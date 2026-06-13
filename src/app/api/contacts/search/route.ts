import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getUserFamilyMembership } from "~/server/family-access";
import { getAccessibleTeamBooks } from "~/server/team-access";

// P24B-22: contacts search for the mobile search overlay. Returns up to 25
// matches across the same set the list shows (owned + shared family/team books),
// matched on name / company / email / phone / nickname.
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

  const insensitive = { contains: q, mode: "insensitive" as const };
  const matchConditions = [
    { fullName: insensitive },
    { company: insensitive },
    { email: insensitive },
    { nickname: insensitive },
    { phone: { contains: q } },
  ];

  const contacts = await db.contact.findMany({
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
        { OR: matchConditions },
      ],
    },
    select: { id: true, fullName: true, company: true, email: true, phone: true },
    orderBy: { fullName: "asc" },
    take: 25,
  });

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
