import type { SyncAccountLifecycleStatus } from "~/lib/sync-account-status";
import {
  loadEffectivePlan,
  PLAN_DEFAULTS,
  resolveSyncAutoPauseThreshold,
} from "~/server/dav/plan-entitlements.mjs";

// Display heuristic only: a PAUSED account with no auto-pause code (paused
// before P39-05 stamped SYNC_AUTO_PAUSED) and a streak this long is shown as
// "paused for safety". The real threshold is per plan — see below.
export const AUTO_PAUSE_FAILURE_STREAK = 3;

// P49A-19 item 6 (owner decision 2026-09-27): a connection auto-pauses after
// 3 consecutive failures on Free and 5 on paid plans (Pro / Family / Teams;
// an admin comp counts as its plan). The numbers live in the plan matrix
// (PLAN_DEFAULTS[plan].syncAutoPauseAfterFailures) so the runner, the
// settings panel and the help centre can't drift; an explicit per-connection
// "Retry sensitivity" is honoured within the plan's ceiling
// (`resolveSyncAutoPauseThreshold`). Replaces the flat
// DEFAULT_MAX_ATTEMPTS_BEFORE_PAUSE = 5 (P39-05).
export const FREE_AUTO_PAUSE_FAILURES = PLAN_DEFAULTS.FREE.syncAutoPauseAfterFailures;
export const PAID_AUTO_PAUSE_FAILURES = PLAN_DEFAULTS.PRO.syncAutoPauseAfterFailures;

type AutoPauseDb = {
  syncAccount: {
    findUnique: (args: {
      where: { id: string };
      select: { userId: true };
    }) => Promise<{ userId: string } | null>;
  };
};

/**
 * The auto-pause threshold for one connection right now: its owner's
 * effective plan (same resolution as every other entitlement, so the 3-day
 * payment grace applies) combined with the connection's setting. 0 = never.
 */
export const getSyncAutoPauseThreshold = async (
  client: AutoPauseDb,
  syncAccountId: string,
  setting: number | null | undefined,
): Promise<number> => {
  const account = await client.syncAccount.findUnique({
    where: { id: syncAccountId },
    select: { userId: true },
  });
  const effective = account ? await loadEffectivePlan(client, account.userId) : null;
  return resolveSyncAutoPauseThreshold(effective?.entitlements ?? PLAN_DEFAULTS.FREE, setting);
};

/**
 * Should this failure auto-pause the connection? Only a plain ERROR (not an
 * auth failure, which waits for new credentials) whose streak reached a
 * non-zero threshold.
 */
export const shouldAutoPauseAfterFailure = ({
  threshold,
  failureStreak,
  baseFailureStatus,
  errorCode,
}: {
  threshold: number;
  failureStreak: number;
  baseFailureStatus: string;
  errorCode: string | null;
}) =>
  baseFailureStatus === "ERROR" &&
  threshold > 0 &&
  failureStreak >= threshold &&
  getSyncErrorSupportBucket(errorCode) !== "authentication";
// P39-05: lastErrorCode set on the account when retry sensitivity trips. The
// underlying error stays on the tripping SyncJob row.
export const SYNC_AUTO_PAUSED_CODE = "SYNC_AUTO_PAUSED";
// P23-05: a connection auto-pauses once its manual conflict queue reaches this many
// OPEN conflicts, to stop the queue flooding unattended.
export const MANUAL_CONFLICT_QUEUE_LIMIT = 50;
// lastErrorCode set on the account when it auto-pauses for a full conflict queue.
export const CONFLICT_QUEUE_FULL_CODE = "SYNC_CONFLICT_QUEUE_FULL";
// P49A-06 (A-25): SyncJob.errorCode when inbound sync stopped creating contacts
// at the plan's contact cap (nothing deleted; the job settles PARTIAL).
export const CONTACT_LIMIT_REACHED_CODE = "CONTACT_LIMIT_REACHED";

/**
 * P49A-06: how an OAuth (Google / Microsoft) sync job settles, from the
 * connector's tallies. Conflicts outrank the contact-cap warning, which
 * outranks push errors, for the single error code; the summary carries all.
 */
