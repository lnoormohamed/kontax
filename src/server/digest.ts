/* P22-08: notification digest scheduler. Assembles a user's non-security
   notifications from a rolling window and sends a single summary email using the
   P20-09 Digest template, then marks those notifications read. Digest cadence is
   stored on NotificationSettings.digest (NONE | DAILY | WEEKLY). */

import Digest from "~/emails/digest";
import { db } from "~/server/db";
import { appUrl, sendEmail } from "~/server/email";
import { renderEmail } from "~/server/render-email";

import type { NotificationCategory } from "../../generated/prisma";

type DigestCategory = "SHARE" | "CONTACT_UPDATE" | "SYNC" | "REMINDER" | "SECURITY";

function mapCategory(category: NotificationCategory): DigestCategory {
  switch (category) {
    case "SHARING":
      return "SHARE";
    case "SYNC_STATUS":
      return "SYNC";
    case "REMINDERS":
      return "REMINDER";
    case "SECURITY":
      return "SECURITY";
    case "BILLING":
    case "PRODUCT_UPDATES":
    default:
      return "CONTACT_UPDATE";
  }
}

function periodLabel(cadence: "DAILY" | "WEEKLY", windowStart: Date, now: Date): string {
  if (cadence === "DAILY") {
    return now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  }
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${fmt(windowStart)}–${fmt(now)}`;
}

/**
 * Assemble and send one user's digest. Skips (sends nothing) when there are no
 * unread non-security notifications in the window. SECURITY items are excluded —
 * they're emailed individually at detection time. Returns true if an email was sent.
 */
export async function sendDigest(params: {
  userId: string;
  cadence: "DAILY" | "WEEKLY";
  now?: Date;
}): Promise<boolean> {
  const { userId, cadence } = params;
  const now = params.now ?? new Date();
  const windowMs = cadence === "DAILY" ? 86_400_000 : 7 * 86_400_000;
  const windowStart = new Date(now.getTime() - windowMs);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, emailStatus: true },
  });
  if (!user) return false;
  if (user.emailStatus !== "OK") return false;

  const notifications = await db.notification.findMany({
    where: {
      userId,
      read: false,
      dismissedAt: null,
      category: { not: "SECURITY" },
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, category: true, title: true, body: true },
  });
  if (notifications.length === 0) return false;

  const items = notifications.map((n) => ({
    category: mapCategory(n.category),
    summary: n.body ? `${n.title} — ${n.body}` : n.title,
  }));

  const label = periodLabel(cadence, windowStart, now);
  const { html, text } = await renderEmail(
    Digest({
      cadence: cadence === "DAILY" ? "daily" : "weekly",
      periodLabel: label,
      items,
      viewUrl: `${appUrl()}/settings/notifications`,
    }),
  );

  await sendEmail({
    to: user.email,
    subject: `Your Kontax ${cadence === "DAILY" ? "daily" : "weekly"} summary — ${label}`,
    html,
    text,
  });

  // Mark digested notifications as read so they don't accumulate / re-digest.
  await db.notification.updateMany({
    where: { id: { in: notifications.map((n) => n.id) } },
    data: { read: true, readAt: new Date() },
  });

  return true;
}

/**
 * User ids due for a digest now. DAILY users every run; WEEKLY users only on
 * Mondays (UTC). Reads cadence from NotificationSettings.digest.
 */
export async function dueDigestUserIds(
  now = new Date(),
): Promise<{ daily: string[]; weekly: string[] }> {
  const daily = await db.notificationSettings.findMany({
    where: { digest: "DAILY", user: { lifecycleState: "ACTIVE", emailStatus: "OK" } },
    select: { userId: true },
  });
  const weekly =
    now.getUTCDay() === 1
      ? await db.notificationSettings.findMany({
          where: { digest: "WEEKLY", user: { lifecycleState: "ACTIVE", emailStatus: "OK" } },
          select: { userId: true },
        })
      : [];
  return { daily: daily.map((d) => d.userId), weekly: weekly.map((w) => w.userId) };
}
