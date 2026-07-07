#!/usr/bin/env node
/**
 * Reconcile legacy single-book accounts to the P40-05 Personal + Work model.
 *
 * Background: `seedDefaultBooksForNewUser` (src/server/address-books.ts) gives
 * every NEW account a "Personal" (default) + "Work" pair. But accounts created
 * before that shipped — and any account touched by the older
 * `migrate-default-address-books.mjs` — instead have a single auto-generated
 * "All Contacts" / slug "default" book. This script brings those into line:
 *
 *   "All Contacts" (slug "default", isDefault) --> renamed to "Personal"
 *                                                  (slug "personal", isDefault)
 *   + a new "Work" (slug "work") book
 *
 * Safe by construction:
 *   - Only touches the UNTOUCHED migration artifact (name "All Contacts",
 *     slug "default", isDefault=true). A default book the user renamed is left
 *     alone and reported for manual review.
 *   - Adds "Work" only if no book with slug "work" already exists.
 *   - Contacts keep their bookId (the book row is renamed in place), so no
 *     contact is moved or orphaned.
 *   - Slug change default->personal is safe: no code resolves books by that
 *     slug (the default book is found via isDefault), and getUserDefaultBook
 *     returns the isDefault book first.
 *   - Idempotent: an account already on Personal+Work is skipped.
 *
 * Usage:
 *   node scripts/reconcile-books-to-personal-work.mjs            # dry run (default)
 *   node scripts/reconcile-books-to-personal-work.mjs --apply    # write changes
 */
import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const ARTIFACT = { name: "All Contacts", slug: "default" };
const PERSONAL = { name: "Personal", slug: "personal" };
const WORK = { name: "Work", slug: "work" };

async function main() {
  const users = await db.user.findMany({ select: { id: true, email: true } });
  let converted = 0;
  let alreadyOk = 0;
  let skippedCustom = 0;
  let noBooks = 0;

  for (const user of users) {
    const books = await db.addressBook.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, slug: true, isDefault: true },
    });

    if (books.length === 0) {
      noBooks++;
      console.log(`[no-books]  ${user.email} — has zero books (run the migration/seed instead)`);
      continue;
    }

    const hasPersonal = books.some((b) => b.slug === PERSONAL.slug || (b.isDefault && b.name === PERSONAL.name));
    const hasWork = books.some((b) => b.slug === WORK.slug);
    if (hasPersonal && hasWork) {
      alreadyOk++;
      continue;
    }

    const artifact = books.find(
      (b) => b.slug === ARTIFACT.slug && b.name === ARTIFACT.name && b.isDefault,
    );
    if (!artifact) {
      skippedCustom++;
      console.log(
        `[skip]      ${user.email} — no untouched "All Contacts"/default book; books: ${books
          .map((b) => `${b.name}/${b.slug}${b.isDefault ? "*" : ""}`)
          .join(", ")}`,
      );
      continue;
    }

    const willAddWork = !hasWork;
    console.log(
      `[convert]   ${user.email} — rename "${artifact.name}"/${artifact.slug} -> Personal/personal` +
        (willAddWork ? " + add Work/work" : " (Work already present)"),
    );

    if (APPLY) {
      await db.$transaction(async (tx) => {
        await tx.addressBook.update({
          where: { id: artifact.id },
          data: { name: PERSONAL.name, slug: PERSONAL.slug, isDefault: true },
        });
        if (willAddWork) {
          await tx.addressBook.create({
            data: { userId: user.id, name: WORK.name, slug: WORK.slug, isDefault: false },
          });
        }
      });
    }
    converted++;
  }

  console.log(
    `\n${APPLY ? "APPLIED" : "DRY RUN"} — convert: ${converted}, already Personal+Work: ${alreadyOk}, ` +
      `skipped (custom): ${skippedCustom}, no books: ${noBooks}, total users: ${users.length}`,
  );
  if (!APPLY) console.log("Re-run with --apply to write these changes.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
