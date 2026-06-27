export type PublicCardViewEvent = {
  viewedAt: Date;
  referrer: string | null;
};

export type CardAnalytics = {
  totalViews: number;
  views7d: number;
  views30d: number;
  ctaClicks: number;
  latestActivityAt: Date | null;
  topCta: { label: string; count: number } | null;
  dailyViews30d: Array<{ date: string; count: number }>;
  topSources: Array<{ label: string; count: number }>;
};

const ONE_DAY_MS = 86_400_000;

const toDayKey = (value: Date) => value.toISOString().slice(0, 10);

export function normaliseCardReferrer(referrer: string | null | undefined) {
  if (!referrer?.trim()) return "Direct / unknown";

  try {
    const url = new URL(referrer);
    const host = url.hostname.replace(/^www\./i, "");
    return host || "Direct / unknown";
  } catch {
    return "Direct / unknown";
  }
}

export function deriveCardAnalytics(
  totals: { totalViews: number; ctaClicks: number },
  events: PublicCardViewEvent[],
  now = new Date(),
): CardAnalytics {
  const start30d = new Date(now.getTime() - 29 * ONE_DAY_MS);
  start30d.setHours(0, 0, 0, 0);
  const start7d = new Date(now.getTime() - 6 * ONE_DAY_MS);
  start7d.setHours(0, 0, 0, 0);

  const events30d = events.filter((event) => event.viewedAt >= start30d);
  const views7d = events30d.filter((event) => event.viewedAt >= start7d).length;

  const byDay = new Map<string, number>();
  for (let offset = 29; offset >= 0; offset--) {
    const date = new Date(now.getTime() - offset * ONE_DAY_MS);
    date.setHours(0, 0, 0, 0);
    byDay.set(toDayKey(date), 0);
  }
  for (const event of events30d) {
    const key = toDayKey(event.viewedAt);
    if (!byDay.has(key)) continue;
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  const sourceCounts = new Map<string, number>();
  for (const event of events30d) {
    const source = normaliseCardReferrer(event.referrer);
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }

  const topSources = [...sourceCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  const latestActivityAt =
    events.length > 0
      ? events.reduce(
          (latest, event) => (event.viewedAt > latest ? event.viewedAt : latest),
          events[0]!.viewedAt,
        )
      : null;

  return {
    totalViews: totals.totalViews,
    views7d,
    views30d: events30d.length,
    ctaClicks: totals.ctaClicks,
    latestActivityAt,
    topCta: totals.ctaClicks > 0 ? { label: "Add to Kontax", count: totals.ctaClicks } : null,
    dailyViews30d: [...byDay.entries()].map(([date, count]) => ({ date, count })),
    topSources,
  };
}
