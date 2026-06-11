# P22-03 — Notification Preference Settings Page

## Purpose

Let users control which notification categories they receive and via which channels. Security notifications are always on and cannot be disabled. All other categories can be toggled per channel (in-app, email).

## Scope

**In scope:**
- `/settings/notifications` page with grouped category toggles
- `updateNotificationPreference(category, channel, enabled)` server action
- Security category displayed but greyed out with a "cannot be disabled" label

---

## Design / Implementation Spec

### `updateNotificationPreference` server action

```typescript
export async function updateNotificationPreference(input: {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  // Security notifications cannot be disabled
  if (input.category === "SECURITY") return;

  await db.notificationPreference.upsert({
    where: {
      userId_category_channel: {
        userId: session.user.id,
        category: input.category,
        channel: input.channel,
      },
    },
    update: { enabled: input.enabled },
    create: {
      userId: session.user.id,
      category: input.category,
      channel: input.channel,
      enabled: input.enabled,
    },
  });
}
```

### Settings page UI

```
Notifications

Security alerts
Always sent — cannot be disabled.
In-app  ✓ (greyed, locked)    Email  ✓ (greyed, locked)

Contact sharing
In-app  [toggle ✓]            Email  [toggle ✓]

Sync status
In-app  [toggle ✓]            Email  [toggle ✓]

Billing
Always sent — cannot be disabled.
In-app  ✓ (greyed, locked)    Email  ✓ (greyed, locked)

Birthday & anniversary reminders
In-app  [toggle ✓]            Email  [toggle off]

Product updates
In-app  [toggle ✓]            Email  [toggle off]
```

Each toggle calls `updateNotificationPreference` on change. No "Save" button needed — changes are applied immediately (debounced by 500ms to avoid rapid DB writes on fast toggling).

---

## Acceptance Criteria

- `/settings/notifications` page shows all 6 categories with per-channel toggles.
- SECURITY and BILLING categories are displayed but locked (cannot be disabled).
- Toggling a preference calls `updateNotificationPreference` and persists the change.
- Default preference states are correctly loaded from the DB on page render.
- The page is accessible and functional without JavaScript (toggles submit as a form action fallback).
