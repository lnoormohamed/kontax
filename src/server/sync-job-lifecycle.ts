// P49A-04: sync-job lifecycle rules, kept free of the db client so they are
// unit-testable (tests/node/sync-job-lifecycle.test.ts):
//
// - lease reclaim: a RUNNING job whose lease lapsed was orphaned by a killed
//   or crashed worker; it is failed as retryable so the account runs again;
// - lease keeper: renews the lease of the job this process is running and
//   registers it as in-flight work for graceful shutdown;
// - scheduled-retry gate: a FAILED run's nextRetryAt is honoured before the
//   scheduler enqueues the account again;
// - open-conflict dedup: one OPEN SyncConflict per sync link, refreshed in
//   place instead of re-opened on every run (A-06).

import type { Prisma, SyncConflictType, SyncJobStatus } from "../../generated/prisma";
import { beginInFlightWork, isShuttingDown } from "~/server/process-lifecycle";

// ── Lease ───────────────────────────────────────────────────────────────────

/** How long a claim stays valid without a renewal. */
export const SYNC_JOB_LEASE_MS = 10 * 60 * 1000;
/** How often a live worker renews its lease (well inside SYNC_JOB_LEASE_MS). */
export const SYNC_LEASE_RENEW_INTERVAL_MS = 2 * 60 * 1000;
export const SYNC_LEASE_EXPIRED_CODE = "LEASE_EXPIRED";
/**
 * In-flight label prefix for a held sync job. server.mjs's shutdown() parses
 * it to expire the leases of jobs it abandons at the grace deadline.
 */
export const SYNC_JOB_IN_FLIGHT_PREFIX = "sync-job:";

export const nextSyncLeaseExpiry = (now: Date = new Date()) =>
  new Date(now.getTime() + SYNC_JOB_LEASE_MS);

export const expiredSyncLeaseWhere = (now: Date) =>
  ({
    status: "RUNNING",
    leaseExpiresAt: { lt: now },
  }) satisfies Prisma.SyncJobWhereInput;

export const isSyncLeaseExpired = (
  job: { status: SyncJobStatus; leaseExpiresAt: Date | null },
  now: Date,
) =>
  job.status === "RUNNING" &&
  job.leaseExpiresAt != null &&
  job.leaseExpiresAt.getTime() < now.getTime();

/**
 * The FAILED row a reclaimed job becomes. Retryable immediately (nextRetryAt =
 * now) so the scheduler enqueues the account on its next tick; the account row
 * itself is left alone — an interrupted run is not an account-level error.
 */
export const leaseExpiredFailureData = (now: Date) =>
  ({
    status: "FAILED",
    completedAt: now,
    leaseExpiresAt: null,
    workerId: null,
    nextRetryAt: now,
    errorCode: SYNC_LEASE_EXPIRED_CODE,
    errorSummary:
      "Interrupted — the worker running this sync stopped (restart or crash) before it finished. It will be retried automatically.",
  }) satisfies Prisma.SyncJobUpdateManyMutationInput;

export type SyncLeaseKeeper = {
  /**
   * Iterate the jobs of one drain. Stops yielding once the process is shutting
   * down (no new claims), and releases whatever the previous iteration held —
   * including when the loop exits via break, return or an exception.
   */
  iterate<T>(jobs: readonly T[]): Generator<T, void, undefined>;
  /** Mark a successfully claimed job as held by this process. */
  hold(jobId: string): void;
  /** Ids currently held (for tests / diagnostics). */
  held(): string[];
};

export const createSyncLeaseKeeper = ({
  renew,
  intervalMs = SYNC_LEASE_RENEW_INTERVAL_MS,
  onError = (error: unknown) => console.error("[sync] lease renewal failed", error),
}: {
  renew: (jobIds: string[], leaseExpiresAt: Date) => Promise<unknown>;
  intervalMs?: number;
  onError?: (error: unknown) => void;
}): SyncLeaseKeeper => {
  const holds = new Map<string, () => void>();
  let timer: ReturnType<typeof setInterval> | null = null;

  const stopTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const releaseAll = () => {
    for (const release of holds.values()) release();
    holds.clear();
    stopTimer();
  };

  const tick = () => {
    const ids = [...holds.keys()];
    if (ids.length === 0) return;
    renew(ids, nextSyncLeaseExpiry()).catch(onError);
  };

  return {
    *iterate<T>(jobs: readonly T[]) {
      try {
        for (const job of jobs) {
          if (isShuttingDown()) return;
          yield job;
          releaseAll();
        }
      } finally {
        releaseAll();
      }
    },
    hold(jobId) {
      if (holds.has(jobId)) return;
      holds.set(jobId, beginInFlightWork(`${SYNC_JOB_IN_FLIGHT_PREFIX}${jobId}`));
      if (!timer) {
        timer = setInterval(tick, intervalMs);
        timer.unref?.();
      }
    },
    held: () => [...holds.keys()],
  };
};

