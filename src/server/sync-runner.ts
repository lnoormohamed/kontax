import { Prisma } from "../../generated/prisma";
import {
  type CardDavContactCard,
  type CardDavRawPhoto,
  type CardDavRemoteCardState,
  CARDDAV_PUSH_PRECONDITION_FAILED,
  CardDavPreflightError,
  dedupeCardDavCardsByUid,
  deleteCardDavContact,
  fetchCardDavAddressBookCardsWithRaw,
  fetchCardDavContact,
  fetchCardDavPhotoBytes,
  pushCardDavContact,
  putCardDavVCard,
  sameCardDavETag,
  toIfMatchValue,
} from "~/server/carddav";
import { replaceVCardPhoto } from "~/server/carddav-vcard-merge";
import {
  deriveMultiValueFields,
  multiValueWriteData,
  readMultiValueFields,
  snapshotMultiValueWriteData,
} from "~/server/contact-multi-values";
import type { PortableContactInput } from "~/server/contact-portability";
import { db } from "~/server/db";
import { contactLimitMessage, getContactCapacityFor } from "~/server/billing";
import { emitEvent } from "~/lib/activity";
import { PHOTO_SYNC_ENABLED } from "~/lib/photo-sync-flags";
import {
  hashBytes,
  parsePhotoShadow,
  type PhotoSignalKind,
  type PushSeed,
  type RemotePhotoState,
} from "~/server/contact-photo-sync";
import { runPhotoPass, type PhotoPassLink } from "~/server/sync-photo-pass";
import type { SyncAccountLifecycleStatus } from "~/lib/sync-account-status";
import {
  CONFLICT_QUEUE_FULL_CODE,
  CONTACT_LIMIT_REACHED_CODE,
  settleOAuthSyncJob,
  DEFAULT_MAX_ATTEMPTS_BEFORE_PAUSE,
  MANUAL_CONFLICT_QUEUE_LIMIT,
  SYNC_AUTO_PAUSED_CODE,
  getConsecutiveFailureStreak,
  getSyncErrorSupportBucket,
} from "~/server/sync-health";
import {
  buildDeletionHoldPayload,
  DELETION_THRESHOLD_EXCEEDED_CODE,
  type DeletionHoldPayload,
  DeletionThresholdError,
  exceedsDeletionThreshold,
} from "~/server/sync-deletion-guard";
import type { ImportDeletionGuard } from "~/server/sync-import-engine";
import { clearableInboundFamilies } from "~/server/sync-contact-mapping";
import {
  notifySyncAutoPause,
  notifySyncDeletionPause,
  notifySyncNeedsReauth,
} from "~/server/sync-enforcement-notifications";
import {
  isPhotoExcluded,
  mergeExcludedFieldsFromRemote,
  normalizeExcludedFields,
  omitExcludedContactWriteData,
  stripExcludedPortableFields,
} from "~/server/sync-field-exclusions";
import { isWithinSyncWindow, SYNC_WINDOW_DEFERRED_CODE } from "~/server/sync-window";
import {
  decryptSyncCredentialPayload,
  reencryptSyncCredentialIfStale,
} from "~/server/sync-credentials";
import { GoogleSyncError, runGoogleSync } from "~/server/google-sync";
import { MicrosoftSyncError, runMicrosoftSync } from "~/server/microsoft-sync";
import { buildLocalConflictSnapshot } from "~/server/sync-conflict-snapshot";
import { enqueueMergeSuggestionRefresh } from "~/server/merge-suggestion-refresh-queue";
import { runPostImportDeduplication } from "~/server/sync-dedup";
import { LOCAL_MUTATION_SOURCE_TYPES } from "~/server/sync-dirty";
import {
  createSyncLeaseKeeper,
  decideScheduledRun,
  expiredSyncLeaseWhere,
  leaseExpiredFailureData,
  nextSyncLeaseExpiry,
  recordOpenSyncConflict,
  runningSyncJobWhere,
  warnSyncJobReclaimed,
} from "~/server/sync-job-lifecycle";
import {
  buildProviderCapabilityDiagnostics,
  buildProviderSupportedContactShadow,
  type ProviderCapabilityDiagnostics,
  providerSupportsSignificantDates,
  providerSupportedShadowsEqual,
  resolveSyncProviderCapabilityProfile,
  type SyncProviderCapabilityProfile,
} from "~/server/sync-provider-capabilities";
import {
  buildExportLabelFilterWhere,
  DEFAULT_SYNC_FREQUENCY_MINUTES,
  getEffectiveSyncAccountSettings,
  isManualSyncFrequency,
} from "~/server/sync-settings";

const createRetrySchedule = (attemptNumber: number) => {
  const backoffMinutes = [5, 15, 60, 180, 720];
  const minutes = backoffMinutes[Math.min(Math.max(attemptNumber, 1), backoffMinutes.length) - 1]!;
  return new Date(Date.now() + minutes * 60 * 1000);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// P49A-06 (A-25): inbound sync stops creating contacts at the plan's contact
// cap (never deletes); the job settles PARTIAL with CONTACT_LIMIT_REACHED and
// this warning.
const contactCapWarning = async (userId: string, skipped: number) => {
  const capacity = await getContactCapacityFor(db, userId);
  const reason =
    capacity.limit !== null
      ? contactLimitMessage(capacity.planLabel, capacity.limit)
      : "Plan contact limit reached.";
  return `${reason} ${skipped} new contact${skipped === 1 ? " was" : "s were"} not imported (nothing was deleted). Upgrade your plan to import the rest.`;
};

// Shape of a contact row as selected in existingLinks (fields needed for push).
type SyncContactRow = {
  fullName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  namePrefix: string | null;
  nameSuffix: string | null;
  nickname: string | null;
  email: string | null;
  emailAddresses: unknown;
  emailEntries?: unknown;
  phone: string | null;
  phoneNumbers: unknown;
  phoneEntries?: unknown;
  company: string | null;
  department: string | null;
  jobTitle: string | null;
  website: string | null;
  websiteEntries?: unknown;
  birthday: string | null;
  significantDates?: unknown;
  address: string | null;
  postalAddresses: unknown;
  addressEntries?: unknown;
  notes: string | null;
};

type SyncPushContactRow = SyncContactRow & {
  id: string;
  syncUid: string;
  updatedAt: Date;
};

const safeValueEntries = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (
          typeof entry !== "object" ||
          entry === null ||
          typeof (entry as { value?: unknown }).value !== "string"
        ) {
          return [];
        }

        return [
          {
            label: typeof (entry as { label?: unknown }).label === "string" ? (entry as { label: string }).label : "",
            value: (entry as { value: string }).value,
            isPrimary: (entry as { isPrimary?: unknown }).isPrimary === true,
          },
        ];
      })
    : [];

const safeDateEntries = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (
          typeof entry !== "object" ||
          entry === null ||
          typeof (entry as { date?: unknown }).date !== "string"
        ) {
          return [];
        }

        return [
          {
            label:
              typeof (entry as { label?: unknown }).label === "string"
                ? (entry as { label: string }).label
                : "Anniversary",
            date: (entry as { date: string }).date,
            isPrimary:
              typeof (entry as { isPrimary?: unknown }).isPrimary === "boolean"
                ? (entry as { isPrimary: boolean }).isPrimary
                : false,
          },
        ];
      })
    : [];

const safeAddressEntries = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (
          typeof entry !== "object" ||
          entry === null ||
          typeof (entry as { formatted?: unknown }).formatted !== "string"
        ) {
          return [];
        }

        return [
          {
            label: typeof (entry as { label?: unknown }).label === "string" ? (entry as { label: string }).label : "",
            formatted: (entry as { formatted: string }).formatted,
            isPrimary: (entry as { isPrimary?: unknown }).isPrimary === true,
            countryOrRegion:
              typeof (entry as { countryOrRegion?: unknown }).countryOrRegion === "string"
                ? (entry as { countryOrRegion: string }).countryOrRegion
                : undefined,
            streetLine1:
              typeof (entry as { streetLine1?: unknown }).streetLine1 === "string"
                ? (entry as { streetLine1: string }).streetLine1
                : undefined,
            streetLine2:
              typeof (entry as { streetLine2?: unknown }).streetLine2 === "string"
                ? (entry as { streetLine2: string }).streetLine2
                : undefined,
            cityOrTown:
              typeof (entry as { cityOrTown?: unknown }).cityOrTown === "string"
                ? (entry as { cityOrTown: string }).cityOrTown
                : undefined,
            stateOrProvince:
              typeof (entry as { stateOrProvince?: unknown }).stateOrProvince === "string"
                ? (entry as { stateOrProvince: string }).stateOrProvince
                : typeof (entry as { state?: unknown }).state === "string"
                  ? (entry as { state: string }).state
                  : undefined,
            postcode:
              typeof (entry as { postcode?: unknown }).postcode === "string"
                ? (entry as { postcode: string }).postcode
                : undefined,
            poBox:
              typeof (entry as { poBox?: unknown }).poBox === "string"
                ? (entry as { poBox: string }).poBox
                : undefined,
          },
        ];
      })
    : [];

// P49A-10: multi-value fields through the canonical reader (entries; legacy
// keys re-derived from them). Address entries keep the push vocabulary
// (safeAddressEntries maps the web editor's `state` to stateOrProvince).
const contactToPortable = (c: SyncContactRow): PortableContactInput => {
  const multiValues = readMultiValueFields(c);
  return {
    fullName: c.fullName,
    firstName: c.firstName,
    middleName: c.middleName,
    lastName: c.lastName,
    namePrefix: c.namePrefix,
    nameSuffix: c.nameSuffix,
    nickname: c.nickname,
    email: multiValues.email,
    emailAddresses: multiValues.emailAddresses,
    emailEntries: safeValueEntries(multiValues.emailEntries),
    phone: multiValues.phone,
    phoneNumbers: multiValues.phoneNumbers,
    phoneEntries: safeValueEntries(multiValues.phoneEntries),
    company: c.company,
    department: c.department,
    jobTitle: c.jobTitle,
    website: multiValues.website,
    websiteEntries: safeValueEntries(multiValues.websiteEntries),
    birthday: c.birthday,
    significantDates: safeDateEntries(c.significantDates),
    address: multiValues.address,
    postalAddresses: multiValues.postalAddresses,
    addressEntries: safeAddressEntries(multiValues.addressEntries),
    notes: c.notes,
  };
};

// The remote card as a portable contact: entries normalised the way the write
// normalises them and legacy keys derived from them (P49A-10), so the shadow
// of an applied card equals the local shadow of the stored contact.
const cardDavCardToPortable = (card: CardDavContactCard): PortableContactInput => {
  const multiValues = deriveMultiValueFields({
    emailEntries: card.emailEntries,
    phoneEntries: card.phoneEntries,
    addressEntries: card.addressEntries,
    websiteEntries: card.websiteEntries,
  });
  return {
    fullName: card.fullName,
    firstName: card.firstName,
    middleName: card.middleName,
    lastName: card.lastName,
    namePrefix: card.namePrefix,
    nameSuffix: card.nameSuffix,
    nickname: card.nickname,
    email: multiValues.email ?? null,
    emailAddresses: multiValues.emailAddresses ?? [],
    emailEntries: multiValues.emailEntries ?? [],
    phone: multiValues.phone ?? null,
    phoneNumbers: multiValues.phoneNumbers ?? [],
    phoneEntries: multiValues.phoneEntries ?? [],
    company: card.company,
    department: card.department,
    jobTitle: card.jobTitle,
    website: multiValues.website ?? null,
    websiteEntries: multiValues.websiteEntries ?? [],
    birthday: card.birthday,
    significantDates: card.significantDates,
    address: multiValues.address ?? null,
    postalAddresses: multiValues.postalAddresses ?? [],
    addressEntries: safeAddressEntries(multiValues.addressEntries),
    notes: card.notes,
  };
};

const capabilityDiagnosticsToEventPayload = (
  diagnostics: ProviderCapabilityDiagnostics | null,
) =>
  diagnostics
    ? {
        unsupportedFieldFamilies: diagnostics.unsupportedFieldFamilies,
        unsupportedFieldCount: diagnostics.unsupportedFieldCount,
      }
    : {};

