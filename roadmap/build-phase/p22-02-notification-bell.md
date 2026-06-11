# P22-02 — In-App Notification Bell

## Purpose

Surface `UserNotification` records to users via a bell icon in the app header. The bell shows an unread count badge, a dropdown feed of recent notifications, and individual read/dismiss actions. This is the primary delivery mechanism for in-app notifications across all categories.

## Background

`UserNotification` rows are created by `createNotification` (P22-01) and by the suspicious-activity, billing, and reminder systems added in subsequent Phase 22 tickets. This ticket reads those rows and presents them to the user.

## Scope

**In scope:**
- Bell icon in the app header with unread count badge
- Dropdown notification feed (last 20 unread + last 20 read, most recent first)
- Mark individual notification as read on click
- "Mark all as read" action
- Dismiss (remove) individual notification
- 30-second polling for new notifications (same pattern as P12-06 pending share count)
- Navigate to `actionUrl` when a notification with an action URL is clicked

---

## Design / Implementation Spec

### Bell component

`src/app/_components/notification-bell.tsx` — client component.

```typescript
// API endpoint for the bell
// GET /api/notifications — returns unread count + recent notifications
// POST /api/notifications/read — mark all as read
// POST /api/notifications/[id]/read — mark one as read
// DELETE /api/notifications/[id] — dismiss one
```

**Badge:** shows unread count (0–9 as number, 10+ as "9+"). Hidden when count = 0. Same styling as the pending-shares badge from P12-06.

**Dropdown (triggered by bell click):**
- Header: "Notifications" + "Mark all as read" link (if any unread)
- Notification rows: icon + title + body (truncated to 2 lines) + relative time
- Unread rows: slightly darker background (`#f9fafb`)
- Empty state: "No notifications" with a `Bell` icon
- Footer: "Notification settings" link → `/settings/notifications`

**Notification row click behaviour:**
1. Mark as read (optimistic update)
2. If `actionUrl` is set: navigate to that URL
3. If no `actionUrl`: row expands to show full body

**Category icons (Lucide, 16px):**
- SECURITY: `ShieldAlert` (red-500)
- SHARING: `ArrowDownLeft` (green-600)
- SYNC_STATUS: `RefreshCcw` (purple-500)
- BILLING: `CreditCard` (amber-500)
- REMINDERS: `Cake` (blue-500)
- PRODUCT_UPDATES: `Sparkles` (teal-500)

### API routes

`GET /api/notifications`:
```typescript
const unread = await db.userNotification.count({
  where: { userId, readAt: null, dismissedAt: null },
});
const items = await db.userNotification.findMany({
  where: { userId, dismissedAt: null },
  orderBy: { createdAt: "desc" },
  take: 20,
});
return { unread, items };
```

`POST /api/notifications/read` (mark all read):
```typescript
await db.userNotification.updateMany({
  where: { userId, readAt: null },
  data: { readAt: new Date() },
});
```

### Polling

```typescript
// In the bell client component:
useEffect(() => {
  const interval = setInterval(async () => {
    const { unread } = await fetch("/api/notifications").then((r) => r.json());
    setUnreadCount(unread);
  }, 30_000);
  return () => clearInterval(interval);
}, []);
```

---

## Acceptance Criteria

- The bell icon appears in the app header for all authenticated users.
- The unread count badge shows the correct count; hides when count = 0.
- Clicking the bell opens a dropdown with the 20 most recent non-dismissed notifications.
- Clicking a notification marks it as read and navigates to `actionUrl` if set.
- "Mark all as read" sets `readAt` on all unread notifications.
- Dismissing a notification sets `dismissedAt` and removes it from the feed.
- The 30-second poll updates the unread count without a full page reload.
- "Notification settings" link at the bottom of the dropdown goes to `/settings/notifications`.
