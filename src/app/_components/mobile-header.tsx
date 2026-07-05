import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { MobileSearchButton } from "~/app/_components/mobile-search-button";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

// ─────────────────────────────────────────────────────────────────────────────
// P46-DB06 A1 — the ONE mobile header primitive (< md), three variants:
//
//   home     wordmark → /contacts · bell · search · filter — the contacts list
//            only, held across ALL its tabs (no mid-screen swap).
//   section  title + bell, no back — top-level nav destinations (Sync,
//            Settings root).
//   detail   labelled back (naming the destination, canonical blue) + title +
//            optional action — everything reached into.
//
// Contact detail's scroll-hide header stays the one sanctioned Detail
// exception (mobile-contact-detail.tsx) — documented, not folded in.
// ─────────────────────────────────────────────────────────────────────────────

interface HomeVariantProps {
  variant: "home";
  /** Pass the bell node in (NotificationBellSlot) — this file stays
      presentational so client components can import it without dragging the
      server notification graph into the bundle. */
  bell?: ReactNode;
  filterSlot?: ReactNode;
  labelRegistry?: { name: string; color: string }[];
  /** P42-DB01 §3b: compact "Offline" chip shown while account-state owns the banner slot. */
  statusChip?: ReactNode;
}

interface SectionVariantProps {
  variant: "section";
  title: string;
  bell?: ReactNode;
  /** Sticky to the top of a scroll region. */
  sticky?: boolean;
}

interface DetailVariantProps {
  variant: "detail";
  title: string;
  backHref: string;
  backLabel?: string;
  action?: ReactNode;
}

export type MobileHeaderProps = HomeVariantProps | SectionVariantProps | DetailVariantProps;

export function MobileHeader(props: MobileHeaderProps) {
  if (props.variant === "home") return <HomeHeader {...props} />;
  if (props.variant === "section") return <SectionHeader {...props} />;
  return <DetailHeader {...props} />;
}

// ── home — wordmark + bell + search (+ filter slot) ─────────────────────────

function HomeHeader({ bell, filterSlot, labelRegistry, statusChip }: HomeVariantProps) {
  return (
    <header
      className="flex md:hidden"
      style={{
        height: 52,
        flexShrink: 0,
        alignItems: "center",
        gap: 12,
        padding: "0 16px",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #d8ddd6",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <Link
        href="/contacts"
        style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: "#17352e",
            color: "#dff0e7",
            display: "grid",
            placeItems: "center",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          K
        </span>
        <span
          style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.018em", color: "#17352e" }}
        >
          Kontax
        </span>
      </Link>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 0 }}>
        {statusChip}
        {bell}
        {filterSlot}
        <Suspense fallback={null}>
          <MobileSearchButton labelRegistry={labelRegistry} />
        </Suspense>
      </div>
    </header>
  );
}

// ── section — title + bell, no back (Sync, Settings root) ───────────────────

function SectionHeader({ title, bell, sticky = false }: SectionVariantProps) {
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

// ── detail — labelled blue back + centered title + optional action ──────────

function DetailHeader({ title, backHref, backLabel = "Back", action }: DetailVariantProps) {
  return (
    <header
      className="flex md:hidden"
      style={{
        height: 52,
        flexShrink: 0,
        alignItems: "center",
        gap: 4,
        padding: "0 6px 0 4px",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #d8ddd6",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <Link
        href={backHref}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          height: 44,
          padding: "0 8px",
          textDecoration: "none",
          color: "#4158f4",
          fontSize: 14,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
        aria-label={`Back to ${backLabel}`}
      >
        <WorkspaceIcon name="back" size={20} />
        {backLabel}
      </Link>

      <span
        style={{
          flex: 1,
          fontSize: 17,
          fontWeight: 700,
          color: "#1d2823",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "center",
        }}
      >
        {title}
      </span>

      <div style={{ flexShrink: 0, minWidth: 44 }}>{action}</div>
    </header>
  );
}
