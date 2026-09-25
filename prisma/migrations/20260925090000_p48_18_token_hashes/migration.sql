-- P48-18 — hash capability tokens at rest (calendar, share, invite).
--
-- Purely additive: three nullable lookup-hash columns (sha256 hex, UNIQUE) and
-- two nullable encrypted display-copy columns. The legacy plaintext columns
-- ("User"."calToken", "ContactShare"."token", "GroupMember"."inviteToken") are
-- left in place for the dual-read window and are nulled row by row by
-- scripts/backfill-p48-18-token-hashes.mjs; dropping them is a follow-up.
--
-- IF NOT EXISTS throughout so the migration applies cleanly to any environment
-- (production runs KONTAX_SCHEMA_MODE=validate and is migrated out of band —
-- see roadmap/runbooks/deploy.md, "P48-18 deploy order"). The new columns are
-- all NULL on creation and Postgres permits unlimited NULLs in a unique index,
-- so no pre-check is needed.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "calTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "calTokenEncrypted" TEXT;

ALTER TABLE "ContactShare" ADD COLUMN IF NOT EXISTS "tokenHash" TEXT;
ALTER TABLE "ContactShare" ADD COLUMN IF NOT EXISTS "tokenEncrypted" TEXT;

ALTER TABLE "GroupMember" ADD COLUMN IF NOT EXISTS "inviteTokenHash" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_calTokenHash_key" ON "User"("calTokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "ContactShare_tokenHash_key" ON "ContactShare"("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "GroupMember_inviteTokenHash_key" ON "GroupMember"("inviteTokenHash");
