import type { DigestCadence, NotificationCategory, Prisma } from "../../generated/prisma";

import SuspiciousActivity from "~/emails/suspicious-activity";
import { db } from "~/server/db";
import { appUrl, sendEmail } from "~/server/email";
import { renderEmail } from "~/server/render-email";

/**
 * Send a suspicious-activity security alert email (P20-07). Shared entry point
 * that Phase 22 (P22-05) calls when an anomaly is detected. Always sends to the
 * user's canonical address — security alerts ignore notification preferences.
 * Fire-and-forget at the call site; this never throws (sendEmail swallows
 * transport errors).
 */
export async function sendSuspiciousActivityEmail(params: {
  userId: string;
  activityDescription: string;
  deviceHint?: string | null;
  ipAddress?: string | null;
  occurredAt: Date;
}): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { email: true },
  });
  if (!user) return;

  const { html, text } = await renderEmail(
    SuspiciousActivity({
      activity: params.activityDescription,
      device: params.deviceHint ?? "Unknown device",
      ipAddress: params.ipAddress ?? "Unknown",
      time: params.occurredAt.toUTCString(),
      secureUrl: `${appUrl()}/forgot-password`,
    }),
  );

  await sendEmail({
    to: user.email,
    subject: "Security alert — unusual activity on your Kontax account",
    html,
    text,
  });
}

// ── P22-DB05: in-app notification layer ──────────────────────────────────────

const FEED_LIMIT = 20;

// SECURITY and BILLING ignore preferences (always-on / locked). For the rest,
// map a category to its in-app + email preference column on NotificationSettings.
const PREF_COLUMNS: Partial<
  Record<NotificationCategory, { inApp: keyof DefaultPrefs; email: keyof DefaultPrefs }>
> = {
  SHARING: { inApp: "sharingInApp", email: "sharingEmail" },
  SYNC_STATUS: { inApp: "syncInApp", email: "syncEmail" },
  REMINDERS: { inApp: "remindersInApp", email: "remindersEmail" },
  PRODUCT_UPDATES: { inApp: "productInApp", email: "productEmail" },
};

type DefaultPrefs = {
  sharingInApp: boolean;
  sharingEmail: boolean;
  syncInApp: boolean;
  syncEmail: boolean;
  remindersInApp: boolean;
  remindersEmail: boolean;
  productInApp: boolean;
  productEmail: boolean;
  digest: DigestCadence;
};

/**
 * Read the user's notification preferences, lazily creating the row with the
 * brief's defaults on first access.
 */
export async function getNotificationSettings(userId: string): Promise<DefaultPrefs> {
  const existing = await db.notificationSettings.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.notificationSettings.create({ data: { userId } });
}

export async function updateNotificationSettings(
  userId: string,
  data: Partial<DefaultPrefs>,
): Promise<void> {
  await db.notificationSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

/**
 * Single entry point every notification source calls. Writes the in-app row only
 * when the category's in-app preference is on (SECURITY/BILLING always write).
 * Never throws — sources fire-and-forget.
 */
export async function createNotification(params: {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  actionUrl?: string | null;
  securityAlertId?: string | null;
}): Promise<void> {
  try {
    const pref = PREF_COLUMNS[params.category];
    if (pref) {
      const settings = await getNotificationSettings(params.userId);
      if (!settings[pref.inApp]) return;
    }
    await db.notification.create({
      data: {
        userId: params.userId,
        category: params.category,
        title: params.title,
        body: params.body,
        actionUrl: params.actionUrl ?? null,
        securityAlertId: params.securityAlertId ?? null,
      },
    });
  } catch (err) {
    console.error("createNotification failed", err);
  }
}

export type FeedNotification = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  read: boolean;
  actionUrl: string | null;
  securityAlertId: string | null;
  createdAt: Date;
};

/** Non-dismissed feed rows, newest first, for the dropdown. */
export async function getNotificationFeed(
  userId: string,
  limit = FEED_LIMIT,
): Promise<FeedNotification[]> {
  return db.notification.findMany({
    where: { userId, dismissedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      category: true,
      title: true,
      body: true,
      read: true,
      actionUrl: true,
      securityAlertId: true,
      createdAt: true,
    },
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, read: false, dismissedAt: null } });
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  await db.notification.updateMany({
    where: { id, userId, read: false },
    data: { read: true, readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { userId, read: false, dismissedAt: null },
    data: { read: true, readAt: new Date() },
  });
}

export async function dismissNotification(userId: string, id: string): Promise<void> {
  await db.notification.updateMany({
    where: { id, userId },
    data: { dismissedAt: new Date() },
  });
}

