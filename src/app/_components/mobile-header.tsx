import Link from "next/link";
import { Suspense } from "react";

import { MobilePlainHeader } from "~/app/_components/mobile-plain-header";
import { MobileSearchButton } from "~/app/_components/mobile-search-button";
import { NotificationBellSlot } from "~/app/_components/notification-bell-slot";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

// ── Home screen header (contacts list) ──────────────────────────────────────
// Wordmark left · bell + search icon right. Only renders on mobile (< md).

interface MobileHomeHeaderProps {
  userId: string;
  tab?: string;
}

export function MobileHomeHeader({ userId, tab }: MobileHomeHeaderProps) {
  // Activity tab → the shared plain-title header (P24B-01).
  if (tab === "activity") {
    return (
      <MobilePlainHeader title="Activity" sticky bell={<NotificationBellSlot userId={userId} />} />
    );
  }

  // People list → wordmark + bell + search.
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
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          textDecoration: "none",
        }}
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
            style={{
              fontSize: 19,
              fontWeight: 600,
              letterSpacing: "-0.018em",
              color: "#17352e",
            }}
          >
            Kontax
          </span>
        </Link>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 0 }}>
        <NotificationBellSlot userId={userId} />
        <Suspense fallback={null}>
          <MobileSearchButton />
        </Suspense>
      </div>
    </header>
  );
}

// ── Secondary screen header (back + title + optional action) ─────────────────
// Used by AppShell pages: contact detail, create, import/export.

interface MobileSecondaryHeaderProps {
  title: string;
  backHref: string;
  backLabel?: string;
  action?: React.ReactNode;
}

export function MobileSecondaryHeader({
  title,
  backHref,
  backLabel = "Back",
  action,
}: MobileSecondaryHeaderProps) {
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
          color: "#5c655e",
          fontSize: 14,
          fontWeight: 500,
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
