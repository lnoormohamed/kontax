-- P48-03 columns. IF NOT EXISTS because the 0_init baseline (generated from a
-- schema that already had them) creates these on fresh databases, while the
-- production database that 0_init was *resolved* against did not have them.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailChangeRevertExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailChangeRevertTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailPreviousAddress" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastTotpCounter" INTEGER;
