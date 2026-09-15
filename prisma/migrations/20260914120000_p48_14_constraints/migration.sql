-- P48-14 — unique constraints on capability/identity columns + SetNull admin
-- actor cascades.
--
-- ============================================================================
-- OPERATOR PRE-CHECK — RUN BEFORE DEPLOYING THIS MIGRATION
-- ============================================================================
-- The four CREATE UNIQUE INDEX statements below will ABORT the migration (and
-- therefore the deploy) if the live data already contains duplicates. Run
--
--     npm run db:precheck:p48-14
--     (= node scripts/precheck-p48-14-uniqueness.mjs — read-only)
--
-- against production and staging first; it runs exactly the queries below and
-- exits non-zero if anything would collide. Reconcile any duplicates (for sync
-- lineage there is `npm run backfill:sync-lineage`) and re-run until clean.
--
--   -- Users sharing an iCal feed token:
--   SELECT "calToken", count(*) FROM "User"
--    WHERE "calToken" IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
--
--   -- Sync connections sharing a logical connection identity:
--   SELECT "connectionId", count(*) FROM "SyncAccount"
--    WHERE "connectionId" IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
--
--   -- One predecessor superseded by more than one replacement:
--   SELECT "replacesSyncAccountId", count(*) FROM "SyncAccount"
--    WHERE "replacesSyncAccountId" IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
--
--   -- One replacement claimed by more than one predecessor:
--   SELECT "replacedBySyncAccountId", count(*) FROM "SyncAccount"
--    WHERE "replacedBySyncAccountId" IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
--
-- NOTE ON NULLS: all four columns are nullable and Postgres permits unlimited
-- NULLs in a plain unique index, so rows that predate these columns are never
-- in conflict. No partial index is required.
-- ============================================================================

-- DropForeignKey
ALTER TABLE "AdminAuditEvent" DROP CONSTRAINT "AdminAuditEvent_adminUserId_fkey";

-- DropForeignKey
ALTER TABLE "AdminSupportNote" DROP CONSTRAINT "AdminSupportNote_adminUserId_fkey";

-- DropForeignKey
ALTER TABLE "AdminSupportCase" DROP CONSTRAINT "AdminSupportCase_creatorAdminUserId_fkey";

-- DropForeignKey
ALTER TABLE "AdminBroadcast" DROP CONSTRAINT "AdminBroadcast_createdByAdminUserId_fkey";

-- DropIndex (each is superseded by the UNIQUE index created below)
DROP INDEX "User_calToken_idx";

-- DropIndex
DROP INDEX "SyncAccount_connectionId_idx";

-- DropIndex
DROP INDEX "SyncAccount_replacesSyncAccountId_idx";

-- DropIndex
DROP INDEX "SyncAccount_replacedBySyncAccountId_idx";

-- AlterTable
ALTER TABLE "AdminAuditEvent" ADD COLUMN     "adminEmail" TEXT,
ALTER COLUMN "adminUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AdminSupportNote" ADD COLUMN     "adminEmail" TEXT,
ALTER COLUMN "adminUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AdminSupportCase" ADD COLUMN     "creatorAdminEmail" TEXT,
ALTER COLUMN "creatorAdminUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AdminBroadcast" ADD COLUMN     "createdByAdminEmail" TEXT,
ALTER COLUMN "createdByAdminUserId" DROP NOT NULL;

-- Backfill the denormalised actor emails for rows written before this
-- migration, while the actor rows are still joinable. New writes populate the
-- column directly (src/server/admin/audit.ts, src/server/admin/broadcasts.ts,
-- src/app/actions/admin.ts).
UPDATE "AdminAuditEvent" e
   SET "adminEmail" = u."email"
  FROM "User" u
 WHERE e."adminUserId" = u."id" AND e."adminEmail" IS NULL;

UPDATE "AdminSupportNote" n
   SET "adminEmail" = u."email"
  FROM "User" u
 WHERE n."adminUserId" = u."id" AND n."adminEmail" IS NULL;

UPDATE "AdminSupportCase" c
   SET "creatorAdminEmail" = u."email"
  FROM "User" u
 WHERE c."creatorAdminUserId" = u."id" AND c."creatorAdminEmail" IS NULL;

UPDATE "AdminBroadcast" b
   SET "createdByAdminEmail" = u."email"
  FROM "User" u
 WHERE b."createdByAdminUserId" = u."id" AND b."createdByAdminEmail" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_calToken_key" ON "User"("calToken");

-- CreateIndex
CREATE UNIQUE INDEX "SyncAccount_connectionId_key" ON "SyncAccount"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncAccount_replacesSyncAccountId_key" ON "SyncAccount"("replacesSyncAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncAccount_replacedBySyncAccountId_key" ON "SyncAccount"("replacedBySyncAccountId");

-- AddForeignKey
ALTER TABLE "AdminAuditEvent" ADD CONSTRAINT "AdminAuditEvent_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSupportNote" ADD CONSTRAINT "AdminSupportNote_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSupportCase" ADD CONSTRAINT "AdminSupportCase_creatorAdminUserId_fkey" FOREIGN KEY ("creatorAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminBroadcast" ADD CONSTRAINT "AdminBroadcast_createdByAdminUserId_fkey" FOREIGN KEY ("createdByAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
