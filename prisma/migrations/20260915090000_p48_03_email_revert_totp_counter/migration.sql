-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailChangeRevertExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailChangeRevertTokenHash" TEXT,
ADD COLUMN     "emailPreviousAddress" TEXT,
ADD COLUMN     "lastTotpCounter" INTEGER;

