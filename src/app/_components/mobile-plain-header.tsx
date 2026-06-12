import type { ReactNode } from "react";

/**
 * P24B-01 — Shared mobile plain-title header (spec §B1, variant 2).
 *
 * 52px, left-aligned 19/700 title, optional bell on the right. Used by the
 * tab roots that aren't the contacts Home header (Sync, Settings root,
 * Activity). Presentational and server-compatible — pass the bell node in so
 * it works from both server pages and client wrappers.
 */
export function MobilePlainHeader({
  title,
  bell,
  sticky = false,
}: {
  title: string;
  bell?: ReactNode;
  /** Sticky to the top of a scroll region (the Activity tab needs this). */
  sticky?: boolean;
}) {
  return (
    <header
      className="flex shrink-0 items-center border-b border-[#d8ddd6] bg-white md:hidden"
      style={{
        height: 52,
        padding: "0 16px",
        gap: 12,
        ...(sticky ? { position: "sticky", top: 0, zIndex: 40 } : { zIndex: 20 }),
      }}
    >
      <span style={{ fontSize: 19, fontWeight: 700, color: "#1d2823", flex: 1 }}>{title}</span>
      {bell ? <div style={{ flexShrink: 0 }}>{bell}</div> : null}
    </header>
  );
}
