# P22-11 — iCal Birthday & Anniversary Feed

## Purpose

Expose a subscribable `.ics` calendar URL (`/api/calendar/birthdays.ics`) that exports all of the user's contacts' birthdays and significant dates as recurring VEVENT entries. Users can add this URL to Google Calendar, Apple Calendar, or Outlook to see upcoming birthdays directly in their calendar app — without any Kontax-specific client.

## Background

Birthdays are more useful in a calendar than in an app notification. Users check their calendar daily; they don't always check a contacts app. A subscribable iCal feed gives them birthdays in the context they already live in. The URL includes a per-user `calToken` for authentication — it can be safely shared with a calendar app without exposing session credentials.

The iCal standard (RFC 5545) specifies the `.ics` format. `RRULE:FREQ=YEARLY` makes each VEVENT recur annually, so the feed only needs to be maintained once.

## Scope

**In scope:**
- `User.calToken String? @unique` — a random 32-byte token stored on the user, revocable
- `GET /api/calendar/birthdays.ics?calToken={token}` — public route, no session required
- VCALENDAR with VEVENTs for every contact with `birthday` or `significantDates[].date` set
- `RRULE:FREQ=YEARLY` on every VEVENT so birthdays recur automatically
- `DTSTART` as a date-only value (`DATE` type, not `DATE-TIME`) so events appear as all-day events
- Calendar token management in settings: generate, copy URL, regenerate (revoke old)
- `calToken` excluded from the GDPR data export (security — it's a credential)

**Out of scope:**
- Filtering by contact group or label (v1: all contacts with dates)
- Event reminders/alarms within the `.ics` file (the user's calendar app handles its own reminders)
- A separate `.ics` for anniversaries only — all dates are in one feed

---

## Design / Implementation Spec

### Schema change

```prisma
// On User model:
calToken String? @unique
```

Run: `prisma migrate dev --name add-user-cal-token`

### Token generation

```typescript
import { randomBytes } from "crypto";

export function generateCalToken(): string {
  return randomBytes(24).toString("base64url"); // 32-char URL-safe string
}
```

### `GET /api/calendar/birthdays.ics`

`src/app/api/calendar/birthdays.ics/route.ts`:

```typescript
import { formatDate, buildVCalendar } from "~/server/ical";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const calToken = searchParams.get("calToken");

  if (!calToken) {
    return new Response("Missing calToken", { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { calToken },
    select: { id: true, name: true },
  });

  if (!user) {
    return new Response("Invalid or revoked token", { status: 401 });
  }

  // Fetch all contacts with dates
  const contacts = await db.contact.findMany({
    where: {
      userId: user.id,
      archivedAt: null,
      OR: [
        { birthday: { not: null } },
        // significantDates — filter in application layer
      ],
    },
    select: {
      id: true,
      fullName: true,
      firstName: true,
      birthday: true,
      significantDates: true,
    },
  });

  const vevents = buildVEvents(contacts);

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kontax//Kontax Birthday Feed//EN",
    `X-WR-CALNAME:Kontax Birthdays`,
    "X-WR-TIMEZONE:UTC",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kontax-birthdays.ics"',
      // Short cache — contacts may update their birthdays
      "Cache-Control": "max-age=3600, must-revalidate",
    },
  });
}

function buildVEvents(contacts: ContactWithDates[]): string[] {
  const events: string[] = [];
  const currentYear = new Date().getFullYear();

  for (const contact of contacts) {
    const name = contact.fullName ?? contact.firstName ?? "Contact";

    if (contact.birthday) {
      const parsed = parseContactDate(contact.birthday);
      if (parsed) {
        events.push(...buildVEvent({
          uid: `birthday-${contact.id}@kontax.app`,
          summary: `🎂 ${name}'s Birthday`,
          dtstart: formatICalDate(parsed.month, parsed.day, currentYear),
          rrule: "FREQ=YEARLY",
        }));
      }
    }

    const sigDates = (contact.significantDates ?? []) as Array<{
      label: string;
      date?: string;
    }>;

    sigDates.forEach((sd, idx) => {
      if (!sd.date) return;
      const parsed = parseContactDate(sd.date);
      if (!parsed) return;
      const labelEmoji = getLabelEmoji(sd.label);
      events.push(...buildVEvent({
        uid: `significant-${contact.id}-${idx}@kontax.app`,
        summary: `${labelEmoji} ${name}'s ${sd.label ?? "Anniversary"}`,
        dtstart: formatICalDate(parsed.month, parsed.day, currentYear),
        rrule: "FREQ=YEARLY",
      }));
    });
  }

  return events;
}

