-- P48-14 — FK-leading indexes on every child column an ON DELETE action walks,
-- plus removal of five single-column indexes that duplicated a UNIQUE index on
-- the same column (Postgres serves those lookups from the unique btree).
--
-- Without these, every parent delete (a Contact, an ImportJob, a Label, an
-- AddressBook, a SecurityAlert, an admin User) forced a sequential scan of the
-- child table to find rows to cascade or null out. Creating them is additive
-- and non-blocking for reads; see roadmap/runbooks/deploy.md for the
-- CREATE INDEX CONCURRENTLY variant if a table has grown large enough that the
-- brief ACCESS SHARE lock matters.

-- DropIndex
DROP INDEX "EmailVerificationToken_tokenHash_idx";

-- DropIndex
DROP INDEX "PasswordResetToken_tokenHash_idx";

-- DropIndex
DROP INDEX "UserSession_jti_idx";

-- DropIndex
DROP INDEX "StripeWebhookEvent_stripeEventId_idx";

-- DropIndex
DROP INDEX "ApiToken_tokenHash_idx";

-- CreateIndex
CREATE INDEX "Contact_importJobId_idx" ON "Contact"("importJobId");

-- CreateIndex
CREATE INDEX "Contact_mergedIntoContactId_idx" ON "Contact"("mergedIntoContactId");

-- CreateIndex
CREATE INDEX "ContactPrivateField_userId_idx" ON "ContactPrivateField"("userId");

-- CreateIndex
CREATE INDEX "MergeSuggestion_leftContactId_idx" ON "MergeSuggestion"("leftContactId");

-- CreateIndex
CREATE INDEX "MergeSuggestion_rightContactId_idx" ON "MergeSuggestion"("rightContactId");

-- CreateIndex
CREATE INDEX "MergeDismissal_contactAId_idx" ON "MergeDismissal"("contactAId");

-- CreateIndex
CREATE INDEX "MergeDismissal_contactBId_idx" ON "MergeDismissal"("contactBId");

-- CreateIndex
CREATE INDEX "SyncAccount_destinationBookId_idx" ON "SyncAccount"("destinationBookId");

-- CreateIndex
CREATE INDEX "SyncAccountSettings_importLabelId_idx" ON "SyncAccountSettings"("importLabelId");

-- CreateIndex
CREATE INDEX "AdminSupportCase_creatorAdminUserId_idx" ON "AdminSupportCase"("creatorAdminUserId");

-- CreateIndex
CREATE INDEX "ContactShare_contactId_idx" ON "ContactShare"("contactId");

-- CreateIndex
CREATE INDEX "ContactShare_recipientContactId_idx" ON "ContactShare"("recipientContactId");

-- CreateIndex
CREATE INDEX "Notification_securityAlertId_idx" ON "Notification"("securityAlertId");

-- CreateIndex
CREATE INDEX "AdminBroadcast_sentByAdminUserId_idx" ON "AdminBroadcast"("sentByAdminUserId");

-- CreateIndex
CREATE INDEX "AdminBroadcast_retractedByAdminUserId_idx" ON "AdminBroadcast"("retractedByAdminUserId");

-- CreateIndex
CREATE INDEX "BirthdayReminderState_contactId_idx" ON "BirthdayReminderState"("contactId");

