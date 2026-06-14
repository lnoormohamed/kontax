/**
 * DISPLAY ONLY — never use in sync, import, or export code paths.
 * vCard/CardDAV always use ISO 8601 (RFC 6350).
 */

import type { UserPreferences } from "~/lib/preferences";

type DateFormat = NonNullable<UserPreferences["dateFormat"]>;

function applyFormat(year: number, month: number, day: number, fmt: DateFormat): string {
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const yyyy = String(year);
  switch (fmt) {
    case "MM/DD/YYYY":
      return `${mm}/${dd}/${yyyy}`;
    case "YYYY-MM-DD":
      return `${yyyy}-${mm}-${dd}`;
    case "DD MMM YYYY":
    default:
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(year, month - 1, day)));
  }
}

/**
 * Format a JS Date or ISO datetime string for UI display (e.g. createdAt, updatedAt).
 * Returns "" for null/undefined; returns the raw string if parsing fails.
 */
export function formatDate(
  value: Date | string | null | undefined,
  format: DateFormat = "DD MMM YYYY",
): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  // Use UTC parts to avoid timezone-based date shift on date-only strings.
  return applyFormat(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), format);
}

/**
 * Format a stored contact date value for UI display.
 * Handles vCard formats: YYYY-MM-DD, YYYYMMDD, and year-less --MMDD / --MM-DD.
 * Year-less dates render as "14 July" (format preference has no year to apply).
 * Returns "" for null/undefined; returns the raw string for unrecognised formats.
 */
export function formatStoredDate(
  value: string | null | undefined,
  format: DateFormat = "DD MMM YYYY",
): string {
  if (!value) return "";

  // Year-less vCard form: --MMDD or --MM-DD
  const noYear = /^--(\d{2})-?(\d{2})$/.exec(value);
  if (noYear) {
    const [, month, day] = noYear;
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2000, Number(month) - 1, Number(day))));
  }

  // Full date: YYYY-MM-DD (extended) or YYYYMMDD (vCard basic)
  const full = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(value);
  if (!full) return value;
  const [, year, month, day] = full;
  return applyFormat(Number(year), Number(month), Number(day), format);
}