const cardDavPushContactSelect = {
  id: true,
  syncUid: true,
  updatedAt: true,
  fullName: true,
  firstName: true,
  middleName: true,
  lastName: true,
  namePrefix: true,
  nameSuffix: true,
  nickname: true,
  email: true,
  emailAddresses: true,
  emailEntries: true,
  phone: true,
  phoneNumbers: true,
  phoneEntries: true,
  company: true,
  department: true,
  jobTitle: true,
  website: true,
  websiteEntries: true,
  birthday: true,
  significantDates: true,
  address: true,
  postalAddresses: true,
  addressEntries: true,
  notes: true,
} satisfies Prisma.ContactSelect;

const buildContactWriteDataFromRemoteSnapshot = (
  snapshot: unknown,
  profile: SyncProviderCapabilityProfile,
  // P49A-10 (Fable review): the link's stored supportedFieldShadow — only a
  // family the remote held at the last sync may be cleared by an empty card.
  previousShadow: unknown,
) => {
  if (!isRecord(snapshot)) {
    throw new Error("Remote sync snapshot is missing or invalid.");
  }

  const fullName = typeof snapshot.fullName === "string" ? snapshot.fullName.trim() : "";

  if (!fullName) {
    throw new Error("Remote sync snapshot does not contain a valid contact name.");
  }

  const writeData = {
    fullName,
    firstName: typeof snapshot.firstName === "string" ? snapshot.firstName : null,
    middleName: typeof snapshot.middleName === "string" ? snapshot.middleName : null,
    lastName: typeof snapshot.lastName === "string" ? snapshot.lastName : null,
    namePrefix: typeof snapshot.namePrefix === "string" ? snapshot.namePrefix : null,
    nameSuffix: typeof snapshot.nameSuffix === "string" ? snapshot.nameSuffix : null,
    nickname: typeof snapshot.nickname === "string" ? snapshot.nickname : null,
    // P49A-10 (A-19): the remote card's typed entries with legacy columns
    // derived. A family the card left empty clears locally only when the
    // remote held it at the last sync (a deletion there); otherwise the local
    // values may be edits Kontax has not pushed yet and are kept.
    ...snapshotMultiValueWriteData(snapshot, clearableInboundFamilies(profile, previousShadow)),
    company: typeof snapshot.company === "string" ? snapshot.company : null,
    department: typeof snapshot.department === "string" ? snapshot.department : null,
    jobTitle: typeof snapshot.jobTitle === "string" ? snapshot.jobTitle : null,
    birthday: typeof snapshot.birthday === "string" ? snapshot.birthday : null,
    notes: typeof snapshot.notes === "string" ? snapshot.notes : null,
  };

  if (providerSupportsSignificantDates(profile)) {
    return {
      ...writeData,
      significantDates: Array.isArray(snapshot.significantDates)
        ? snapshot.significantDates
        : undefined,
    };
  }

  return writeData;
};

const getFailureStatus = (
  accountStatus: SyncAccountLifecycleStatus,
  errorCode: string,
) => {
  if (
    errorCode === "CARDDAV_AUTH_FAILED" ||
    errorCode === "GOOGLE_AUTH_FAILED" ||
    errorCode === "MICROSOFT_AUTH_FAILED" ||
    errorCode === "CREDENTIALS_MISSING" ||
    errorCode === "CREDENTIALS_UNREADABLE"
  ) {
    return "NEEDS_REAUTH";
  }

  if (
    accountStatus === "PAUSED" ||
    accountStatus === "DISCONNECTED" ||
    accountStatus === "RETIRED"
  ) {
    return accountStatus;
  }

  return "ERROR";
};

