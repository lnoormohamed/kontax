# Phase 22 — Notification Settings & Suspicious Activity Alerts

## Objective

Let users control which events trigger notifications, deliver those notifications via in-app bell and email, surface anomalous account activity as security alerts, and add birthday/anniversary reminders with an iCal calendar feed. The notification infrastructure built here is the delivery layer that Phase 20's email templates plug into and Phase 18's suspicious-activity detection (P18-06 `UserSession`) feeds.

## What already exists

- `ActivityEvent` model (P10-01) — every contact mutation is already logged
- `UserSession` model (P18-06) — new device logins are trackable
- `sessionVersion` (P18-02) — global session invalidation exists
- `Contact.birthday` and `Contact.significantDates` fields exist on the schema
- No `NotificationPreference` model
- No `UserNotification` model (in-app bell feed)
- No suspicious activity detection logic

## What this phase adds

- `NotificationPreference` schema — per-category, per-channel on/off
- `UserNotification` model — in-app notification feed backing the bell
- In-app notification bell with unread count
- Notification preference settings page
- Suspicious activity detection rules (bulk delete, new device, failed logins)
- "Wasn't me" lockout flow
- Activity anomaly detail drawer
- Notification digest email
- Birthday/anniversary reminder cron job
- Reminder lead-time preferences
- iCal birthday/anniversary calendar feed

## Phase Tracker

| Ticket | Title | Status | Priority | Depends On |
| --- | --- | --- | --- | --- |
| DB-05 | Design brief — notification settings, bell, suspicious activity surfaces | Complete | P1 | P22-02, P22-05 |
| P22-01 | Notification preferences schema — `NotificationPreference` and `UserNotification` models | Complete | P0 | P10-01 |
| P22-02 | In-app notification bell — unread count badge, dropdown feed, mark-all-read | Complete | P0 | P22-01 |
| P22-03 | Notification preference settings page — grouped categories, per-channel toggles | Complete | P1 | P22-01 |
| P22-04 | Suspicious activity detection — bulk delete, new device login, failed login rules | Complete | P0 | P10-01, P18-06 |
| P22-05 | Suspicious activity alert — in-app banner + email; dismiss or "wasn't me" flow | Complete | P1 | P22-04, P20-07 |
| P22-06 | Account lockout on "wasn't me" — all sessions invalidated, forced password reset | Complete | P1 | P22-05 |
| P22-07 | Activity anomaly detail drawer — flagged events, affected contacts, IP/device, timestamp | Complete | P1 | P22-05, P10-06 |
| P22-08 | Notification digest email — daily/weekly summary; user-configurable frequency | Complete | P2 | P22-01, P20-09 |
| P22-09 | Birthday & anniversary reminder detection — daily cron; upcoming date scanning; notification queuing | Complete | P1 | P22-01, P10-01 |
| P22-10 | Reminder lead-time preferences — 1 day / 1 week / 1 month; per-contact override | Complete* | P2 | P22-09 |
| P22-11 | iCal birthday/anniversary feed — `/api/calendar/birthdays.ics`; per-user `calToken`; RRULE:FREQ=YEARLY | Complete | P1 | P22-09 |

> **Implementation notes (as built):**
> - Model naming differs from the original sketch: `Notification` (not `UserNotification`),
>   `NotificationSettings` with explicit per-category columns + a `digest` enum (not a
>   row-per-channel `NotificationPreference`), plus `SecurityAlert` (drives the banner/drawer)
>   and `FailedLoginAttempt` / `BirthdayReminderState`. Detection is centralised in
>   `src/server/notifications.ts` (+ `reminders.ts`, `digest.ts`, `ical.ts`).
> - `calToken` is **not** a DB `@unique` constraint (a new unique column would crash-loop the
>   Dockerfile's startup `prisma db push --skip-generate`, which has no `--accept-data-loss`);
>   uniqueness comes from the 24-byte random token + `findFirst`.
> - **P22-10\*** — user-level lead-time + per-contact `reminderLeadDaysOverride` (schema + cron
>   honour it) are done; the per-contact override **edit-form control** is deferred (the only
>   remaining sub-item) to avoid churn in the contact inline editor.
> - Crons need a daily 08:00 UTC schedule pointing at `/api/cron/birthday-reminders` and
>   `/api/cron/digest` (with `x-cron-secret: $CRON_SECRET`).

## Build order

P22-01 (schema) → P22-02 (bell) + P22-04 (detection) in parallel → P22-03 + P22-05 in parallel → P22-06 + P22-07 in parallel → P22-08 + P22-09 in parallel → P22-10 + P22-11 last.

## Exit criteria

- Users can configure which notification categories fire on which channels (in-app, email, both).
- The in-app bell shows unread notifications with a count badge.
- Suspicious activity (bulk delete, new device login) triggers an immediate in-app + email alert.
- The "wasn't me" flow invalidates all sessions and forces a password reset.
- A daily cron job queues birthday/anniversary reminders per user lead-time preference.
- The iCal feed URL exports all birthdays as recurring calendar events subscribable in any calendar app.
