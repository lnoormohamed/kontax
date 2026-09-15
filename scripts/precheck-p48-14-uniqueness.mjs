// P48-14: READ-ONLY pre-flight for the p48_14_constraints migration.
//
// That migration adds four UNIQUE indexes. Postgres builds a unique index in a
// single statement that ABORTS if the existing rows already violate it — which
// would fail `prisma migrate deploy` and, because a non-zero exit kills the
// container, crash-loop the deploy. Run this against production and staging
// BEFORE deploying:
//
//     DATABASE_URL=… npm run db:precheck:p48-14
//
// Exit codes: 0 = safe to migrate · 1 = duplicates found (reconcile first)
//             2 = the check itself failed (treat as "not cleared").
//
// This script only SELECTs. It never writes.
//
// NULLs are not duplicates: Postgres allows unlimited NULLs in a unique index,
// so legacy rows that never got a token / connectionId are irrelevant here and
// every query below filters them out.
import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

/** Each check reports the duplicate values and how to reconcile them. */
const CHECKS = [
  {
    label: 'User."calToken" (iCal feed bearer token)',
    constraint: "User_calToken_key",
    query: () => db.$queryRaw`
      SELECT "calToken" AS value, count(*)::int AS count
        FROM "User"
       WHERE "calToken" IS NOT NULL
       GROUP BY "calToken"
      HAVING count(*) > 1
       ORDER BY count(*) DESC
       LIMIT 50`,
    remedy:
      'Two accounts share a calendar token — a live credential leak, not just a constraint problem. Rotate the token on all but one row (UPDATE "User" SET "calToken" = NULL WHERE id = …; the owner can re-generate it from Settings) and notify security.',
  },
  {
    label: 'SyncAccount."connectionId" (stable logical connection identity)',
    constraint: "SyncAccount_connectionId_key",
    query: () => db.$queryRaw`
      SELECT "connectionId" AS value, count(*)::int AS count
        FROM "SyncAccount"
       WHERE "connectionId" IS NOT NULL
       GROUP BY "connectionId"
      HAVING count(*) > 1
       ORDER BY count(*) DESC
       LIMIT 50`,
    remedy:
      "A connectionId must map to exactly one SyncAccount row. Null out the duplicates on the newer rows and re-run `npm run backfill:sync-lineage`, which mints a fresh cuid2 for every row still missing one.",
  },
  {
    label: 'SyncAccount."replacesSyncAccountId" (lineage: predecessor link)',
    constraint: "SyncAccount_replacesSyncAccountId_key",
    query: () => db.$queryRaw`
      SELECT "replacesSyncAccountId" AS value, count(*)::int AS count
        FROM "SyncAccount"
       WHERE "replacesSyncAccountId" IS NOT NULL
       GROUP BY "replacesSyncAccountId"
      HAVING count(*) > 1
       ORDER BY count(*) DESC
       LIMIT 50`,
    remedy:
      "One retired connection is claimed as the predecessor of more than one replacement — replaceSyncAccountWithNewConnection refuses to replace an already-RETIRED account, so this means rows were written outside that path. Keep the link on the replacement the predecessor's replacedBySyncAccountId points at and null the others.",
  },
  {
    label: 'SyncAccount."replacedBySyncAccountId" (lineage: successor link)',
    constraint: "SyncAccount_replacedBySyncAccountId_key",
    query: () => db.$queryRaw`
      SELECT "replacedBySyncAccountId" AS value, count(*)::int AS count
        FROM "SyncAccount"
       WHERE "replacedBySyncAccountId" IS NOT NULL
       GROUP BY "replacedBySyncAccountId"
      HAVING count(*) > 1
       ORDER BY count(*) DESC
       LIMIT 50`,
    remedy:
      "One replacement is claimed as the successor of more than one retired connection. Keep the link whose replacesSyncAccountId points back at it and null the others.",
  },
];

async function main() {
  console.log("[p48-14 precheck] Read-only uniqueness check for the constraints migration.\n");

  let blocking = 0;

  for (const check of CHECKS) {
    const rows = await check.query();
    if (rows.length === 0) {
      console.log(`  OK    ${check.label}`);
      continue;
    }
    blocking += rows.length;
    console.log(`  DUPES ${check.label}`);
    console.log(`        would violate: ${check.constraint}`);
    for (const row of rows) {
      console.log(`          ${String(row.value)} — ${row.count} rows`);
    }
    console.log(`        fix: ${check.remedy}`);
  }

  console.log("");
  if (blocking > 0) {
    console.error(
      `[p48-14 precheck] BLOCKED — ${blocking} duplicate value(s) across the checks above.`,
    );
    console.error(
      "[p48-14 precheck] Do NOT deploy the p48_14_constraints migration until this reports clean; the CREATE UNIQUE INDEX would abort the deploy.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("[p48-14 precheck] CLEAR — no duplicates. Safe to run `prisma migrate deploy`.");
}

main()
  .catch((err) => {
    console.error("[p48-14 precheck] Check failed — treat as NOT cleared:", err);
    process.exitCode = 2;
  })
  .finally(() => {
    void db.$disconnect();
  });
