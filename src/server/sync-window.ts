// P39-01: sync-window evaluation. The P36 panel stores syncWindowStart/End as
// hour-of-day; P39 adds syncWindowTimezone (IANA) so the window tracks the
// user's wall clock across DST. Rows saved before the timezone was captured
// (syncWindowTimezone null) keep their original stored-as-UTC semantics until
// the user re-saves the panel.

export const SYNC_WINDOW_DEFERRED_CODE = "SYNC_WINDOW_DEFERRED";

/** Current hour-of-day (0–23) in the given IANA zone; falls back to UTC when the
 * zone is missing or invalid (defensive — the client sends
 * Intl.DateTimeFormat().resolvedOptions().timeZone, which is always valid). */
export const getHourInTimezone = (now: Date, timeZone: string | null): number => {
  if (timeZone) {
    try {
      const hour = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        hourCycle: "h23",
      }).format(now);
      const parsed = Number.parseInt(hour, 10);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 23) {
        return parsed;
      }
    } catch {
      // fall through to UTC
    }
  }
  return now.getUTCHours();
};

/**
 * Whether a scheduled sync may run right now. The window is [start, end) on the
 * user's wall clock; a window that wraps midnight (start > end) covers
 * start→24h and 0h→end. start === end or either bound missing = no restriction.
 */
export const isWithinSyncWindow = ({
  now,
  windowStart,
  windowEnd,
  timezone,
}: {
  now: Date;
  windowStart: number | null;
  windowEnd: number | null;
  timezone: string | null;
}): boolean => {
  if (windowStart == null || windowEnd == null || windowStart === windowEnd) {
    return true;
  }

  const hour = getHourInTimezone(now, timezone);
  return windowStart < windowEnd
    ? hour >= windowStart && hour < windowEnd
    : hour >= windowStart || hour < windowEnd;
};
