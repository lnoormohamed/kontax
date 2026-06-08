import { db } from "~/server/db";

export const computeAddressBookCTag = async (userId: string) => {
  const mostRecent = await db.contact.findFirst({
    where: {
      userId,
      archivedAt: null,
      syncTombstoneAt: null,
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