// ── security alerts (banner + anomaly drawer) ────────────────────────────────

export type SecurityAlertKind = "device" | "bulk";

export type SecurityAlertView = {
  id: string;
  kind: SecurityAlertKind;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: Date;
};

/**
 * Persist an anomaly, raise its linked SECURITY notification (1:1, Resolution 3),
 * and send the always-on security email (P20-07). SECURITY ignores preferences —
 * both the in-app row and the email always go out. Returns the alert.
 */
export async function createSecurityAlert(params: {
  userId: string;
  kind: SecurityAlertKind;
  title: string;
  summary: string;
  payload: Prisma.InputJsonValue;
  deviceHint?: string | null;
  ipAddress?: string | null;
}): Promise<{ id: string } | null> {
  try {
    const alert = await db.securityAlert.create({
      data: {
        userId: params.userId,
        kind: params.kind,
        title: params.title,
        summary: params.summary,
        payload: params.payload,
      },
      select: { id: true },
    });
    // SECURITY ignores preferences — always raise the in-app row.
    await db.notification.create({
      data: {
        userId: params.userId,
        category: "SECURITY",
        title: params.title,
        body: params.summary,
        securityAlertId: alert.id,
      },
    });
    // Always-on security email (never throws; fire-and-forget).
    void sendSuspiciousActivityEmail({
      userId: params.userId,
      activityDescription: params.summary,
      deviceHint: params.deviceHint ?? null,
      ipAddress: params.ipAddress ?? null,
      occurredAt: new Date(),
    });
    return alert;
  } catch (err) {
    console.error("createSecurityAlert failed", err);
    return null;
  }
}

/** Active (unresolved) alerts driving the banner stack, newest first. */
export async function getActiveSecurityAlerts(userId: string): Promise<SecurityAlertView[]> {
  const rows = await db.securityAlert.findMany({
    where: { userId, resolution: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, title: true, summary: true, payload: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind === "bulk" ? "bulk" : "device",
    title: r.title,
    summary: r.summary,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    createdAt: r.createdAt,
  }));
}

export async function getSecurityAlert(
  userId: string,
  alertId: string,
): Promise<SecurityAlertView | null> {
  const r = await db.securityAlert.findFirst({
    where: { id: alertId, userId },
    select: { id: true, kind: true, title: true, summary: true, payload: true, createdAt: true },
  });
  if (!r) return null;
  return {
    id: r.id,
    kind: r.kind === "bulk" ? "bulk" : "device",
    title: r.title,
    summary: r.summary,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    createdAt: r.createdAt,
  };
}

/**
 * Resolve an alert. "DISMISSED" = "that was me". "SECURED" = "wasn't me" — bumps
 * sessionVersion to sign out every other session (same mechanism as a password
 * change). Marks the linked notification read either way.
 */
export async function resolveSecurityAlert(
  userId: string,
  alertId: string,
  resolution: "DISMISSED" | "SECURED",
): Promise<void> {
  const alert = await db.securityAlert.findFirst({
    where: { id: alertId, userId, resolution: null },
    select: { id: true },
  });
  if (!alert) return;

  await db.$transaction([
    db.securityAlert.update({
      where: { id: alert.id },
      data: { resolution, resolvedAt: new Date() },
    }),
    db.notification.updateMany({
      where: { securityAlertId: alert.id, userId, read: false },
      data: { read: true, readAt: new Date() },
    }),
  ]);

  if (resolution === "SECURED") {
    // P22-06 lockdown: invalidate every session token (sessionVersion) and revoke
    // all UserSession rows. The password-reset email is sent by the action layer
    // (resolveSecurityAlertAction) to avoid a server→actions import cycle.
    await db.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });
    await db.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

// ── anomaly detection ────────────────────────────────────────────────────────

const BULK_DELETE_THRESHOLD = 10; // contacts removed within the window
const BULK_DELETE_WINDOW_MS = 60_000;

/**
 * Called after a bulk contact removal. Raises a "bulk" security alert when the
 * number of contacts removed in the last 60s crosses the threshold and there
 * isn't already an active bulk alert. `names` seeds the drawer's affected list.
 */