function buildVEvent(params: {
  uid: string;
  summary: string;
  dtstart: string;
  rrule: string;
}): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `SUMMARY:${escapeICalText(params.summary)}`,
    `DTSTART;VALUE=DATE:${params.dtstart}`,
    `DURATION:P1D`,
    `RRULE:${params.rrule}`,
    `TRANSP:TRANSPARENT`, // all-day event, does not block time
    "END:VEVENT",
  ];
}

function formatICalDate(month: number, day: number, year: number): string {
  // iCal DATE format: YYYYMMDD
  return `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

function escapeICalText(text: string): string {
  // RFC 5545: escape commas, semicolons, and backslashes
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function getLabelEmoji(label: string | undefined): string {
  const lower = (label ?? "").toLowerCase();
  if (lower.includes("anniversary")) return "💑";
  if (lower.includes("work")) return "💼";
  return "📅";
}
```

### Calendar token management in settings

In `/settings/notifications` (or `/settings/profile`), a "Calendar feed" section:

```
Birthday calendar feed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subscribe to your contacts' birthdays in any calendar app.

Calendar URL
[https://kontax.app/api/calendar/birthdays.ics?calToken=…]   [Copy]

[Regenerate URL]   (revokes the current URL immediately)

How to subscribe →   (links to /help#calendar-feed)
```

`generateCalTokenForUser` server action:

```typescript
export async function generateCalTokenForUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  const token = generateCalToken();
  await db.user.update({
    where: { id: session.user.id },
    data: { calToken: token },
  });

  return token;
}
```

The URL is displayed as `https://kontax.app/api/calendar/birthdays.ics?calToken={token}`. The "Copy" button uses the clipboard API. "Regenerate URL" calls `generateCalTokenForUser` and overwrites the existing token — the old URL immediately returns 401.

### `/help#calendar-feed` FAQ entry

Add to the P26-12 help page under "Birthday & anniversary reminders":

**How do I add Kontax birthdays to my calendar?**
> Go to Settings → Notifications → Calendar feed. Copy the Calendar URL and add it as a subscribed calendar in:
> - **Google Calendar:** Other calendars → From URL
> - **Apple Calendar:** File → New Calendar Subscription
> - **Outlook:** Add calendar → From internet
>
> Birthdays update automatically when you change contact details.

---

## Acceptance Criteria

- `User.calToken` field exists; migration applied.
- `GET /api/calendar/birthdays.ics?calToken={token}` returns valid iCal content (parseable by Google Calendar, Apple Calendar, and Outlook).
- The feed includes one VEVENT per contact birthday and one per `significantDates` entry with a date.
- Every VEVENT has `RRULE:FREQ=YEARLY` so events recur annually.
- Events are all-day (`DTSTART;VALUE=DATE`, `DURATION:P1D`, `TRANSP:TRANSPARENT`).
- An invalid or missing `calToken` returns 401.
- "Regenerate URL" immediately revokes the old token; the old URL returns 401 on the next request.
- The calendar URL is displayed in the settings panel with a copy button.
- The `/help#calendar-feed` section explains how to subscribe in the three major calendar apps.
- The `.ics` response has `Content-Type: text/calendar` and `Cache-Control: max-age=3600`.

---

## Risks and Open Questions

- **iCal line length limit:** RFC 5545 requires lines to be at most 75 octets, with continuation lines beginning with a space. Contact names with long unicode characters can exceed this. Add a line-folding utility to the iCal generation code: `foldLine(text: string): string` that inserts `\r\n ` every 75 bytes.
- **DTSTART year for recurring events:** the `RRULE:FREQ=YEARLY` rule recurs based on the `DTSTART` year. Setting `DTSTART` to the current year means the event will appear this year and every subsequent year. If the current year has already passed the date, the event won't appear until next year. This is correct behaviour — the user should subscribe early enough in the year. Document this in the help section.
- **Cal token in the data export (P29-01):** the `calToken` is a live credential — including it in the data export ZIP would allow anyone with the export file to subscribe to the user's birthday feed indefinitely. Exclude `calToken` from `account.json` in the GDPR export. Include only `calTokenExists: true` as a boolean so the user knows a token was active.
