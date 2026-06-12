/* P22-11: iCal birthday & anniversary feed. Builds an RFC 5545 VCALENDAR with
   one all-day, yearly-recurring VEVENT per contact birthday / significant date.
   Reuses parseContactDate from the reminder detector. */

import { randomBytes } from "crypto";

import { contactName, labelOr, parseContactDate } from "~/server/reminders";

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

// RFC 5545: escape backslashes, commas, and semicolons in text values.
function escapeICalText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
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
            uid: `birthday-${contact.id}@kontax.app`,
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
          uid: `significant-${contact.id}-${idx}@kontax.app`,
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
