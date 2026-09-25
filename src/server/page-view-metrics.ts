import "server-only";

import { getRedis } from "~/server/rate-limit";

// P50A-08 — Cookieless, privacy-respecting page-view counting.
//
// No cookies, no per-visitor identifier, and no IP address is ever stored:
// the client beacon (~/app/_components/page-view-beacon.tsx) sends only a
// path, and the counters below are keyed by that path and the UTC calendar
// date — nothing that identifies a visitor. The route that calls
// `recordPageView` (src/app/api/metrics/pv/route.ts) does use the request IP,
// but only as an ephemeral in-memory/Redis rate-limit key (same pattern as
// /api/card/[username]/click) — it is never written into these counters.
//
// Storage: one Redis hash per UTC day, `pv:<YYYY-MM-DD>`, field = path,
// value = count. A hash keeps a whole day's counters in one key instead of
// one key per path per day, and TTLs cleanly.

const PV_KEY_PREFIX = "pv:";
const PV_TTL_SECONDS = 400 * 24 * 60 * 60; // ~13 months of daily history

// Content pages this is allowed to count, plus the one conversion path
// (guides/help/compare/for/features → /register). Kept local to this module
// rather than imported from src/server/public-paths.ts: that file gates
// session/auth routing and is owned by another in-flight change, whereas this
// list only decides what a beacon is allowed to increment.
const PV_TRACKED_PREFIXES = ["/guides/", "/compare/", "/help/", "/for/", "/features/"] as const;
const PV_TRACKED_EXACT = ["/register", "/features"] as const;

const MAX_PATH_LENGTH = 200;

/** True when `path` is one this deployment counts page views for. */
export function isTrackablePath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0 || path.length > MAX_PATH_LENGTH) return false;
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if ((PV_TRACKED_EXACT as readonly string[]).includes(path)) return true;
  return PV_TRACKED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function utcDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayKey(date: Date): string {
  return `${PV_KEY_PREFIX}${utcDateStamp(date)}`;
}

/**
 * Increment today's counter for `path`. Never throws — a Redis outage (or
 * Redis simply not being configured, e.g. locally) must never affect the
 * page the beacon fired from, so every failure is swallowed here.
 */
export async function recordPageView(path: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const key = dayKey(new Date());
    await redis.multi().hincrby(key, path, 1).expire(key, PV_TTL_SECONDS).exec();
  } catch {
    // Fail silently — see module note above.
  }
}

function categoryFor(path: string): string | null {
  if (path.startsWith("/guides/")) return "Guides";
  if (path.startsWith("/compare/")) return "Compare";
  if (path.startsWith("/help/")) return "Help";
  if (path.startsWith("/for/")) return "For";
  if (path === "/features" || path.startsWith("/features/")) return "Features";
  return null;
}

export type PageViewSummary = {
  /** Whether Redis is configured at all — lets the admin page distinguish
   *  "genuinely zero views" from "no store to read from". */
  redisConfigured: boolean;
  days: number;
  /** Total content-page views across the window (excludes /register). */
  totalViews: number;
  /** /register views over the window — the guide/help → register proxy
   *  conversion count (P50A-08); not attributed to a specific referring page,
   *  since no referrer or identifier is captured. */
  registerConversions: number;
  categoryTotals: Record<string, number>;
  topPaths: { path: string; count: number }[];
};

const EMPTY_SUMMARY = (days: number): PageViewSummary => ({
  redisConfigured: false,
  days,
  totalViews: 0,
  registerConversions: 0,
  categoryTotals: {},
  topPaths: [],
});

/** Read + aggregate the last `days` days of counters for the admin metrics page. */
export async function loadPageViewSummary(days = 7): Promise<PageViewSummary> {
  const redis = getRedis();
  if (!redis) return EMPTY_SUMMARY(days);

  const now = Date.now();
  const dayKeys = Array.from({ length: days }, (_, i) => dayKey(new Date(now - i * 24 * 60 * 60 * 1000)));

  const perDay = await Promise.all(
    dayKeys.map(async (key) => {
      try {
        return await redis.hgetall(key);
      } catch {
        return {};
      }
    }),
  );

  const totals = new Map<string, number>();
  for (const day of perDay) {
    for (const [path, raw] of Object.entries(day)) {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      totals.set(path, (totals.get(path) ?? 0) + n);
    }
  }

  let totalViews = 0;
  let registerConversions = 0;
  const categoryTotals: Record<string, number> = {};

  for (const [path, count] of totals) {
    if (path === "/register") {
      registerConversions += count;
      continue;
    }
    const category = categoryFor(path);
    if (!category) continue;
    totalViews += count;
    categoryTotals[category] = (categoryTotals[category] ?? 0) + count;
  }

  const topPaths = [...totals.entries()]
    .filter(([path]) => path !== "/register")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  return { redisConfigured: true, days, totalViews, registerConversions, categoryTotals, topPaths };
}
