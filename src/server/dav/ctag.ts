import { db } from "~/server/db";

// CTag must change whenever ANY contact changes — including tombstoned/archived ones —
// so that clients know to re-fetch and discover deletions. Filtering out tombstoned
// contacts here would cause clients to miss delete events entirely.
export const computeAddressBookCTag = async (userId: string) => {
  const mostRecent = await db.contact.findFirst({
    where: {
      userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      updatedAt: true,
    },
  });

  return mostRecent?.updatedAt.toISOString() ?? "empty";
};
