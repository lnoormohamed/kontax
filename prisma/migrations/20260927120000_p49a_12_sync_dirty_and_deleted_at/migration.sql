-- P49A-12 — deletes, merges and non-web edits propagate to sync providers.
--
-- Purely additive: two nullable columns and one index. NULL for every existing
-- row, so no backfill is needed:
--   * "SyncContactLink"."localDirtyAt" — the per-link "dirty since last sync"
--     marker. The Google / Outlook push also still picks up a link whose
--     contact was last written by a non-sync writer after the link last synced
--     (the pre-P49A-12 rule, widened from MANUAL to every non-sync source), so
--     edits made before this migration are not lost.
--   * "Contact"."deletedAt" — "Delete permanently" on a contact that still has
--     live sync links: hidden everywhere, purged once every link has pushed its
--     remote delete.
--
-- IF NOT EXISTS so the migration applies cleanly to any environment
-- (production runs KONTAX_SCHEMA_MODE=validate and is migrated out of band —
-- see roadmap/runbooks/deploy.md).

ALTER TABLE "SyncContactLink" ADD COLUMN IF NOT EXISTS "localDirtyAt" TIMESTAMP(3);

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Contact_deletedAt_idx" ON "Contact"("deletedAt");
