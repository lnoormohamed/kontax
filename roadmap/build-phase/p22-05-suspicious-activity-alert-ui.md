# P22-05 — Suspicious Activity Alert UI

## Purpose

When a suspicious activity event is detected, the user needs an in-app alert that is hard to miss — more prominent than a notification bell item — and that gives them a clear path to either dismiss it ("that was me") or lock down their account ("wasn't me"). This ticket implements that banner and its two action paths.

## Background

`createNotification` (P22-01) creates the `UserNotification` row. `sendSuspiciousActivityEmail` (P20-07) sends the email. This ticket adds the in-app banner that appears on top of the contacts page.

## Scope

**In scope:**
- Persistent security alert banner shown when there are unread SECURITY notifications
- "That was me — dismiss" action
- "Wasn't me — secure my account" action (links to P22-06)
- Alert detail link → activity anomaly drawer (P22-07)

---

## Design / Implementation Spec

### Security alert banner

Shown at the top of the contacts workspace (below the grace-period banner from P19-06 if both are active) when there are unread `UserNotification` rows with `category = SECURITY`.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔴  Security alert: A new device signed into your account.             │
│      [View details]   [That was me]   [Wasn't me — secure my account]  │
└─────────────────────────────────────────────────────────────────────────┘
```

Background: `red-50`. Left border: 4px `red-600`. Icon: `ShieldAlert` (Lucide, 16px, red-600).

**Multiple alerts:** if there are multiple unread security notifications, show the most recent one. Add a count: "Security alert (1 of 3): ..." with prev/next arrows.

### Actions

**"View details"** → opens the activity anomaly detail drawer (P22-07). The drawer shows the full context of the flagged event.

**"That was me — dismiss":**
1. Mark the notification `readAt = now()`.
2. Banner fades out.
3. Brief "OK, noted." toast confirmation.

**"Wasn't me — secure my account":**
- Routes to `/settings/security?action=lockdown` which triggers the P22-06 lockout flow.

---

## Acceptance Criteria

- The security alert banner appears when there are unread SECURITY notifications.
- "That was me" marks the notification read and dismisses the banner.
- "Wasn't me" navigates to the P22-06 lockdown flow.
- "View details" opens the anomaly drawer (P22-07).
- Multiple alerts show a count and nav arrows.
- The banner does not appear on public pages or the login/register flow.
