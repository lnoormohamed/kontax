#!/usr/bin/env node
/**
 * P40-05: backfill ContactBookMembership from Contact.bookId.
 *
 * Creates exactly one membership row per existing contact, isPrimary=true,
 * pointing at the contact's current bookId (or the user's default book when
 * bookId is null — the P18-11 migration should already have populated it).
 *
 * Contract (source spec §4 / P40-05):
 *   - Additive: never writes Contact.bookId, never deletes memberships.
 *   - Idempotent: (contactId, addressBookId) is unique and we skipDuplicates,
 *     so a re-run is a no-op.
 *   - ZERO new books: if a contact has no bookId AND its user has no default
 *     book, the contact is skipped and reported — we do not invent a book here
 *     (run scripts/migrate-default-address-books.mjs first if that happens).
 *
 * Run the P18-11 book migration BEFORE this, and this BEFORE any code reads
 * memberships (the P40-06 read cutover) — a contact with no membership would
 * vanish from a membership-based list.
 *
 * Usage:
 *   node scripts/backfill-contact-book-memberships.mjs           # apply
 *   node scripts/backfill-contact-book-memberships.mjs --dry-run # report only
 */
import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 1000;

async function main() {
  // Map each user to their default (isDefault) book, for contacts with null bookId.
  const defaultBooks = await db.addressBook.findMany({
    where: { isDefault: true },
    select: { id: true, userId: true },
  });
  const defaultBookByUser = new Map(defaultBooks.map((b) => [b.userId, b.id]));

  let scanned = 0;
  let created = 0;
  let skippedNoBook = 0;
  let cursor = null;

  for (;;) {
    const contacts = await db.contact.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, userId: true, bookId: true },
    });
    if (contacts.length === 0) break;
    cursor = contacts[contacts.length - 1].id;
    scanned += contacts.length;

    const rows = [];
    for (const contact of contacts) {
      const addressBookId = contact.bookId ?? defaultBookByUser.get(contact.userId);
      if (!addressBookId) {
        skippedNoBook++;
        console.warn(
          `[skip] contact ${contact.id} (user ${contact.userId}) has no bookId and no default book`,
        );
        continue;
      }
      rows.push({ contactId: contact.id, addressBookId, isPrimary: true });
    }

    if (rows.length > 0 && !DRY_RUN) {
      // Unique (contactId, addressBookId) makes this a no-op for rows that
      // already exist, so re-runs and partial prior runs are safe.
      const result = await db.contactBookMembership.createMany({
        data: rows,
        skipDuplicates: true,
      });
      created += result.count;
    } else if (DRY_RUN) {
      created += rows.length; // would-create count under dry run
    }

    console.log(
      `...scanned ${scanned} contact(s), ${created} membership(s) ${DRY_RUN ? "would be " : ""}created`,
    );
  }

  console.log(
    `${DRY_RUN ? "[DRY RUN] " : ""}Done. Contacts scanned: ${scanned}. Memberships ${DRY_RUN ? "to create" : "created"}: ${created}. Skipped (no book): ${skippedNoBook}.`,
  );
  if (skippedNoBook > 0) {
    console.warn(
      `WARNING: ${skippedNoBook} contact(s) skipped. Run scripts/migrate-default-address-books.mjs, then re-run this backfill.`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
