import { Prisma } from "../../generated/prisma";
import { db } from "~/server/db";

/**
 * P28-07 — full-text contact search.
 *
 * Computes a weighted `tsvector` at query time (no stored column / GIN index —
 * see the ticket's deploy-safety note: `db push` on startup can't model a
 * GENERATED tsvector column without risking schema drift). The match is scoped
 * to one user's own contacts, so the per-query sequential scan stays bounded.
 *
 * Searchable, in descending weight:
 *   A — fullName, nickname
 *   B — company, jobTitle
 *   C — notes, department, scalar email/phone/address, and the JSON multi-value
 *       columns (emails/phones/addresses/custom fields) cast to text so their
 *       values are tokenised (e.g. an email like "jane@acme.co" stays one token).
 */

// Lower-cased alphanumeric terms (Unicode-aware). Strips punctuation, so
// "@acme.com" → ["acme", "com"] which still prefix-matches the email token.
const sanitizeTerms = (q: string): string[] =>
  q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0);

/**
 * Build a prefix `tsquery` string ("acme:* & corp:*") from raw user input, or
 * null when there's nothing worth a full-text pass (caller falls back to ILIKE).
 */
export function buildTsQuery(q: string): string | null {
  const terms = sanitizeTerms(q);
  if (terms.length === 0) return null;
  // Single-character queries are better served by the ILIKE prefix path.
  if (terms.join("").length < 2) return null;
  return terms.map((t) => `${t}:*`).join(" & ");
}

export const isFullTextEligible = (q: string): boolean => buildTsQuery(q) !== null;

// Phone search is a separate concern from text FTS: phone numbers are stored with
// spaces/punctuation (e.g. "+44 7882 539146"), which to_tsvector splits into
// multiple tokens, and tsquery only prefix-matches — so a mid-number fragment
// ("78825") or the un-spaced full number ("+447882539146") never matches. We
// instead strip both sides to digits and do a substring match.
const looksLikePhone = (q: string): boolean => /^[+(]?\d[\d\s()+.\-]*$/.test(q.trim());

/** Digits of `q` when it looks like a phone number, else "" (disables phone match). */
const phoneDigits = (q: string): string => (looksLikePhone(q) ? q.replace(/\D/g, "") : "");

/**
 * Search scope: either a user's own contacts, or the contacts of a set of
 * shared (group) address books. Same FTS + phone matching applies to both.
 */
export type SearchScope = { userId: string } | { groupBookIds: string[] };

/**
 * Returns the ids of the in-scope contacts matching `q`, with a relevance rank
 * (higher = better). Empty when the query isn't full-text eligible and isn't a
 * phone number.
 */
export async function searchContactIds(
  scope: SearchScope,
  q: string,
  limit = 1000,
): Promise<{ id: string; rank: number }[]> {
  // Group scope with no books can't match anything.
  if ("groupBookIds" in scope && scope.groupBookIds.length === 0) return [];

  const tsq = buildTsQuery(q);
  const digits = phoneDigits(q); // "" unless the query looks like a phone number
  // Nothing to search on (too short / symbol-only and not a phone number).
  if (!tsq && digits.length < 3) return [];
  // A phone-only query may not be text-eligible; a tsquery that matches nothing
  // keeps the SQL shape uniform so the phone branch can still run.
  const tsqParam = tsq ?? "x0x0x0nomatch0x0x0:*";

  const scopeWhere =
    "userId" in scope
      ? Prisma.sql`"userId" = ${scope.userId}`
      : Prisma.sql`id IN (SELECT "contactId" FROM "GroupContact" WHERE "groupAddressBookId" IN (${Prisma.join(scope.groupBookIds)}))`;

  const rows = await db.$queryRaw<{ id: string; rank: number }[]>(Prisma.sql`
    WITH scored AS (
      SELECT
        id,
        setweight(to_tsvector('english', coalesce("fullName", '') || ' ' || coalesce("nickname", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("company", '') || ' ' || coalesce("jobTitle", '')), 'B') ||
        setweight(to_tsvector('english',
          coalesce("notes", '') || ' ' || coalesce("department", '') || ' ' ||
          coalesce("email", '') || ' ' || coalesce("phone", '') || ' ' || coalesce("address", '') || ' ' ||
          coalesce("emailEntries"::text, '') || ' ' || coalesce("phoneEntries"::text, '') || ' ' ||
          coalesce("addressEntries"::text, '') || ' ' || coalesce("postalAddresses"::text, '') || ' ' ||
          coalesce("emailAddresses"::text, '') || ' ' || coalesce("phoneNumbers"::text, '') || ' ' ||
          coalesce("customFields"::text, '') || ' ' ||
          coalesce((SELECT string_agg(val, ' ') FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof("labels") = 'array' THEN "labels" ELSE '[]'::jsonb END) AS val), '')
        ), 'C') AS vec,
        -- all phone sources stripped to digits, for substring matching
        regexp_replace(
          coalesce("phone", '') || ' ' || coalesce("phoneNumbers"::text, '') || ' ' || coalesce("phoneEntries"::text, ''),
          '[^0-9]', '', 'g'
        ) AS phone_digits
      FROM "Contact"
      WHERE ${scopeWhere}
    )
    SELECT
      id,
      GREATEST(
        ts_rank(vec, to_tsquery('english', ${tsqParam})),
        CASE WHEN length(${digits}) >= 3 AND phone_digits LIKE '%' || ${digits} || '%' THEN 1.0 ELSE 0 END
      ) AS rank
    FROM scored
    WHERE vec @@ to_tsquery('english', ${tsqParam})
       OR (length(${digits}) >= 3 AND phone_digits LIKE '%' || ${digits} || '%')
    ORDER BY rank DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({ id: r.id, rank: Number(r.rank) }));
}

/**
 * Returns contact ids whose labels jsonb array contains an element matching
 * the query case-insensitively. Used as a fallback supplement in the ILIKE
 * path so label-only searches (e.g. "VIP") still work when the tsvector is
 * cold (newly added label not yet reflected).
 */
export async function searchLabelIlikeIds(
  scope: SearchScope,
  q: string,
): Promise<string[]> {
  if ("groupBookIds" in scope && scope.groupBookIds.length === 0) return [];

  const scopeWhere =
    "userId" in scope
      ? Prisma.sql`"userId" = ${scope.userId}`
      : Prisma.sql`id IN (SELECT "contactId" FROM "GroupContact" WHERE "groupAddressBookId" IN (${Prisma.join(scope.groupBookIds)}))`;

  const likeParam = `%${q}%`;
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM "Contact"
    WHERE "archivedAt" IS NULL
      AND ${scopeWhere}
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof("labels") = 'array' THEN "labels" ELSE '[]'::jsonb END
        ) AS lbl
        WHERE lbl ILIKE ${likeParam}
      )
    LIMIT 25
  `);
  return rows.map((r) => r.id);
}
