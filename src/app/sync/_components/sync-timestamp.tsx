"use client";

import { useEffect, useState } from "react";

// Renders a sync timestamp in the *viewer's* local timezone as
// "Today HH:MM" / "Yesterday HH:MM" / "DD MMM". The page is server-rendered in
// the container's timezone (UTC), so formatting there would show UTC. We render
// a deterministic UTC fallback for SSR + first paint (so hydration matches),
// then re-format in the browser's local timezone after mount.
function format(date: Date, timeZone?: string): string {
  const opts: Intl.DateTimeFormatOptions = timeZone ? { timeZone } : {};
  // YYYY-MM-DD in the target zone, for stable same-day / yesterday comparison.
  const ymd = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      ...opts,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000);
  const time = new Intl.DateTimeFormat("en-GB", {
    ...opts,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (ymd(date) === ymd(now)) return `Today ${time}`;
  if (ymd(date) === ymd(yesterday)) return `Yesterday ${time}`;
  return new Intl.DateTimeFormat("en-GB", {
    ...opts,
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function SyncTimestamp({ iso }: { iso: string }) {
  // null until mounted: SSR and first client render both use the UTC fallback,
  // so hydration matches; the effect then upgrades to the local-zone label.
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(format(new Date(iso)));
  }, [iso]);

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {label ?? format(new Date(iso), "UTC")}
    </time>
  );
}
