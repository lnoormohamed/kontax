# Notifications model

**Cross-cutting subsystem.** How in-app notifications, email notifications, birthday reminders, security alerts, and the iCal birthday feed work.

---

## Notification categories

```typescript
enum NotificationCategory {
  SECURITY        // always-on: sign-in alerts, suspicious activity
  SHARING         // new share received, live share updated
  SYNC_STATUS     // sync account connected, error, reconnect needed
  BILLING         // payment failed, trial ending, plan changed
  REMINDERS       // birthday + anniversary reminders
  PRODUCT_UPDATES // feature announcements
}
```

`SECURITY` and `BILLING` are always-on — they cannot be disabled in user preferences. All other categories have independent in-app and email toggles in `NotificationSettings`.

---

## Notification row

```
Notification {
  userId
  category         — NotificationCategory
  title            — short heading
  body             — expanded description
  read             — false until user opens the bell dropdown
  readAt
  dismissedAt      — null = still in feed; dismissed = hidden
  actionUrl        — optional deep link (e.g. "/shares" for sharing notifications)
  securityAlertId  — links to SecurityAlert for SECURITY category
}
```

The bell badge in the nav counts rows where `read=false AND dismissedAt=null`. The dropdown shows `dismissedAt=null` rows newest-first.

`createNotification(...)` in `src/server/notifications.ts` is the canonical writer. It checks category-level user preferences before inserting — so if the user has disabled `SYNC_STATUS` in-app notifications, calls to `createNotification` for that category are no-ops.

---

## Email delivery

Email notifications are dispatched fire-and-forget from the server action or webhook handler that creates them. The email transport is SES. If SES is unconfigured, emails log to the console.

### Digest mode

Users can choose `DigestCadence.DAILY` or `DigestCadence.WEEKLY` in `NotificationSettings.digest` to receive a summary email instead of individual notifications. The digest cron (`POST /api/cron/digest`) runs every morning and weekly on Monday, batches all unread notifications for digest-mode users, and sends a single summary email.

---

## Birthday & anniversary reminders

### Data model

`BirthdayReminderState` deduplicates reminder sends:
```
BirthdayReminderState {
  userId
  contactId
  dateKey      — "birthday" | "significant-0" | "significant-1" ...
  lastSentYear — year of the last send; prevents re-firing within a calendar year
}
```

### Reminder flow

The birthday cron (`POST /api/cron/birthday-reminders`) runs daily:
1. For each user with reminders enabled, find contacts whose birthday (or significant date) falls within the lead-time window (default 7 days; overridable per user and per contact).
2. Check `BirthdayReminderState.lastSentYear` — skip if a reminder was already sent this calendar year.
3. Create a `Notification` (category `REMINDERS`) and send an email.
4. Upsert `BirthdayReminderState.lastSentYear = currentYear`.

The lead-time preference lives on `UserNotificationSettings.birthdayReminderLeadDays` (global) and on the contact row as an override.

### iCal birthday feed

Each user has a unique iCal token (`User.icalToken`). The feed is served at `/api/calendar/birthdays.ics?token={icalToken}`. The token is a revocable credential — rotating it (`User.icalToken = newToken`) immediately invalidates all existing subscriptions. Any app that supports iCal subscriptions can add this URL.

---

## Security alerts

Security alerts are a special notification type backed by a `SecurityAlert` row:

```
SecurityAlert {
  userId
  kind         — "device" (sign-in from new device/IP) | "bulk" (mass mutation)
  title
  summary
  payload      — JSON: device details or list of affected contacts
  resolution   — null (active) | "DISMISSED" | "SECURED"
  resolvedAt
}
```

### Resolution flow

When a user sees a security alert in the UI:
- **That was me**: sets `resolution=DISMISSED`. The alert is acknowledged and archived.
- **Wasn't me**: sets `resolution=SECURED`. This triggers: sign out of all sessions (`sessionVersion` increment), prompts the user to change their password.

### Detection rules

The server checks for suspicious activity on:
- **Sign-in from new device/IP**: if the `deviceFingerprint` or IP differs from recent sessions.
- **Repeated failed login attempts**: `FailedLoginAttempt` rows — more than 5 in 1 hour fires a `SecurityAlert` with `kind=device`.

---

## Notification preferences

`NotificationSettings` (lazily created with defaults on first access):

| Field | Default | Controls |
|-------|---------|---------|
| `sharingInApp` | true | SHARING category in-app |
| `sharingEmail` | true | SHARING category email |
| `syncInApp` | true | SYNC_STATUS in-app |
| `syncEmail` | true | SYNC_STATUS email |
| `remindersInApp` | true | REMINDERS in-app |
| `remindersEmail` | false | REMINDERS email |
| `productInApp` | true | PRODUCT_UPDATES in-app |
| `productEmail` | false | PRODUCT_UPDATES email |
| `digest` | NONE | NONE / DAILY / WEEKLY digest mode |

SECURITY and BILLING have no settings rows — they are always delivered both in-app and by email.

---

## References

- Schema: `prisma/schema.prisma` — `Notification`, `SecurityAlert`, `NotificationSettings`, `BirthdayReminderState`, `FailedLoginAttempt`
- Notification writer: `src/server/notifications.ts`
- Birthday cron: `src/app/api/cron/birthday-reminders/route.ts`
- Digest cron: `src/app/api/cron/digest/route.ts`
- Birthday feed: `src/app/api/calendar/birthdays.ics/route.ts`
- Billing emails (trial, payment failed, plan changed): `src/server/billing-emails.ts`
