import "server-only";

import { GUIDE_PAGES, SECTION_INDEXES } from "~/app/(marketing)/guides/_content/pages";
import { HELP_CATEGORIES, HELP_ROOT, allArticles, articleHref, categoryHref } from "~/app/(marketing)/help/_content";
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

// Only real, published content pages can be counted (Fable review M1): the
// allow-list is built from the same registries the sitemap uses, so a beacon
// can never create a counter for an invented path — which keeps the number of
// hash fields bounded (~100) in the Redis that also backs the login limiters.
const STATIC_TRACKED_PATHS = [
  "/register", // the one conversion path
  "/features",
  "/features/duplicates",
  "/features/history",
  "/for/families",
  "/for/teams",
] as const;

let trackedPaths: ReadonlySet<string> | null = null;
function getTrackedPaths(): ReadonlySet<string> {
  trackedPaths ??= new Set<string>([
    ...STATIC_TRACKED_PATHS,
    HELP_ROOT,
    ...HELP_CATEGORIES.map((c) => categoryHref(c.id)),
    ...allArticles().map((a) => articleHref(a)),
    ...Object.values(SECTION_INDEXES).map((s) => s.path),
    ...GUIDE_PAGES.map((g) => g.path),
  ]);
  return trackedPaths;
}

// Belt and braces: even with an exact allow-list, never let one day's hash grow
// past this many distinct paths.
const MAX_FIELDS_PER_DAY = 1000;

const MAX_PATH_LENGTH = 200;

/** True when `path` is a published content page this deployment counts. */
export function isTrackablePath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0 || path.length > MAX_PATH_LENGTH) return false;
  return getTrackedPaths().has(path);
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
    const known = await redis.hexists(key, path);
    if (!known && (await redis.hlen(key)) >= MAX_FIELDS_PER_DAY) return;
    await redis.multi().hincrby(key, path, 1).expire(key, PV_TTL_SECONDS).exec();
  } catch {
    // Fail silently — see module note above.
  }
}

function categoryFor(path: string): string | null {
  if (path === "/guides" || path.startsWith("/guides/")) return "Guides";
  if (path === "/compare" || path.startsWith("/compare/")) return "Compare";
  if (path === "/help" || path.startsWith("/help/")) return "Help";
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
