// P39-02: the deletion-hold review + resume flows, factored out of the action
// layer so the P39-08 QA harness can exercise the exact product code paths
// without a browser session. The actions in src/app/actions/sync.ts stay the
// auth/revalidate wrappers around these cores.

import { Prisma } from "../../generated/prisma";
import { db } from "~/server/db";
import type { DeletionHoldPayload } from "~/server/sync-deletion-guard";

export const readDeletionHold = async (
  userId: string,
  syncAccountId: string,
): Promise<DeletionHoldPayload | null> => {
  const account = await db.syncAccount.findFirst({
    where: { id: syncAccountId, userId },
    select: { id: true, status: true, lastErrorCode: true, deletionHold: true },
  });
  if (
    account?.status !== "PAUSED" ||
    account.lastErrorCode !== "DELETION_THRESHOLD_EXCEEDED" ||
    !account.deletionHold
  ) {
    return null;
  }
  return account.deletionHold as unknown as DeletionHoldPayload;
};

export type DeletionHoldReview = {
  total: number;
  threshold: number;
  /** Held deletions not yet reconciled by a later sync — 0 means resume is safe. */
  remaining: number;
  byBook: Array<{ name: string; detail: string | null; count: number }>;
  preview: Array<{ contactId: string; name: string }>;
};

/** Review payload for the paused-for-deletions surface (P39-DB01 §1a/1d). */
export const getDeletionHoldReviewCore = async (
  userId: string,
  syncAccountId: string,
): Promise<{ ok: true; review: DeletionHoldReview } | { ok: false; error: string }> => {
  const hold = await readDeletionHold(userId, syncAccountId);
  if (!hold) {
    return { ok: false, error: "This connection has no pending deletion review." };
  }

  // "Already reconciled" (§1d empty state): held links a later sync (or the
  // other resume path) has since tombstoned no longer count as pending.
  const heldLinkIds = [...hold.inboundLinkIds, ...hold.outboundLinkIds];
  const remaining =
    heldLinkIds.length > 0
      ? await db.syncContactLink.count({
          where: { id: { in: heldLinkIds }, tombstonedAt: null },
        })
      : 0;

  return {
    ok: true,
    review: {
      total: hold.total,
      threshold: hold.threshold,
      remaining,
      byBook: hold.byBook,
      preview: hold.preview,
    },
  };
};

/**
 * "Resume without deleting" (P39-DB01 §1c): reconcile the held links so the
 * pending removals never replay — outbound holds are tombstoned without the
 * remote delete (local stays archived, remote copy kept); inbound holds are
 * tombstoned without archiving the local contact (remote deleted it, Kontax
 * keeps it) — then reactivate the account.
 */
export const resumeSyncWithoutDeletionsCore = async (
  userId: string,
  syncAccountId: string,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const hold = await readDeletionHold(userId, syncAccountId);
  if (!hold) {
    return { ok: false, error: "This connection has no pending deletion review." };
  }

  const now = new Date();
  await db.$transaction([
    ...(hold.outboundLinkIds.length > 0
      ? [
          db.syncContactLink.updateMany({
            where: { id: { in: hold.outboundLinkIds }, syncAccountId },
            data: { tombstonedAt: now, lastSyncedAt: now },
          }),
        ]
      : []),
    ...(hold.inboundLinkIds.length > 0
      ? [
          db.syncContactLink.updateMany({
            where: { id: { in: hold.inboundLinkIds }, syncAccountId },
            data: { tombstonedAt: now, remoteDeletedAt: now, lastSyncedAt: now },
          }),
        ]
      : []),
    db.syncAccount.update({
      where: { id: syncAccountId },
      data: {
        status: "ACTIVE",
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        deletionHold: Prisma.DbNull,
        deletionHoldAt: null,
        deletionGuardBypassOnce: false,
      },
    }),
  ]);

  return { ok: true };
};

/**
 * "Resume and allow deletions" (P39-DB01 §1f, post-confirm): arm the one-shot
 * guard bypass and run a sync immediately so the held deletions commit once.
 */
export const resumeSyncAllowDeletionsCore = async (
  userId: string,
  syncAccountId: string,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const hold = await readDeletionHold(userId, syncAccountId);
  if (!hold) {
    return { ok: false, error: "This connection has no pending deletion review." };
  }

  const account = await db.syncAccount.findFirst({
    where: { id: syncAccountId, userId },
    select: { syncDirection: true },
  });
  if (!account) {
    return { ok: false, error: "Sync account not found." };
  }

  await db.$transaction([
    db.syncAccount.update({
      where: { id: syncAccountId },
      data: {
        status: "ACTIVE",
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        deletionGuardBypassOnce: true,
      },
    }),
    db.syncJob.create({
      data: {
        syncAccountId,
        status: "QUEUED",
        trigger: "MANUAL",
        syncDirection: account.syncDirection,
        attemptCount: 1,
        maxAttempts: 5,
        nextRetryAt: new Date(),
        idempotencyKey: `${syncAccountId}:resume-allow-deletions:${Date.now()}`,
      },
    }),
  ]);

  // Apply the deletions right away (same inline pattern as "Sync now"). The
  // run's success transaction clears the hold and resets the bypass.
  try {
    const { runQueuedSyncJobs } = await import("~/server/sync-runner");
    await runQueuedSyncJobs({ syncAccountId, limit: 1 });
  } catch (error) {
    console.error("[sync] resume-allow-deletions inline run failed:", error);
  }

  return { ok: true };
};
