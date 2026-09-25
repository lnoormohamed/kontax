-- P49A-05 — 7-day notice before a lapsed Family group dissolves.
--
-- Purely additive: one nullable column. When a Family owner's plan lapses the
-- webhook stamps "familyDissolveAt" = now + 7 days instead of removing members
-- at once; the nightly sweep (/api/cron/delete-accounts) dissolves groups whose
-- date has passed. NULL for every existing row, so no backfill.
--
-- IF NOT EXISTS so the migration applies cleanly to any environment
-- (production runs KONTAX_SCHEMA_MODE=validate and is migrated out of band —
-- see roadmap/runbooks/deploy.md).

ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "familyDissolveAt" TIMESTAMP(3);
