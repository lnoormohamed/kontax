#!/usr/bin/env node
/**
 * P18-11 / P40-05: ensure every user has the default book pair and no contact is
 * left without a book.
 *
 * For any user with ZERO address books, seed the P40-05 pair — "Personal"
 * (default) + "Work" — matching seedDefaultBooksForNewUser in
 * src/server/address-books.ts. Then backfill any bookId-less contacts into that
 * user's default (Personal) book. Idempotent — safe to re-run.
 *
 * NOTE: this only creates books for accounts that have NONE. Accounts that still
 * carry the older single "All Contacts"/"default" book are converted separately
 * by scripts/reconcile-books-to-personal-work.mjs.
 *
 * Usage: node scripts/migrate-default-address-books.mjs
 */
import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

// Mirror of DEFAULT_BOOK_SEED (src/server/address-books.ts). "Personal" is the
// account's default/home book; slugs are stable and used in CardDAV paths.
const DEFAULT_BOOK_SEED = [
  { name: "Personal", slug: "personal", isDefault: true },
  { name: "Work", slug: "work", isDefault: false },
];

async function main() {
  const users = await db.user.findMany({ select: { id: true } });
  console.log(`Checking ${users.length} user(s)...`);

  let seeded = 0;
  let backfilled = 0;

  for (const user of users) {
    const existing = await db.addressBook.count({ where: { userId: user.id } });
    if (existing === 0) {
      await db.addressBook.createMany({
        data: DEFAULT_BOOK_SEED.map((book) => ({ userId: user.id, ...book })),
        skipDuplicates: true,
      });
      seeded++;
    }

    // Backfill any contacts without a book into the user's default book.
    const orphans = await db.contact.count({ where: { userId: user.id, bookId: null } });
    if (orphans > 0) {
      const defaultBook = await db.addressBook.findFirst({
        where: { userId: user.id, isDefault: true },
        select: { id: true },
      });
      if (defaultBook) {
        const result = await db.contact.updateMany({
          where: { userId: user.id, bookId: null },
          data: { bookId: defaultBook.id },
        });
        backfilled += result.count;
      }
    }
  }

  console.log(`Done. Users seeded with Personal+Work: ${seeded}. Contacts backfilled: ${backfilled}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
