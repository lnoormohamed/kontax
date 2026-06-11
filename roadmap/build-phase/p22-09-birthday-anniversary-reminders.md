# P22-09 — Birthday & Anniversary Reminder Detection

## Purpose

Scan each user's contacts daily for upcoming birthdays and anniversaries, and queue a `UserNotification` (category: `REMINDERS`) when a date falls within the user's configured lead-time window. Users who store birthdays in Kontax should never miss them — the app should tell them, not wait to be asked.

## Background

The `Contact.birthday` field (Phase 6, P6-03) stores dates in `YYYY-MM-DD` or `--MM-DD` format. The `Contact.significantDates` JSON array (Phase 6) stores additional dates (anniversaries, work anniversaries, etc.) with a `label` and a `date` field. Both are the sources for this reminder system.

P22-01 defined the `REMINDERS` notification category and the `createNotification` utility. P22-03's settings page includes a reminder lead-time toggle that P22-10 implements. This ticket builds the daily detection job that reads contact dates and produces notifications.

## Scope

**In scope:**
- `BirthdayReminderState` model — tracks the last reminder sent per contact per year, preventing duplicate notifications
- `runBirthdayReminders(userId)` function — the core detection logic
- Daily CRON job that calls `runBirthdayReminders` for all active users with reminder notifications enabled
- Sources scanned: `Contact.birthday` and each entry in `Contact.significantDates` where `date` is set
- Lead-time: default 7 days (the P22-10 per-user preference; this ticket uses the default)
- `actionUrl` on the notification: links to the contact detail page

**Out of scope:**
- Per-user lead-time preference (P22-10)
- Per-contact lead-time override (P22-10)
- Email reminder delivery (P22-01's `createNotification` respects the user's email preference already)
- Reminder for year-less dates (only `--MM-DD` format — these are annual without a birth year and are fully supported)

---

## Design / Implementation Spec

### `BirthdayReminderState` model

Tracks the last calendar year in which a reminder was sent for a specific contact/date combination, preventing the same reminder from firing multiple times per year.

```prisma
model BirthdayReminderState {
    id           String   @id @default(cuid())
    userId       String
    contactId    String
    dateKey      String   // e.g. "birthday" or "anniversary-0" or "work-anniversary-1"
    lastSentYear Int      // the calendar year the last reminder was sent
    lastSentAt   DateTime @default(now())

    user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
    contact Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)

    @@unique([userId, contactId, dateKey])
    @@index([userId, lastSentYear])
}
```

Run: `prisma migrate dev --name add-birthday-reminder-state`

### Date parsing

```typescript
/**
 * Parse a Kontax date string to a { month, day } object.
 * Supports "YYYY-MM-DD" and "--MM-DD" formats.
 */
export function parseContactDate(dateStr: string): { month: number; day: number } | null {
  // YYYY-MM-DD
  const full = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (full) return { month: parseInt(full[2]!), day: parseInt(full[3]!) };

  // --MM-DD (year-less)
  const yearless = dateStr.match(/^--(\d{2})-(\d{2})$/);
  if (yearless) return { month: parseInt(yearless[1]!), day: parseInt(yearless[2]!) };

  return null;
}

/**
 * Returns the number of days until the next occurrence of MM-DD from today.
 * Returns 0 if today is the date; negative if it passed this year (next occurrence is next year).
 */
export function daysUntilAnnual(month: number, day: number, today: Date): number {
  const thisYear = today.getFullYear();
  const occurrence = new Date(thisYear, month - 1, day);
  const diffMs = occurrence.getTime() - today.setHours(0, 0, 0, 0);
  const days = Math.round(diffMs / 86_400_000);

  // If already passed this year, next occurrence is next year
  if (days < 0) {
    const nextYear = new Date(thisYear + 1, month - 1, day);
    return Math.round((nextYear.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  }

  return days;
}
```

### `runBirthdayReminders`

