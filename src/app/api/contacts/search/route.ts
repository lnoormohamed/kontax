import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  getOrderedNameSearchQueries,
  isFullTextEligible,
  searchContactIds,
  searchLabelIlikeIds,
} from "~/server/contact-search";
import { getUserFamilyMembership } from "~/server/family-access";
import { getAccessibleTeamBooks } from "~/server/team-access";

// P33-01: extended to include fields needed for matchField + snippet attribution.
const RESULT_SELECT = {
  id: true,
  fullName: true,
  nickname: true,
  company: true,
  email: true,
  phone: true,
  phoneEntries: true,
  labels: true,
  notes: true,
  avatarUrl: true,
} as const;

export type MatchField = "name" | "company" | "email" | "phone" | "label" | "notes";

export type SearchResult = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  labels: string[];
  avatarUrl: string | null;
  matchField: MatchField;
  snippet: string | null;
  matchAlt: boolean; // true when the phone match was on a secondary number
};

type PhoneEntry = { label: string; value: string; isPrimary: boolean };

function safeLabels(raw: unknown): string[] {
  return Array.isArray(raw) ? (raw as unknown[]).filter((v): v is string => typeof v === "string") : [];
}

function safePhoneEntries(raw: unknown): PhoneEntry[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter(
    (e): e is PhoneEntry =>
      typeof e === "object" && e !== null && "value" in e && typeof (e as PhoneEntry).value === "string",
  );
}

// Returns a windowed excerpt of `notes` centered on the first occurrence of `ql`.
function notesExcerpt(notes: string, ql: string, win = 100): string {
  const i = notes.toLowerCase().indexOf(ql);
  if (i < 0) return notes.slice(0, win);
  let start = Math.max(0, i - 30);
  if (start > 0) {
    const sp = notes.indexOf(" ", start);
    if (sp > -1 && sp < i) start = sp + 1;
  }
  let end = Math.min(notes.length, start + win);
  if (end < notes.length) {
    const sp = notes.lastIndexOf(" ", end);
    if (sp > start + 20) end = sp;
  }
  return (start > 0 ? "…" : "") + notes.slice(start, end).trim() + (end < notes.length ? "…" : "");
}

type ContactRow = Awaited<ReturnType<typeof db.contact.findMany<{ select: typeof RESULT_SELECT }>>>[number];

// Priority order mirrors the spec's FIELDS: name → company → email → phone → label → notes.
// A contact is attributed to the first (highest-priority) field whose value contains the query.
function attributeMatch(
  c: ContactRow,
  q: string,
): { matchField: MatchField; snippet: string | null; matchAlt: boolean } {
  const ql = q.toLowerCase();
  const nameQueries = getOrderedNameSearchQueries(q).map((query) => query.toLowerCase());
  const digits = q.replace(/\D/g, "");
  const isPhoneQuery = !/[a-z]/i.test(q) && digits.length >= 2;
  const nameValueMatches = (value: string | null | undefined) =>
    nameQueries.some((query) => (value ?? "").toLowerCase().includes(query));

  if (!isPhoneQuery) {
    if (nameValueMatches(c.fullName) || nameValueMatches(c.nickname)) {
      return { matchField: "name", snippet: null, matchAlt: false };
    }
    if (c.company?.toLowerCase().includes(ql)) {
      return { matchField: "company", snippet: c.company, matchAlt: false };
    }
    if (c.email?.toLowerCase().includes(ql)) {
      return { matchField: "email", snippet: c.email, matchAlt: false };
    }
  }

  if (digits.length >= 2) {
    if (c.phone?.replace(/\D/g, "").includes(digits)) {
      return { matchField: "phone", snippet: c.phone, matchAlt: false };
    }
    const entries = safePhoneEntries(c.phoneEntries);
    const altEntry = entries.find((e) => e.value.replace(/\D/g, "").includes(digits));
    if (altEntry) {
      return { matchField: "phone", snippet: altEntry.value, matchAlt: true };
    }
  }

  if (!isPhoneQuery) {
    const labels = safeLabels(c.labels);
    const matchedLabel = labels.find((l) => l.toLowerCase().includes(ql));
    if (matchedLabel) {
      return { matchField: "label", snippet: matchedLabel, matchAlt: false };
    }
    if (c.notes?.toLowerCase().includes(ql)) {
      return { matchField: "notes", snippet: notesExcerpt(c.notes, ql), matchAlt: false };
    }
  }

  // Fallback: FTS matched but our per-field scan didn't find a hit (rare edge case
  // e.g. multi-value JSON field match). Attribute to name so the row renders cleanly.
  return { matchField: "name", snippet: null, matchAlt: false };
}

