#!/usr/bin/env node
/**
 * P18-11: Create a default AddressBook for every user and backfill Contact.bookId.
 * Idempotent — safe to re-run.
 *
 * Usage: node scripts/migrate-default-address-books.mjs
 */
import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany({ select: { id: true } });
  console.log(`Migrating ${users.length} user(s)...`);

  let created = 0;
  let backfilled = 0;

  for (const user of users) {
    const book = await db.addressBook.upsert({
      where: { userId_slug: { userId: user.id, slug: "default" } },
      update: {},
      create: {
        userId: user.id,
        name: "All Contacts",
        slug: "default",
        isDefault: true,
      },
    });

    const result = await db.contact.updateMany({
      where: { userId: user.id, bookId: null },
      data: { bookId: book.id },
    });

    if (result.count > 0) {
      backfilled += result.count;
      created++;
    }
  }

  console.log(`Done. Books created/ensured: ${users.length}. Contacts backfilled: ${backfilled}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
