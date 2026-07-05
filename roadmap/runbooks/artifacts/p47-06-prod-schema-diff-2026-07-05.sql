-- CreateEnum
CREATE TYPE "KontaxExportKind" AS ENUM ('DOCUMENT', 'ARCHIVE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SyncJobStatus" ADD VALUE 'SKIPPED';
ALTER TYPE "SyncJobStatus" ADD VALUE 'HALTED';

-- AlterTable
ALTER TABLE "GroupAddressBook" ADD COLUMN     "minimumSharingPolicy" JSONB;

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN     "sharingPolicy" JSONB;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "contactShareId" TEXT,
ADD COLUMN     "eventAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SyncAccount" ADD COLUMN     "deletionGuardBypassOnce" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletionHold" JSONB,
ADD COLUMN     "deletionHoldAt" TIMESTAMP(3),
ADD COLUMN     "destinationBookId" TEXT;

-- AlterTable
ALTER TABLE "SyncAccountSettings" ADD COLUMN     "autolinkCaveatDismissedAt" TIMESTAMP(3),
ADD COLUMN     "conflictOverride" TEXT,
ADD COLUMN     "fieldPrecedence" TEXT,
ADD COLUMN     "projectionBookIds" TEXT[],
ADD COLUMN     "syncWindowTimezone" TEXT;

-- AlterTable
ALTER TABLE "SyncContactLink" ADD COLUMN     "photoShadow" JSONB;

-- CreateTable
CREATE TABLE "ContactBookMembership" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "addressBookId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactBookMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactPrivateField" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "label" TEXT,
    "value" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactPrivateField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KontaxExportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "KontaxExportKind" NOT NULL DEFAULT 'ARCHIVE',
    "status" "ImportExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "includeArchived" BOOLEAN NOT NULL DEFAULT false,
    "includePhotos" BOOLEAN NOT NULL DEFAULT true,
    "includeVcardFallback" BOOLEAN NOT NULL DEFAULT false,
    "contactIds" JSONB,
    "bookId" TEXT,
    "filterQuery" TEXT,
    "totalCount" INTEGER,
    "progressCount" INTEGER NOT NULL DEFAULT 0,
    "photoCount" INTEGER NOT NULL DEFAULT 0,
    "exportedCount" INTEGER NOT NULL DEFAULT 0,
    "downloadUrl" TEXT,
    "fileSizeBytes" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KontaxExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactBookMembership_addressBookId_contactId_idx" ON "ContactBookMembership"("addressBookId", "contactId");

-- CreateIndex
CREATE INDEX "ContactBookMembership_contactId_idx" ON "ContactBookMembership"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactBookMembership_contactId_addressBookId_key" ON "ContactBookMembership"("contactId", "addressBookId");

-- CreateIndex
CREATE INDEX "ContactPrivateField_contactId_userId_idx" ON "ContactPrivateField"("contactId", "userId");

-- CreateIndex
CREATE INDEX "KontaxExportJob_userId_status_createdAt_idx" ON "KontaxExportJob"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "KontaxExportJob_status_expiresAt_idx" ON "KontaxExportJob"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Notification_contactShareId_idx" ON "Notification"("contactShareId");

-- AddForeignKey
ALTER TABLE "ContactBookMembership" ADD CONSTRAINT "ContactBookMembership_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactBookMembership" ADD CONSTRAINT "ContactBookMembership_addressBookId_fkey" FOREIGN KEY ("addressBookId") REFERENCES "AddressBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPrivateField" ADD CONSTRAINT "ContactPrivateField_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPrivateField" ADD CONSTRAINT "ContactPrivateField_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KontaxExportJob" ADD CONSTRAINT "KontaxExportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncAccount" ADD CONSTRAINT "SyncAccount_destinationBookId_fkey" FOREIGN KEY ("destinationBookId") REFERENCES "AddressBook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_contactShareId_fkey" FOREIGN KEY ("contactShareId") REFERENCES "ContactShare"("id") ON DELETE SET NULL ON UPDATE CASCADE;

