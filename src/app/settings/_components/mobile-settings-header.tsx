"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

// P24B-02: route-aware mobile settings header (md:hidden).
// At the settings root → plain "Settings" title. On any sub-page → a back
// header (‹ chevron → /settings · sub-page title) so users aren't trapped with
// only the bottom nav to escape. Back target is always the settings list.

const SUBPAGE_TITLES: Record<string, string> = {
  profile: "Profile",
  account: "Account",
  notifications: "Notifications",
  preferences: "Preferences",
  devices: "Devices & app passwords",
  security: "Security",
  family: "Family",
  teams: "Team management",
};

export function MobileSettingsHeader({ bell }: { bell: React.ReactNode }) {
  const pathname = usePathname();
  // First segment under /settings ("" at the root).
  const segment = pathname.replace(/^\/settings\/?/, "").split("/")[0] ?? "";
  const isRoot = segment === "";
  const title = isRoot ? "Settings" : (SUBPAGE_TITLES[segment] ?? "Settings");

  return (
    <header
      className="flex shrink-0 items-center border-b border-[#d8ddd6] bg-white md:hidden"
      style={{ height: 52, padding: isRoot ? "0 16px" : "0 12px 0 4px", gap: 8 }}
    >
      {isRoot ? (
        <span style={{ fontSize: 19, fontWeight: 700, color: "#1d2823", flex: 1 }}>Settings</span>
      ) : (
        <>
          <Link
            href="/settings"
            aria-label="Back to Settings"
            style={{
              width: 44,
              height: 44,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              color: "#1d2823",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <WorkspaceIcon name="back" size={22} />
          </Link>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 17,
              fontWeight: 700,
              color: "#1d2823",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
        </>
      )}
      <div style={{ flexShrink: 0 }}>{bell}</div>
    </header>
  );
}