export const settleOAuthSyncJob = (result: {
  conflicts: number;
  pushFailed?: number;
  capSkipped?: number;
  capWarning?: string | null;
}) => {
  const hasConflicts = result.conflicts > 0;
  const pushFailed = result.pushFailed ?? 0;
  const capSkipped = result.capSkipped ?? 0;
  const partial = hasConflicts || pushFailed > 0 || capSkipped > 0;
  const summary = [
    hasConflicts
      ? `${result.conflicts} sync conflicts need review before this account is fully healthy again.`
      : null,
    capSkipped > 0 ? (result.capWarning ?? `${capSkipped} new contacts were not imported (plan contact limit reached).`) : null,
    pushFailed > 0
      ? `${pushFailed} contacts could not be sent to the provider; they will be retried on the next sync.`
      : null,
  ].filter((part): part is string => part !== null);
  return {
    status: partial ? ("PARTIAL" as const) : ("SUCCEEDED" as const),
    errorCode: hasConflicts
      ? "SYNC_CONFLICTS_OPEN"
      : capSkipped > 0
        ? CONTACT_LIMIT_REACHED_CODE
        : pushFailed > 0
          ? "SYNC_PUSH_ERRORS"
          : null,
    errorSummary: summary.length > 0 ? summary.join(" ") : null,
    // Same column the CardDAV runner uses for deferred local changes; plus
    // contacts skipped at the plan cap.
    skippedCount: pushFailed + capSkipped,
  };
};

export type SyncAccountStatus = SyncAccountLifecycleStatus;
export type SyncJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "PARTIAL"
  | "FAILED"
  | "SKIPPED"
  | "HALTED";
export type SyncSupportBucket =
  | "authentication"
  | "connectivity"
  | "rate-limit"
  | "conflict"
  | "provider-policy"
  | "protocol-or-data"
  | "unknown";
export type SyncOperationalHealth =
  | "healthy"
  | "watch"
  | "needs_attention"
  | "paused_for_safety"
  | "needs_reauth"
  | "retired";

export const getSyncErrorSupportBucket = (errorCode: string | null | undefined): SyncSupportBucket => {
  if (!errorCode) {
    return "unknown";
  }

  if (
    errorCode.includes("AUTH") ||
    errorCode.includes("CREDENTIAL") ||
    errorCode.includes("REAUTH")
  ) {
    return "authentication";
  }

  if (
    errorCode.includes("NETWORK") ||
    errorCode.includes("TIMEOUT") ||
    errorCode.includes("TLS") ||
    errorCode.includes("DNS") ||
    errorCode.includes("CONNECT")
  ) {
    return "connectivity";
  }

  if (errorCode.includes("RATE")) {
    return "rate-limit";
  }

  if (errorCode.includes("CONFLICT")) {
    return "conflict";
  }

  if (
    errorCode.includes("UNSUPPORTED") ||
    errorCode.includes("READ_ONLY") ||
    errorCode.includes("POLICY") ||
    errorCode.includes("FORBIDDEN")
  ) {
    return "provider-policy";
  }

  if (
    errorCode.includes("PARSE") ||
    errorCode.includes("PROTOCOL") ||
    errorCode.includes("DISCOVERY") ||
    errorCode.includes("ADDRESSBOOK") ||
    errorCode.includes("ACCOUNT_ID") ||
    errorCode.includes("NOT_FOUND") ||
    errorCode.includes("INVALID")
  ) {
    return "protocol-or-data";
  }

  return "protocol-or-data";
};

export const getConsecutiveFailureStreak = (
  jobs: Array<{ status: SyncJobStatus; errorCode: string | null }>,
) => {
  let streak = 0;

  for (const job of jobs) {
    // P39-01/02: window-skipped and threshold-halted rows are informational —
    // they neither extend nor reset a failure streak.
    if (job.status === "SKIPPED" || job.status === "HALTED") {
      continue;
    }

    if (job.status !== "FAILED") {
      break;
    }

    streak += 1;
  }

  return streak;
};

export const getSyncAccountOperationalHealth = ({
  status,
  lastErrorCode,
  recentJobs,
}: {
  status: SyncAccountStatus;
  lastErrorCode: string | null;
  recentJobs: Array<{ status: SyncJobStatus; errorCode: string | null }>;
}): SyncOperationalHealth => {
  const failureStreak = getConsecutiveFailureStreak(recentJobs);

  if (status === "NEEDS_REAUTH") {
    return "needs_reauth";
  }

  if (status === "RETIRED") {
    return "retired";
  }

  // P23-05: auto-pause for a full manual conflict queue is also a "safety" pause.
  if (status === "PAUSED" && lastErrorCode === CONFLICT_QUEUE_FULL_CODE) {
    return "paused_for_safety";
  }

  // P39-02/05: deletion-threshold holds and retry-sensitivity trips are
  // protective stops, marked by their distinct account error codes.
  if (
    status === "PAUSED" &&
    (lastErrorCode === "DELETION_THRESHOLD_EXCEEDED" || lastErrorCode === SYNC_AUTO_PAUSED_CODE)
  ) {
    return "paused_for_safety";
  }

  if (
    status === "PAUSED" &&
    failureStreak >= AUTO_PAUSE_FAILURE_STREAK &&
    getSyncErrorSupportBucket(lastErrorCode) !== "authentication"
  ) {
    return "paused_for_safety";
  }

  if (status === "ERROR" || lastErrorCode) {
    return "needs_attention";
  }

  if (failureStreak > 0) {
    return "watch";
  }

  return "healthy";
};
