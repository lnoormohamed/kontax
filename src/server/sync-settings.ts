import type { Prisma, SyncAccountSettings } from "../../generated/prisma";
import { db } from "~/server/db";

// P23-01: platform fallbacks applied when a SyncAccount has no settings row yet.
// These mirror the column defaults on SyncAccountSettings so the sync engine can
// read settings without forcing a row to exist first.
export const SYNC_SETTINGS_DEFAULTS = {
  syncDirection: "TWO_WAY",
  conflictPolicy: "SERVER_WINS",
  bookAllowlist: [] as string[],
  syncFrequencyMinutes: null as number | null,
  requireReauthToEdit: true,
} as const;

// Platform default polling interval when syncFrequencyMinutes is null.
export const DEFAULT_SYNC_FREQUENCY_MINUTES = 60;

// Sentinel stored in syncFrequencyMinutes to represent the "Manual only" option
// (the field is otherwise a positive minute count; null means platform default).
export const MANUAL_SYNC_FREQUENCY = 0;

export const isManualSyncFrequency = (minutes: number | null | undefined): boolean =>
  minutes === MANUAL_SYNC_FREQUENCY;

/**
 * Read the effective settings for a sync account, falling back to platform
 * defaults when no row exists. Does not write — safe on every job run.
 */
export const getEffectiveSyncAccountSettings = async (
  syncAccountId: string,
): Promise<{
  syncDirection: SyncAccountSettings["syncDirection"];
  conflictPolicy: SyncAccountSettings["conflictPolicy"];
  bookAllowlist: string[];
  syncFrequencyMinutes: number | null;
  requireReauthToEdit: boolean;
  // P39 enforcement inputs (all optional in the P36 panel).
  maxDeletionsThreshold: number | null;
  notifyOnFailure: boolean;
  syncWindowStart: number | null;
  syncWindowEnd: number | null;
  syncWindowTimezone: string | null;
  maxAttemptsBeforePause: number | null;
  excludedFields: string[];
  exportLabelFilter: string[];
}> => {
  const settings = await db.syncAccountSettings.findUnique({
    where: { syncAccountId },
  });

  return {
    syncDirection: settings?.syncDirection ?? SYNC_SETTINGS_DEFAULTS.syncDirection,
    conflictPolicy: settings?.conflictPolicy ?? SYNC_SETTINGS_DEFAULTS.conflictPolicy,
    bookAllowlist: settings?.bookAllowlist ?? SYNC_SETTINGS_DEFAULTS.bookAllowlist,
    syncFrequencyMinutes:
      settings?.syncFrequencyMinutes ?? SYNC_SETTINGS_DEFAULTS.syncFrequencyMinutes,
    requireReauthToEdit:
      settings?.requireReauthToEdit ?? SYNC_SETTINGS_DEFAULTS.requireReauthToEdit,
    maxDeletionsThreshold: settings?.maxDeletionsThreshold ?? null,
    notifyOnFailure: settings?.notifyOnFailure ?? true,
    syncWindowStart: settings?.syncWindowStart ?? null,
    syncWindowEnd: settings?.syncWindowEnd ?? null,
    syncWindowTimezone: settings?.syncWindowTimezone ?? null,
    maxAttemptsBeforePause: settings?.maxAttemptsBeforePause ?? null,
    excludedFields: settings?.excludedFields ?? [],
    exportLabelFilter: settings?.exportLabelFilter ?? [],
  };
};

/**
 * P39-04: Prisma where-fragment restricting outbound CREATE candidates to
 * contacts carrying at least one of the connection's export-filter labels.
 * The filter stores Label ids but Contact.labels holds label *names* (the
 * P31B registry maps between them), so the ids resolve to names first.
 *
 * Returns null when the filter is empty (= push all). Labels deleted since
 * the filter was saved drop out; if every selected label is gone the filter
 * matches nothing — "only these labels" with none left means no new pushes,
 * not all of them.
 *
 * New pushes only, per the P36 brief: contacts already linked to the remote
 * keep syncing and are never deleted for losing the label.
 */
export const buildExportLabelFilterWhere = async (
  userId: string,
  exportLabelFilter: string[],
): Promise<Prisma.ContactWhereInput | null> => {
  if (exportLabelFilter.length === 0) return null;

  const labels = await db.label.findMany({
    where: { id: { in: exportLabelFilter }, userId },
    select: { name: true },
  });

  return { OR: labels.map((label) => ({ labels: { array_contains: label.name } })) };
};

/**
 * Lazily create (or return the existing) settings row for an account. Idempotent:
 * safe to call repeatedly. The edit drawer (P23-02) calls this before applying a
 * patch so existing accounts gain a row on first save.
 */
export const getOrCreateSyncAccountSettings = async (
  syncAccountId: string,
  tx: Prisma.TransactionClient = db,
): Promise<SyncAccountSettings> =>
  tx.syncAccountSettings.upsert({
    where: { syncAccountId },
    create: {
      syncAccountId,
      syncDirection: SYNC_SETTINGS_DEFAULTS.syncDirection,
      conflictPolicy: SYNC_SETTINGS_DEFAULTS.conflictPolicy,
      bookAllowlist: [...SYNC_SETTINGS_DEFAULTS.bookAllowlist],
    },
    update: {},
  });

/**
 * Backfill default settings rows for every account that lacks one. Run after the
 * additive schema push so all existing SyncAccount rows have settings (P23-01
 * acceptance). Idempotent via skipDuplicates.
 */
export const backfillSyncAccountSettings = async (): Promise<number> => {
  const accounts = await db.syncAccount.findMany({
    where: { settings: null },
    select: { id: true },
  });

  if (accounts.length === 0) return 0;

  const result = await db.syncAccountSettings.createMany({
    data: accounts.map((a) => ({
      syncAccountId: a.id,
      syncDirection: SYNC_SETTINGS_DEFAULTS.syncDirection,
      conflictPolicy: SYNC_SETTINGS_DEFAULTS.conflictPolicy,
      bookAllowlist: [...SYNC_SETTINGS_DEFAULTS.bookAllowlist],
    })),
    skipDuplicates: true,
  });

  return result.count;
};
