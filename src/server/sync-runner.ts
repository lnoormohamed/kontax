import type { Prisma } from "../../generated/prisma";
import {
  CardDavPreflightError,
  deleteCardDavContact,
  fetchCardDavAddressBookCards,
  fetchCardDavAddressBookIndex,
  pushCardDavContact,
} from "~/server/carddav";
import type { PortableContactInput } from "~/server/contact-portability";
import { db } from "~/server/db";
import { emitEvent } from "~/lib/activity";
import { createNotification } from "~/server/notifications";
import {
  AUTO_PAUSE_FAILURE_STREAK,
  CONFLICT_QUEUE_FULL_CODE,
  MANUAL_CONFLICT_QUEUE_LIMIT,
  getConsecutiveFailureStreak,
  getSyncErrorSupportBucket,
} from "~/server/sync-health";
import { decryptSyncCredentialPayload } from "~/server/sync-credentials";
import { GoogleSyncError, runGoogleSync } from "~/server/google-sync";
import { MicrosoftSyncError, runMicrosoftSync } from "~/server/microsoft-sync";
import { buildLocalConflictSnapshot } from "~/server/sync-conflict-snapshot";
import { runPostImportDeduplication } from "~/server/sync-dedup";
import {
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
  jobTitle: string | null;
  website: string | null;
  websiteEntries?: unknown;
  birthday: string | null;
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

const safeStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

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
          },
        ];
      })
    : [];

const contactToPortable = (c: SyncContactRow): PortableContactInput => ({
  fullName: c.fullName,
  firstName: c.firstName,
  lastName: c.lastName,
  nickname: c.nickname,
  email: c.email,
  emailAddresses: safeStringArray(c.emailAddresses),
  emailEntries: safeValueEntries(c.emailEntries),
  phone: c.phone,
  phoneNumbers: safeStringArray(c.phoneNumbers),
  phoneEntries: safeValueEntries(c.phoneEntries),
  company: c.company,
  jobTitle: c.jobTitle,
  website: c.website,
  websiteEntries: safeValueEntries(c.websiteEntries),
  birthday: c.birthday,
  address: c.address,
  postalAddresses: Array.isArray(c.postalAddresses)
    ? (c.postalAddresses as PortableContactInput["postalAddresses"])
    : null,
  addressEntries: safeAddressEntries(c.addressEntries),
  notes: c.notes,
});

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
  jobTitle: true,
  website: true,
  websiteEntries: true,
  birthday: true,
  address: true,
  postalAddresses: true,
  addressEntries: true,
  notes: true,
} satisfies Prisma.ContactSelect;

const buildContactWriteDataFromRemoteSnapshot = (snapshot: unknown) => {
  if (!isRecord(snapshot)) {
    throw new Error("Remote sync snapshot is missing or invalid.");
  }

  const fullName = typeof snapshot.fullName === "string" ? snapshot.fullName.trim() : "";

  if (!fullName) {
    throw new Error("Remote sync snapshot does not contain a valid contact name.");
  }

  const emailAddresses = Array.isArray(snapshot.emailAddresses)
    ? snapshot.emailAddresses.filter((value): value is string => typeof value === "string")
    : [];
  const phoneNumbers = Array.isArray(snapshot.phoneNumbers)
    ? snapshot.phoneNumbers.filter((value): value is string => typeof value === "string")
    : [];

  return {
    fullName,
    firstName: typeof snapshot.firstName === "string" ? snapshot.firstName : null,
    middleName: typeof snapshot.middleName === "string" ? snapshot.middleName : null,
    lastName: typeof snapshot.lastName === "string" ? snapshot.lastName : null,
    namePrefix: typeof snapshot.namePrefix === "string" ? snapshot.namePrefix : null,
    nameSuffix: typeof snapshot.nameSuffix === "string" ? snapshot.nameSuffix : null,
    nickname: typeof snapshot.nickname === "string" ? snapshot.nickname : null,
    email: emailAddresses[0] ?? (typeof snapshot.email === "string" ? snapshot.email : null),
    emailAddresses: emailAddresses.length > 0 ? emailAddresses : undefined,
    emailEntries: Array.isArray(snapshot.emailEntries) ? snapshot.emailEntries : undefined,
    phone: phoneNumbers[0] ?? (typeof snapshot.phone === "string" ? snapshot.phone : null),
    phoneNumbers: phoneNumbers.length > 0 ? phoneNumbers : undefined,
    phoneEntries: Array.isArray(snapshot.phoneEntries) ? snapshot.phoneEntries : undefined,
    company: typeof snapshot.company === "string" ? snapshot.company : null,
    jobTitle: typeof snapshot.jobTitle === "string" ? snapshot.jobTitle : null,
    website: typeof snapshot.website === "string" ? snapshot.website : null,
    websiteEntries: Array.isArray(snapshot.websiteEntries) ? snapshot.websiteEntries : undefined,
    birthday: typeof snapshot.birthday === "string" ? snapshot.birthday : null,
    address: typeof snapshot.address === "string" ? snapshot.address : null,
    postalAddresses: Array.isArray(snapshot.postalAddresses) ? snapshot.postalAddresses : undefined,
    addressEntries: Array.isArray(snapshot.addressEntries) ? snapshot.addressEntries : undefined,
    notes: typeof snapshot.notes === "string" ? snapshot.notes : null,
  };
};

