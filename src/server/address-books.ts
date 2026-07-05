import type { AddressBook, Prisma } from "../../generated/prisma";
import { db } from "~/server/db";

/**
 * P40-05: the default book pair seeded for a brand-new account (source spec
 * §4.3 / decision §10.2). Names are renameable by the user; slugs are stable
 * and used in CardDAV paths. "Personal" is the account's default/home book.
 */
export const DEFAULT_BOOK_SEED = [
  { name: "Personal", slug: "personal", isDefault: true },
  { name: "Work", slug: "work", isDefault: false },
] as const;

/**
 * P40-05: seed the Personal + Work book pair for a NEW account.
 *
 * New-accounts-only by contract (source spec §4 / P40-05): if the user already
 * has any AddressBook — an existing account provisioned under P18-11, or a
 * re-run — this is a no-op, so we never create a book next to ones the user
 * already named. Idempotent and safe to call inside the registration flow.
 *
 * Accepts a client/transaction so it can enlist in the signup transaction.
 */
export async function seedDefaultBooksForNewUser(
  userId: string,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<void> {
  const existing = await client.addressBook.count({ where: { userId } });
  if (existing > 0) return;

  await client.addressBook.createMany({
    data: DEFAULT_BOOK_SEED.map((book) => ({ userId, ...book })),
    skipDuplicates: true,
  });
}

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