export async function detectBulkContactDelete(
  userId: string,
  removedCount: number,
  names: string[],
): Promise<void> {
  try {
    if (removedCount < BULK_DELETE_THRESHOLD) return;
    const existing = await db.securityAlert.findFirst({
      where: {
        userId,
        kind: "bulk",
        resolution: null,
        createdAt: { gte: new Date(Date.now() - BULK_DELETE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (existing) return;

    const sample = names.slice(0, 3).map((name) => ({ name, at: formatClock(new Date()) }));
    const more = Math.max(0, removedCount - sample.length);
    await createSecurityAlert({
      userId,
      kind: "bulk",
      title: "Bulk contact delete",
      summary: `${removedCount} contacts were deleted in the last 60 seconds — faster than typical activity.`,
      payload: { events: sample, more },
    });
  } catch (err) {
    console.error("detectBulkContactDelete failed", err);
  }
}

/**
 * Called on sign-in (in the auth jwt callback). Raises a "device" security alert
 * when the (device, IP) pair has never been seen on a prior session for this
 * user. Must never throw — sign-in must not be blocked.
 */
export async function detectNewDeviceSignIn(params: {
  userId: string;
  ipAddress: string | null;
  deviceHint: string | null;
}): Promise<void> {
  try {
    const prior = await db.userSession.findFirst({
      where: {
        userId: params.userId,
        OR: [
          params.deviceHint ? { deviceHint: params.deviceHint } : undefined,
          params.ipAddress ? { ipAddress: params.ipAddress } : undefined,
        ].filter(Boolean) as Prisma.UserSessionWhereInput[],
      },
      select: { id: true },
    });
    // First-ever session (no history at all) is not "new device" — skip.
    const anySession = await db.userSession.findFirst({
      where: { userId: params.userId },
      select: { id: true },
    });
    if (prior || !anySession) return;

    const device = params.deviceHint ?? "Unknown device";
    await createSecurityAlert({
      userId: params.userId,
      kind: "device",
      title: "New device sign-in",
      summary: `A new device (${device}) signed into your Kontax account. If this was you, no action is needed.`,
      payload: {
        Device: device,
        "IP address": params.ipAddress ?? "Unknown",
        Time: formatWhen(new Date()),
      },
      deviceHint: device,
      ipAddress: params.ipAddress,
    });
  } catch (err) {
    console.error("detectNewDeviceSignIn failed", err);
  }
}

const FAILED_LOGIN_THRESHOLD = 5; // alert when MORE than this many in the window
const FAILED_LOGIN_WINDOW_MS = 60 * 60 * 1000;

/**
 * P22-04 Rule 3: record a failed sign-in against an existing account and raise a
 * SECURITY alert when more than 5 attempts occur within an hour. Called from the
 * auth `authorize` callback on password mismatch. Never throws.
 */
export async function recordFailedLogin(
  userId: string,
  ipAddress: string | null,
): Promise<void> {
  try {
    await db.failedLoginAttempt.create({ data: { userId, ipAddress } });
    const since = new Date(Date.now() - FAILED_LOGIN_WINDOW_MS);
    const count = await db.failedLoginAttempt.count({
      where: { userId, createdAt: { gte: since } },
    });
    if (count <= FAILED_LOGIN_THRESHOLD) return;

    // One active alert per window — don't re-fire on every subsequent attempt.
    const existing = await db.securityAlert.findFirst({
      where: {
        userId,
        kind: "device",
        resolution: null,
        title: "Repeated failed sign-in attempts",
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (existing) return;

    await createSecurityAlert({
      userId,
      kind: "device",
      title: "Repeated failed sign-in attempts",
      summary: `${count} failed sign-in attempts on your account in the last hour. If this wasn't you, secure your account.`,
      payload: {
        Device: "Unknown device",
        "IP address": ipAddress ?? "Unknown",
        Time: formatWhen(new Date()),
      },
      ipAddress,
    });
  } catch (err) {
    console.error("recordFailedLogin failed", err);
  }
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

// "June 11, 2026 at 14:32 UTC" — matches the drawer's title timestamp format.
function formatWhen(d: Date): string {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "long",
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
  return `${date} at ${time} UTC`;
}

// ── product updates ──────────────────────────────────────────────────────────
// (Birthday/anniversary reminders live in src/server/reminders.ts — P22-09.)

/**
 * Broadcast a PRODUCT_UPDATES notification to every active user (admin-triggered).
 * Honours per-user in-app preference via createNotification.
 */
export async function broadcastProductUpdate(params: {
  title: string;
  body: string;
  actionUrl?: string | null;
}): Promise<number> {
  const users = await db.user.findMany({
    where: { lifecycleState: "ACTIVE" },
    select: { id: true },
  });
  for (const u of users) {
    await createNotification({
      userId: u.id,
      category: "PRODUCT_UPDATES",
      title: params.title,
      body: params.body,
      actionUrl: params.actionUrl ?? null,
    });
  }
  return users.length;
}