const getFailureStatus = (
  accountStatus: "ACTIVE" | "PAUSED" | "NEEDS_REAUTH" | "ERROR" | "DISCONNECTED",
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

  return accountStatus === "PAUSED" ? "PAUSED" : "ERROR";
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
  accountStatus: "ACTIVE" | "PAUSED" | "NEEDS_REAUTH" | "ERROR" | "DISCONNECTED";
  errorCode: string;
  errorSummary: string;
}) => {
  const now = new Date();
  const baseFailureStatus = getFailureStatus(accountStatus, errorCode);
  const recentJobs = await db.syncJob.findMany({
    where: {
      syncAccountId,
      id: {
        not: jobId,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: AUTO_PAUSE_FAILURE_STREAK - 1,
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
    failureStreak >= AUTO_PAUSE_FAILURE_STREAK &&
    supportBucket !== "authentication";
  const finalStatus = shouldAutoPause ? "PAUSED" : baseFailureStatus;
  const finalErrorSummary = shouldAutoPause
    ? `${errorSummary} Kontax paused this sync account after ${failureStreak} consecutive ${supportBucket} failures so it does not keep retrying unattended.`
    : errorSummary;

  await db.$transaction([
    db.syncJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        completedAt: now,
        leaseExpiresAt: null,
        nextRetryAt:
          attemptCount < maxAttempts && !shouldAutoPause
            ? createRetrySchedule(attemptCount + 1)
            : null,
        errorCode,
        errorSummary: finalErrorSummary,
      },
    }),
    db.syncAccount.update({
      where: { id: syncAccountId },
      data: {
        status: finalStatus,
        lastErrorAt: now,
        lastErrorCode: errorCode,
        lastErrorMessage: finalErrorSummary,
      },
    }),
  ]);

  // P22-DB05: notify on the transition into an attention-needed state (re-auth
  // required or auto-paused) — not on every transient retry.
  if (
    (finalStatus === "NEEDS_REAUTH" || finalStatus === "PAUSED") &&
    accountStatus !== finalStatus
  ) {
    const account = await db.syncAccount.findUnique({
      where: { id: syncAccountId },
      select: { userId: true, provider: true },
    });
    if (account) {
      const needsReauth = finalStatus === "NEEDS_REAUTH";
      await createNotification({
        userId: account.userId,
        category: "SYNC_STATUS",
        title: `Sync error — ${account.provider}`,
        body: needsReauth
          ? "Re-authentication is required to keep this account in sync."
          : "Kontax paused this sync account after repeated failures. Review it to resume syncing.",
        actionUrl: "/sync",
      });
    }
  }
};

// P27-08: best-effort post-import dedup. Never throws — the sync job has
// already succeeded; a dedup failure must not flip it to failed.
const runPostImportDedupSafely = async (
  userId: string,
  syncAccountId: string,
  syncJobId: string,
  source: string,
) => {
  try {
    await runPostImportDeduplication({ userId, syncAccountId, syncJobId, source });
  } catch {
    // swallow — dedup is advisory; the import already committed.
  }
};

// P34D-03: enqueue a SCHEDULED sync for every ACTIVE account that is due per its
// effective frequency. Skips manual-only accounts and accounts that already have
// a QUEUED/RUNNING job (so ticks don't pile up). The cron route runs the queue
// afterwards. Returns counts for observability.
export const enqueueDueSyncJobs = async (): Promise<{ enqueued: number; skipped: number }> => {
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

    await db.syncJob.create({
      data: {
        syncAccountId: account.id,
        status: "QUEUED",
        trigger: "SCHEDULED",
        syncDirection: account.syncDirection,
        attemptCount: 1,
        maxAttempts: 5,
        nextRetryAt: new Date(),
        idempotencyKey: `${account.id}:scheduled:${now}`,
      },
    });
    enqueued += 1;
  }

  return { enqueued, skipped };
};

