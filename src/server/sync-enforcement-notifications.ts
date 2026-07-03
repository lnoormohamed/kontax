// P39-05 / P39-DB01 §4: the three enforcement notification templates —
// deletion pause, auto-pause, needs-reauth. One entry point per event; each
// writes the in-app SYNC_STATUS row (user category prefs apply inside
// createNotification) and sends the matching P20-layout email.
//
// Gating contract (P39-DB01 §4a): the per-connection notifyOnFailure setting
// gates the two pause events. Re-auth always notifies and its email can't be
// unsubscribed from (same posture as security alerts). Callers pass
// notifyOnFailure so this module stays pure of settings reads.
//
// Everything here is fire-and-forget: never throws — a notification failure
// must not fail the sync job that raised it.

import SyncAutoPause from "~/emails/sync-auto-pause";
import SyncDeletionPause from "~/emails/sync-deletion-pause";
import SyncReauth from "~/emails/sync-reauth";
import { db } from "~/server/db";
import { appUrl, sendEmail } from "~/server/email";
import {
  createNotification,
  getNotificationSettings,
} from "~/server/notifications";
import { renderEmail } from "~/server/render-email";

const syncAccountUrl = (syncAccountId: string) => `/sync?account=${syncAccountId}`;

const getRecipient = async (userId: string) =>
  db.user.findUnique({ where: { id: userId }, select: { email: true } });

const formatWhen = (d: Date): string => {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
  return `${date} · ${time} GMT`;
};

/** P39-02: a sync halted by the deletion-safety threshold. */
export async function notifySyncDeletionPause(params: {
  userId: string;
  syncAccountId: string;
  accountLabel: string;
  wouldDelete: number;
  limit: number;
  notifyOnFailure: boolean;
  occurredAt: Date;
}): Promise<void> {
  try {
    if (!params.notifyOnFailure) return;

    await createNotification({
      userId: params.userId,
      category: "SYNC_STATUS",
      title: "Sync paused — review needed",
      body: `${params.accountLabel} would have deleted ${params.wouldDelete} contacts (limit ${params.limit}). Nothing was deleted.`,
      actionUrl: syncAccountUrl(params.syncAccountId),
    });

    const settings = await getNotificationSettings(params.userId);
    if (!settings.syncEmail) return;
    const user = await getRecipient(params.userId);
    if (!user) return;

    const { html, text } = await renderEmail(
      SyncDeletionPause({
        accountLabel: params.accountLabel,
        wouldDelete: params.wouldDelete,
        limit: params.limit,
        when: formatWhen(params.occurredAt),
        reviewUrl: `${appUrl()}${syncAccountUrl(params.syncAccountId)}`,
      }),
    );
    await sendEmail({
      to: user.email,
      subject: "A sync was paused to protect your contacts",
      html,
      text,
    });
  } catch (err) {
    console.error("notifySyncDeletionPause failed", err);
  }
}

/** P39-05: auto-paused after maxAttemptsBeforePause consecutive failures. */
export async function notifySyncAutoPause(params: {
  userId: string;
  syncAccountId: string;
  accountLabel: string;
  failureCount: number;
  lastError: string;
  notifyOnFailure: boolean;
}): Promise<void> {
  try {
    if (!params.notifyOnFailure) return;

    await createNotification({
      userId: params.userId,
      category: "SYNC_STATUS",
      title: "Sync auto-paused",
      body: `${params.accountLabel} was paused after ${params.failureCount} consecutive failures. Last error: ${params.lastError}.`,
      actionUrl: syncAccountUrl(params.syncAccountId),
    });

    const settings = await getNotificationSettings(params.userId);
    if (!settings.syncEmail) return;
    const user = await getRecipient(params.userId);
    if (!user) return;

    const { html, text } = await renderEmail(
      SyncAutoPause({
        accountLabel: params.accountLabel,
        failureCount: params.failureCount,
        lastError: params.lastError,
        openUrl: `${appUrl()}${syncAccountUrl(params.syncAccountId)}`,
      }),
    );
    await sendEmail({
      to: user.email,
      subject: "We paused a sync after repeated failures",
      html,
      text,
    });
  } catch (err) {
    console.error("notifySyncAutoPause failed", err);
  }
}

/** Credentials broken — always notifies, regardless of notifyOnFailure. */
export async function notifySyncNeedsReauth(params: {
  userId: string;
  syncAccountId: string;
  accountLabel: string;
  /** e.g. "Your app password was rejected". */
  reason: string;
}): Promise<void> {
  try {
    await createNotification({
      userId: params.userId,
      category: "SYNC_STATUS",
      title: "Reconnect needed",
      body: `${params.accountLabel} needs re-authentication — ${params.reason}.`,
      actionUrl: syncAccountUrl(params.syncAccountId),
    });

    // Re-auth email rides the no-unsubscribe path: always sent.
    const user = await getRecipient(params.userId);
    if (!user) return;

    const { html, text } = await renderEmail(
      SyncReauth({
        accountLabel: params.accountLabel,
        reason: params.reason,
        reconnectUrl: `${appUrl()}${syncAccountUrl(params.syncAccountId)}`,
      }),
    );
    await sendEmail({
      to: user.email,
      subject: `Reconnect ${params.accountLabel} to keep syncing`,
      html,
      text,
    });
  } catch (err) {
    console.error("notifySyncNeedsReauth failed", err);
  }
}
