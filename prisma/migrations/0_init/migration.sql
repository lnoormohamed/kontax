-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountLifecycleState" AS ENUM ('ACTIVE', 'TRIALING', 'GRACE', 'CANCELED', 'LOCKED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AdminSupportCaseStatus" AS ENUM ('OPEN', 'WAITING_ON_CUSTOMER', 'WAITING_ON_PROVIDER', 'RESOLVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdminSupportCaseSeverity" AS ENUM ('NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AdminBroadcastStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT', 'RETRACTED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('OK', 'BOUNCED', 'COMPLAINED');

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('STRIPE');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO', 'FAMILY', 'TEAMS');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('FAMILY', 'TEAM');

-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "GroupInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SharedBookPermissionKind" AS ENUM ('FAMILY_CAN_EDIT', 'TEAM_BOOK_ACCESS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ImportExportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApiTokenScope" AS ENUM ('READ_ONLY', 'READ_WRITE');

-- CreateEnum
CREATE TYPE "ContactImportFormat" AS ENUM ('CSV_GENERIC');

-- CreateEnum
CREATE TYPE "ContactExportFormat" AS ENUM ('CSV_GENERIC', 'VCARD_4');

-- CreateEnum
CREATE TYPE "KontaxExportKind" AS ENUM ('DOCUMENT', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "ImportSourceProfile" AS ENUM ('GENERIC', 'GOOGLE', 'APPLE', 'OUTLOOK');

-- CreateEnum
CREATE TYPE "MergeSuggestionStatus" AS ENUM ('OPEN', 'DISMISSED', 'MERGED', 'STALE');

-- CreateEnum
CREATE TYPE "MergeSuggestionConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "MergeDecisionStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "SyncProvider" AS ENUM ('CARDDAV', 'GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('TWO_WAY', 'IMPORT_ONLY', 'EXPORT_ONLY');

-- CreateEnum
CREATE TYPE "SyncAccountStatus" AS ENUM ('ACTIVE', 'PAUSED', 'NEEDS_REAUTH', 'ERROR', 'DISCONNECTED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ConflictPolicy" AS ENUM ('SERVER_WINS', 'DEVICE_WINS', 'MANUAL');

-- CreateEnum
CREATE TYPE "SyncJobTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'WEBHOOK', 'RECOVERY');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED', 'HALTED');

-- CreateEnum
CREATE TYPE "SyncConflictType" AS ENUM ('LOCAL_REMOTE_MUTATION', 'DELETE_CONFLICT', 'MERGE_CONFLICT', 'VERSION_MISMATCH');

-- CreateEnum
CREATE TYPE "SyncConflictStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED', 'AUTO_RESOLVED');

-- CreateEnum
CREATE TYPE "SyncConflictSource" AS ENUM ('OUTBOUND_SYNC', 'INBOUND_DEVICE');

-- CreateEnum
CREATE TYPE "SyncResolutionStrategy" AS ENUM ('KEEP_LOCAL', 'KEEP_REMOTE', 'DUPLICATE_LOCAL', 'ARCHIVE_LOCAL', 'MANUAL_MERGE');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('MANUAL', 'IMPORT_CSV', 'SYNC_CARDDAV', 'SYNC_GOOGLE', 'SYNC_MICROSOFT', 'SHARED_STATIC', 'SHARED_LIVE', 'API', 'CARD_IMPORT');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CONTACT_CREATED', 'CONTACT_UPDATED', 'CONTACT_ARCHIVED', 'CONTACT_RESTORED', 'CONTACT_DELETED', 'CONTACT_MERGED', 'CONTACT_MERGE_UNDONE', 'CONTACT_IMPORTED', 'CONTACT_SHARED', 'CONTACT_SHARE_RECEIVED', 'SYNC_PULLED', 'SYNC_PUSHED', 'SYNC_CONFLICT_DETECTED', 'SYNC_CONFLICT_RESOLVED', 'SYNC_CONNECTION_CONNECTED', 'SYNC_CONNECTION_RECONNECTED', 'SYNC_CONNECTION_DISCONNECTED', 'SYNC_CONNECTION_RETIRED', 'SYNC_CONNECTION_REPLACED', 'SYNC_SETTINGS_CHANGED', 'ACCOUNT_UPDATED');

-- CreateEnum
CREATE TYPE "EmailVerificationTokenType" AS ENUM ('SIGNUP', 'EMAIL_CHANGE');

-- CreateEnum
CREATE TYPE "Actor" AS ENUM ('USER', 'SYNC', 'IMPORT', 'SHARE', 'FAMILY_MEMBER', 'TEAM_MEMBER', 'SYSTEM', 'API');

-- CreateEnum
CREATE TYPE "FeatureFlagMode" AS ENUM ('OFF', 'SPECIFIC_USERS', 'ALL', 'ROLLOUT');

-- CreateEnum
CREATE TYPE "ShareType" AS ENUM ('VCARD_LINK', 'STATIC_COPY', 'LIVE_SYNC');

-- CreateEnum
CREATE TYPE "ShareStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'DECLINED');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('SECURITY', 'SHARING', 'SYNC_STATUS', 'BILLING', 'REMINDERS', 'PRODUCT_UPDATES');

-- CreateEnum
CREATE TYPE "DigestCadence" AS ENUM ('NONE', 'DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "lifecycleState" "AccountLifecycleState" NOT NULL DEFAULT 'ACTIVE',
    "autoFillPhoneticNames" BOOLEAN NOT NULL DEFAULT false,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "avatarUrl" TEXT,
    "emailVerified" TIMESTAMP(3),
    "emailPendingChange" TEXT,
    "emailPendingChangeRequestedAt" TIMESTAMP(3),
    "emailChangeRevertTokenHash" TEXT,
    "emailChangeRevertExpiresAt" TIMESTAMP(3),
    "emailPreviousAddress" TEXT,
    "emailStatus" "EmailStatus" NOT NULL DEFAULT 'OK',
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "totpVerifiedAt" TIMESTAMP(3),
    "lastTotpCounter" INTEGER,
    "scheduledDeleteAt" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "planOverrideReason" TEXT,
    "planOverriddenAt" TIMESTAMP(3),
    "reminderLeadDays" INTEGER NOT NULL DEFAULT 7,
    "calToken" TEXT,
    "username" TEXT,
    "usernameClaimedAt" TIMESTAMP(3),
    "publicCardFields" JSONB,
    "publicCardViews" INTEGER NOT NULL DEFAULT 0,
    "addToKontaxClicks" INTEGER NOT NULL DEFAULT 0,
    "preferences" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicCardView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrer" VARCHAR(500),

    CONSTRAINT "PublicCardView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOnboardingState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exploredAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "upgradeOnboardingPlan" TEXT,
    "upgradeOnboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOnboardingState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppPassword" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppPassword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharRomanization" (
    "ch" TEXT NOT NULL,
    "roman" TEXT NOT NULL,

    CONSTRAINT "CharRomanization_pkey" PRIMARY KEY ("ch")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importJobId" TEXT,
    "reminderLeadDaysOverride" INTEGER,
    "mergedIntoContactId" TEXT,
    "syncUid" TEXT NOT NULL,
    "syncVersion" INTEGER NOT NULL DEFAULT 1,
    "syncTombstoneAt" TIMESTAMP(3),
    "fullName" TEXT NOT NULL,
    "firstName" TEXT,
    "middleName" TEXT,
    "lastName" TEXT,
    "phoneticFirstName" TEXT,
    "phoneticLastName" TEXT,
    "namePrefix" TEXT,
    "nameSuffix" TEXT,
    "nickname" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "phoneticCompany" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "website" TEXT,
    "birthday" TEXT,
    "address" TEXT,
    "avatarUrl" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "labels" JSONB,
    "websiteEntries" JSONB,
    "emailAddresses" JSONB,
    "phoneNumbers" JSONB,
    "postalAddresses" JSONB,
    "emailEntries" JSONB,
    "phoneEntries" JSONB,
    "addressEntries" JSONB,
    "significantDates" JSONB,
    "relatedPeople" JSONB,
    "customFields" JSONB,
    "notes" TEXT,
    "sourceType" "SourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceDetail" TEXT,
    "lastMutatedBy" "SourceType" NOT NULL DEFAULT 'MANUAL',
    "lastMutatedByDetail" TEXT,
    "archivedAt" TIMESTAMP(3),
    "bookId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "searchVector" tsvector,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "SubscriptionCustomer" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "groupId" TEXT,
    "provider" "BillingProvider" NOT NULL DEFAULT 'STRIPE',
    "providerCustomerId" TEXT NOT NULL,
    "billingEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "groupId" TEXT,
    "subscriptionCustomerId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'STRIPE',
    "providerSubscriptionId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "interval" "SubscriptionInterval" NOT NULL DEFAULT 'MONTHLY',
    "contactsLimit" INTEGER,
    "monthlyImportLimit" INTEGER,
    "syncAccountsLimit" INTEGER,
    "appPasswordsLimit" INTEGER,
    "advancedMergeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "premiumExportEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cardDavSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "familyGroupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "teamsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sharedAddressBooksLimit" INTEGER,
    "memberSlotsLimit" INTEGER,
    "activityLogRetentionDays" INTEGER,
    "liveShareEnabled" BOOLEAN NOT NULL DEFAULT false,
    "staticShareEnabled" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "format" "ContactImportFormat" NOT NULL,
    "sourceProfile" "ImportSourceProfile",
    "status" "ImportExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "sourceFileName" TEXT,
    "sourceFileSizeBytes" INTEGER,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "previewContactCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "rolledBackCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "previewedAt" TIMESTAMP(3),
    "committedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "format" "ContactExportFormat" NOT NULL,
    "status" "ImportExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "includeArchived" BOOLEAN NOT NULL DEFAULT false,
    "filterQuery" TEXT,
    "resultFileName" TEXT,
    "exportedCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "MergeSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leftContactId" TEXT NOT NULL,
    "rightContactId" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "status" "MergeSuggestionStatus" NOT NULL DEFAULT 'OPEN',
    "confidence" "MergeSuggestionConfidence" NOT NULL,
    "score" INTEGER NOT NULL,
    "hardMatch" BOOLEAN NOT NULL DEFAULT false,
    "signals" JSONB NOT NULL,
    "reasons" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MergeSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MergeDecision" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MergeDecisionStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "notes" TEXT,
    "details" JSONB,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversalSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MergeDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MergeDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactAId" TEXT NOT NULL,
    "contactBId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MergeDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT,
    "replacesSyncAccountId" TEXT,
    "replacedBySyncAccountId" TEXT,
    "provider" "SyncProvider" NOT NULL DEFAULT 'CARDDAV',
    "status" "SyncAccountStatus" NOT NULL DEFAULT 'PAUSED',
    "syncDirection" "SyncDirection" NOT NULL DEFAULT 'TWO_WAY',
    "label" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "principalUrl" TEXT,
    "addressBookUrl" TEXT,
    "addressBookDisplayName" TEXT,
    "remoteAccountId" TEXT,
    "remoteCTag" TEXT,
    "credentialReference" TEXT,
    "credentialVersion" INTEGER NOT NULL DEFAULT 1,
    "credentialUpdatedAt" TIMESTAMP(3),
    "credentialLastValidatedAt" TIMESTAMP(3),
    "credentialRevokedAt" TIMESTAMP(3),
    "encryptionKeyRef" TEXT,
    "connectionValidatedAt" TIMESTAMP(3),
    "lastSyncCursor" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSucceededAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "discoveredBooks" JSONB,
    "booksDiscoveredAt" TIMESTAMP(3),
    "setupCompletedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "deletionHold" JSONB,
    "deletionHoldAt" TIMESTAMP(3),
    "deletionGuardBypassOnce" BOOLEAN NOT NULL DEFAULT false,
    "retiredAt" TIMESTAMP(3),
    "retiredReason" TEXT,
    "destinationBookId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncAccountSettings" (
    "id" TEXT NOT NULL,
    "syncAccountId" TEXT NOT NULL,
    "syncDirection" "SyncDirection" NOT NULL DEFAULT 'TWO_WAY',
    "conflictPolicy" "ConflictPolicy" NOT NULL DEFAULT 'SERVER_WINS',
    "capabilityProfileOverride" TEXT,
    "bookAllowlist" TEXT[],
    "syncFrequencyMinutes" INTEGER,
    "requireReauthToEdit" BOOLEAN NOT NULL DEFAULT true,
    "importLabelId" TEXT,
    "maxDeletionsThreshold" INTEGER,
    "notifyOnFailure" BOOLEAN NOT NULL DEFAULT true,
    "syncWindowStart" INTEGER,
    "syncWindowEnd" INTEGER,
    "syncWindowTimezone" TEXT,
    "excludedFields" TEXT[],
    "exportLabelFilter" TEXT[],
    "maxAttemptsBeforePause" INTEGER,
    "projectionBookIds" TEXT[],
    "fieldPrecedence" TEXT,
    "autolinkCaveatDismissedAt" TIMESTAMP(3),
    "conflictOverride" TEXT,
    "lastModifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncAccountSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncSettingsElevation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncSettingsElevation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncContactLink" (
    "id" TEXT NOT NULL,
    "syncAccountId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "remoteHref" TEXT,
    "remoteUid" TEXT,
    "remoteETag" TEXT,
    "capabilityProfileId" TEXT,
    "supportedFieldShadow" JSONB,
    "photoShadow" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "tombstonedAt" TIMESTAMP(3),
    "remoteDeletedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncContactLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "syncAccountId" TEXT NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" "SyncJobTrigger" NOT NULL DEFAULT 'MANUAL',
    "syncDirection" "SyncDirection" NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "workerId" TEXT,
    "idempotencyKey" TEXT,
    "cursorBefore" TEXT,
    "cursorAfter" TEXT,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "deletedCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "pushedCreatedCount" INTEGER NOT NULL DEFAULT 0,
    "pushedUpdatedCount" INTEGER NOT NULL DEFAULT 0,
    "pushedDeletedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicatesDetectedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorSummary" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncConflict" (
    "id" TEXT NOT NULL,
    "syncAccountId" TEXT,
    "syncContactLinkId" TEXT,
    "contactId" TEXT,
    "appPasswordId" TEXT,
    "conflictType" "SyncConflictType" NOT NULL,
    "conflictSource" "SyncConflictSource" NOT NULL DEFAULT 'OUTBOUND_SYNC',
    "status" "SyncConflictStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionStrategy" "SyncResolutionStrategy",
    "localSyncVersion" INTEGER,
    "remoteETag" TEXT,
    "localSnapshot" JSONB,
    "remoteSnapshot" JSONB,
    "resolutionNotes" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "EmailVerificationTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestedFromIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceHint" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "totpChallengeVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TotpRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TotpRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT,
    "eventType" "EventType" NOT NULL,
    "actor" "Actor" NOT NULL,
    "actorDetail" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditEvent" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetEmail" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSupportNote" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSupportNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSupportCase" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "creatorAdminUserId" TEXT NOT NULL,
    "assigneeAdminUserId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "AdminSupportCaseStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "AdminSupportCaseSeverity" NOT NULL DEFAULT 'NORMAL',
    "nextFollowUpAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSupportCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "owner" TEXT,
    "purpose" TEXT,
    "environmentScope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "riskLevel" TEXT NOT NULL DEFAULT 'standard',
    "killSwitch" BOOLEAN NOT NULL DEFAULT false,
    "mode" "FeatureFlagMode" NOT NULL DEFAULT 'OFF',
    "rolloutPct" INTEGER NOT NULL DEFAULT 0,
    "allowedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" "GroupType" NOT NULL,
    "name" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "memberSlotsLimit" INTEGER,
    "maxMembers" INTEGER NOT NULL DEFAULT 6,
    "defaultAddressBookId" TEXT,
    "teamsGraceEndsAt" TIMESTAMP(3),
    "teamsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedBookPermissionAuditEvent" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupType" "GroupType" NOT NULL,
    "groupName" TEXT NOT NULL,
    "groupAddressBookId" TEXT,
    "groupAddressBookName" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "targetMemberId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetName" TEXT NOT NULL,
    "permissionKind" "SharedBookPermissionKind" NOT NULL,
    "beforeValue" TEXT,
    "afterValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedBookPermissionAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT,
    "invitedEmail" TEXT,
    "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
    "inviteStatus" "GroupInviteStatus" NOT NULL DEFAULT 'PENDING',
    "canEdit" BOOLEAN NOT NULL DEFAULT true,
    "canManageBilling" BOOLEAN NOT NULL DEFAULT false,
    "addressBookPermissions" JSONB,
    "sharingPolicy" JSONB,
    "inviteToken" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedByUserId" TEXT,
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupAddressBook" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "minimumSharingPolicy" JSONB,
    "archivedAt" TIMESTAMP(3),
    "dissolvedToBookId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupAddressBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressBook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "deviceWritable" BOOLEAN NOT NULL DEFAULT true,
    "sourceBookIds" TEXT[],
    "sourceGroupBookId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddressBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedFilter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filterState" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Label" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamSyncAccount" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "syncAccountId" TEXT NOT NULL,
    "addressBookId" TEXT NOT NULL,
    "addedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamSyncAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupContact" (
    "id" TEXT NOT NULL,
    "groupAddressBookId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "addedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactShare" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "contactId" TEXT,
    "shareType" "ShareType" NOT NULL,
    "token" TEXT,
    "recipientUserId" TEXT,
    "recipientEmail" TEXT,
    "recipientContactId" TEXT,
    "status" "ShareStatus" NOT NULL DEFAULT 'ACTIVE',
    "snapshot" JSONB,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastPushedAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "maxDownloads" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "actionUrl" TEXT,
    "securityAlertId" TEXT,
    "adminBroadcastId" TEXT,
    "contactShareId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminBroadcast" (
    "id" TEXT NOT NULL,
    "createdByAdminUserId" TEXT NOT NULL,
    "sentByAdminUserId" TEXT,
    "retractedByAdminUserId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionUrl" TEXT,
    "status" "AdminBroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "retractedAt" TIMESTAMP(3),
    "audienceFilters" JSONB NOT NULL DEFAULT '{}',
    "audienceSummary" JSONB NOT NULL DEFAULT '{}',
    "previewRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "userId" TEXT NOT NULL,
    "sharingInApp" BOOLEAN NOT NULL DEFAULT true,
    "sharingEmail" BOOLEAN NOT NULL DEFAULT true,
    "syncInApp" BOOLEAN NOT NULL DEFAULT true,
    "syncEmail" BOOLEAN NOT NULL DEFAULT true,
    "remindersInApp" BOOLEAN NOT NULL DEFAULT true,
    "remindersEmail" BOOLEAN NOT NULL DEFAULT false,
    "productInApp" BOOLEAN NOT NULL DEFAULT true,
    "productEmail" BOOLEAN NOT NULL DEFAULT false,
    "digest" "DigestCadence" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "FailedLoginAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailedLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BirthdayReminderState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "lastSentYear" INTEGER NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BirthdayReminderState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportMappingSuggestionFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "columnHeader" TEXT NOT NULL,
    "suggestedField" TEXT NOT NULL,
    "chosenField" TEXT NOT NULL,
    "sampleValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportMappingSuggestionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportMappingPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headerHash" TEXT NOT NULL,
    "columnMappings" JSONB NOT NULL,
    "sourceProfile" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportMappingPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldSelection" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataExportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'PENDING',
    "includeArchived" BOOLEAN NOT NULL DEFAULT false,
    "downloadUrl" TEXT,
    "fileSizeBytes" INTEGER,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "DataExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "scope" "ApiTokenScope" NOT NULL DEFAULT 'READ_ONLY',
    "lastUsedAt" TIMESTAMP(3),
    "requestCountThisMonth" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_scheduledDeleteAt_idx" ON "User"("scheduledDeleteAt");

-- CreateIndex
CREATE INDEX "User_calToken_idx" ON "User"("calToken");

-- CreateIndex
CREATE INDEX "PublicCardView_userId_viewedAt_idx" ON "PublicCardView"("userId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserOnboardingState_userId_key" ON "UserOnboardingState"("userId");

-- CreateIndex
CREATE INDEX "AppPassword_userId_revokedAt_createdAt_idx" ON "AppPassword"("userId", "revokedAt", "createdAt");

-- CreateIndex
CREATE INDEX "AppPassword_userId_revokedAt_idx" ON "AppPassword"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Contact_userId_archivedAt_fullName_idx" ON "Contact"("userId", "archivedAt", "fullName");

-- CreateIndex
CREATE INDEX "Contact_userId_archivedAt_nickname_idx" ON "Contact"("userId", "archivedAt", "nickname");

-- CreateIndex
CREATE INDEX "Contact_userId_archivedAt_email_idx" ON "Contact"("userId", "archivedAt", "email");

-- CreateIndex
CREATE INDEX "Contact_userId_archivedAt_phone_idx" ON "Contact"("userId", "archivedAt", "phone");

-- CreateIndex
CREATE INDEX "Contact_userId_importJobId_idx" ON "Contact"("userId", "importJobId");

-- CreateIndex
CREATE INDEX "Contact_userId_mergedIntoContactId_idx" ON "Contact"("userId", "mergedIntoContactId");

-- CreateIndex
CREATE INDEX "Contact_bookId_archivedAt_fullName_idx" ON "Contact"("bookId", "archivedAt", "fullName");

-- CreateIndex
CREATE INDEX "Contact_searchVector_idx" ON "Contact" USING GIN ("searchVector");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_userId_syncUid_key" ON "Contact"("userId", "syncUid");

-- CreateIndex
CREATE INDEX "ContactBookMembership_addressBookId_contactId_idx" ON "ContactBookMembership"("addressBookId", "contactId");

-- CreateIndex
CREATE INDEX "ContactBookMembership_contactId_idx" ON "ContactBookMembership"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactBookMembership_contactId_addressBookId_key" ON "ContactBookMembership"("contactId", "addressBookId");

-- CreateIndex
CREATE INDEX "ContactPrivateField_contactId_userId_idx" ON "ContactPrivateField"("contactId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCustomer_userId_key" ON "SubscriptionCustomer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCustomer_groupId_key" ON "SubscriptionCustomer"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCustomer_provider_providerCustomerId_key" ON "SubscriptionCustomer"("provider", "providerCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE INDEX "Subscription_groupId_status_idx" ON "Subscription"("groupId", "status");

-- CreateIndex
CREATE INDEX "Subscription_subscriptionCustomerId_status_idx" ON "Subscription"("subscriptionCustomerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_provider_providerSubscriptionId_key" ON "Subscription"("provider", "providerSubscriptionId");

-- CreateIndex
CREATE INDEX "ImportJob_userId_status_createdAt_idx" ON "ImportJob"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ExportJob_userId_status_createdAt_idx" ON "ExportJob"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "KontaxExportJob_userId_status_createdAt_idx" ON "KontaxExportJob"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "KontaxExportJob_status_expiresAt_idx" ON "KontaxExportJob"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "MergeSuggestion_userId_status_updatedAt_idx" ON "MergeSuggestion"("userId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MergeSuggestion_userId_pairKey_key" ON "MergeSuggestion"("userId", "pairKey");

-- CreateIndex
CREATE INDEX "MergeDecision_userId_status_decidedAt_idx" ON "MergeDecision"("userId", "status", "decidedAt");

-- CreateIndex
CREATE INDEX "MergeDecision_suggestionId_decidedAt_idx" ON "MergeDecision"("suggestionId", "decidedAt");

-- CreateIndex
CREATE INDEX "MergeDismissal_userId_idx" ON "MergeDismissal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MergeDismissal_userId_contactAId_contactBId_key" ON "MergeDismissal"("userId", "contactAId", "contactBId");

-- CreateIndex
CREATE INDEX "SyncAccount_userId_status_updatedAt_idx" ON "SyncAccount"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "SyncAccount_connectionId_idx" ON "SyncAccount"("connectionId");

-- CreateIndex
CREATE INDEX "SyncAccount_replacesSyncAccountId_idx" ON "SyncAccount"("replacesSyncAccountId");

-- CreateIndex
CREATE INDEX "SyncAccount_replacedBySyncAccountId_idx" ON "SyncAccount"("replacedBySyncAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncAccount_userId_baseUrl_label_key" ON "SyncAccount"("userId", "baseUrl", "label");

-- CreateIndex
CREATE UNIQUE INDEX "SyncAccountSettings_syncAccountId_key" ON "SyncAccountSettings"("syncAccountId");

-- CreateIndex
CREATE INDEX "SyncSettingsElevation_userId_jti_idx" ON "SyncSettingsElevation"("userId", "jti");

-- CreateIndex
CREATE UNIQUE INDEX "SyncSettingsElevation_userId_jti_key" ON "SyncSettingsElevation"("userId", "jti");

-- CreateIndex
CREATE INDEX "SyncContactLink_contactId_updatedAt_idx" ON "SyncContactLink"("contactId", "updatedAt");

-- CreateIndex
CREATE INDEX "SyncContactLink_syncAccountId_tombstonedAt_idx" ON "SyncContactLink"("syncAccountId", "tombstonedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncContactLink_syncAccountId_contactId_key" ON "SyncContactLink"("syncAccountId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncContactLink_syncAccountId_remoteHref_key" ON "SyncContactLink"("syncAccountId", "remoteHref");

-- CreateIndex
CREATE UNIQUE INDEX "SyncContactLink_syncAccountId_remoteUid_key" ON "SyncContactLink"("syncAccountId", "remoteUid");

-- CreateIndex
CREATE INDEX "SyncJob_syncAccountId_status_createdAt_idx" ON "SyncJob"("syncAccountId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SyncJob_status_nextRetryAt_idx" ON "SyncJob"("status", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncJob_syncAccountId_idempotencyKey_key" ON "SyncJob"("syncAccountId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SyncConflict_syncAccountId_status_detectedAt_idx" ON "SyncConflict"("syncAccountId", "status", "detectedAt");

-- CreateIndex
CREATE INDEX "SyncConflict_contactId_status_idx" ON "SyncConflict"("contactId", "status");

-- CreateIndex
CREATE INDEX "SyncConflict_syncContactLinkId_status_idx" ON "SyncConflict"("syncContactLinkId", "status");

-- CreateIndex
CREATE INDEX "SyncConflict_appPasswordId_status_idx" ON "SyncConflict"("appPasswordId", "status");

-- CreateIndex
CREATE INDEX "SyncConflict_conflictSource_status_detectedAt_idx" ON "SyncConflict"("conflictSource", "status", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_type_usedAt_idx" ON "EmailVerificationToken"("userId", "type", "usedAt");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_tokenHash_idx" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_usedAt_expiresAt_idx" ON "PasswordResetToken"("userId", "usedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_tokenHash_idx" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_jti_key" ON "UserSession"("jti");

-- CreateIndex
CREATE INDEX "UserSession_userId_revokedAt_lastActiveAt_idx" ON "UserSession"("userId", "revokedAt", "lastActiveAt");

-- CreateIndex
CREATE INDEX "UserSession_jti_idx" ON "UserSession"("jti");

-- CreateIndex
CREATE INDEX "TotpRecoveryCode_userId_usedAt_idx" ON "TotpRecoveryCode"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_userId_createdAt_idx" ON "ActivityEvent"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActivityEvent_contactId_createdAt_idx" ON "ActivityEvent"("contactId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminAuditEvent_adminUserId_createdAt_idx" ON "AdminAuditEvent"("adminUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminAuditEvent_action_createdAt_idx" ON "AdminAuditEvent"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminAuditEvent_targetUserId_createdAt_idx" ON "AdminAuditEvent"("targetUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminSupportNote_subjectType_subjectId_createdAt_idx" ON "AdminSupportNote"("subjectType", "subjectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminSupportNote_targetUserId_createdAt_idx" ON "AdminSupportNote"("targetUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminSupportNote_adminUserId_createdAt_idx" ON "AdminSupportNote"("adminUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminSupportCase_subjectType_subjectId_status_updatedAt_idx" ON "AdminSupportCase"("subjectType", "subjectId", "status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "AdminSupportCase_targetUserId_status_updatedAt_idx" ON "AdminSupportCase"("targetUserId", "status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "AdminSupportCase_assigneeAdminUserId_status_updatedAt_idx" ON "AdminSupportCase"("assigneeAdminUserId", "status", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "Group_ownerId_idx" ON "Group"("ownerId");

-- CreateIndex
CREATE INDEX "Group_subscriptionId_idx" ON "Group"("subscriptionId");

-- CreateIndex
CREATE INDEX "SharedBookPermissionAuditEvent_groupId_createdAt_idx" ON "SharedBookPermissionAuditEvent"("groupId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SharedBookPermissionAuditEvent_groupType_createdAt_idx" ON "SharedBookPermissionAuditEvent"("groupType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SharedBookPermissionAuditEvent_targetMemberId_createdAt_idx" ON "SharedBookPermissionAuditEvent"("targetMemberId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_inviteToken_key" ON "GroupMember"("inviteToken");

-- CreateIndex
CREATE INDEX "GroupMember_userId_inviteStatus_idx" ON "GroupMember"("userId", "inviteStatus");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_inviteStatus_idx" ON "GroupMember"("groupId", "inviteStatus");

-- CreateIndex
CREATE INDEX "GroupMember_invitedEmail_inviteStatus_idx" ON "GroupMember"("invitedEmail", "inviteStatus");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_invitedEmail_key" ON "GroupMember"("groupId", "invitedEmail");

-- CreateIndex
CREATE INDEX "GroupAddressBook_groupId_idx" ON "GroupAddressBook"("groupId");

-- CreateIndex
CREATE INDEX "AddressBook_userId_isDefault_idx" ON "AddressBook"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "AddressBook_userId_archivedAt_idx" ON "AddressBook"("userId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AddressBook_userId_slug_key" ON "AddressBook"("userId", "slug");

-- CreateIndex
CREATE INDEX "SavedFilter_userId_sortOrder_idx" ON "SavedFilter"("userId", "sortOrder");

-- CreateIndex
CREATE INDEX "Label_userId_position_idx" ON "Label"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Label_userId_name_key" ON "Label"("userId", "name");

-- CreateIndex
CREATE INDEX "TeamSyncAccount_groupId_idx" ON "TeamSyncAccount"("groupId");

-- CreateIndex
CREATE INDEX "TeamSyncAccount_addressBookId_idx" ON "TeamSyncAccount"("addressBookId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSyncAccount_syncAccountId_key" ON "TeamSyncAccount"("syncAccountId");

-- CreateIndex
CREATE INDEX "GroupContact_groupAddressBookId_updatedAt_idx" ON "GroupContact"("groupAddressBookId", "updatedAt");

-- CreateIndex
CREATE INDEX "GroupContact_contactId_idx" ON "GroupContact"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupContact_groupAddressBookId_contactId_key" ON "GroupContact"("groupAddressBookId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactShare_token_key" ON "ContactShare"("token");

-- CreateIndex
CREATE INDEX "ContactShare_ownerUserId_status_createdAt_idx" ON "ContactShare"("ownerUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ContactShare_recipientUserId_status_idx" ON "ContactShare"("recipientUserId", "status");

-- CreateIndex
CREATE INDEX "ContactShare_recipientEmail_status_idx" ON "ContactShare"("recipientEmail", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_stripeEventId_idx" ON "StripeWebhookEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_processedAt_idx" ON "StripeWebhookEvent"("processedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_adminBroadcastId_idx" ON "Notification"("adminBroadcastId");

-- CreateIndex
CREATE INDEX "Notification_contactShareId_idx" ON "Notification"("contactShareId");

-- CreateIndex
CREATE INDEX "AdminBroadcast_status_scheduledFor_createdAt_idx" ON "AdminBroadcast"("status", "scheduledFor", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminBroadcast_createdByAdminUserId_createdAt_idx" ON "AdminBroadcast"("createdByAdminUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SecurityAlert_userId_createdAt_idx" ON "SecurityAlert"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FailedLoginAttempt_userId_createdAt_idx" ON "FailedLoginAttempt"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BirthdayReminderState_userId_lastSentYear_idx" ON "BirthdayReminderState"("userId", "lastSentYear");

-- CreateIndex
CREATE UNIQUE INDEX "BirthdayReminderState_userId_contactId_dateKey_key" ON "BirthdayReminderState"("userId", "contactId", "dateKey");

-- CreateIndex
CREATE INDEX "ImportMappingSuggestionFeedback_columnHeader_idx" ON "ImportMappingSuggestionFeedback"("columnHeader");

-- CreateIndex
CREATE INDEX "ImportMappingSuggestionFeedback_userId_idx" ON "ImportMappingSuggestionFeedback"("userId");

-- CreateIndex
CREATE INDEX "ImportMappingPreset_userId_lastUsedAt_idx" ON "ImportMappingPreset"("userId", "lastUsedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ImportMappingPreset_userId_headerHash_key" ON "ImportMappingPreset"("userId", "headerHash");

-- CreateIndex
CREATE INDEX "ExportPreset_userId_createdAt_idx" ON "ExportPreset"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DataExportJob_userId_status_idx" ON "DataExportJob"("userId", "status");

-- CreateIndex
CREATE INDEX "DataExportJob_status_expiresAt_idx" ON "DataExportJob"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiToken_userId_revokedAt_idx" ON "ApiToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "ApiToken_tokenHash_idx" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_userId_name_key" ON "ApiToken"("userId", "name");

-- AddForeignKey
ALTER TABLE "PublicCardView" ADD CONSTRAINT "PublicCardView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnboardingState" ADD CONSTRAINT "UserOnboardingState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppPassword" ADD CONSTRAINT "AppPassword_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_mergedIntoContactId_fkey" FOREIGN KEY ("mergedIntoContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "AddressBook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactBookMembership" ADD CONSTRAINT "ContactBookMembership_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactBookMembership" ADD CONSTRAINT "ContactBookMembership_addressBookId_fkey" FOREIGN KEY ("addressBookId") REFERENCES "AddressBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPrivateField" ADD CONSTRAINT "ContactPrivateField_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPrivateField" ADD CONSTRAINT "ContactPrivateField_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCustomer" ADD CONSTRAINT "SubscriptionCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCustomer" ADD CONSTRAINT "SubscriptionCustomer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscriptionCustomerId_fkey" FOREIGN KEY ("subscriptionCustomerId") REFERENCES "SubscriptionCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KontaxExportJob" ADD CONSTRAINT "KontaxExportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeSuggestion" ADD CONSTRAINT "MergeSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeSuggestion" ADD CONSTRAINT "MergeSuggestion_leftContactId_fkey" FOREIGN KEY ("leftContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeSuggestion" ADD CONSTRAINT "MergeSuggestion_rightContactId_fkey" FOREIGN KEY ("rightContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeDecision" ADD CONSTRAINT "MergeDecision_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "MergeSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeDecision" ADD CONSTRAINT "MergeDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeDismissal" ADD CONSTRAINT "MergeDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeDismissal" ADD CONSTRAINT "MergeDismissal_contactAId_fkey" FOREIGN KEY ("contactAId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeDismissal" ADD CONSTRAINT "MergeDismissal_contactBId_fkey" FOREIGN KEY ("contactBId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncAccount" ADD CONSTRAINT "SyncAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncAccount" ADD CONSTRAINT "SyncAccount_destinationBookId_fkey" FOREIGN KEY ("destinationBookId") REFERENCES "AddressBook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncAccount" ADD CONSTRAINT "SyncAccount_replacesSyncAccountId_fkey" FOREIGN KEY ("replacesSyncAccountId") REFERENCES "SyncAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncAccount" ADD CONSTRAINT "SyncAccount_replacedBySyncAccountId_fkey" FOREIGN KEY ("replacedBySyncAccountId") REFERENCES "SyncAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncAccountSettings" ADD CONSTRAINT "SyncAccountSettings_syncAccountId_fkey" FOREIGN KEY ("syncAccountId") REFERENCES "SyncAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncAccountSettings" ADD CONSTRAINT "SyncAccountSettings_importLabelId_fkey" FOREIGN KEY ("importLabelId") REFERENCES "Label"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncContactLink" ADD CONSTRAINT "SyncContactLink_syncAccountId_fkey" FOREIGN KEY ("syncAccountId") REFERENCES "SyncAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncContactLink" ADD CONSTRAINT "SyncContactLink_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_syncAccountId_fkey" FOREIGN KEY ("syncAccountId") REFERENCES "SyncAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncConflict" ADD CONSTRAINT "SyncConflict_syncAccountId_fkey" FOREIGN KEY ("syncAccountId") REFERENCES "SyncAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncConflict" ADD CONSTRAINT "SyncConflict_syncContactLinkId_fkey" FOREIGN KEY ("syncContactLinkId") REFERENCES "SyncContactLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncConflict" ADD CONSTRAINT "SyncConflict_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncConflict" ADD CONSTRAINT "SyncConflict_appPasswordId_fkey" FOREIGN KEY ("appPasswordId") REFERENCES "AppPassword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TotpRecoveryCode" ADD CONSTRAINT "TotpRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditEvent" ADD CONSTRAINT "AdminAuditEvent_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSupportNote" ADD CONSTRAINT "AdminSupportNote_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSupportCase" ADD CONSTRAINT "AdminSupportCase_creatorAdminUserId_fkey" FOREIGN KEY ("creatorAdminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSupportCase" ADD CONSTRAINT "AdminSupportCase_assigneeAdminUserId_fkey" FOREIGN KEY ("assigneeAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSupportCase" ADD CONSTRAINT "AdminSupportCase_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedBookPermissionAuditEvent" ADD CONSTRAINT "SharedBookPermissionAuditEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAddressBook" ADD CONSTRAINT "GroupAddressBook_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressBook" ADD CONSTRAINT "AddressBook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFilter" ADD CONSTRAINT "SavedFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSyncAccount" ADD CONSTRAINT "TeamSyncAccount_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSyncAccount" ADD CONSTRAINT "TeamSyncAccount_syncAccountId_fkey" FOREIGN KEY ("syncAccountId") REFERENCES "SyncAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSyncAccount" ADD CONSTRAINT "TeamSyncAccount_addressBookId_fkey" FOREIGN KEY ("addressBookId") REFERENCES "GroupAddressBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupContact" ADD CONSTRAINT "GroupContact_groupAddressBookId_fkey" FOREIGN KEY ("groupAddressBookId") REFERENCES "GroupAddressBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupContact" ADD CONSTRAINT "GroupContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactShare" ADD CONSTRAINT "ContactShare_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactShare" ADD CONSTRAINT "ContactShare_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactShare" ADD CONSTRAINT "ContactShare_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactShare" ADD CONSTRAINT "ContactShare_recipientContactId_fkey" FOREIGN KEY ("recipientContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_securityAlertId_fkey" FOREIGN KEY ("securityAlertId") REFERENCES "SecurityAlert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_adminBroadcastId_fkey" FOREIGN KEY ("adminBroadcastId") REFERENCES "AdminBroadcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_contactShareId_fkey" FOREIGN KEY ("contactShareId") REFERENCES "ContactShare"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminBroadcast" ADD CONSTRAINT "AdminBroadcast_createdByAdminUserId_fkey" FOREIGN KEY ("createdByAdminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminBroadcast" ADD CONSTRAINT "AdminBroadcast_sentByAdminUserId_fkey" FOREIGN KEY ("sentByAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminBroadcast" ADD CONSTRAINT "AdminBroadcast_retractedByAdminUserId_fkey" FOREIGN KEY ("retractedByAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailedLoginAttempt" ADD CONSTRAINT "FailedLoginAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayReminderState" ADD CONSTRAINT "BirthdayReminderState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayReminderState" ADD CONSTRAINT "BirthdayReminderState_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportMappingSuggestionFeedback" ADD CONSTRAINT "ImportMappingSuggestionFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportMappingPreset" ADD CONSTRAINT "ImportMappingPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportPreset" ADD CONSTRAINT "ExportPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportJob" ADD CONSTRAINT "DataExportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

