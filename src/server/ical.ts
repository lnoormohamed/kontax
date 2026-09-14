/* P22-11: iCal birthday & anniversary feed. Builds an RFC 5545 VCALENDAR with
   one all-day, yearly-recurring VEVENT per contact birthday / significant date.
   Reuses parseContactDate from the reminder detector. */

import { randomBytes } from "crypto";

/** 32-char URL-safe calendar token (revocable credential). */
export function generateCalToken(): string {
  return randomBytes(24).toString("base64url");
}

type ContactWithDates = {
  id: string;
  fullName: string | null;
  firstName: string | null;
  birthday: string | null;
  significantDates: unknown;
};

// Duplicated (verbatim) from ~/server/reminders rather than imported: that
// module's other exports (createNotification, the reminder scan) pull in
// ~/server/db and the email-template tree, which this file — and its unit
// tests — has no business depending on for three pure string/date helpers.
// Keep these in sync with ~/server/reminders if the parsing rules change.

/** Best-effort contact display name (empty strings fall through to the fallback). */
function contactName(
  c: { fullName?: string | null; firstName?: string | null },
  fallback = "A contact",
): string {
  const full = c.fullName?.trim();
  if (full) return full;
  const first = c.firstName?.trim();
  if (first) return first;
  return fallback;
}

/** Trimmed label or fallback when empty/absent. */
function labelOr(label: string | null | undefined, fallback: string): string {
  const t = label?.trim();
  return t && t.length > 0 ? t : fallback;
}

/** Parse a Kontax date string to { month, day }. Supports "YYYY-MM-DD" and "--MM-DD". */
function parseContactDate(dateStr: string): { month: number; day: number } | null {
  const full = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(dateStr);
  if (full) return { month: Number(full[2]), day: Number(full[3]) };
  const yearless = /^--(\d{2})-?(\d{2})$/.exec(dateStr);
  if (yearless) return { month: Number(yearless[1]), day: Number(yearless[2]) };
  return null;
}

// RFC 5545: escape backslashes, commas, and semicolons in text values.
// P48-11 item 5: a contact/date label is attacker-controlled (synced or
// imported) — a literal CR or LF would break the current property's line and
// let the rest of the value be parsed as a new iCal property (property
// injection into every subscriber's calendar app). Collapse any real
// line-break sequence to the RFC 5545 escaped-newline token ("\n" as two
// characters) *before* escaping backslashes would double-escape it, so no
// raw CR/LF ever reaches the output.
export function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatICalDate(month: number, day: number, year: number): string {
  return `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

function labelEmoji(label: string | undefined): string {
  const lower = (label ?? "").toLowerCase();
  if (lower.includes("anniversary")) return "💑";
  if (lower.includes("work")) return "💼";
  return "📅";
}

function buildVEvent(params: { uid: string; summary: string; dtstart: string }): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `SUMMARY:${escapeICalText(params.summary)}`,
    `DTSTART;VALUE=DATE:${params.dtstart}`,
    "DURATION:P1D",
    "RRULE:FREQ=YEARLY",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

function buildVEvents(contacts: ContactWithDates[], year: number): string[] {
  const events: string[] = [];
  for (const contact of contacts) {
    const name = contactName(contact, "Contact");

    if (contact.birthday) {
      const parsed = parseContactDate(contact.birthday);
      if (parsed) {
        events.push(
          ...buildVEvent({
            uid: `birthday-${contact.id}@getkontax.com`,
            summary: `🎂 ${name}'s Birthday`,
            dtstart: formatICalDate(parsed.month, parsed.day, year),
          }),
        );
      }
    }

    const sig = (contact.significantDates ?? []) as Array<{ label?: string; date?: string }>;
    sig.forEach((sd, idx) => {
      if (!sd.date) return;
      const parsed = parseContactDate(sd.date);
      if (!parsed) return;
      events.push(
        ...buildVEvent({
          uid: `significant-${contact.id}-${idx}@getkontax.com`,
          summary: `${labelEmoji(sd.label)} ${name}'s ${labelOr(sd.label, "Anniversary")}`,
          dtstart: formatICalDate(parsed.month, parsed.day, year),
        }),
      );
    });
  }
  return events;
}

/** Assemble the full .ics document for a user's contacts. */
export function buildVCalendar(contacts: ContactWithDates[], now = new Date()): string {
  const vevents = buildVEvents(contacts, now.getUTCFullYear());
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kontax//Kontax Birthday Feed//EN",
    "X-WR-CALNAME:Kontax Birthdays",
    "X-WR-TIMEZONE:UTC",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");
}
