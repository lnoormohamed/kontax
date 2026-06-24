// Phase 34G lifecycle semantics.
// Active-ish rows still represent the current logical connection and can be
// resumed, edited, or counted by slot/accounting rules.
export const SYNC_ACCOUNT_ACTIVE_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "NEEDS_REAUTH",
  "ERROR",
] as const;

// Historical rows are preserved for audit/support. They should not appear in
// the active rail and must not be treated as current live connections.
export const SYNC_ACCOUNT_HISTORICAL_STATUSES = [
  "DISCONNECTED",
  "RETIRED",
] as const;

// A disconnected row can be reactivated; a retired row cannot.
export const SYNC_ACCOUNT_RECONNECTABLE_STATUSES = ["DISCONNECTED"] as const;

// Normal settings / sync actions may operate on any non-retired row.
export const SYNC_ACCOUNT_MUTABLE_STATUSES = [
  ...SYNC_ACCOUNT_ACTIVE_STATUSES,
  ...SYNC_ACCOUNT_RECONNECTABLE_STATUSES,
] as const;

export type SyncAccountLifecycleStatus =
  | (typeof SYNC_ACCOUNT_ACTIVE_STATUSES)[number]
  | (typeof SYNC_ACCOUNT_HISTORICAL_STATUSES)[number];

export const isHistoricalSyncAccountStatus = (
  status: SyncAccountLifecycleStatus,
): boolean =>
  (SYNC_ACCOUNT_HISTORICAL_STATUSES as readonly string[]).includes(status);

export const isReconnectableSyncAccountStatus = (
  status: SyncAccountLifecycleStatus,
): boolean =>
  (SYNC_ACCOUNT_RECONNECTABLE_STATUSES as readonly string[]).includes(status);
