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
  };
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