// P24B-22 / P28-07 / P33-01: contacts search. Full-text + phone-number matching
// across the user's own contacts + accessible shared books, with matchField + snippet
// attribution so the client can group results and show why a contact matched.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ results: [] }, { status: 401 });
  }
  const userId = session.user.id;

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const [familyMembership, accessibleTeamBooks] = await Promise.all([
    getUserFamilyMembership(userId),
    getAccessibleTeamBooks(userId),
  ]);
  const accessibleBookIds = [
    familyMembership?.bookId,
    ...accessibleTeamBooks.map((b) => b.id),
  ].filter((bookId): bookId is string => Boolean(bookId));

  let contacts: ContactRow[] = [];

  if (isFullTextEligible(q)) {
    // Full-text + phone match over both scopes, ranked.
    const [priv, shared] = await Promise.all([
      searchContactIds({ userId }, q),
      accessibleBookIds.length > 0
        ? searchContactIds({ groupBookIds: accessibleBookIds }, q)
        : Promise.resolve([]),
    ]);
    const rankById = new Map<string, number>();
    for (const r of [...priv, ...shared]) {
      rankById.set(r.id, Math.max(rankById.get(r.id) ?? 0, r.rank));
    }
    const ids = [...rankById.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([id]) => id);

    const rows = ids.length
      ? await db.contact.findMany({
          where: { id: { in: ids }, archivedAt: null },
          select: RESULT_SELECT,
        })
      : [];
    // Preserve relevance order (findMany doesn't guarantee it).
    const byId = new Map(rows.map((r) => [r.id, r]));
    contacts = ids.map((id) => byId.get(id)).filter((r): r is (typeof rows)[number] => Boolean(r));
  }

  if (contacts.length === 0) {
    // FTS returned nothing (or query wasn't FTS-eligible): fall back to ILIKE.
    // This catches cases like "corp.com" where FTS tokenization splits the email
    // differently than the stored tsvector, and short single-char queries.
    const insensitive = { contains: q, mode: "insensitive" as const };
    const scopeOr = [
      { userId },
      ...(accessibleBookIds.length > 0
        ? [{ groupContacts: { some: { groupAddressBookId: { in: accessibleBookIds } } } }]
        : []),
    ];
    // Also collect contacts matched only by label text.
    const [ilikeContacts, privLabelIds, sharedLabelIds] = await Promise.all([
      db.contact.findMany({
        where: {
          archivedAt: null,
          AND: [
            { OR: scopeOr },
            {
              OR: [
                { fullName: insensitive },
                { company: insensitive },
                { email: insensitive },
                { nickname: insensitive },
                { phone: { contains: q } },
              ],
            },
          ],
        },
        select: RESULT_SELECT,
        orderBy: { fullName: "asc" },
        take: 25,
      }),
      searchLabelIlikeIds({ userId }, q),
      accessibleBookIds.length > 0
        ? searchLabelIlikeIds({ groupBookIds: accessibleBookIds }, q)
        : Promise.resolve([]),
    ]);
    const labelIdRows = [...privLabelIds, ...sharedLabelIds];

    // Merge label-matched ids with ILIKE results, fetching any missing contacts.
    const ilikeIds = new Set(ilikeContacts.map((c) => c.id));
    const extraIds = labelIdRows.filter((id) => !ilikeIds.has(id));
    if (extraIds.length > 0) {
      const extra = await db.contact.findMany({
        where: { id: { in: extraIds }, archivedAt: null },
        select: RESULT_SELECT,
        orderBy: { fullName: "asc" },
      });
      contacts = [...ilikeContacts, ...extra];
    } else {
      contacts = ilikeContacts;
    }
  }

  const results: SearchResult[] = contacts.map((c) => {
    const { matchField, snippet, matchAlt } = attributeMatch(c, q);
    return {
      id: c.id,
      name: c.fullName,
      company: c.company,
      email: c.email,
      phone: c.phone,
      labels: safeLabels(c.labels),
      avatarUrl: c.avatarUrl,
      matchField,
      snippet,
      matchAlt,
    };
  });

  return NextResponse.json({ results });
}
