"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

interface BottomNavProps {
  unreadCount?: number;
  syncErrorCount?: number;
  duplicatesCount?: number;
}

const TABS = [
  // Mobile lands on the contacts list, not the Overview dashboard (a desktop
  // concept). Overview stays reachable via the Kontax wordmark in the mobile
  // header, so Archived/Shared aren't stranded.
  // P46-19: Duplicates holds the third slot (recurring, phone-friendly work);
  // /sync moved under Settings → Data & sync, and its error badge moved to
  // the Settings tab so broken sync stays visible.
  { key: "contacts", label: "Contacts", icon: "layoutList", href: "/contacts" },
  { key: "activity", label: "Activity", icon: "activity", href: "/contacts?tab=activity" },
  { key: "duplicates", label: "Duplicates", icon: "merge", href: "/contacts?tab=duplicates" },
  { key: "settings", label: "Settings", icon: "gear", href: "/settings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function getActiveTab(pathname: string, searchParams: ReturnType<typeof useSearchParams>): TabKey {
  if (pathname.startsWith("/settings") || pathname.startsWith("/sync")) return "settings";
  if (pathname.startsWith("/merge")) return "duplicates";
  if (pathname.startsWith("/contacts") && searchParams.get("tab") === "duplicates") return "duplicates";
  if (pathname.startsWith("/contacts") && searchParams.get("tab") === "activity") return "activity";
  if (pathname.startsWith("/contacts") || pathname === "/") return "contacts";
  return "contacts";
}

export function BottomNav({ unreadCount = 0, syncErrorCount = 0, duplicatesCount = 0 }: BottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeKey = getActiveTab(pathname, searchParams);

  return (
    <nav
      className="flex md:hidden"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "calc(56px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
        backgroundColor: "#ffffff",
        borderTop: "1px solid #d8ddd6",
        zIndex: 50,
      }}
    >
      {TABS.map(({ key, label, icon, href }) => {
        const isActive = key === activeKey;
        const color = isActive ? "#17352e" : "#8b938c";
        const badge =
          key === "activity" ? unreadCount : key === "duplicates" ? duplicatesCount : key === "settings" ? syncErrorCount : 0;

        return (
          <Link
            key={key}
            href={href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              color,
              textDecoration: "none",
              position: "relative",
              minHeight: 44,
              WebkitTapHighlightColor: "transparent",
            }}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
          >
            {/* active dot */}
            <span style={{ height: 4, display: "flex", alignItems: "center" }}>
              {isActive && (
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    backgroundColor: "#17352e",
                  }}
                />
              )}
            </span>

            {/* icon + badge */}
            <span style={{ position: "relative" }}>
              <WorkspaceIcon
                name={icon}
                size={24}
                strokeWidth={isActive ? 2 : 1.8}
              />
              {badge > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -5,
                    right: -8,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 8,
                    backgroundColor: "#b5472f",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    display: "grid",
                    placeItems: "center",
                    border: "1.5px solid #fff",
                    lineHeight: 1,
                  }}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </span>

            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.01em" }}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
