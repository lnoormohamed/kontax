import type { AddressBook } from "../../generated/prisma";
import { db } from "~/server/db";

/**
 * Returns the user's default AddressBook, creating it if it doesn't exist.
 * Covers the window between user creation and the backfill script running.
 */
export async function getUserDefaultBook(userId: string): Promise<AddressBook> {
  const existing = await db.addressBook.findFirst({
    where: { userId, isDefault: true },
  });
  if (existing) return existing;

  return db.addressBook.upsert({
    where: { userId_slug: { userId, slug: "default" } },
    update: {},
    create: { userId, name: "All Contacts", slug: "default", isDefault: true },
  });
}
