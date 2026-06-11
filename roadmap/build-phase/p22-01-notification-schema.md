# P22-01 — Notification Preferences Schema

## Purpose

Establish the data models that underpin the entire notification system: `NotificationPreference` (what the user wants to hear about and via which channel) and `UserNotification` (the in-app notification feed records that the bell reads). Without this schema, every other Phase 22 ticket has nowhere to store or read notification state.

## Background

The `ActivityEvent` model (P10-01) tracks contact mutations for the activity log. Notifications are different — they are user-facing alerts with read/unread state, actions (dismiss, respond), and channel preferences. A separate model avoids coupling the notification delivery system to the activity audit trail.

## Scope

**In scope:**
- `NotificationCategory` enum
- `NotificationChannel` enum
- `NotificationPreference` Prisma model — per-user, per-category on/off per channel
- `UserNotification` Prisma model — individual notification records for the in-app feed
- `createNotification(userId, category, title, body, actionUrl?)` utility
- Default preferences seeded on user creation

---

## Design / Implementation Spec

### Schema changes

```prisma
enum NotificationCategory {
    SECURITY          // Suspicious activity, new device login
    SHARING           // Contact shares received, live share converted
    SYNC_STATUS       // Sync error, reconnect needed
    BILLING           // Payment failed, trial ending, plan changed
    REMINDERS         // Birthday/anniversary reminders
    PRODUCT_UPDATES   // New features, announcements
}

enum NotificationChannel {
    IN_APP
    EMAIL
}

model NotificationPreference {
    id       String               @id @default(cuid())
    userId   String
    category NotificationCategory
    channel  NotificationChannel
    enabled  Boolean              @default(true)
    user     User                 @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@unique([userId, category, channel])
    @@index([userId, category])
}

model UserNotification {
    id          String               @id @default(cuid())
    userId      String
    category    NotificationCategory
    title       String
    body        String
    actionUrl   String?
    readAt      DateTime?
    dismissedAt DateTime?
    createdAt   DateTime             @default(now())
    user        User                 @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId, readAt, createdAt(sort: Desc)])
    @@index([userId, dismissedAt, createdAt(sort: Desc)])
}
```

Add relations to `User`:
```prisma
notificationPreferences NotificationPreference[]
notifications           UserNotification[]
```

Run: `prisma migrate dev --name add-notification-models`

### Default preferences

On user creation (in the register route handler, after the user is created), seed default preferences:

```typescript
async function seedDefaultNotificationPreferences(userId: string): Promise<void> {
  const defaults: Array<{ category: NotificationCategory; channel: NotificationChannel; enabled: boolean }> = [
    // Security — always on, both channels
    { category: "SECURITY", channel: "IN_APP", enabled: true },
    { category: "SECURITY", channel: "EMAIL", enabled: true },
    // Sharing — on by default
    { category: "SHARING", channel: "IN_APP", enabled: true },
    { category: "SHARING", channel: "EMAIL", enabled: true },
    // Sync — in-app on, email on
    { category: "SYNC_STATUS", channel: "IN_APP", enabled: true },
    { category: "SYNC_STATUS", channel: "EMAIL", enabled: true },
    // Billing — always on
    { category: "BILLING", channel: "IN_APP", enabled: true },
    { category: "BILLING", channel: "EMAIL", enabled: true },
    // Reminders — on by default
    { category: "REMINDERS", channel: "IN_APP", enabled: true },
    { category: "REMINDERS", channel: "EMAIL", enabled: false }, // email off by default
    // Product updates — in-app on, email off
    { category: "PRODUCT_UPDATES", channel: "IN_APP", enabled: true },
    { category: "PRODUCT_UPDATES", channel: "EMAIL", enabled: false },
  ];

  await db.notificationPreference.createMany({ data: defaults.map((d) => ({ userId, ...d })) });
}
```

### `createNotification` utility

```typescript
// src/server/notifications.ts

export async function createNotification(params: {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  actionUrl?: string;
}): Promise<void> {
  // Check in-app preference
  const pref = await db.notificationPreference.findUnique({
    where: {
      userId_category_channel: {
        userId: params.userId,
        category: params.category,
        channel: "IN_APP",
      },
    },
  });

  // Security notifications always fire regardless of preference
  const alwaysFire = params.category === "SECURITY";

  if (alwaysFire || pref?.enabled !== false) {
    await db.userNotification.create({
      data: {
        userId: params.userId,
        category: params.category,
        title: params.title,
        body: params.body,
        actionUrl: params.actionUrl,
      },
    });
  }
}
```

---

## Acceptance Criteria

- `NotificationPreference` and `UserNotification` models exist; migration applied.
- Default preferences are created for every new user registration.
- `createNotification` respects in-app preferences; always creates for SECURITY category.
- `UserNotification` rows have `readAt` and `dismissedAt` for the bell read/dismiss UX.
- All Phase 22 tickets build on this schema without further migrations.
