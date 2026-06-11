# P22-07 — Activity Anomaly Detail Drawer

## Purpose

When a user clicks "View details" on a security alert, they need to see exactly what happened: which contacts were affected, what device was used, from what IP, and at what time. This drawer surfaces that context so the user can make an informed decision about whether to dismiss or lock down their account.

## Background

`ActivityEvent` rows (P10-01) contain the raw event data. `UserSession` rows (P18-06) contain the device and IP context. The `UserNotification` row (P22-01) ties the alert to the underlying events via its `payload` field.

## Scope

**In scope:**
- Slide-over drawer component triggered from the security alert banner (P22-05) and from the activity log (P10-06)
- Sections: summary, affected contacts (if applicable), device/IP/time, actions (dismiss / secure account)
- Accessible via `/settings/security?alert={notificationId}` as a deep-linkable URL

---

## Design / Implementation Spec

### Drawer sections

**Header:** "Security Alert — [type label]" with a red `ShieldAlert` icon.

**Summary:** the `body` text from the `UserNotification` row.

**Event timeline** (from `ActivityEvent` rows associated with the alert window):

```
2 minutes ago  [Delete icon]  "Jane Smith" was deleted
2 minutes ago  [Delete icon]  "Bob Jones" was deleted
2 minutes ago  [Delete icon]  "Alice Wu" was deleted
... and 8 more
```

Events linked to the alert window are fetched by querying `ActivityEvent` rows for the userId within 5 minutes of the `UserNotification.createdAt` timestamp, filtered by the relevant event types (CONTACT_DELETED for bulk delete, etc.).

**Device & location** (for new-device login alerts):

```
Device:     Chrome on macOS
IP address: 91.108.4.5
Time:       June 11, 2026 at 14:32 UTC
```

**Actions (bottom of drawer):**
- "That was me — dismiss" → marks notification read, closes drawer
- "Wasn't me — secure my account" → navigates to P22-06 lockdown page

---

## Acceptance Criteria

- The drawer opens when "View details" is clicked on the security alert banner.
- The drawer shows the notification body, relevant activity events, and device/IP info.
- Bulk delete alerts show a list of the deleted contacts.
- New device login alerts show device hint and IP.
- "That was me" dismisses the notification and closes the drawer.
- "Wasn't me" navigates to the lockdown confirmation page.
- The drawer is accessible via `/settings/security?alert={id}` direct link.