// ── Scheduled retry gate ────────────────────────────────────────────────────

export type LatestSyncJobOutcome = {
  status: SyncJobStatus;
  nextRetryAt: Date | null;
  attemptCount: number;
  maxAttempts: number;
};

export type ScheduledRunDecision =
  | { action: "enqueue"; attemptCount: number }
  | { action: "defer"; until: Date };

/**
 * Decide whether a due account may be enqueued, given its most recent
 * completed job (SUCCEEDED / PARTIAL / FAILED — SKIPPED and HALTED rows are
 * informational and must be filtered out by the caller).
 *
 * - no history or a healthy last run → enqueue a fresh attempt 1;
 * - FAILED with nextRetryAt in the future → back off until then;
 * - FAILED and due for retry → enqueue the next attempt of the backoff ladder;
 * - FAILED with no nextRetryAt (retry budget spent) → back to the normal
 *   cadence with a fresh attempt counter; the auto-pause streak in
 *   markJobFailed is what stops a persistently failing account.
 */
export const decideScheduledRun = (
  latest: LatestSyncJobOutcome | null,
  now: Date,
): ScheduledRunDecision => {
  if (latest?.status !== "FAILED") {
    return { action: "enqueue", attemptCount: 1 };
  }
  if (latest.nextRetryAt == null) {
    return { action: "enqueue", attemptCount: 1 };
  }
  if (latest.nextRetryAt.getTime() > now.getTime()) {
    return { action: "defer", until: latest.nextRetryAt };
  }
  return {
    action: "enqueue",
    attemptCount: Math.max(1, Math.min(latest.attemptCount + 1, latest.maxAttempts)),
  };
};

// ── Open-conflict dedup (A-06) ──────────────────────────────────────────────

export type OpenSyncConflictInput = {
  syncAccountId: string;
  syncContactLinkId: string;
  contactId: string;
  conflictType: SyncConflictType;
  localSyncVersion: number | null;
  remoteETag: string | null;
  localSnapshot: Prisma.InputJsonValue;
  remoteSnapshot: Prisma.InputJsonValue;
  resolutionNotes: string;
};

export type OpenSyncConflictOutcome =
  | { outcome: "created"; id: string }
  | { outcome: "refreshed"; id: string }
  | { outcome: "kept"; id: string };

const isPhotoConflictSnapshot = (snapshot: unknown) =>
  typeof snapshot === "object" &&
  snapshot !== null &&
  (snapshot as Record<string, unknown>).__photoConflict === true;

/**
 * Record a conflict for a sync link, keeping at most one OPEN row per link.
 * An existing OPEN field conflict is refreshed with the current snapshots (so
 * the review queue shows today's state); an OPEN photo conflict recorded by
 * the photo pass is kept untouched — the field conflict surfaces on the first
 * run after it is resolved.
 */
export const recordOpenSyncConflict = async (
  tx: Prisma.TransactionClient,
  input: OpenSyncConflictInput,
): Promise<OpenSyncConflictOutcome> => {
  const existing = await tx.syncConflict.findFirst({
    where: { syncContactLinkId: input.syncContactLinkId, status: "OPEN" },
    orderBy: { detectedAt: "desc" },
    select: { id: true, localSnapshot: true },
  });

  if (existing) {
    if (isPhotoConflictSnapshot(existing.localSnapshot)) {
      return { outcome: "kept", id: existing.id };
    }
    await tx.syncConflict.update({
      where: { id: existing.id },
      data: {
        conflictType: input.conflictType,
        localSyncVersion: input.localSyncVersion,
        remoteETag: input.remoteETag,
        localSnapshot: input.localSnapshot,
        remoteSnapshot: input.remoteSnapshot,
        resolutionNotes: input.resolutionNotes,
      },
    });
    return { outcome: "refreshed", id: existing.id };
  }

  const created = await tx.syncConflict.create({
    data: {
      syncAccountId: input.syncAccountId,
      syncContactLinkId: input.syncContactLinkId,
      contactId: input.contactId,
      conflictType: input.conflictType,
      status: "OPEN",
      localSyncVersion: input.localSyncVersion,
      remoteETag: input.remoteETag,
      localSnapshot: input.localSnapshot,
      remoteSnapshot: input.remoteSnapshot,
      resolutionNotes: input.resolutionNotes,
    },
    select: { id: true },
  });
  return { outcome: "created", id: created.id };
};