const markJobFailed = async ({
  jobId,
  syncAccountId,
  _syncDirection,
  attemptCount,
  maxAttempts,
  accountStatus,
  errorCode,
  errorSummary,
}: {
  jobId: string;
  syncAccountId: string;
  _syncDirection: "TWO_WAY" | "IMPORT_ONLY" | "EXPORT_ONLY";
  attemptCount: number;
  maxAttempts: number;
  accountStatus: SyncAccountLifecycleStatus;
  errorCode: string;
  errorSummary: string;
}) => {
  const now = new Date();
  const baseFailureStatus = getFailureStatus(accountStatus, errorCode);
  // P39-05: retry sensitivity — the per-connection maxAttemptsBeforePause
  // replaces the hardcoded platform streak. 0 = never auto-pause.
  const settingsRow = await db.syncAccountSettings.findUnique({
    where: { syncAccountId },
    select: { maxAttemptsBeforePause: true, notifyOnFailure: true },
  });
  const pauseThreshold =
    settingsRow?.maxAttemptsBeforePause ?? DEFAULT_MAX_ATTEMPTS_BEFORE_PAUSE;
  const notifyOnFailure = settingsRow?.notifyOnFailure ?? true;
  const recentJobs = await db.syncJob.findMany({
    where: {
      syncAccountId,
      id: {
        not: jobId,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    // SKIPPED/HALTED rows are ignored by the streak; over-fetch so the window
    // still spans enough FAILED rows to reach the threshold.
    take: Math.max(pauseThreshold - 1, 0) + 10,
    select: {
      status: true,
      errorCode: true,
    },
  });
  const failureStreak = getConsecutiveFailureStreak([
    {
      status: "FAILED",
      errorCode,
    },
    ...recentJobs.map((job) => ({
      status: job.status,
      errorCode: job.errorCode,
    })),
  ]);
  const supportBucket = getSyncErrorSupportBucket(errorCode);
  const shouldAutoPause =
    baseFailureStatus === "ERROR" &&
    pauseThreshold > 0 &&
    failureStreak >= pauseThreshold &&
    supportBucket !== "authentication";
  const finalStatus = shouldAutoPause ? "PAUSED" : baseFailureStatus;
  // P39-DB01 §3a: the tripping run's history row carries the attempt counter;
  // earlier attempts carry theirs from their own markJobFailed pass.
  const attemptSuffix =
    pauseThreshold > 0 && supportBucket !== "authentication"
      ? shouldAutoPause
        ? ` · attempt ${failureStreak} of ${pauseThreshold}`
        : ` · attempt ${failureStreak}`
      : "";
  const jobErrorSummary = `${errorSummary}${attemptSuffix}`;
  const accountErrorSummary = shouldAutoPause
    ? `Auto-paused after ${failureStreak} consecutive failures. Kontax stopped retrying to avoid hammering the server. Last error: ${errorCode}.`
    : errorSummary;

  // Fable review (P49A-04): settle the job only if it is still RUNNING. A job
  // reclaimed after its lease expired is already FAILED/LEASE_EXPIRED (and its
  // retry may be running) — leave it and the account alone.
  const settled = await db.$transaction(async (tx) => {
    const { count } = await tx.syncJob.updateMany({
      where: runningSyncJobWhere(jobId),
      data: {
        status: "FAILED",
        completedAt: now,
        leaseExpiresAt: null,
        nextRetryAt:
          attemptCount < maxAttempts && !shouldAutoPause
            ? createRetrySchedule(attemptCount + 1)
            : null,
        errorCode,
        errorSummary: jobErrorSummary,
      },
    });
    if (count === 0) return false;
    await tx.syncAccount.update({
      where: { id: syncAccountId },
      data: {
        status: finalStatus,
        lastErrorAt: now,
        // P39-05: a retry-sensitivity trip is marked by its own account code so
        // health classifies it paused_for_safety; the underlying error stays on
        // the tripping SyncJob row and in the message text.
        lastErrorCode: shouldAutoPause ? SYNC_AUTO_PAUSED_CODE : errorCode,
        lastErrorMessage: accountErrorSummary,
      },
    });
    return true;
  });
  if (!settled) {
    warnSyncJobReclaimed(jobId, `FAILED/${errorCode}`);
    return;
  }

  // P22-DB05 / P39-05: notify on the transition into an attention-needed state
  // (re-auth required or auto-paused) — not on every transient retry. The
  // per-connection notifyOnFailure setting gates the pause path; re-auth
  // always notifies (P39-DB01 §4).
  if (
    (finalStatus === "NEEDS_REAUTH" || finalStatus === "PAUSED") &&
    accountStatus !== finalStatus
  ) {
    const account = await db.syncAccount.findUnique({
      where: { id: syncAccountId },
      select: { userId: true, provider: true, label: true },
    });
    if (account) {
      if (finalStatus === "NEEDS_REAUTH") {
        await notifySyncNeedsReauth({
          userId: account.userId,
          syncAccountId,
          accountLabel: account.label,
          reason:
            account.provider === "CARDDAV"
              ? "your app password was rejected"
              : "your authorisation has expired or been revoked",
        });
      } else {
        await notifySyncAutoPause({
          userId: account.userId,
          syncAccountId,
          accountLabel: account.label,
          failureCount: failureStreak,
          lastError: errorCode,
          notifyOnFailure,
        });
      }
    }
  }
};

// P39-02: a run aborted before commit by the deletion-safety threshold. Not a
// failure — the job row goes to HALTED and the account parks in a protective
// PAUSED state carrying the hold payload the review surface renders.
const markJobHalted = async ({
  jobId,
  syncAccountId,
  userId,
  accountLabel,
  hold,
}: {
  jobId: string;
  syncAccountId: string;
  userId: string;
  accountLabel: string;
  hold: DeletionHoldPayload;
}) => {
  const now = new Date();
  const settingsRow = await db.syncAccountSettings.findUnique({
    where: { syncAccountId },
    select: { notifyOnFailure: true },
  });
  const notifyOnFailure = settingsRow?.notifyOnFailure ?? true;

  const settled = await db.$transaction(async (tx) => {
    const { count } = await tx.syncJob.updateMany({
      where: runningSyncJobWhere(jobId),
      data: {
        status: "HALTED",
        completedAt: now,
        leaseExpiresAt: null,
        nextRetryAt: null,
        errorCode: DELETION_THRESHOLD_EXCEEDED_CODE,
        errorSummary: `Halted before commit · ${hold.total} pending removal${hold.total !== 1 ? "s" : ""}`,
      },
    });
    if (count === 0) return false;
    await tx.syncAccount.update({
      where: { id: syncAccountId },
      data: {
        status: "PAUSED",
        lastErrorAt: now,
        lastErrorCode: DELETION_THRESHOLD_EXCEEDED_CODE,
        lastErrorMessage: `Sync paused: this sync would have deleted ${hold.total} contact${hold.total === 1 ? "" : "s"} (your limit is ${hold.threshold}). Nothing was deleted.`,
        deletionHold: hold,
        deletionHoldAt: now,
      },
    });
    return true;
  });
  if (!settled) {
    warnSyncJobReclaimed(jobId, "HALTED");
    return;
  }

  await notifySyncDeletionPause({
    userId,
    syncAccountId,
    accountLabel,
    wouldDelete: hold.total,
    limit: hold.threshold,
    notifyOnFailure,
    occurredAt: now,
  });
};

// P39-02: per-run deletion-guard context for a connector. undefined when the
// threshold is disabled or the account's one-shot bypass is set ("Resume and
// allow deletions" — the run may commit the held deletions once).
const buildDeletionGuardContext = (
  job: { syncAccount: { deletionGuardBypassOnce: boolean } },
  threshold: number | null,
): ImportDeletionGuard | undefined =>
  threshold != null && !job.syncAccount.deletionGuardBypassOnce
    ? { threshold, candidates: [] }
    : undefined;

// P27-08: best-effort post-import dedup. Never throws — the sync job has
// already succeeded; a dedup failure must not flip it to failed.
// P49A-09: enqueued as a background merge-suggestion refresh (one per user at
// a time; failures are logged by the queue) instead of scoring the whole book
// inline in the sync runner.
const runPostImportDedupSafely = (
  userId: string,
  syncAccountId: string,
  syncJobId: string,
  source: string,
) => {
  try {
    enqueueMergeSuggestionRefresh(userId, {
      source,
      dedupeKey: `sync-import:${syncJobId}`,
      run: () => runPostImportDeduplication({ userId, syncAccountId, syncJobId, source }),
    });
  } catch {
    // swallow — dedup is advisory; the import already committed.
  }
};

// P49A-04: a RUNNING job whose lease lapsed was orphaned by a worker that died
// (deploy SIGKILL, crash, OOM). Left alone it blocks its account forever —
// enqueueDueSyncJobs skips accounts with a RUNNING job and the runner's
// same-account guard reverts every new claim. Fail it as retryable instead; a
// live worker renews its lease (createSyncLeaseKeeper), so only dead claims
// lapse. Runs at the start of every enqueue and drain; cheap when idle.
export const reclaimExpiredSyncJobs = async (now: Date = new Date()): Promise<number> => {
  const result = await db.syncJob.updateMany({
    where: expiredSyncLeaseWhere(now),
    data: leaseExpiredFailureData(now),
  });
  if (result.count > 0) {
    console.warn(
      `[sync] reclaimed ${result.count} sync job(s) with an expired lease (orphaned by a stopped worker); marked FAILED/LEASE_EXPIRED for retry.`,
    );
  }
  return result.count;
};

// P34D-03: enqueue a SCHEDULED sync for every ACTIVE account that is due per its
// effective frequency. Skips manual-only accounts and accounts that already have
// a QUEUED/RUNNING job (so ticks don't pile up). The cron route runs the queue
// afterwards. Returns counts for observability.
export const enqueueDueSyncJobs = async (): Promise<{
  enqueued: number;
  skipped: number;
  deferred: number;
}> => {
  await reclaimExpiredSyncJobs();
  const now = Date.now();
  const accounts = await db.syncAccount.findMany({
    // P36-DB02: skip accounts awaiting initial setup (setupCompletedAt null) — the
    // first sync is held until the user confirms settings via completeSyncSetup().
    where: { status: "ACTIVE", credentialRevokedAt: null, setupCompletedAt: { not: null } },
    select: {
      id: true,
      syncDirection: true,
      lastSyncedAt: true,
      syncJobs: {
        where: { status: { in: ["QUEUED", "RUNNING"] } },
        select: { id: true },
        take: 1,
      },
    },
  });

  let enqueued = 0;
  let skipped = 0;
  let deferred = 0;

  for (const account of accounts) {
    // Already has a pending job — don't stack another.
    if (account.syncJobs.length > 0) {
      skipped += 1;
      continue;
    }

    const settings = await getEffectiveSyncAccountSettings(account.id);
    if (isManualSyncFrequency(settings.syncFrequencyMinutes)) {
      skipped += 1;
      continue;
    }

    const freqMinutes = settings.syncFrequencyMinutes ?? DEFAULT_SYNC_FREQUENCY_MINUTES;
    const due =
      !account.lastSyncedAt || now - account.lastSyncedAt.getTime() >= freqMinutes * 60_000;
    if (!due) {
      skipped += 1;
      continue;
    }

    // P49A-04: honour the backoff a failed run scheduled (nextRetryAt) instead
    // of re-running a failing account on every tick; a due retry carries the
    // next attempt number so the backoff ladder advances.
    const latestOutcome = await db.syncJob.findFirst({
      where: {
        syncAccountId: account.id,
        status: { in: ["SUCCEEDED", "PARTIAL", "FAILED"] },
      },
      orderBy: [{ createdAt: "desc" }],
      select: { status: true, nextRetryAt: true, attemptCount: true, maxAttempts: true },
    });
    const decision = decideScheduledRun(latestOutcome, new Date(now));
    if (decision.action === "defer") {
      deferred += 1;
      continue;
    }

    // P39-01: hold scheduled runs outside the account's sync window, evaluated
    // on the user's wall clock (IANA zone; legacy rows without a zone keep
    // their stored-as-UTC semantics). Manual "Sync now" never passes through
    // here, so it bypasses the window by construction. One SKIPPED history row
    // per frequency period records the deferral without spamming every tick.
    if (
      !isWithinSyncWindow({
        now: new Date(now),
        windowStart: settings.syncWindowStart,
        windowEnd: settings.syncWindowEnd,
        timezone: settings.syncWindowTimezone,
      })
    ) {
      const recentSkip = await db.syncJob.findFirst({
        where: {
          syncAccountId: account.id,
          status: "SKIPPED",
          createdAt: { gte: new Date(now - freqMinutes * 60_000) },
        },
        select: { id: true },
      });
      if (!recentSkip) {
        const windowLabel = `${String(settings.syncWindowStart).padStart(2, "0")}:00–${String(settings.syncWindowEnd).padStart(2, "0")}:00`;
        await db.syncJob.create({
          data: {
            syncAccountId: account.id,
            status: "SKIPPED",
            trigger: "SCHEDULED",
            syncDirection: account.syncDirection,
            completedAt: new Date(now),
            errorCode: SYNC_WINDOW_DEFERRED_CODE,
            errorSummary: `Skipped — outside sync window (${windowLabel})`,
            idempotencyKey: `${account.id}:window-skip:${now}`,
          },
        });
      }
      deferred += 1;
      continue;
    }

    await db.syncJob.create({
      data: {
        syncAccountId: account.id,
        status: "QUEUED",
        trigger: "SCHEDULED",
        syncDirection: account.syncDirection,
        attemptCount: decision.attemptCount,
        maxAttempts: 5,
        nextRetryAt: new Date(),
        idempotencyKey: `${account.id}:scheduled:${now}`,
      },
    });
    enqueued += 1;
  }

  return { enqueued, skipped, deferred };
};

export const runQueuedSyncJobs = async ({
  limit = 5,
  syncAccountId,
}: { limit?: number; syncAccountId?: string } = {}) => {
  await reclaimExpiredSyncJobs();
  const queuedJobs = await db.syncJob.findMany({
    where: {
      status: "QUEUED",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      // P34D-03: "Sync now" runs only the triggering account's jobs inline.
      ...(syncAccountId ? { syncAccountId } : {}),
    },
    orderBy: [{ createdAt: "asc" }],
    take: Math.max(limit, 1),
    include: {
      syncAccount: {
        select: {
          id: true,
          userId: true,
          label: true,
          status: true,
          provider: true,
          syncDirection: true,
          baseUrl: true,
          principalUrl: true,
          addressBookUrl: true,
          remoteAccountId: true,
          remoteCTag: true,
          lastSyncCursor: true,
          credentialReference: true,
          // P48-16: the key a row was encrypted under, used as the decrypt hint
          // for pre-keyring envelopes and to spot rows due for re-encryption.
          encryptionKeyRef: true,
          credentialRevokedAt: true,
          // P39-02: one-shot deletion-guard bypass set by "Resume and allow".
          deletionGuardBypassOnce: true,
          settings: {
            select: {
              capabilityProfileOverride: true,
            },
          },
          // P14-06: when linked to a team book, sync operates on that book's
          // contacts (owned by the group owner) instead of personal contacts.
          teamLink: {
            select: {
              addressBookId: true,
              addressBook: { select: { name: true } },
              group: { select: { name: true, ownerId: true } },
            },
          },
        },
      },
    },
  });

  const summary = {
    processed: 0,
    succeeded: 0,
    partial: 0,
    failed: 0,
    skipped: 0,
    // P39-02: runs aborted before commit by the deletion-safety threshold.
    halted: 0,
  };

  // P27-01/04: shared bookkeeping for OAuth provider jobs (Google, Microsoft).
  // The connector's run() returns the import tally + queueFull; this records the
  // job/account state identically across providers. Returns the summary bucket
  // to increment.
  type OAuthSyncResult = {
    created: number;
    updated: number;
    deleted: number;
    conflicts: number;
    queueFull: boolean;
    // Outbound (Kontax -> remote) tallies. Optional: connectors without a push
    // phase (Microsoft, for now) omit them and they record as 0.
    pushedCreated?: number;
    pushedUpdated?: number;
    pushedDeleted?: number;
    // P49A-01 (A-07): contacts whose push failed (error recorded on the link).
    pushFailed?: number;
    // P49A-06 (A-25): new remote contacts not imported (plan contact cap).
    capSkipped?: number;
  };
  const runOAuthSyncJob = async (
    job: (typeof queuedJobs)[number],
    run: () => Promise<OAuthSyncResult>,
    toErrorCode: (error: unknown) => string,
  ): Promise<"succeeded" | "partial" | "failed" | "halted"> => {
    if (!job.syncAccount.credentialReference || job.syncAccount.credentialRevokedAt) {
      await markJobFailed({
        jobId: job.id,
        syncAccountId: job.syncAccountId,
        _syncDirection: job.syncDirection,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        accountStatus: job.syncAccount.status,
        errorCode: "CREDENTIALS_MISSING",
        errorSummary:
          "The sync account is missing active credentials. Reconnect to restore syncing.",
      });
      return "failed";
    }

    try {
      const result = await run();
      const now = new Date();
      const hasConflicts = result.conflicts > 0;
      // P49A-06: a run that hit the contact cap settles PARTIAL with a
      // readable CONTACT_LIMIT_REACHED warning (see settleOAuthSyncJob).
      const capSkipped = result.capSkipped ?? 0;
      const settlement = settleOAuthSyncJob({
        conflicts: result.conflicts,
        pushFailed: result.pushFailed,
        capSkipped,
        capWarning:
          capSkipped > 0 ? await contactCapWarning(job.syncAccount.userId, capSkipped) : null,
      });
      const isPartial = settlement.status === "PARTIAL";
      // Settle only a job still RUNNING (see runningSyncJobWhere).
      const settled = await db.$transaction(async (tx) => {
        const { count } = await tx.syncJob.updateMany({
          where: runningSyncJobWhere(job.id),
          data: {
            status: settlement.status,
            completedAt: now,
            leaseExpiresAt: null,
            nextRetryAt: null,
            errorCode: settlement.errorCode,
            errorSummary: settlement.errorSummary,
            skippedCount: settlement.skippedCount,
            createdCount: result.created,
            updatedCount: result.updated,
            deletedCount: result.deleted,
            conflictCount: result.conflicts,
            pushedCreatedCount: result.pushedCreated ?? 0,
            pushedUpdatedCount: result.pushedUpdated ?? 0,
            pushedDeletedCount: result.pushedDeleted ?? 0,
          },
        });
        if (count === 0) return false;
        await tx.syncAccount.update({
          where: { id: job.syncAccountId },
          data: {
            status: result.queueFull ? "PAUSED" : "ACTIVE",
            lastSucceededAt: now,
            lastSyncedAt: now,
            // P39-02: a completed run settles any deletion hold — either the
            // one-shot bypass just committed the deletions, or a resume path
            // already reconciled them.
            deletionHold: Prisma.DbNull,
            deletionHoldAt: null,
            deletionGuardBypassOnce: false,
            lastErrorAt: result.queueFull || hasConflicts ? now : null,
            lastErrorCode: result.queueFull
              ? CONFLICT_QUEUE_FULL_CODE
              : hasConflicts
                ? "SYNC_CONFLICTS_OPEN"
                : null,
            lastErrorMessage: result.queueFull
              ? "Sync paused — the manual conflict queue is full. Resolve conflicts to resume automatic sync."
              : hasConflicts
                ? `${result.conflicts} sync conflicts need review before the account is fully healthy again.`
                : null,
          },
        });
        return true;
      });
      if (!settled) {
        warnSyncJobReclaimed(job.id, isPartial ? "PARTIAL" : "SUCCEEDED");
      }
      return isPartial ? "partial" : "succeeded";
    } catch (error) {
      // P39-02: a deletion-threshold trip is a protective halt, not a failure.
      if (error instanceof DeletionThresholdError) {
        await markJobHalted({
          jobId: job.id,
          syncAccountId: job.syncAccountId,
          userId: job.syncAccount.userId,
          accountLabel: job.syncAccount.label,
          hold: error.hold,
        });
        return "halted";
      }
      await markJobFailed({
        jobId: job.id,
        syncAccountId: job.syncAccountId,
        _syncDirection: job.syncDirection,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        accountStatus: job.syncAccount.status,
        errorCode: toErrorCode(error),
        errorSummary: error instanceof Error ? error.message : "Sync failed.",
      });
      return "failed";
    }
  };

  // P49A-04: renews the lease of the job being run and registers it as
  // in-flight work; iterate() stops claiming once the process is shutting down
  // and releases the hold whichever way an iteration ends.
  const leaseKeeper = createSyncLeaseKeeper({
    renew: (jobIds, leaseExpiresAt) =>
      db.syncJob.updateMany({
        where: { id: { in: jobIds }, status: "RUNNING" },
        data: { leaseExpiresAt },
      }),
  });

  for (const job of leaseKeeper.iterate(queuedJobs)) {
    const leaseExpiresAt = nextSyncLeaseExpiry();
    const claim = await db.syncJob.updateMany({
      where: {
        id: job.id,
        status: "QUEUED",
      },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        workerId: "manual-runner",
        leaseExpiresAt,
      },
    });

    if (claim.count === 0) {
      summary.skipped += 1;
      continue;
    }
    leaseKeeper.hold(job.id);

    // Guard against same-account concurrent runs. A "Sync now" inline run may
    // claim and execute an older QUEUED job for an account while the cron
    // simultaneously claims a newer QUEUED job for the same account. Both would
    // read the pre-commit snapshot and try to create the same contacts, hitting
    // the syncUid unique constraint. If another job for this account is already
    // RUNNING, revert the claim and leave the job for the next drain pass.
    const siblingRunning = await db.syncJob.findFirst({
      where: {
        syncAccountId: job.syncAccountId,
        status: "RUNNING",
        id: { not: job.id },
      },
      select: { id: true },
    });
    if (siblingRunning) {
      await db.syncJob.updateMany({
        where: runningSyncJobWhere(job.id),
        data: { status: "QUEUED", startedAt: null, workerId: null, leaseExpiresAt: null },
      });
      summary.skipped += 1;
      continue;
    }

    summary.processed += 1;

    if (
      job.syncAccount.status === "PAUSED" ||
      job.syncAccount.status === "DISCONNECTED" ||
      job.syncAccount.status === "RETIRED"
    ) {
      const statusLabel = job.syncAccount.status.toLowerCase().replace("_", " ");
      const errorCode =
        job.syncAccount.status === "PAUSED"
          ? "SYNC_ACCOUNT_PAUSED"
          : job.syncAccount.status === "DISCONNECTED"
            ? "SYNC_ACCOUNT_DISCONNECTED"
            : "SYNC_ACCOUNT_RETIRED";
      await markJobFailed({
        jobId: job.id,
        syncAccountId: job.syncAccountId,
        _syncDirection: job.syncDirection,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        accountStatus: job.syncAccount.status,
        errorCode,
        errorSummary: `The queued sync job was skipped because the sync account is ${statusLabel}.`,
      });
      summary.failed += 1;
      continue;
    }

    // P27-01/04: OAuth connectors (Google, Microsoft). These accounts have no
    // addressBookUrl/CardDAV credentials, so they branch out before the
    // CardDAV-specific guards below. Each connector handles full vs incremental
    // (syncToken / delta link) internally.
    if (job.syncAccount.provider === "GOOGLE") {
      // P27-03: conflict policy drives both-changed + tombstone resolution.
      const settings = await getEffectiveSyncAccountSettings(job.syncAccountId);
      // P27-08: dedup runs only on the initial full import (no stored cursor).
      const wasFullImport = !job.syncAccount.lastSyncCursor;
      const outcome = await runOAuthSyncJob(
        job,
        () =>
          runGoogleSync({
            id: job.syncAccount.id,
            userId: job.syncAccount.userId,
            label: job.syncAccount.label,
            credentialReference: job.syncAccount.credentialReference,
            lastSyncCursor: job.syncAccount.lastSyncCursor,
            conflictPolicy: settings.conflictPolicy,
            syncDirection: job.syncAccount.syncDirection,
            deletionGuard: buildDeletionGuardContext(job, settings.maxDeletionsThreshold),
            excludedFields: normalizeExcludedFields(settings.excludedFields),
            exportLabelFilter: settings.exportLabelFilter,
          }),
        (error) => (error instanceof GoogleSyncError ? error.code : "GOOGLE_SYNC_FAILED"),
      );
      summary[outcome] += 1;
      if (wasFullImport && outcome !== "failed") {
        runPostImportDedupSafely(job.syncAccount.userId, job.syncAccountId, job.id, "google-import");
      }
      continue;
    }

    if (job.syncAccount.provider === "MICROSOFT") {
      const settings = await getEffectiveSyncAccountSettings(job.syncAccountId);
      const wasFullImport = !job.syncAccount.lastSyncCursor;
      const outcome = await runOAuthSyncJob(
        job,
        () =>
          runMicrosoftSync({
            id: job.syncAccount.id,
            userId: job.syncAccount.userId,
            label: job.syncAccount.label,
            credentialReference: job.syncAccount.credentialReference,
            lastSyncCursor: job.syncAccount.lastSyncCursor,
            conflictPolicy: settings.conflictPolicy,
            syncDirection: job.syncAccount.syncDirection,
            deletionGuard: buildDeletionGuardContext(job, settings.maxDeletionsThreshold),
            excludedFields: normalizeExcludedFields(settings.excludedFields),
            exportLabelFilter: settings.exportLabelFilter,
          }),
        (error) => (error instanceof MicrosoftSyncError ? error.code : "MICROSOFT_SYNC_FAILED"),
      );
      summary[outcome] += 1;
      if (wasFullImport && outcome !== "failed") {
        runPostImportDedupSafely(job.syncAccount.userId, job.syncAccountId, job.id, "outlook-import");
      }
      continue;
    }

    if (job.syncDirection === "EXPORT_ONLY") {
      await markJobFailed({
        jobId: job.id,
        syncAccountId: job.syncAccountId,
        _syncDirection: job.syncDirection,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        accountStatus: job.syncAccount.status,
        errorCode: "SYNC_DIRECTION_UNSUPPORTED",
        errorSummary:
          "EXPORT_ONLY is not available in the first live CardDAV sync slice yet. Use IMPORT_ONLY or TWO_WAY while Kontax runs bootstrap import sync.",
      });
      summary.failed += 1;
      continue;
    }

    if (
      !job.syncAccount.credentialReference ||
      job.syncAccount.credentialRevokedAt ||
      !job.syncAccount.addressBookUrl
    ) {
      await markJobFailed({
        jobId: job.id,
        syncAccountId: job.syncAccountId,
        _syncDirection: job.syncDirection,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        accountStatus: job.syncAccount.status,
        errorCode: "CREDENTIALS_MISSING",
        errorSummary:
          "The sync account is missing active encrypted credentials or an address book URL.",
      });
      summary.failed += 1;
      continue;
    }

    // P23-01: read the per-connection settings (falls back to platform defaults
    // when no row exists yet). conflictPolicy routes the conflict branch below;
    // bookAllowlist gates which books this account is allowed to sync.
    const settings = await getEffectiveSyncAccountSettings(job.syncAccountId);

    // Honor the book allowlist. The runner syncs one addressBookUrl per job, so
    // when the allowlist is non-empty and excludes this book, complete the job as
    // a no-op rather than a failure.
    if (
      settings.bookAllowlist.length > 0 &&
      !settings.bookAllowlist.includes(job.syncAccount.addressBookUrl)
    ) {
      await db.syncJob.updateMany({
        where: runningSyncJobWhere(job.id),
        data: {
          status: "SUCCEEDED",
          completedAt: new Date(),
          leaseExpiresAt: null,
          nextRetryAt: null,
          errorCode: null,
          errorSummary: "Skipped — this address book is excluded by the connection allowlist.",
        },
      });
      summary.skipped += 1;
      continue;
    }

    // P14-06: resolve the sync scope. Team-linked accounts operate on a team
    // book's contacts (owned by the group owner); personal accounts unchanged.
    const teamLink = job.syncAccount.teamLink;
    const scopeUserId = teamLink ? teamLink.group.ownerId : job.syncAccount.userId;
    const scopeLabel = teamLink
      ? `${job.syncAccount.label} · ${teamLink.group.name} · ${teamLink.addressBook.name}`
      : job.syncAccount.label;
    const contactScopeWhere = teamLink
      ? { groupContacts: { some: { groupAddressBookId: teamLink.addressBookId } } }
      : { userId: job.syncAccount.userId };

    let decryptedCredentials: ReturnType<typeof decryptSyncCredentialPayload>;

    try {
      decryptedCredentials = decryptSyncCredentialPayload(
        job.syncAccount.credentialReference,
        job.syncAccount.encryptionKeyRef,
      );
    } catch (error) {
      const errorSummary =
        error instanceof Error
          ? error.message
          : "Stored CardDAV credentials could not be decrypted.";

      await markJobFailed({
        jobId: job.id,
        syncAccountId: job.syncAccountId,
        _syncDirection: job.syncDirection,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        accountStatus: job.syncAccount.status,
        errorCode: "CREDENTIALS_UNREADABLE",
        errorSummary,
      });
      summary.failed += 1;
      continue;
    }

    // P48-16: lazy key rotation. The credentials just decrypted fine, so if the
    // row is on a retired key or the pre-keyring envelope, quietly rewrite it
    // under the current key. Best-effort — a failure here must never fail the
    // sync job, and the next run will simply try again.
    try {
      const rotated = reencryptSyncCredentialIfStale(
        job.syncAccount.credentialReference,
        job.syncAccount.encryptionKeyRef,
      );
      if (rotated) {
        await db.syncAccount.update({
          where: { id: job.syncAccountId },
          data: {
            credentialReference: rotated.credentialReference,
            encryptionKeyRef: rotated.encryptionKeyRef,
          },
        });
      }
    } catch (error) {
      console.warn(
        `[sync-runner] credential re-encryption skipped for account ${job.syncAccountId}:`,
        error,
      );
    }

    try {
      const now = new Date();
      // P39-03: excluded fields are stripped from both shadow sides (so a
      // change confined to them never syncs), omitted from inbound writes, and
      // grafted from the remote card into outbound vCard PUTs so the remote's
      // own values survive un-scrubbed.
      const excludedFields = normalizeExcludedFields(settings.excludedFields);
      const capabilityProfile = resolveSyncProviderCapabilityProfile({
        provider: job.syncAccount.provider,
        baseUrl: job.syncAccount.baseUrl,
        addressBookUrl: job.syncAccount.addressBookUrl,
        label: job.syncAccount.label,
        capabilityProfileOverride:
          job.syncAccount.settings?.capabilityProfileOverride ?? null,
      });
      const cardDavCredentials = {
        username: decryptedCredentials.username,
        password: decryptedCredentials.password,
      };
      // P49A-03: one REPORT gives every card with its raw vCard; the href /
      // ETag / UID index is derived from it below, so the ETag a push is
      // conditioned on and the raw card it preserves come from the same read.
      const fetchedCards = await fetchCardDavAddressBookCardsWithRaw({
        addressBookUrl: job.syncAccount.addressBookUrl,
        credentials: cardDavCredentials,
        // P44-03: decode PHOTO only when photo sync is on (avoids the b64 cost).
        includePhoto: PHOTO_SYNC_ENABLED,
      });

      const remoteUids = [...new Set(fetchedCards.map((fetched) => fetched.card.uid))];
      const existingContacts =
        remoteUids.length > 0
          ? await db.contact.findMany({
              where: {
                ...contactScopeWhere,
                syncUid: {
                  in: remoteUids,
                },
              },
              select: {
                id: true,
                syncUid: true,
                archivedAt: true,
              },
            })
          : [];
      const existingLinks = await db.syncContactLink.findMany({
        where: {
          syncAccountId: job.syncAccountId,
        },
        select: {
          id: true,
          remoteUid: true,
          remoteHref: true,
          remoteETag: true,
          capabilityProfileId: true,
          supportedFieldShadow: true,
          photoShadow: true,
          lastSyncedAt: true,
          tombstonedAt: true,
          contactId: true,
          contact: {
            select: {
              id: true,
              syncUid: true,
              syncVersion: true,
              updatedAt: true,
              archivedAt: true,
              avatarUrl: true,
              // P39-02: book grouping for the deletion-hold review card.
              book: { select: { name: true } },
              fullName: true,
              firstName: true,
              middleName: true,
              lastName: true,
              namePrefix: true,
              nameSuffix: true,
              nickname: true,
              email: true,
              emailAddresses: true,
              emailEntries: true,
              phone: true,
              phoneNumbers: true,
              phoneEntries: true,
              company: true,
              department: true,
              jobTitle: true,
              website: true,
              websiteEntries: true,
              birthday: true,
              // P49A-03 (A-03): pushed back to providers that round-trip
              // anniversaries (iCloud X-ABDATE); without it every push of a
              // linked contact sent "no dates" and wiped them remotely.
              significantDates: true,
              address: true,
              postalAddresses: true,
              addressEntries: true,
              notes: true,
            },
          },
        },
      });
      // P49A-03 (A-21): a book can hold several cards sharing one UID. Sync
      // exactly one per UID (the linked one first) and leave the rest alone —
      // two of them used to reach the contact/link creates and abort the whole
      // commit on the unique constraint, every run.
      const { kept: keptCards, dropped: duplicateUidCards } = dedupeCardDavCardsByUid(
        fetchedCards,
        new Map(existingLinks.map((link) => [link.remoteUid ?? link.contact.syncUid, link.remoteHref])),
      );
      if (duplicateUidCards.length > 0) {
        console.warn(
          `[sync] CardDAV account ${job.syncAccountId}: ${duplicateUidCards.length} remote card(s) share a UID with another card in the book; synced one card per UID and left the others untouched.`,
        );
      }
      const remoteCards = keptCards.map((fetched) => fetched.card);
      const remoteEntries = remoteCards.map(({ href, etag, uid }) => ({ href, etag, uid }));
      // P49A-03: the latest known state of each remote card (raw vCard + ETag).
      // Every PUT is built from it (unmodelled properties preserved) and
      // conditioned on its ETag; a successful PUT replaces it with what was sent.
      const remoteStateByUid = new Map<string, CardDavRemoteCardState>(
        keptCards.map((fetched) => [fetched.card.uid, { vcard: fetched.vcard, etag: fetched.card.etag }]),
      );
      const contactByUid = new Map(existingContacts.map((contact) => [contact.syncUid, contact]));
      const remoteEntryByUid = new Map(remoteEntries.map((entry) => [entry.uid, entry]));
      // Also index the remote index by href so we can fall back to href lookup when a
      // contact's UID changed in iCloud (e.g. after we inadvertently pushed a different
      // UID in the vCard body). Without this fallback the contact would appear as "deleted"
      // on the remote side even though it still exists at the same href.
      const remoteEntryByHref = new Map(remoteEntries.map((entry) => [entry.href, entry]));
      const remoteCardByUid = new Map(remoteCards.map((card) => [card.uid, card]));
      const linkedRemoteUids = new Set(
        existingLinks.map((link) => link.remoteUid ?? link.contact.syncUid),
      );
      // Guard: also index existing links by href so we can detect the case where iCloud
      // changed a contact's UID (e.g. after we pushed with a wrong UID in the vCard body).
      // Without this, those cards would fall into unmatchedCards and trigger a unique
      // constraint failure when we try to create a second link for the same href.
      const linkedHrefs = new Set(existingLinks.map((link) => link.remoteHref).filter(Boolean));
      const matchedEntries = remoteEntries.filter(
        (entry) => contactByUid.has(entry.uid) && !linkedRemoteUids.has(entry.uid),
      );
      const unmatchedCards = remoteCards.filter(
        (card) => !contactByUid.has(card.uid) && !linkedHrefs.has(card.href),
      );
      const conflictEntries: Array<{
        type: "LOCAL_REMOTE_MUTATION" | "DELETE_CONFLICT";
        linkId: string;
        contactId: string;
        localSyncVersion: number;
        remoteETag: string | null;
        localSnapshot: ReturnType<typeof buildLocalConflictSnapshot>;
        remoteSnapshot: unknown;
        resolutionNotes: string;
      }> = [];
      const remoteApplyCandidates: Array<{
        linkId: string;
        contactId: string;
        remoteETag: string | null;
        remoteSnapshot: unknown;
        capabilityDiagnostics: ProviderCapabilityDiagnostics | null;
        previousShadow: unknown;
      }> = [];
      let deferredLocalChangesCount = 0;
      const canWrite = job.syncDirection !== "IMPORT_ONLY";
      const localPushCandidates: Array<{
        linkId: string;
        remoteHref: string;
        remoteUid: string;
        // P49A-03: the link, for re-routing the push through the conflict path
        // when the remote card changed under it (412).
        link: (typeof existingLinks)[number];
        contact: SyncPushContactRow;
        // P49A-03: the remote card the push replaces (its raw vCard and ETag
        // are in remoteStateByUid under this card's UID).
        remoteCard: CardDavContactCard | null;
        // P39-03: the remote card's current values, grafted back into the
        // pushed vCard for excluded fields.
        remotePortable: PortableContactInput | null;
        capabilityDiagnostics: ProviderCapabilityDiagnostics | null;
      }> = [];
      const localDeleteCandidates: Array<{
        linkId: string;
        remoteHref: string;
        contactId: string;
        contactName: string;
        bookName: string;
        bookDetail: string | null;
      }> = [];
      // P49A-12: links of archived contacts whose remote card is already gone.
      const remoteGoneLinkIds: string[] = [];
      const metadataRefreshCandidates: Array<{
        linkId: string;
        remoteHref: string;
        remoteUid: string;
        remoteETag: string | null;
        supportedFieldShadow: ReturnType<typeof buildProviderSupportedContactShadow>;
        lastSyncedAt: Date;
      }> = [];
      // P23-05: audit trail for conflicts auto-resolved by SERVER_WINS / DEVICE_WINS.
      const autoResolvedEntries: Array<{
        linkId: string;
        contactId: string;
        localSyncVersion: number;
        remoteETag: string | null;
        localSnapshot: ReturnType<typeof buildLocalConflictSnapshot>;
        remoteSnapshot: unknown;
        strategy: "KEEP_REMOTE" | "KEEP_LOCAL";
      }> = [];

      // The remote card of a link is gone while the local contact is active.
      const recordRemoteMissing = (link: (typeof existingLinks)[number], remoteUid: string) => {
        if (link.contact.archivedAt) {
          // P49A-12 (A-16): deleted on both sides — settle the link so a
          // permanently deleted contact can be purged.
          if (!link.tombstonedAt) remoteGoneLinkIds.push(link.id);
          return;
        }
        conflictEntries.push({
          type: "DELETE_CONFLICT",
          linkId: link.id,
          contactId: link.contact.id,
          localSyncVersion: link.contact.syncVersion,
          remoteETag: link.remoteETag ?? null,
          localSnapshot: buildLocalConflictSnapshot(link.contact),
          remoteSnapshot: {
            deleted: true,
            remoteUid,
            remoteHref: link.remoteHref,
          },
          resolutionNotes:
            "Remote contact appears missing while the local contact is still active.",
        });
      };

      // P23-01: resolve a local↔remote mutation by the connection's policy.
      // P49A-03: shared by the classification below and by a push whose
      // If-Match lost the race (the re-read remote card differs from Kontax).
      const routeBothSidesChanged = (
        link: (typeof existingLinks)[number],
        remoteCard: CardDavContactCard,
      ) => {
        if (settings.conflictPolicy === "SERVER_WINS") {
          // Remote wins: apply the remote snapshot over the local contact.
          remoteApplyCandidates.push({
            linkId: link.id,
            contactId: link.contact.id,
            remoteETag: remoteCard.etag ?? null,
            remoteSnapshot: remoteCard,
            capabilityDiagnostics: buildProviderCapabilityDiagnostics(
              contactToPortable(link.contact),
              capabilityProfile,
            ),
            previousShadow: link.supportedFieldShadow,
          });
          // P23-05: record an AUTO_RESOLVED audit row for the applied conflict.
          autoResolvedEntries.push({
            linkId: link.id,
            contactId: link.contact.id,
            localSyncVersion: link.contact.syncVersion,
            remoteETag: remoteCard.etag ?? null,
            localSnapshot: buildLocalConflictSnapshot(link.contact),
            remoteSnapshot: remoteCard,
            strategy: "KEEP_REMOTE",
          });
          return;
        }
        if (settings.conflictPolicy === "DEVICE_WINS") {
          // Kontax wins: keep the local edit and let a later push carry it; do
          // not overwrite with the remote snapshot on this pull.
          deferredLocalChangesCount += 1;
          // P23-05: record an AUTO_RESOLVED audit row for the kept-local conflict.
          autoResolvedEntries.push({
            linkId: link.id,
            contactId: link.contact.id,
            localSyncVersion: link.contact.syncVersion,
            remoteETag: remoteCard.etag ?? null,
            localSnapshot: buildLocalConflictSnapshot(link.contact),
            remoteSnapshot: remoteCard,
            strategy: "KEEP_LOCAL",
          });
          return;
        }
        // MANUAL: surface a SyncConflict row for the review queue (P23-05).
        conflictEntries.push({
          type: "LOCAL_REMOTE_MUTATION",
          linkId: link.id,
          contactId: link.contact.id,
          localSyncVersion: link.contact.syncVersion,
          remoteETag: remoteCard.etag ?? null,
          localSnapshot: buildLocalConflictSnapshot(link.contact),
          remoteSnapshot: remoteCard,
          resolutionNotes:
            "Local and remote contact data both changed since the last healthy sync point.",
        });
      };

      // P39-04: the export label filter gates NEW outbound pushes only —
      // already-linked contacts keep syncing and are never deleted for
      // losing the label.
      const exportLabelWhere = canWrite
        ? await buildExportLabelFilterWhere(job.syncAccount.userId, settings.exportLabelFilter)
        : null;
      const localCreateCandidates: SyncPushContactRow[] =
        canWrite
          ? await db.contact.findMany({
              where: {
                ...contactScopeWhere,
                archivedAt: null,
                syncTombstoneAt: null,
                // P49A-12 (A-17): any non-sync writer (was MANUAL only).
                lastMutatedBy: { in: LOCAL_MUTATION_SOURCE_TYPES },
                syncLinks: { none: { syncAccountId: job.syncAccountId } },
                ...(exportLabelWhere ? { AND: [exportLabelWhere] } : {}),
              },
              select: cardDavPushContactSelect,
            })
          : [];

      for (const link of existingLinks) {
        const remoteUid = link.remoteUid ?? link.contact.syncUid;
        // Primary lookup: by the UID we have on record.
        // Fallback: by href — handles the edge case where iCloud updated the contact's UID
        // (e.g. because a previous sync inadvertently pushed a different UID in the vCard body).
        // Without this, the contact would appear "deleted" on the remote even though it exists.
        let remoteEntry = remoteEntryByUid.get(remoteUid);
        if (!remoteEntry && link.remoteHref) {
          remoteEntry = remoteEntryByHref.get(link.remoteHref);
        }
        const remoteCard = remoteEntry ? remoteCardByUid.get(remoteEntry.uid) : undefined;
        const localChanged =
          link.lastSyncedAt == null || link.contact.updatedAt.getTime() > link.lastSyncedAt.getTime();
        const remoteChanged = remoteEntry != null && !sameCardDavETag(remoteEntry.etag, link.remoteETag);
        const localSupportedShadow = buildProviderSupportedContactShadow(
          stripExcludedPortableFields(contactToPortable(link.contact), excludedFields),
          capabilityProfile,
        );
        const remoteSupportedShadow = remoteCard
          ? buildProviderSupportedContactShadow(
              stripExcludedPortableFields(cardDavCardToPortable(remoteCard), excludedFields),
              capabilityProfile,
            )
          : null;
        const supportedFieldsDiffer =
          remoteSupportedShadow == null
            ? true
            : !providerSupportedShadowsEqual(localSupportedShadow, remoteSupportedShadow);
        const localSupportedChanged = localChanged && supportedFieldsDiffer;
        const remoteSupportedChanged = remoteChanged && supportedFieldsDiffer;

        if (!remoteEntry) {
          recordRemoteMissing(link, remoteUid);
          continue;
        }

        if (localChanged && link.contact.archivedAt) {
          if (canWrite && link.remoteHref) {
            localDeleteCandidates.push({
              linkId: link.id,
              remoteHref: link.remoteHref,
              contactId: link.contact.id,
              contactName: link.contact.fullName,
              bookName: link.contact.book?.name ?? "Personal",
              bookDetail: link.contact.book ? null : "default",
            });
          } else {
            deferredLocalChangesCount += 1;
          }
          continue;
        }

        if (localSupportedChanged && remoteSupportedChanged && remoteCard) {
          routeBothSidesChanged(link, remoteCard);
          continue;
        }

        if (localSupportedChanged) {
          if (canWrite && link.remoteHref) {
            localPushCandidates.push({
              linkId: link.id,
              remoteHref: link.remoteHref,
              remoteUid: remoteUid ?? link.remoteHref,
              link,
              contact: link.contact,
              remoteCard: remoteCard ?? null,
              remotePortable: remoteCard ? cardDavCardToPortable(remoteCard) : null,
              capabilityDiagnostics: buildProviderCapabilityDiagnostics(
                contactToPortable(link.contact),
                capabilityProfile,
              ),
            });
          } else {
            deferredLocalChangesCount += 1;
          }
          continue;
        }

        if (remoteSupportedChanged && remoteCard) {
          remoteApplyCandidates.push({
            linkId: link.id,
            contactId: link.contact.id,
            remoteETag: remoteEntry.etag ?? null,
            remoteSnapshot: remoteCard,
            capabilityDiagnostics: buildProviderCapabilityDiagnostics(
              contactToPortable(link.contact),
              capabilityProfile,
            ),
            previousShadow: link.supportedFieldShadow,
          });
          continue;
        }

        if (remoteSupportedShadow) {
          metadataRefreshCandidates.push({
            linkId: link.id,
            remoteHref: remoteEntry.href,
            remoteUid: remoteEntry.uid,
            remoteETag: remoteEntry.etag ?? null,
            supportedFieldShadow: remoteSupportedShadow,
            lastSyncedAt: localChanged ? link.contact.updatedAt : now,
          });
        }
      }

      // P39-02: deletion-safety threshold — the outbound delete list is fully
      // known after classification and nothing has been written yet (remote or
      // local), so the guard halts here before any commit. CardDAV inbound
      // remote deletions surface as DELETE_CONFLICT rows, never auto-applied
      // deletes, so only the outbound direction counts for this provider.
      if (
        !job.syncAccount.deletionGuardBypassOnce &&
        exceedsDeletionThreshold(
          { inbound: 0, outbound: localDeleteCandidates.length },
          settings.maxDeletionsThreshold,
        )
      ) {
        throw new DeletionThresholdError(
          buildDeletionHoldPayload(
            localDeleteCandidates.map((candidate) => ({
              linkId: candidate.linkId,
              contactId: candidate.contactId,
              name: candidate.contactName,
              bookName: candidate.bookName,
              bookDetail: candidate.bookDetail,
              direction: "outbound" as const,
            })),
            settings.maxDeletionsThreshold!,
          ),
        );
      }

      // Checkpoint before anything is written: if a lease renewal found this
      // job reclaimed (its retry may already be running), stop here.
      leaseKeeper.assertLive(job.id);

      // Execute outbound writes to CardDAV (outside the DB transaction — network I/O).
      const pushedLinks: Array<{ linkId: string; newETag: string | null; newHref: string }> = [];
      const createdLinks: Array<{
        contactId: string;
        remoteUid: string;
        remoteHref: string;
        remoteETag: string | null;
        supportedFieldShadow: ReturnType<typeof buildProviderSupportedContactShadow>;
        lastSyncedAt: Date;
        capabilityDiagnostics: ProviderCapabilityDiagnostics | null;
      }> = [];
      const deletedLinkIds: Array<{ linkId: string; lastSyncedAt: Date }> =
        remoteGoneLinkIds.map((linkId) => ({ linkId, lastSyncedAt: now }));

      // P44-04: a full-card PUT with no PHOTO line would wipe the remote photo
      // (and cascade into deleting the local one on the next photo pass).
      // P49A-03: a field push now carries the remote PHOTO line through
      // verbatim (like every property it does not own), whether or not photo
      // sync is on — it used to wipe the photo with photo sync off. While photo
      // sync is on, a URI-form photo (iCloud) is still re-embedded as bytes, as
      // P44-04 verified; if they can't be fetched the URI line is kept instead.
      // The dedicated photo pass (below) is what changes the photo.
      const fieldPushPhoto = async (
        photo: CardDavRawPhoto | null | undefined,
      ): Promise<string | undefined> => {
        if (!PHOTO_SYNC_ENABLED || photo?.kind !== "uri") return undefined;
        const bytes = await fetchCardDavPhotoBytes(
          photo.uri,
          cardDavCredentials,
          job.syncAccount.addressBookUrl ?? undefined,
        );
        return bytes ? bytes.toString("base64") : undefined;
      };

      // P49A-03: the push lost its If-Match race — the remote card changed (or
      // vanished) after the REPORT. Nothing was written. Re-read it and route it
      // the way the classification above would have: gone → delete conflict;
      // now equal to Kontax → just refresh the link; otherwise the connection's
      // conflict policy (a MANUAL account gets one review-queue conflict).
      const rerouteAfterLostPushRace = async (
        candidate: (typeof localPushCandidates)[number],
        cardUid: string,
      ) => {
        const current = await fetchCardDavContact({
          href: candidate.remoteHref,
          credentials: cardDavCredentials,
          uid: cardUid,
          includePhoto: PHOTO_SYNC_ENABLED,
        });
        if (!current) {
          remoteStateByUid.delete(cardUid);
          remoteCardByUid.delete(cardUid);
          recordRemoteMissing(candidate.link, candidate.remoteUid);
          return;
        }
        remoteStateByUid.set(current.card.uid, { vcard: current.vcard, etag: current.card.etag });
        remoteCardByUid.set(current.card.uid, current.card);
        const localShadow = buildProviderSupportedContactShadow(
          stripExcludedPortableFields(contactToPortable(candidate.contact), excludedFields),
          capabilityProfile,
        );
        const remoteShadow = buildProviderSupportedContactShadow(
          stripExcludedPortableFields(cardDavCardToPortable(current.card), excludedFields),
          capabilityProfile,
        );
        if (providerSupportedShadowsEqual(localShadow, remoteShadow)) {
          metadataRefreshCandidates.push({
            linkId: candidate.linkId,
            remoteHref: current.card.href,
            remoteUid: current.card.uid,
            remoteETag: current.card.etag ?? null,
            supportedFieldShadow: remoteShadow,
            lastSyncedAt: candidate.contact.updatedAt,
          });
          return;
        }
        routeBothSidesChanged(candidate.link, current.card);
      };

      for (const candidate of localPushCandidates) {
        const cardUid = candidate.remoteCard?.uid ?? candidate.remoteUid;
        try {
          const result = await pushCardDavContact({
            addressBookUrl: job.syncAccount.addressBookUrl,
            credentials: cardDavCredentials,
            remoteUid: candidate.remoteUid,
            // P39-03: the full-card PUT carries the remote's own values for
            // excluded fields — local edits to them never propagate.
            contact: mergeExcludedFieldsFromRemote(
              contactToPortable(candidate.contact),
              candidate.remotePortable,
              excludedFields,
            ),
            capabilityProfile,
            hrefOverride: candidate.remoteHref || undefined,
            photoBase64: await fieldPushPhoto(candidate.remoteCard?.photo),
            // P49A-03: built from the card as read (unmodelled properties
            // preserved) and sent with If-Match on its ETag.
            remote: remoteStateByUid.get(cardUid),
          });
          remoteStateByUid.set(cardUid, { vcard: result.vcard, etag: result.etag });
          pushedLinks.push({ linkId: candidate.linkId, newETag: result.etag, newHref: result.href });
        } catch (err) {
          if (err instanceof CardDavPreflightError && err.code === CARDDAV_PUSH_PRECONDITION_FAILED) {
            try {
              await rerouteAfterLostPushRace(candidate, cardUid);
            } catch (rereadError) {
              console.error(
                `[sync] CardDAV re-read after a lost push race failed for link ${candidate.linkId}:`,
                rereadError,
              );
              deferredLocalChangesCount += 1;
            }
            continue;
          }
          console.error(`[sync] CardDAV push failed for link ${candidate.linkId}:`, err);
          deferredLocalChangesCount += 1;
        }
      }

      // P49A-03: a local contact whose UID is already on the remote is linked
      // to that card by matchedEntries in this run — "creating" it would PUT a
      // second card with the same UID (or replace the existing one).
      const remoteUidSet = new Set(remoteUids);
      for (const contact of localCreateCandidates) {
        if (remoteUidSet.has(contact.syncUid)) continue;
        try {
          const result = await pushCardDavContact({
            addressBookUrl: job.syncAccount.addressBookUrl,
            credentials: cardDavCredentials,
            remoteUid: contact.syncUid,
            // P39-03: excluded fields never reach a freshly-created remote card.
            contact: stripExcludedPortableFields(contactToPortable(contact), excludedFields),
            capabilityProfile,
            // P49A-03: a create — If-None-Match: * never replaces an existing card.
            remote: null,
          });
          createdLinks.push({
            contactId: contact.id,
            remoteUid: contact.syncUid,
            remoteHref: result.href,
            remoteETag: result.etag,
            supportedFieldShadow: buildProviderSupportedContactShadow(
              stripExcludedPortableFields(contactToPortable(contact), excludedFields),
              capabilityProfile,
            ),
            lastSyncedAt: contact.updatedAt,
            capabilityDiagnostics: buildProviderCapabilityDiagnostics(
              contactToPortable(contact),
              capabilityProfile,
            ),
          });
        } catch (err) {
          console.error(`[sync] CardDAV create failed for contact ${contact.id}:`, err);
          deferredLocalChangesCount += 1;
        }
      }

      for (const candidate of localDeleteCandidates) {
        try {
          await deleteCardDavContact({
            href: candidate.remoteHref,
            credentials: {
              username: decryptedCredentials.username,
              password: decryptedCredentials.password,
            },
          });
          deletedLinkIds.push({ linkId: candidate.linkId, lastSyncedAt: now });
        } catch (err) {
          console.error(`[sync] CardDAV delete failed for link ${candidate.linkId}:`, err);
          deferredLocalChangesCount += 1;
        }
      }

      // P49A-06 (A-25): set inside the transaction below — how many of the
      // unmatched remote cards fit under the plan's contact cap.
      let cardsToCreate = unmatchedCards;
      let capSkippedCount = 0;
      let capWarning: string | null = null;

      await db.$transaction(async (tx) => {
        // P49A-06 (A-25): lock the account the contacts are created under
        // (the team owner for a team sync) FIRST, as every create path does
        // (P48-17), then create only as many new contacts as fit under the
        // plan's cap. The rest are left unlinked (never deleted) and are
        // offered again on the next sync.
        if (unmatchedCards.length > 0) {
          const capacity = await getContactCapacityFor(tx, scopeUserId, { lock: true });
          if (capacity.remaining !== null && capacity.remaining < unmatchedCards.length) {
            cardsToCreate = unmatchedCards.slice(0, capacity.remaining);
            capSkippedCount = unmatchedCards.length - cardsToCreate.length;
            capWarning =
              capacity.limit !== null
                ? `${contactLimitMessage(capacity.planLabel, capacity.limit)} ${capSkippedCount} new contact${capSkippedCount === 1 ? " was" : "s were"} not imported (nothing was deleted). Upgrade your plan to import the rest.`
                : null;
          }
        }

        // P49A-04: conflicts newly opened by this run (re-detected ones only
        // refresh their existing OPEN row).
        let openedConflictCount = 0;
        for (const entry of matchedEntries) {
          const contact = contactByUid.get(entry.uid)!;

          await tx.syncContactLink.upsert({
            where: {
              syncAccountId_contactId: {
                syncAccountId: job.syncAccountId,
                contactId: contact.id,
              },
            },
            create: {
              syncAccountId: job.syncAccountId,
              contactId: contact.id,
              remoteHref: entry.href,
              remoteUid: entry.uid,
              remoteETag: entry.etag,
              capabilityProfileId: capabilityProfile.id,
              supportedFieldShadow:
                remoteCardByUid.has(entry.uid)
                  ? (buildProviderSupportedContactShadow(
                      stripExcludedPortableFields(
                        cardDavCardToPortable(remoteCardByUid.get(entry.uid)!),
                        excludedFields,
                      ),
                      capabilityProfile,
                    ) as Prisma.InputJsonValue)
                  : undefined,
              lastSyncedAt: now,
            },
            update: {
              remoteHref: entry.href,
              remoteUid: entry.uid,
              remoteETag: entry.etag,
              capabilityProfileId: capabilityProfile.id,
              supportedFieldShadow:
                remoteCardByUid.has(entry.uid)
                  ? (buildProviderSupportedContactShadow(
                      stripExcludedPortableFields(
                        cardDavCardToPortable(remoteCardByUid.get(entry.uid)!),
                        excludedFields,
                      ),
                      capabilityProfile,
                    ) as Prisma.InputJsonValue)
                  : undefined,
              remoteDeletedAt: null,
              tombstonedAt: null,
              lastErrorCode: null,
              lastErrorMessage: null,
              lastSyncedAt: now,
            },
          });
        }

        for (const created of createdLinks) {
          await tx.syncContactLink.upsert({
            where: {
              syncAccountId_contactId: {
                syncAccountId: job.syncAccountId,
                contactId: created.contactId,
              },
            },
            create: {
              syncAccountId: job.syncAccountId,
              contactId: created.contactId,
              remoteHref: created.remoteHref,
              remoteUid: created.remoteUid,
              remoteETag: created.remoteETag,
              capabilityProfileId: capabilityProfile.id,
              supportedFieldShadow: created.supportedFieldShadow,
              lastSyncedAt: created.lastSyncedAt,
            },
            update: {
              remoteHref: created.remoteHref,
              remoteUid: created.remoteUid,
              remoteETag: created.remoteETag,
              capabilityProfileId: capabilityProfile.id,
              supportedFieldShadow: created.supportedFieldShadow,
              remoteDeletedAt: null,
              tombstonedAt: null,
              lastErrorCode: null,
              lastErrorMessage: null,
              lastSyncedAt: created.lastSyncedAt,
            },
          });
        }

        for (const card of cardsToCreate) {
          // P39-03: excluded fields are dropped from the imported contact.
          const createdContact = await tx.contact.create({
            data: omitExcludedContactWriteData({
              userId: scopeUserId,
              syncUid: card.uid,
              fullName: card.fullName,
              firstName: card.firstName,
              middleName: card.middleName,
              lastName: card.lastName,
              namePrefix: card.namePrefix,
              nameSuffix: card.nameSuffix,
              nickname: card.nickname,
              // P49A-10: typed entries, legacy columns derived.
              ...multiValueWriteData({
                emailEntries: card.emailEntries,
                phoneEntries: card.phoneEntries,
                addressEntries: card.addressEntries,
                websiteEntries: card.websiteEntries,
              }),
              company: card.company,
              department: card.department,
              jobTitle: card.jobTitle,
              birthday: card.birthday,
              significantDates: providerSupportsSignificantDates(capabilityProfile) &&
                card.significantDates.length > 0 ? card.significantDates : undefined,
              notes: card.notes,
              sourceType: "SYNC_CARDDAV",
              sourceDetail: scopeLabel,
              lastMutatedBy: "SYNC_CARDDAV",
              lastMutatedByDetail: scopeLabel,
            }, excludedFields),
            select: {
              id: true,
              updatedAt: true,
            },
          });

          // P14-06: link a team-synced contact into the team book.
          if (teamLink) {
            await tx.groupContact.create({
              data: {
                groupAddressBookId: teamLink.addressBookId,
                contactId: createdContact.id,
                addedByUserId: job.syncAccount.userId,
              },
            });
          }

          const remoteEntry = remoteEntryByUid.get(card.uid);

          await tx.syncContactLink.create({
            data: {
              syncAccountId: job.syncAccountId,
              contactId: createdContact.id,
              remoteHref: remoteEntry?.href ?? card.href,
              remoteUid: card.uid,
              remoteETag: remoteEntry?.etag ?? card.etag,
              capabilityProfileId: capabilityProfile.id,
              supportedFieldShadow: buildProviderSupportedContactShadow(
                cardDavCardToPortable(card),
                capabilityProfile,
              ),
              // Use the contact's actual updatedAt (set by Prisma during create) so that
              // subsequent syncs don't falsely detect all bootstrapped contacts as localChanged.
              lastSyncedAt: createdContact.updatedAt,
            },
          });

          await emitEvent(tx, {
            userId: job.syncAccount.userId,
            contactId: createdContact.id,
            eventType: "SYNC_PULLED",
            actor: "SYNC",
            actorDetail: scopeLabel,
            payload: { syncAccountId: job.syncAccountId, syncAccountLabel: job.syncAccount.label },
          });
        }

        for (const remoteApply of remoteApplyCandidates) {
          // Guard: if the remote snapshot has no valid name (e.g. a Fastmail
          // contact whose FN field is blank), skip the update rather than
          // aborting the entire sync job. Record a soft error on the link so
          // the next sync retries, and advance the ETag so we don't re-fetch
          // the same unchanged vCard on every pass.
          const remoteFullName =
            isRecord(remoteApply.remoteSnapshot) &&
            typeof remoteApply.remoteSnapshot.fullName === "string"
              ? remoteApply.remoteSnapshot.fullName.trim()
              : "";
          if (!remoteFullName) {
            await tx.syncContactLink.update({
              where: { id: remoteApply.linkId },
              data: {
                remoteETag: remoteApply.remoteETag,
                lastErrorCode: "REMOTE_CONTACT_NO_NAME",
                lastErrorMessage: "Remote contact has no name — skipped update.",
              },
            });
            continue;
          }

          const updatedContact = await tx.contact.update({
            where: {
              id: remoteApply.contactId,
            },
            data: {
              // P39-03: excluded remote fields never overwrite local values.
              ...omitExcludedContactWriteData(
                buildContactWriteDataFromRemoteSnapshot(
                  remoteApply.remoteSnapshot,
                  capabilityProfile,
                  remoteApply.previousShadow,
                ),
                excludedFields,
              ),
              lastMutatedBy: "SYNC_CARDDAV",
              lastMutatedByDetail: job.syncAccount.label,
              syncVersion: {
                increment: 1,
              },
            },
            select: { id: true, updatedAt: true },
          });

          await tx.syncContactLink.update({
            where: {
              id: remoteApply.linkId,
            },
              data: {
                remoteETag: remoteApply.remoteETag,
                capabilityProfileId: capabilityProfile.id,
                supportedFieldShadow: buildProviderSupportedContactShadow(
                  stripExcludedPortableFields(
                    cardDavCardToPortable(remoteApply.remoteSnapshot as CardDavContactCard),
                    excludedFields,
                  ),
                  capabilityProfile,
                ),
                remoteDeletedAt: null,
                tombstonedAt: null,
                lastErrorCode: null,
              lastErrorMessage: null,
              // Use the contact's actual updatedAt so lastSyncedAt >= updatedAt,
              // preventing falsely detecting this pull as a local change next sync.
              lastSyncedAt: updatedContact.updatedAt,
            },
          });

          await emitEvent(tx, {
            userId: job.syncAccount.userId,
            contactId: remoteApply.contactId,
            eventType: "SYNC_PULLED",
            actor: "SYNC",
            actorDetail: scopeLabel,
            payload: {
              syncAccountId: job.syncAccountId,
              syncAccountLabel: job.syncAccount.label,
              ...capabilityDiagnosticsToEventPayload(
                remoteApply.capabilityDiagnostics,
              ),
            },
          });
        }

        for (const conflictEntry of conflictEntries) {
          // P49A-04 (A-06): one OPEN conflict per link. The same unresolved
          // divergence is detected again on every run; refresh the existing
          // row instead of stacking a new one (which auto-paused the account
          // once MANUAL_CONFLICT_QUEUE_LIMIT duplicates piled up).
          const recorded = await recordOpenSyncConflict(tx, {
            syncAccountId: job.syncAccountId,
            syncContactLinkId: conflictEntry.linkId,
            contactId: conflictEntry.contactId,
            conflictType: conflictEntry.type,
            localSyncVersion: conflictEntry.localSyncVersion,
            remoteETag: conflictEntry.remoteETag,
            localSnapshot: conflictEntry.localSnapshot,
            remoteSnapshot: conflictEntry.remoteSnapshot as Prisma.InputJsonValue,
            resolutionNotes: conflictEntry.resolutionNotes,
          });
          if (recorded.outcome !== "created") continue;
          openedConflictCount += 1;

          await emitEvent(tx, {
            userId: job.syncAccount.userId,
            contactId: conflictEntry.contactId,
            eventType: "SYNC_CONFLICT_DETECTED",
            actor: "SYNC",
            actorDetail: scopeLabel,
            payload: {
              conflictType: conflictEntry.type,
              remoteETag: conflictEntry.remoteETag ?? undefined,
            },
          });
        }

        // Update sync links for contacts successfully pushed to the remote.
        for (const pushed of pushedLinks) {
          const pushedLink = localPushCandidates.find((candidate) => candidate.linkId === pushed.linkId);
          await tx.syncContactLink.update({
            where: { id: pushed.linkId },
            data: {
              remoteHref: pushed.newHref,
              remoteETag: pushed.newETag,
              capabilityProfileId: capabilityProfile.id,
              ...(pushedLink
                ? {
                    supportedFieldShadow: buildProviderSupportedContactShadow(
                      stripExcludedPortableFields(
                        contactToPortable(pushedLink.contact),
                        excludedFields,
                      ),
                      capabilityProfile,
                    ),
                  }
                : {}),
              lastSyncedAt: now,
              lastErrorCode: null,
              lastErrorMessage: null,
            },
          });

          if (pushedLink) {
            await emitEvent(tx, {
              userId: job.syncAccount.userId,
              contactId: pushedLink.contact.id,
              eventType: "SYNC_PUSHED",
              actor: "SYNC",
              actorDetail: scopeLabel,
              payload: {
                syncAccountId: job.syncAccountId,
                syncAccountLabel: job.syncAccount.label,
                ...capabilityDiagnosticsToEventPayload(
                  pushedLink.capabilityDiagnostics,
                ),
              },
            });
          }
        }

        for (const created of createdLinks) {
          await emitEvent(tx, {
            userId: job.syncAccount.userId,
            contactId: created.contactId,
            eventType: "SYNC_PUSHED",
            actor: "SYNC",
            actorDetail: scopeLabel,
            payload: {
              syncAccountId: job.syncAccountId,
              syncAccountLabel: job.syncAccount.label,
              ...capabilityDiagnosticsToEventPayload(
                created.capabilityDiagnostics,
              ),
            },
          });
        }

        for (const refresh of metadataRefreshCandidates) {
          await tx.syncContactLink.update({
            where: { id: refresh.linkId },
            data: {
              remoteHref: refresh.remoteHref,
              remoteUid: refresh.remoteUid,
              remoteETag: refresh.remoteETag,
              capabilityProfileId: capabilityProfile.id,
              supportedFieldShadow: refresh.supportedFieldShadow,
              remoteDeletedAt: null,
              tombstonedAt: null,
              lastErrorCode: null,
              lastErrorMessage: null,
              lastSyncedAt: refresh.lastSyncedAt,
            },
          });
        }

        // Tombstone sync links for contacts deleted on the remote.
        for (const deleted of deletedLinkIds) {
          await tx.syncContactLink.update({
            where: { id: deleted.linkId },
            data: { tombstonedAt: now, lastSyncedAt: deleted.lastSyncedAt },
          });
        }

        // P23-05: persist AUTO_RESOLVED audit rows for policy-resolved conflicts.
        for (const auto of autoResolvedEntries) {
          await tx.syncConflict.create({
            data: {
              syncAccountId: job.syncAccountId,
              syncContactLinkId: auto.linkId,
              contactId: auto.contactId,
              conflictType: "LOCAL_REMOTE_MUTATION",
              status: "AUTO_RESOLVED",
              resolutionStrategy: auto.strategy,
              resolvedAt: now,
              localSyncVersion: auto.localSyncVersion,
              remoteETag: auto.remoteETag,
              localSnapshot: auto.localSnapshot,
              remoteSnapshot: auto.remoteSnapshot as Prisma.InputJsonValue,
              resolutionNotes:
                auto.strategy === "KEEP_REMOTE"
                  ? "Auto-resolved by the Server-wins policy: remote change applied."
                  : "Auto-resolved by the Kontax-wins policy: local change kept.",
            },
          });
        }

        // P23-05: auto-pause when the manual review queue fills up.
        const openConflictCount = await tx.syncConflict.count({
          where: { syncAccountId: job.syncAccountId, status: "OPEN" },
        });
        const queueFull = openConflictCount >= MANUAL_CONFLICT_QUEUE_LIMIT;

        const settledJob = await tx.syncJob.updateMany({
          where: runningSyncJobWhere(job.id),
          data: {
            status: conflictEntries.length > 0 || capSkippedCount > 0 ? "PARTIAL" : "SUCCEEDED",
            completedAt: new Date(),
            leaseExpiresAt: null,
            nextRetryAt: null,
            // Inbound (remote -> Kontax). Remote deletions surface as conflicts
            // rather than auto-applied deletes, so the inbound delete count is 0.
            createdCount: cardsToCreate.length,
            updatedCount: matchedEntries.length + remoteApplyCandidates.length,
            deletedCount: 0,
            conflictCount: conflictEntries.length,
            // Outbound (Kontax -> remote). CardDAV now creates new unlinked
            // local MANUAL contacts remotely, plus updates/deletes linked ones.
            pushedCreatedCount: createdLinks.length,
            pushedUpdatedCount: pushedLinks.length,
            pushedDeletedCount: deletedLinkIds.length,
            skippedCount: deferredLocalChangesCount + capSkippedCount,
            cursorBefore: job.syncAccount.remoteCTag ?? job.cursorBefore ?? job.syncAccount.addressBookUrl,
            cursorAfter: String(remoteEntries.length),
            errorCode:
              conflictEntries.length > 0
                ? "SYNC_CONFLICTS_OPEN"
                : capSkippedCount > 0
                  ? CONTACT_LIMIT_REACHED_CODE
                  : null,
            errorSummary: (() => {
              const parts: string[] = [];
              if (cardsToCreate.length > 0) parts.push(`imported ${cardsToCreate.length} new`);
              const pulled = matchedEntries.length + remoteApplyCandidates.length;
              if (pulled > 0) parts.push(`pulled ${pulled} remote update${pulled !== 1 ? "s" : ""}`);
              if (createdLinks.length > 0) parts.push(`created ${createdLinks.length} remote contact${createdLinks.length !== 1 ? "s" : ""}`);
              if (pushedLinks.length > 0) parts.push(`pushed ${pushedLinks.length} local update${pushedLinks.length !== 1 ? "s" : ""}`);
              if (deletedLinkIds.length > 0) parts.push(`deleted ${deletedLinkIds.length} remote`);
              if (deferredLocalChangesCount > 0) parts.push(`deferred ${deferredLocalChangesCount} local change${deferredLocalChangesCount !== 1 ? "s" : ""}`);
              // P49A-03 (A-21): duplicate-UID remote cards left untouched.
              if (duplicateUidCards.length > 0) parts.push(`skipped ${duplicateUidCards.length} remote card${duplicateUidCards.length !== 1 ? "s" : ""} with a duplicate UID`);
              if (openedConflictCount > 0) parts.push(`opened ${openedConflictCount} conflict${openedConflictCount !== 1 ? "s" : ""}`);
              const stillOpen = conflictEntries.length - openedConflictCount;
              if (stillOpen > 0) parts.push(`${stillOpen} conflict${stillOpen !== 1 ? "s" : ""} still awaiting review`);
              const synced =
                parts.length > 0 ? `Synced: ${parts.join(", ")}.` : `Sync complete — no changes.`;
              return capWarning ? `${synced} ${capWarning}` : synced;
            })(),
          },
        });
        // Reclaimed mid-run: the links/contacts above still commit (the
        // remote pushes already happened), but the job row keeps its reclaimed
        // FAILED/LEASE_EXPIRED state instead of being overwritten.
        if (settledJob.count === 0) {
          warnSyncJobReclaimed(
            job.id,
            conflictEntries.length > 0 || capSkippedCount > 0 ? "PARTIAL" : "SUCCEEDED",
          );
        }

        await tx.syncAccount.update({
          where: { id: job.syncAccountId },
          data: {
            status: queueFull || job.syncAccount.status === "PAUSED" ? "PAUSED" : "ACTIVE",
            remoteCTag: String(remoteEntries.length),
            lastSyncCursor: String(remoteEntries.length),
            lastSyncedAt: now,
            lastSucceededAt: now,
            // P39-02: a completed run settles any deletion hold.
            deletionHold: Prisma.DbNull,
            deletionHoldAt: null,
            deletionGuardBypassOnce: false,
            lastErrorAt: queueFull || conflictEntries.length > 0 ? now : null,
            lastErrorCode: queueFull
              ? CONFLICT_QUEUE_FULL_CODE
              : conflictEntries.length > 0
                ? "SYNC_CONFLICTS_OPEN"
                : null,
            lastErrorMessage: queueFull
              ? `Sync paused — the manual conflict queue is full (${openConflictCount} open conflicts). Resolve conflicts to resume automatic sync.`
              : conflictEntries.length > 0
                ? `${conflictEntries.length} sync conflicts need review before the account is fully healthy again.`
                : null,
          },
        });
      },
      // A large book issues hundreds of sequential writes in this commit
      // (link upserts, metadata refreshes, bulk first imports) — the Prisma
      // interactive-transaction default of 5s aborts mid-commit on big books
      // or high-latency links. P39-08 surfaced this on a ~1k-contact book.
      // SYNC_COMMIT_TX_TIMEOUT_MS overrides for high-latency DB links (e.g.
      // the QA harness running over VPN against the staging DB).
      {
        maxWait: 15_000,
        timeout: Number(process.env.SYNC_COMMIT_TX_TIMEOUT_MS ?? "") || 120_000,
      });

      // P44-03/04: contact photo pass. Runs after the field commit (so contacts
      // and links exist) and outside any DB transaction (it does network I/O).
      // Only reconciles contacts still present remotely — remote deletions are
      // handled by the conflict path above, not here.
      if (PHOTO_SYNC_ENABLED) {
        try {
          const photoExcluded = isPhotoExcluded(settings.excludedFields);
          // EXPORT_ONLY is rejected earlier for CardDAV, so inbound is always
          // permitted here; outbound follows canWrite (false for IMPORT_ONLY).
          const cap = {
            canPull: !photoExcluded,
            canPush: !photoExcluded && canWrite,
          };
          const creds = {
            username: decryptedCredentials.username,
            password: decryptedCredentials.password,
          };
          const abUrl: string = job.syncAccount.addressBookUrl;
          const photoLinks: PhotoPassLink[] = [];
          // P49A-03: a link left with an open field conflict this run is not
          // photo-synced until the conflict is resolved — a photo PUT would move
          // the stored ETag past the remote edit awaiting review, and the next
          // run would then push the local fields over it.
          const fieldConflictLinkIds = new Set(conflictEntries.map((entry) => entry.linkId));
          for (const link of existingLinks) {
            if (!link.remoteUid) continue;
            if (fieldConflictLinkIds.has(link.id)) continue;
            const uid: string = link.remoteUid;
            const card = remoteCardByUid.get(uid);
            if (!card) continue; // not present remotely → deletion path owns it
            const photo = card.photo ?? null;

            let remote: RemotePhotoState;
            let signalKind: PhotoSignalKind;
            let loadRemoteBytes: () => Promise<Buffer | null>;
            if (!photo) {
              remote = { hasPhoto: false, signal: null };
              signalKind = "contentHash";
              loadRemoteBytes = async () => null;
            } else if (photo.kind === "inline") {
              const bytes = Buffer.from(photo.base64.replace(/\s+/g, ""), "base64");
              remote = { hasPhoto: bytes.length > 0, signal: bytes.length > 0 ? hashBytes(bytes) : null };
              signalKind = "contentHash";
              loadRemoteBytes = async () => bytes;
            } else {
              remote = { hasPhoto: true, signal: photo.uri };
              signalKind = "resourceIdentifier";
              loadRemoteBytes = async () => fetchCardDavPhotoBytes(photo.uri, creds, abUrl);
            }

            // P49A-03: a photo push changes only the PHOTO — the latest known
            // remote card (as read, or as this run's field push left it) with
            // its PHOTO swapped, sent with If-Match. Kontax fields are not
            // re-projected here, so a photo push can't undo a remote edit that
            // was applied or deferred this run. A 412 throws; runPhotoPass
            // records the failure for this link and the next run retries.
            const pushCardWithPhoto = async (photoBase64: string | null): Promise<string | null> => {
              let state = remoteStateByUid.get(uid);
              if (state?.etag == null) {
                // No ETag to condition on (a PUT response may omit it): re-read.
                const current = await fetchCardDavContact({ href: card.href, credentials: creds, uid });
                if (!current) {
                  throw new Error("The remote card is gone; its photo is reconciled on the next sync.");
                }
                state = { vcard: current.vcard, etag: current.card.etag };
              }
              const vcard = replaceVCardPhoto(state.vcard, photoBase64);
              const res = await putCardDavVCard({
                href: card.href,
                credentials: creds,
                vcard,
                ifMatch: toIfMatchValue(state.etag),
              });
              remoteStateByUid.set(uid, { vcard, etag: res.etag });
              return res.etag;
            };

            photoLinks.push({
              linkId: link.id,
              contactId: link.contactId,
              avatarUrl: link.contact.avatarUrl ?? null,
              shadow: parsePhotoShadow(link.photoShadow),
              signalKind,
              remote,
              loadRemoteBytes,
              pushCanonical: async (b64): Promise<PushSeed> => {
                const decoded = Buffer.from(b64, "base64");
                const etag = await pushCardWithPhoto(b64);
                // CardDAV is byte-stable (P44-01) → the canonical remote copy is
                // exactly what we pushed; no read-back round trip needed.
                return { remoteSignal: hashBytes(decoded), remoteCanonicalHash: hashBytes(decoded), remoteETag: etag };
              },
              deleteRemote: async () => {
                await pushCardWithPhoto(null);
              },
            });
          }

          const tally = await runPhotoPass(
            db,
            {
              userId: job.syncAccount.userId,
              syncAccountId: job.syncAccountId,
              syncAccountLabel: job.syncAccount.label,
            },
            cap,
            photoLinks,
          );
          const inbound = tally.pulled + tally.deletedLocal;
          const outbound = tally.pushed + tally.deletedRemote;
          if (inbound + outbound > 0) {
            await db.syncJob.update({
              where: { id: job.id },
              data: {
                updatedCount: { increment: inbound },
                pushedUpdatedCount: { increment: outbound },
              },
            });
          }
        } catch (error) {
          console.warn(`[Kontax] CardDAV photo pass failed for account ${job.syncAccountId}`, error);
        }
      }

      if (conflictEntries.length > 0) {
        summary.partial += 1;
      } else {
        summary.succeeded += 1;
      }
    } catch (error) {
      // P39-02: a deletion-threshold trip is a protective halt, not a failure.
      if (error instanceof DeletionThresholdError) {
        await markJobHalted({
          jobId: job.id,
          syncAccountId: job.syncAccountId,
          userId: job.syncAccount.userId,
          accountLabel: job.syncAccount.label,
          hold: error.hold,
        });
        summary.halted += 1;
        continue;
      }

      const errorCode =
        error instanceof CardDavPreflightError ? error.code : "CARDDAV_SYNC_FAILED";
      const errorSummary =
        error instanceof Error
          ? error.message
          : "CardDAV sync execution failed before Kontax could refresh local state.";

      await markJobFailed({
        jobId: job.id,
        syncAccountId: job.syncAccountId,
        _syncDirection: job.syncDirection,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        accountStatus: job.syncAccount.status,
        errorCode,
        errorSummary,
      });
      summary.failed += 1;
    }
  }

  return summary;
};
