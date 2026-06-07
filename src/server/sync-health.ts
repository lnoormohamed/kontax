export const AUTO_PAUSE_FAILURE_STREAK = 3;

export type SyncAccountStatus = "ACTIVE" | "PAUSED" | "NEEDS_REAUTH" | "ERROR";
export type SyncJobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED";
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
  | "needs_reauth";

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
