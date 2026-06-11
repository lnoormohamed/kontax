# P22-10 — Reminder Lead-Time Preferences

## Purpose

Let users choose how far in advance they are reminded of birthdays and anniversaries — 1 day, 1 week (default), or 1 month before — with the option to set a different lead time on individual contacts. This gives users control over the notification timing without requiring them to manage individual reminders manually.

## Background

P22-09 implements the birthday reminder detection job. It reads `User.reminderLeadDays` for the user-level lead time (defaulting to 7 if not set). This ticket adds that field to the schema, exposes a preference UI in `/settings/notifications`, and adds per-contact override support in the contact edit form.

## Scope

**In scope:**
- `User.reminderLeadDays Int @default(7)` schema field
- Per-contact override: `Contact.reminderLeadDaysOverride Int?` — null means use the user default
- `updateReminderLeadDays(days)` server action
- Settings UI: a dropdown or radio group in `/settings/notifications` below the REMINDERS toggle
- Contact edit form: an optional "Reminder" field that overrides the user default for this specific contact
- The P22-09 CRON reads the per-contact override if set, otherwise the user default

**Out of scope:**
- Per-date-type lead times (all dates for a contact share the same lead time in v1)
- Time-of-day preference for the reminder

---

## Design / Implementation Spec

### Schema changes

```prisma
// On User model:
reminderLeadDays Int @default(7)

// On Contact model:
reminderLeadDaysOverride Int? // null = use User.reminderLeadDays
```

Run: `prisma migrate dev --name add-reminder-lead-time`

### `updateReminderLeadDays` server action

```typescript
export async function updateReminderLeadDays(days: number): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  const VALID_OPTIONS = [1, 3, 7, 14, 30];
  if (!VALID_OPTIONS.includes(days)) throw new Error("INVALID_LEAD_DAYS");

  await db.user.update({
    where: { id: session.user.id },
    data: { reminderLeadDays: days },
  });
}
```

### Settings UI

In `/settings/notifications`, below the REMINDERS category toggle:

```
Birthday & anniversary reminders
In-app  [toggle ✓]          Email  [toggle off]

  Remind me  [1 week before ▾]
```

The "Remind me" dropdown appears only when the REMINDERS in-app toggle is enabled. Disabled (greyed) when the toggle is off.

Dropdown options:
- 1 day before
- 3 days before
- 1 week before (default, shown as "1 week before")
- 2 weeks before
- 1 month before

```typescript
const LEAD_DAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1,  label: "1 day before" },
  { value: 3,  label: "3 days before" },
  { value: 7,  label: "1 week before" },
  { value: 14, label: "2 weeks before" },
  { value: 30, label: "1 month before" },
];
```

### Per-contact override in the contact edit form

In the "More" section of the contact edit form (P24-05 / P17-01/02), an optional "Reminder" field:

```
Reminder
[Use default (1 week) ▾]
```

Dropdown options: "Use default (N days)" + all the same lead-time options. "Use default" sets `reminderLeadDaysOverride = null`; selecting a specific value sets the override.

The displayed default shows the user's current `reminderLeadDays` value in parentheses: "Use default (1 week)" / "Use default (1 month)".

`updateContactReminderOverride` server action:

```typescript
export async function updateContactReminderOverride(input: {
  contactId: string;
  leadDays: number | null; // null = use user default
}): Promise<void> {
  const session = await auth();
  await db.contact.update({
    where: { id: input.contactId, userId: session!.user!.id },
    data: { reminderLeadDaysOverride: input.leadDays },
  });
}
```

### Integration with P22-09 CRON

In `runBirthdayReminders`, replace the hardcoded `leadDays` with:

```typescript
// Read user's default
const user = await db.user.findUniqueOrThrow({
  where: { id: userId },
  select: { reminderLeadDays: true },
});
const userLeadDays = user.reminderLeadDays;

// Inside the contacts loop, use per-contact override if set:
const leadDays = contact.reminderLeadDaysOverride ?? userLeadDays;
```

---

## Acceptance Criteria

- `User.reminderLeadDays` defaults to 7; migration applied.
- `Contact.reminderLeadDaysOverride` is nullable; null means use the user default.
- `updateReminderLeadDays` rejects values outside `[1, 3, 7, 14, 30]`.
- The settings UI shows the lead-time dropdown below the REMINDERS toggle; it is disabled when the toggle is off.
- The contact edit form shows the "Reminder" field in the "More" section.
- The dropdown "Use default" option displays the current user lead days in parentheses.
- The P22-09 CRON uses the per-contact override when set, falling back to the user default.
- Changing the user default does not affect contacts with an explicit override.

---

## Risks and Open Questions

- **Retroactive lead-time change and the dedup state:** if a user changes from 1-week to 1-month reminders, contacts that already fired a 1-week reminder will not fire again (dedup by `lastSentYear`). The user will need to wait until next year for the 1-month reminder to take effect. This is expected and acceptable — changing lead time takes effect from next year's cycle.
- **Contact-level UI placement:** the "Reminder" field appears in the "More" section of the contact edit form. It should only appear for contacts that have at least one date set (`birthday` or a `significantDates` entry with a `date` field). For contacts with no dates, the field is hidden to avoid confusion.
