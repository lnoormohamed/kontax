import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { isFullTextEligible, searchContactIds } from "~/server/contact-search";
import { getUserFamilyMembership } from "~/server/family-access";
import { getAccessibleTeamBooks } from "~/server/team-access";

const RESULT_SELECT = { id: true, fullName: true, company: true, email: true, phone: true } as const;

// P24B-22 / P28-07: contacts search for the mobile search overlay. Uses the same
// full-text + phone-number search as the desktop list (so phone fragments, notes,
// and multi-value fields all match), across the user's own contacts + the shared
// family/team books they can see. Falls back to multi-field ILIKE for short /
// symbol-only queries that aren't full-text eligible.
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

  let contacts: { id: string; fullName: string; company: string | null; email: string | null; phone: string | null }[];

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
  } else {
    // Short / symbol-only query: multi-field ILIKE fallback.
    const insensitive = { contains: q, mode: "insensitive" as const };
    contacts = await db.contact.findMany({
      where: {
        archivedAt: null,
        AND: [
          {
            OR: [
              { userId },
              ...(accessibleBookIds.length > 0
                ? [{ groupContacts: { some: { groupAddressBookId: { in: accessibleBookIds } } } }]
                : []),
            ],
          },
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
    });
  }

  return NextResponse.json({
    results: contacts.map((c) => ({
      id: c.id,
      name: c.fullName,
      company: c.company,
      email: c.email,
      phone: c.phone,
    })),
  });
}
