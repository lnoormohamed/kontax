# P22-08 — Notification Digest Scheduler

## Purpose

Send users a daily or weekly email digest summarising their Kontax notifications, for those who prefer a lower-frequency update cadence over individual emails. The scheduler assembles notification items from a rolling time window, renders them using the `NotificationDigestTemplate` (P20-09), and sends via SES. Users who have had no notifications in the period receive no email.

## Background

`UserNotification` rows are created by `createNotification` (P22-01) throughout the app lifecycle. Individual notification emails (share invite, billing, security) are sent immediately. The digest is an opt-in alternative for users who find the individual emails noisy — they toggle off individual email notifications per category in `/settings/notifications` (P22-03) and instead receive a single summary email.

The scheduler runs as a CRON job. It is not part of the request lifecycle and never blocks user actions.

## Scope

**In scope:**
- `DigestCadence` enum (`DAILY`, `WEEKLY`) and `User.digestCadence` field — nullable (null = no digest)
- Digest cadence toggle in `/settings/notifications` — "Send me a digest instead of individual emails"
- `sendDigest(userId, period)` — assembles notification items and sends via P20-09 template
- CRON job: daily at 08:00 UTC for DAILY users; Monday at 08:00 UTC for WEEKLY users
- Skip users with no unread notifications in the window; skip SECURITY items that were already emailed individually
- Mark digested notifications as read after send (so they don't accumulate)

**Out of scope:**
- Per-category digest (v1 digest covers all non-security categories in one email)
- Custom time zones for digest delivery (v1 always sends at 08:00 UTC)
- Push notifications (web or mobile)

---

## Design / Implementation Spec

### Schema change

```prisma
enum DigestCadence {
    DAILY
    WEEKLY
}

// On User model:
digestCadence DigestCadence?  // null = no digest
```

Run: `prisma migrate dev --name add-digest-cadence`

### Settings UI addition

In `/settings/notifications`, below the per-category toggles, add a digest cadence section:

```
Email digest
────────────────────────────────────────────────────────────
Instead of individual emails, receive a summary digest.

○ No digest (individual emails per category setting above)
○ Daily digest  (sent at 08:00 UTC each morning)
○ Weekly digest (sent Monday at 08:00 UTC)
```

Selecting a cadence sets `User.digestCadence`. When a cadence is active, the email toggles for non-security categories are shown as greyed out with a "(covered by digest)" note — they still control in-app notifications, but emails come via the digest instead.

### `sendDigest` function

`src/server/digest.ts`:

```typescript
import { NotificationDigestTemplate } from "~/emails/digest";
import { renderEmail } from "~/server/render-email";
import { sendEmail } from "~/server/email";

export async function sendDigest(params: {
  userId: string;
  cadence: "DAILY" | "WEEKLY";
}): Promise<void> {
  const { userId, cadence } = params;

  const windowMs = cadence === "DAILY" ? 86_400_000 : 7 * 86_400_000;
  const windowStart = new Date(Date.now() - windowMs);

  // Fetch non-security notifications in the window
  const notifications = await db.userNotification.findMany({
    where: {
      userId,
      category: { not: "SECURITY" }, // security items are always emailed immediately
      createdAt: { gte: windowStart },
      dismissedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  if (notifications.length === 0) return; // skip empty digests

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) return;

  const periodLabel = cadence === "DAILY"
    ? new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : `${windowStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}–${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  // Map notifications to DigestItem shape
  const items = notifications.map((n) => ({
    category: mapCategoryToDigestCategory(n.category),
    summary: n.title + (n.body ? ` — ${n.body}` : ""),
    actionUrl: n.actionUrl ?? undefined,
  }));

  const { html, text } = await renderEmail(
    <NotificationDigestTemplate
      period={cadence === "DAILY" ? "daily" : "weekly"}
      periodLabel={periodLabel}
      items={items}
      viewAllUrl={`${process.env.APP_URL}/settings/notifications`}
    />
  );

  await sendEmail({
    to: user.email,
    subject: `Your Kontax ${cadence === "DAILY" ? "daily" : "weekly"} summary — ${periodLabel}`,
    html,
    text,
  });

  // Mark digested notifications as read
  await db.userNotification.updateMany({
    where: { id: { in: notifications.map((n) => n.id) } },
    data: { readAt: new Date() },
  });
}

function mapCategoryToDigestCategory(
  category: string,
): "SHARE" | "CONTACT_UPDATE" | "SYNC" | "REMINDER" | "SECURITY" {
  const map: Record<string, "SHARE" | "CONTACT_UPDATE" | "SYNC" | "REMINDER" | "SECURITY"> = {
    SHARING: "SHARE",
    SYNC_STATUS: "SYNC",
    BILLING: "CONTACT_UPDATE", // billing maps to generic "update" bucket
    REMINDERS: "REMINDER",
    PRODUCT_UPDATES: "CONTACT_UPDATE",
    SECURITY: "SECURITY",
  };
  return map[category] ?? "CONTACT_UPDATE";
}
```

### CRON job

In `src/app/api/cron/digest/route.ts` (protected by `CRON_SECRET` per P18-10):

```typescript
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const isMonday = now.getUTCDay() === 1;

  // Daily digest users
  const dailyUsers = await db.user.findMany({
    where: { digestCadence: "DAILY", lifecycleState: "ACTIVE", emailStatus: "OK" },
    select: { id: true },
  });

  // Weekly digest users — only on Mondays
  const weeklyUsers = isMonday
    ? await db.user.findMany({
        where: { digestCadence: "WEEKLY", lifecycleState: "ACTIVE", emailStatus: "OK" },
        select: { id: true },
      })
    : [];

  const results = await Promise.allSettled([
    ...dailyUsers.map((u) => sendDigest({ userId: u.id, cadence: "DAILY" })),
    ...weeklyUsers.map((u) => sendDigest({ userId: u.id, cadence: "WEEKLY" })),
  ]);

  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(`[digest-cron] sent=${results.length - failed} failed=${failed}`);

  return NextResponse.json({ sent: results.length - failed, failed });
}
```

Register in the scheduler (Vercel CRON or equivalent):
```
# vercel.json
{
  "crons": [
    { "path": "/api/cron/digest", "schedule": "0 8 * * *" }
  ]
}
```

---

## Acceptance Criteria

- `User.digestCadence` field exists (`DAILY | WEEKLY | null`); migration applied.
- The `/settings/notifications` page shows the digest cadence selector.
- `sendDigest` skips users with no non-security notifications in the window.
- SECURITY category notifications are excluded from the digest (they are always emailed immediately by P22-04).
- Digested notifications are marked `readAt = now()` after the digest is sent.
- The CRON endpoint returns 401 without the correct `CRON_SECRET` header.
- Weekly digests fire only on Mondays.
- Users with `emailStatus != OK` or `lifecycleState != ACTIVE` are excluded from the CRON run.
- An empty digest (no notifications in window) produces no email and no error.

---

## Risks and Open Questions

- **Digest vs individual email interaction:** if a user has BILLING in-app on and email on, and also has a digest enabled, they would receive both an individual billing email and a digest containing the same billing notification. The `sendDigest` function currently does not filter out notifications that were already emailed individually. For v1, document this as expected behaviour and accept the duplication — a future pass can add a `emailedAt` field to `UserNotification` to filter them out.
- **Scale of CRON job:** `Promise.allSettled` runs all digest sends concurrently. On a large user base, this can cause SES rate limit errors. For v1 (low user count), this is acceptable. At scale, batch with a concurrency limit (`p-limit` or a queue) to stay within the SES sending rate.
- **Time zone fairness:** all digests send at 08:00 UTC. A user in UTC-8 receives their digest at midnight. This is a known v1 limitation — document it in settings ("Digests are sent at 8:00 AM UTC"). Personalised send time is a future improvement.
- **Digest cadence and individual email preferences:** decide whether setting a digest cadence implicitly disables individual email notifications for the affected categories, or whether the user must toggle them off separately. The spec above greys out the toggles when a cadence is active, but the DB still stores the individual preference values. Confirm this UX decision before shipping.
