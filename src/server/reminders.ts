/* P22-09: birthday & anniversary reminder detection. Scans each user's contacts
   for upcoming dates (Contact.birthday + Contact.significantDates) and raises a
   REMINDERS notification when one falls within the user's lead-time window
   (P22-10: Contact.reminderLeadDaysOverride ?? User.reminderLeadDays). A
   BirthdayReminderState row dedups to once per contact/date per calendar year. */

import { Prisma } from "../../generated/prisma";
import { db } from "~/server/db";
import { createNotification } from "~/server/notifications";

export const DEFAULT_LEAD_DAYS = 7;

/** Best-effort contact display name (empty strings fall through to the fallback). */
export function contactName(
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
export function labelOr(label: string | null | undefined, fallback: string): string {
  const t = label?.trim();
  return t && t.length > 0 ? t : fallback;
}

/** Parse a Kontax date string to { month, day }. Supports "YYYY-MM-DD" and "--MM-DD". */
export function parseContactDate(dateStr: string): { month: number; day: number } | null {
  const full = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(dateStr);
  if (full) return { month: Number(full[2]), day: Number(full[3]) };
  const yearless = /^--(\d{2})-?(\d{2})$/.exec(dateStr);
  if (yearless) return { month: Number(yearless[1]), day: Number(yearless[2]) };
  return null;
}

/**
 * Days until the next annual occurrence of MM-DD from `today` (0 = today). If the
 * date already passed this year, returns days until next year's occurrence. Uses
 * UTC throughout and never mutates `today`.
 */
export function daysUntilAnnual(month: number, day: number, today: Date): number {
  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const thisYear = new Date(startOfToday).getUTCFullYear();
  let occurrence = Date.UTC(thisYear, month - 1, day);
  if (occurrence < startOfToday) {
    occurrence = Date.UTC(thisYear + 1, month - 1, day);
  }
  return Math.round((occurrence - startOfToday) / 86_400_000);
}

const monthDayLabel = (month: number, day: number) =>
  new Date(Date.UTC(2000, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

/**
 * Run reminder detection for one user. Returns the number of REMINDERS
 * notifications raised. Honours the per-contact lead-time override and the
 * once-per-year dedup. `createNotification` still respects the user's in-app
 * REMINDERS preference, so opted-out users produce nothing.
 */
export async function runBirthdayReminders(userId: string, now = new Date()): Promise<number> {
  const currentYear = now.getUTCFullYear();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { reminderLeadDays: true },
  });
  if (!user) return 0;
  const userLeadDays = user.reminderLeadDays ?? DEFAULT_LEAD_DAYS;

  const contacts = await db.contact.findMany({
    where: { userId, archivedAt: null, birthday: { not: null } },
    select: {
      id: true,
      fullName: true,
      firstName: true,
      birthday: true,
      significantDates: true,
      reminderLeadDaysOverride: true,
    },
  });
  // significantDates is JSON, so we can't filter it in the query — but a contact
  // with neither a birthday nor significant dates is irrelevant. The query above
  // already requires a birthday; also pull contacts with significant dates only.
  const sigOnly = await db.contact.findMany({
    where: { userId, archivedAt: null, birthday: null, NOT: { significantDates: { equals: Prisma.DbNull } } },
    select: {
      id: true,
      fullName: true,
      firstName: true,
      birthday: true,
      significantDates: true,
      reminderLeadDaysOverride: true,
    },
  });

  let sent = 0;
  for (const contact of [...contacts, ...sigOnly]) {
    const leadDays = contact.reminderLeadDaysOverride ?? userLeadDays;
    const name = contactName(contact);

    const dates: Array<{ dateKey: string; dateStr: string; label: string }> = [];
    if (contact.birthday) {
      dates.push({ dateKey: "birthday", dateStr: contact.birthday, label: "birthday" });
    }
    const sig = (contact.significantDates ?? []) as Array<{ label?: string; date?: string }>;
    sig.forEach((sd, idx) => {
      if (sd.date) {
        dates.push({
          dateKey: `significant-${idx}`,
          dateStr: sd.date,
          label: labelOr(sd.label, "anniversary"),
        });
      }
    });

    for (const { dateKey, dateStr, label } of dates) {
      const parsed = parseContactDate(dateStr);
      if (!parsed) continue;
      const daysUntil = daysUntilAnnual(parsed.month, parsed.day, now);
      if (daysUntil < 0 || daysUntil > leadDays) continue;

      const existing = await db.birthdayReminderState.findUnique({
        where: { userId_contactId_dateKey: { userId, contactId: contact.id, dateKey } },
        select: { lastSentYear: true },
      });
      if (existing?.lastSentYear === currentYear) continue;

      const when = daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`;
      await createNotification({
        userId,
        category: "REMINDERS",
        title: `${name}'s ${label} is coming up`,
        body: `${when} — ${monthDayLabel(parsed.month, parsed.day)}`,
        actionUrl: `/contacts/${contact.id}`,
      });

      await db.birthdayReminderState.upsert({
        where: { userId_contactId_dateKey: { userId, contactId: contact.id, dateKey } },
        create: { userId, contactId: contact.id, dateKey, lastSentYear: currentYear },
        update: { lastSentYear: currentYear, lastSentAt: new Date() },
      });
      sent++;
    }
  }
  return sent;
}

/**
 * Eligible users for the daily run: active users whose REMINDERS in-app
 * preference is on (the default — users with no settings row are included).
 */
export async function eligibleReminderUserIds(): Promise<string[]> {
  const users = await db.user.findMany({
    where: {
      lifecycleState: "ACTIVE",
      OR: [
        { notificationSettings: { is: null } },
        { notificationSettings: { remindersInApp: true } },
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
