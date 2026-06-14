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

/**
 * Returns the ids of the user's contacts matching `q`, with a relevance rank
 * (higher = better). Empty when the query isn't full-text eligible.
 */
export async function searchContactIds(
  userId: string,
  q: string,
  limit = 1000,
): Promise<{ id: string; rank: number }[]> {
  const tsq = buildTsQuery(q);
  if (!tsq) return [];

  const rows = await db.$queryRaw<{ id: string; rank: number }[]>`
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
          coalesce("customFields"::text, '')
        ), 'C') AS vec
      FROM "Contact"
      WHERE "userId" = ${userId}
    )
    SELECT id, ts_rank(vec, to_tsquery('english', ${tsq})) AS rank
    FROM scored
    WHERE vec @@ to_tsquery('english', ${tsq})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({ id: r.id, rank: Number(r.rank) }));
}