```typescript
export async function runBirthdayReminders(userId: string): Promise<number> {
  const DEFAULT_LEAD_DAYS = 7;
  const currentYear = new Date().getFullYear();

  // Read user's lead-time preference (P22-10 adds this field; default 7 if not set)
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { reminderLeadDays: true },
  });
  const leadDays = user.reminderLeadDays ?? DEFAULT_LEAD_DAYS;

  // Get all contacts with dates
  const contacts = await db.contact.findMany({
    where: {
      userId,
      archivedAt: null,
      OR: [
        { birthday: { not: null } },
        // significantDates is JSON — filter in application layer
      ],
    },
    select: {
      id: true,
      fullName: true,
      birthday: true,
      significantDates: true,
    },
  });

  let notificationsSent = 0;
  const today = new Date();

  for (const contact of contacts) {
    // Build list of dates to check for this contact
    const datesToCheck: Array<{ dateKey: string; dateStr: string; label: string }> = [];

    if (contact.birthday) {
      datesToCheck.push({ dateKey: "birthday", dateStr: contact.birthday, label: "birthday" });
    }

    const sigDates = (contact.significantDates ?? []) as Array<{
      label: string;
      date?: string;
    }>;
    sigDates.forEach((sd, idx) => {
      if (sd.date) {
        datesToCheck.push({
          dateKey: `significant-${idx}`,
          dateStr: sd.date,
          label: sd.label ?? "anniversary",
        });
      }
    });

    for (const { dateKey, dateStr, label } of datesToCheck) {
      const parsed = parseContactDate(dateStr);
      if (!parsed) continue;

      const daysUntil = daysUntilAnnual(parsed.month, parsed.day, today);

      // Only notify if within the lead-time window (0 = today, leadDays = N days ahead)
      if (daysUntil < 0 || daysUntil > leadDays) continue;

      // Deduplication: only send once per year per contact/date
      const existing = await db.birthdayReminderState.findUnique({
        where: {
          userId_contactId_dateKey: { userId, contactId: contact.id, dateKey },
        },
      });

      if (existing?.lastSentYear === currentYear) continue;

      // Compose the notification body
      const when = daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`;
      const title = `${contact.fullName ?? "A contact"}'s ${label} is coming up`;
      const body = `${when} — ${new Date(today.getFullYear(), parsed.month - 1, parsed.day).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`;

      await createNotification({
        userId,
        category: "REMINDERS",
        title,
        body,
        actionUrl: `/contacts/${contact.id}`,
      });

      // Upsert the dedup state
      await db.birthdayReminderState.upsert({
        where: {
          userId_contactId_dateKey: { userId, contactId: contact.id, dateKey },
        },
        create: { userId, contactId: contact.id, dateKey, lastSentYear: currentYear },
        update: { lastSentYear: currentYear, lastSentAt: new Date() },
      });

      notificationsSent++;
    }
  }

  return notificationsSent;
}
```

### Daily CRON job

`src/app/api/cron/birthday-reminders/route.ts`:

```typescript
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Find all active users with REMINDERS in-app notifications enabled
  const eligibleUserIds = await db.notificationPreference.findMany({
    where: {
      category: "REMINDERS",
      channel: "IN_APP",
      enabled: true,
      user: { lifecycleState: "ACTIVE" },
    },
    select: { userId: true },
  });

  const results = await Promise.allSettled(
    eligibleUserIds.map((u) => runBirthdayReminders(u.userId)),
  );

  const total = results
    .filter((r) => r.status === "fulfilled")
    .reduce((sum, r) => sum + (r as PromiseFulfilledResult<number>).value, 0);

  return NextResponse.json({
    usersScanned: eligibleUserIds.length,
    notificationsSent: total,
  });
}
```

Register on the LXC cron (`crontab -e`):
```
0 7 * * * curl -s -X POST https://your-app-url/api/cron/birthday-reminders -H "x-cron-secret: $CRON_SECRET"
```
(daily at 07:00 UTC — before most users start their day)

---

## Acceptance Criteria

- `BirthdayReminderState` model exists; migration applied.
- `runBirthdayReminders` creates a `REMINDERS` `UserNotification` for each contact with a birthday/anniversary within the lead-time window.
- The same reminder is not sent twice in the same calendar year (deduplication via `lastSentYear`).
- Year-less dates (`--MM-DD`) are correctly handled and treated as annual.
- The `actionUrl` on the notification links to `/contacts/{id}`.
- The CRON job runs at 07:00 UTC and processes only users with REMINDERS notifications enabled.
- Contacts with no dates, or dates more than `leadDays` away, produce no notification.
- `significantDates` entries without a `date` field are silently skipped.

---

## Risks and Open Questions

- **Leap year birthdays (Feb 29):** for users born on Feb 29, `new Date(year, 1, 29)` produces March 1 in non-leap years. The `daysUntilAnnual` function handles this implicitly — on non-leap years, Feb 29 effectively falls on March 1. Document this as expected behaviour and add a note in the notification body: "Note: Feb 29 is observed on March 1 in non-leap years."
- **Time zone and "today":** the CRON runs at 07:00 UTC. A user in UTC+12 would receive their reminder the day before they expect it. For v1, all date comparisons are UTC-based. A per-user timezone preference is a future improvement (P22-10 is a natural extension point).
- **Performance on large contact libraries:** the current implementation runs one contact at a time. For a user with 5,000 contacts, this is ~5,000 iterations. The comparison is fast (arithmetic only) but the DB writes for dedup state add up. Batch the dedup upserts using `createMany` with `skipDuplicates` to reduce round-trips.
