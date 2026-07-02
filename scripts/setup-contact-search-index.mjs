#!/usr/bin/env node
/**
 * P38-06 — stored tsvector + GIN index for contact full-text search.
 *
 * Idempotent one-off setup (safe to re-run):
 *   1. adds Contact."searchVector" tsvector if missing
 *   2. creates/replaces the trigger function replicating the exact weighting
 *      in src/server/contact-search.ts (A: fullName/nickname,
 *      B: company/jobTitle, C: notes/department/scalars/JSON multi-values/labels)
 *   3. creates the BEFORE INSERT OR UPDATE trigger on the source columns
 *   4. backfills existing rows in batches of 5000
 *   5. creates the GIN index CONCURRENTLY
 *
 * Deploy order (two-step): run this against the target database BEFORE
 * deploying code that queries "searchVector". `prisma db push` knows the
 * column via the Unsupported("tsvector") field in schema.prisma; the trigger
 * and index are owned by this script and verified by check-schema-drift.mjs.
 *
 * Usage: DATABASE_URL=... node scripts/setup-contact-search-index.mjs
 */

import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const log = (msg) => console.log(`[search-index] ${msg}`);

// Single source of truth for the vector expression (mirrors contact-search.ts).
// `ref` is the row qualifier: NEW (trigger) or c (backfill).
const vectorExpr = (ref) => `
    setweight(to_tsvector('english', coalesce(${ref}."fullName", '') || ' ' || coalesce(${ref}."nickname", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${ref}."company", '') || ' ' || coalesce(${ref}."jobTitle", '')), 'B') ||
    setweight(to_tsvector('english',
      coalesce(${ref}."notes", '') || ' ' || coalesce(${ref}."department", '') || ' ' ||
      coalesce(${ref}."email", '') || ' ' || coalesce(${ref}."phone", '') || ' ' || coalesce(${ref}."address", '') || ' ' ||
      coalesce(${ref}."emailEntries"::text, '') || ' ' || coalesce(${ref}."phoneEntries"::text, '') || ' ' ||
      coalesce(${ref}."addressEntries"::text, '') || ' ' || coalesce(${ref}."postalAddresses"::text, '') || ' ' ||
      coalesce(${ref}."emailAddresses"::text, '') || ' ' || coalesce(${ref}."phoneNumbers"::text, '') || ' ' ||
      coalesce(${ref}."customFields"::text, '') || ' ' ||
      coalesce((SELECT string_agg(val, ' ') FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(${ref}."labels") = 'array' THEN ${ref}."labels" ELSE '[]'::jsonb END) AS val), '')
    ), 'C')`;

const SOURCE_COLUMNS = [
  "fullName", "nickname", "company", "jobTitle", "notes", "department",
  "email", "phone", "address", "emailEntries", "phoneEntries",
  "addressEntries", "postalAddresses", "emailAddresses", "phoneNumbers",
  "customFields", "labels",
];

async function main() {
  log("1/5 column");
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "searchVector" tsvector`,
  );

  log("2/5 trigger function");
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION contact_search_vector_update() RETURNS trigger AS $fn$
    BEGIN
      NEW."searchVector" := ${vectorExpr("NEW")};
      RETURN NEW;
    END
    $fn$ LANGUAGE plpgsql;
  `);

  log("3/5 trigger");
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS contact_search_vector_trigger ON "Contact"`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER contact_search_vector_trigger
    BEFORE INSERT OR UPDATE OF ${SOURCE_COLUMNS.map((c) => `"${c}"`).join(", ")}
    ON "Contact"
    FOR EACH ROW EXECUTE FUNCTION contact_search_vector_update();
  `);

  log("4/5 backfill");
  let total = 0;
  for (;;) {
    const updated = await prisma.$executeRawUnsafe(`
      UPDATE "Contact" c SET "searchVector" = ${vectorExpr("c")}
      WHERE c.id IN (
        SELECT id FROM "Contact" WHERE "searchVector" IS NULL LIMIT 5000
      )
    `);
    total += updated;
    if (updated === 0) break;
    log(`  backfilled ${total} rows…`);
  }
  log(`  backfill complete (${total} rows)`);

  log("5/5 GIN index (CONCURRENTLY)");
  // CONCURRENTLY cannot run inside a transaction — $executeRawUnsafe sends it
  // as a single statement, which Prisma executes without a wrapping tx.
  await prisma.$executeRawUnsafe(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contact_searchVector_idx" ON "Contact" USING GIN ("searchVector")`,
  );

  const [check] = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT count(*) FROM "Contact" WHERE "searchVector" IS NULL) AS remaining_null,
      (SELECT count(*) FROM pg_trigger WHERE tgname = 'contact_search_vector_trigger') AS trigger_ok,
      (SELECT count(*) FROM pg_indexes WHERE indexname = 'Contact_searchVector_idx') AS index_ok
  `);
  log(`verify: null-vectors=${check.remaining_null} trigger=${check.trigger_ok} index=${check.index_ok}`);
  if (check.trigger_ok < 1n || check.index_ok < 1n) {
    throw new Error("verification failed — trigger or index missing");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