export const runQueuedSyncJobs = async ({
  limit = 5,
  syncAccountId,
}: { limit?: number; syncAccountId?: string } = {}) => {
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
          credentialRevokedAt: true,
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
  };
  const runOAuthSyncJob = async (
    job: (typeof queuedJobs)[number],
    run: () => Promise<OAuthSyncResult>,
    toErrorCode: (error: unknown) => string,
  ): Promise<"succeeded" | "partial" | "failed"> => {
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
      await db.$transaction([
        db.syncJob.update({
          where: { id: job.id },
          data: {
            status: hasConflicts ? "PARTIAL" : "SUCCEEDED",
            completedAt: now,
            leaseExpiresAt: null,
            nextRetryAt: null,
            errorCode: hasConflicts ? "SYNC_CONFLICTS_OPEN" : null,
            errorSummary: hasConflicts
              ? `${result.conflicts} sync conflicts need review before this account is fully healthy again.`
              : null,
            createdCount: result.created,
            updatedCount: result.updated,
            deletedCount: result.deleted,
            conflictCount: result.conflicts,
            pushedCreatedCount: result.pushedCreated ?? 0,
            pushedUpdatedCount: result.pushedUpdated ?? 0,
            pushedDeletedCount: result.pushedDeleted ?? 0,
          },
        }),
        db.syncAccount.update({
          where: { id: job.syncAccountId },
          data: {
            status: result.queueFull ? "PAUSED" : "ACTIVE",
            lastSucceededAt: now,
            lastSyncedAt: now,
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
        }),
      ]);
      return hasConflicts ? "partial" : "succeeded";
    } catch (error) {
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

  for (const job of queuedJobs) {
    const leaseExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
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
      await db.syncJob.update({
        where: { id: job.id },
        data: { status: "QUEUED", startedAt: null, workerId: null, leaseExpiresAt: null },
      });
      summary.skipped += 1;
      continue;
    }

    summary.processed += 1;

    if (job.syncAccount.status === "PAUSED") {
      await markJobFailed({
        jobId: job.id,
        syncAccountId: job.syncAccountId,
        _syncDirection: job.syncDirection,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        accountStatus: job.syncAccount.status,
        errorCode: "SYNC_ACCOUNT_PAUSED",
        errorSummary: "The queued sync job was skipped because the sync account is paused.",
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
          }),
        (error) => (error instanceof GoogleSyncError ? error.code : "GOOGLE_SYNC_FAILED"),
      );
      summary[outcome] += 1;
      if (wasFullImport && outcome !== "failed") {
        await runPostImportDedupSafely(job.syncAccount.userId, job.syncAccountId, job.id, "google-import");
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
          }),
        (error) => (error instanceof MicrosoftSyncError ? error.code : "MICROSOFT_SYNC_FAILED"),
      );
      summary[outcome] += 1;
      if (wasFullImport && outcome !== "failed") {
        await runPostImportDedupSafely(job.syncAccount.userId, job.syncAccountId, job.id, "outlook-import");
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
      await db.syncJob.update({
        where: { id: job.id },
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
      decryptedCredentials = decryptSyncCredentialPayload(job.syncAccount.credentialReference);
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

    try {
      const now = new Date();
      const remoteEntries = await fetchCardDavAddressBookIndex({
        addressBookUrl: job.syncAccount.addressBookUrl,
        credentials: {
          username: decryptedCredentials.username,
          password: decryptedCredentials.password,
        },
      });
      const remoteCards = await fetchCardDavAddressBookCards({
        addressBookUrl: job.syncAccount.addressBookUrl,
        credentials: {
          username: decryptedCredentials.username,
          password: decryptedCredentials.password,
        },
      });

      const remoteUids = remoteEntries.map((entry) => entry.uid);
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
          lastSyncedAt: true,
          contactId: true,
          contact: {
            select: {
              id: true,
              syncUid: true,
              syncVersion: true,
              updatedAt: true,
              archivedAt: true,
              fullName: true,
              firstName: true,
              middleName: true,
              lastName: true,
              namePrefix: true,
              nameSuffix: true,
              nickname: true,
              email: true,
              emailAddresses: true,
              phone: true,
              phoneNumbers: true,
              company: true,
              jobTitle: true,
              website: true,
              birthday: true,
              address: true,
              postalAddresses: true,
              notes: true,
            },
          },
        },
      });
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
      }> = [];
      let deferredLocalChangesCount = 0;
      const canWrite = job.syncDirection !== "IMPORT_ONLY";
      const localPushCandidates: Array<{
        linkId: string;
        remoteHref: string;
        remoteUid: string;
        contact: SyncContactRow;
      }> = [];
      const localDeleteCandidates: Array<{
        linkId: string;
        remoteHref: string;
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
      const localCreateCandidates: SyncPushContactRow[] =
        canWrite
          ? await db.contact.findMany({
              where: {
                ...contactScopeWhere,
                archivedAt: null,
                syncTombstoneAt: null,
                lastMutatedBy: "MANUAL",
                syncLinks: { none: { syncAccountId: job.syncAccountId } },
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
        const remoteChanged = remoteEntry != null && remoteEntry.etag !== link.remoteETag;

        if (!remoteEntry) {
          if (!link.contact.archivedAt) {
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
          }

          continue;
        }

        if (localChanged && remoteChanged && remoteCard) {
          // P23-01: resolve a local↔remote mutation by the connection's policy.
          if (settings.conflictPolicy === "SERVER_WINS") {
            // Remote wins: apply the remote snapshot over the local contact.
            remoteApplyCandidates.push({
              linkId: link.id,
              contactId: link.contact.id,
              remoteETag: remoteEntry.etag ?? null,
              remoteSnapshot: remoteCard,
            });
            // P23-05: record an AUTO_RESOLVED audit row for the applied conflict.
            autoResolvedEntries.push({
              linkId: link.id,
              contactId: link.contact.id,
              localSyncVersion: link.contact.syncVersion,
              remoteETag: remoteEntry.etag ?? null,
              localSnapshot: buildLocalConflictSnapshot(link.contact),
              remoteSnapshot: remoteCard,
              strategy: "KEEP_REMOTE",
            });
            continue;
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
              remoteETag: remoteEntry.etag ?? null,
              localSnapshot: buildLocalConflictSnapshot(link.contact),
              remoteSnapshot: remoteCard,
              strategy: "KEEP_LOCAL",
            });
            continue;
          }
          // MANUAL: surface a SyncConflict row for the review queue (P23-05).
          conflictEntries.push({
            type: "LOCAL_REMOTE_MUTATION",
            linkId: link.id,
            contactId: link.contact.id,
            localSyncVersion: link.contact.syncVersion,
            remoteETag: remoteEntry.etag ?? null,
            localSnapshot: buildLocalConflictSnapshot(link.contact),
            remoteSnapshot: remoteCard,
            resolutionNotes:
              "Local and remote contact data both changed since the last healthy sync point.",
          });
          continue;
        }

        if (localChanged) {
          if (canWrite && link.remoteHref) {
            if (link.contact.archivedAt) {
              localDeleteCandidates.push({ linkId: link.id, remoteHref: link.remoteHref });
            } else {
              localPushCandidates.push({
                linkId: link.id,
                remoteHref: link.remoteHref,
                remoteUid: remoteUid ?? link.remoteHref,
                contact: link.contact,
              });
            }
          } else {
            deferredLocalChangesCount += 1;
          }
          continue;
        }

        if (remoteChanged && remoteCard) {
          remoteApplyCandidates.push({
            linkId: link.id,
            contactId: link.contact.id,
            remoteETag: remoteEntry.etag ?? null,
            remoteSnapshot: remoteCard,
          });
        }
      }

      // Execute outbound writes to CardDAV (outside the DB transaction — network I/O).
      const pushedLinks: Array<{ linkId: string; newETag: string | null; newHref: string }> = [];
      const createdLinks: Array<{
        contactId: string;
        remoteUid: string;
        remoteHref: string;
        remoteETag: string | null;
        lastSyncedAt: Date;
      }> = [];
      const deletedLinkIds: string[] = [];

      for (const candidate of localPushCandidates) {
        try {
          const result = await pushCardDavContact({
            addressBookUrl: job.syncAccount.addressBookUrl,
            credentials: {
              username: decryptedCredentials.username,
              password: decryptedCredentials.password,
            },
            remoteUid: candidate.remoteUid,
            contact: contactToPortable(candidate.contact),
            hrefOverride: candidate.remoteHref || undefined,
          });
          pushedLinks.push({ linkId: candidate.linkId, newETag: result.etag, newHref: result.href });
        } catch (err) {
          console.error(`[sync] CardDAV push failed for link ${candidate.linkId}:`, err);
          deferredLocalChangesCount += 1;
        }
      }

      for (const contact of localCreateCandidates) {
        try {
          const result = await pushCardDavContact({
            addressBookUrl: job.syncAccount.addressBookUrl,
            credentials: {
              username: decryptedCredentials.username,
              password: decryptedCredentials.password,
            },
            remoteUid: contact.syncUid,
            contact: contactToPortable(contact),
          });
          createdLinks.push({
            contactId: contact.id,
            remoteUid: contact.syncUid,
            remoteHref: result.href,
            remoteETag: result.etag,
            lastSyncedAt: contact.updatedAt,
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
          deletedLinkIds.push(candidate.linkId);
        } catch (err) {
          console.error(`[sync] CardDAV delete failed for link ${candidate.linkId}:`, err);
          deferredLocalChangesCount += 1;
        }
      }

      await db.$transaction(async (tx) => {
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
              lastSyncedAt: now,
            },
            update: {
              remoteHref: entry.href,
              remoteUid: entry.uid,
              remoteETag: entry.etag,
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
              lastSyncedAt: created.lastSyncedAt,
            },
            update: {
              remoteHref: created.remoteHref,
              remoteUid: created.remoteUid,
              remoteETag: created.remoteETag,
              remoteDeletedAt: null,
              tombstonedAt: null,
              lastErrorCode: null,
              lastErrorMessage: null,
              lastSyncedAt: created.lastSyncedAt,
            },
          });
        }

        for (const card of unmatchedCards) {
          const createdContact = await tx.contact.create({
            data: {
              userId: scopeUserId,
              syncUid: card.uid,
              fullName: card.fullName,
              firstName: card.firstName,
              middleName: card.middleName,
              lastName: card.lastName,
              namePrefix: card.namePrefix,
              nameSuffix: card.nameSuffix,
              nickname: card.nickname,
              email: card.emailAddresses[0] ?? null,
              emailAddresses: card.emailAddresses.length > 0 ? card.emailAddresses : undefined,
              emailEntries: card.emailEntries.length > 0 ? card.emailEntries : undefined,
              phone: card.phoneNumbers[0] ?? null,
              phoneNumbers: card.phoneNumbers.length > 0 ? card.phoneNumbers : undefined,
              phoneEntries: card.phoneEntries.length > 0 ? card.phoneEntries : undefined,
              company: card.company,
              jobTitle: card.jobTitle,
              website: card.website,
              websiteEntries: card.websiteEntries.length > 0 ? card.websiteEntries : undefined,
              birthday: card.birthday,
              address: card.address,
              postalAddresses:
                card.postalAddresses.length > 0 ? card.postalAddresses : undefined,
              addressEntries: card.addressEntries.length > 0 ? card.addressEntries : undefined,
              notes: card.notes,
              sourceType: "SYNC_CARDDAV",
              sourceDetail: scopeLabel,
              lastMutatedBy: "SYNC_CARDDAV",
              lastMutatedByDetail: scopeLabel,
            },
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
              ...buildContactWriteDataFromRemoteSnapshot(remoteApply.remoteSnapshot),
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
            payload: { syncAccountId: job.syncAccountId, syncAccountLabel: job.syncAccount.label },
          });
        }

        for (const conflictEntry of conflictEntries) {
          await tx.syncConflict.create({
            data: {
              syncAccountId: job.syncAccountId,
              syncContactLinkId: conflictEntry.linkId,
              contactId: conflictEntry.contactId,
              conflictType: conflictEntry.type,
              status: "OPEN",
              localSyncVersion: conflictEntry.localSyncVersion,
              remoteETag: conflictEntry.remoteETag,
              localSnapshot: conflictEntry.localSnapshot,
              remoteSnapshot: conflictEntry.remoteSnapshot as Prisma.InputJsonValue,
              resolutionNotes: conflictEntry.resolutionNotes,
            },
          });

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
          await tx.syncContactLink.update({
            where: { id: pushed.linkId },
            data: {
              remoteHref: pushed.newHref,
              remoteETag: pushed.newETag,
              lastSyncedAt: now,
              lastErrorCode: null,
              lastErrorMessage: null,
            },
          });
        }

        // Tombstone sync links for contacts deleted on the remote.
        for (const linkId of deletedLinkIds) {
          await tx.syncContactLink.update({
            where: { id: linkId },
            data: { tombstonedAt: now, lastSyncedAt: now },
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

        const totalPushed = pushedLinks.length + deletedLinkIds.length;
        await tx.syncJob.update({
          where: { id: job.id },
          data: {
            status: conflictEntries.length > 0 ? "PARTIAL" : "SUCCEEDED",
            completedAt: new Date(),
            leaseExpiresAt: null,
            nextRetryAt: null,
            // Inbound (remote -> Kontax). Remote deletions surface as conflicts
            // rather than auto-applied deletes, so the inbound delete count is 0.
            createdCount: unmatchedCards.length,
            updatedCount: matchedEntries.length + remoteApplyCandidates.length,
            deletedCount: 0,
            conflictCount: conflictEntries.length,
            // Outbound (Kontax -> remote). CardDAV now creates new unlinked
            // local MANUAL contacts remotely, plus updates/deletes linked ones.
            pushedCreatedCount: createdLinks.length,
            pushedUpdatedCount: pushedLinks.length,
            pushedDeletedCount: deletedLinkIds.length,
            skippedCount: deferredLocalChangesCount,
            cursorBefore: job.syncAccount.remoteCTag ?? job.cursorBefore ?? job.syncAccount.addressBookUrl,
            cursorAfter: String(remoteEntries.length),
            errorCode: conflictEntries.length > 0 ? "SYNC_CONFLICTS_OPEN" : null,
            errorSummary: (() => {
              const parts: string[] = [];
              if (unmatchedCards.length > 0) parts.push(`imported ${unmatchedCards.length} new`);
              const pulled = matchedEntries.length + remoteApplyCandidates.length;
              if (pulled > 0) parts.push(`pulled ${pulled} remote update${pulled !== 1 ? "s" : ""}`);
              if (createdLinks.length > 0) parts.push(`created ${createdLinks.length} remote contact${createdLinks.length !== 1 ? "s" : ""}`);
              if (pushedLinks.length > 0) parts.push(`pushed ${pushedLinks.length} local update${pushedLinks.length !== 1 ? "s" : ""}`);
              if (deletedLinkIds.length > 0) parts.push(`deleted ${deletedLinkIds.length} remote`);
              if (deferredLocalChangesCount > 0) parts.push(`deferred ${deferredLocalChangesCount} local change${deferredLocalChangesCount !== 1 ? "s" : ""}`);
              if (conflictEntries.length > 0) parts.push(`opened ${conflictEntries.length} conflict${conflictEntries.length !== 1 ? "s" : ""}`);
              return parts.length > 0
                ? `Synced: ${parts.join(", ")}.`
                : `Sync complete — no changes.`;
            })(),
          },
        });

        await tx.syncAccount.update({
          where: { id: job.syncAccountId },
          data: {
            status: queueFull || job.syncAccount.status === "PAUSED" ? "PAUSED" : "ACTIVE",
            remoteCTag: String(remoteEntries.length),
            lastSyncCursor: String(remoteEntries.length),
            lastSyncedAt: now,
            lastSucceededAt: now,
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
      });

      if (conflictEntries.length > 0) {
        summary.partial += 1;
      } else {
        summary.succeeded += 1;
      }
    } catch (error) {
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
