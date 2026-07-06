"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

const SUBPAGE_TITLES: Record<string, string> = {
  account: "Account",
  notifications: "Notifications",
  preferences: "Preferences",
  developer: "Developer",
  security: "Security",
  data: "Data & sync",
  sharing: "Sharing & groups",
  billing: "Plan & billing",
};

// P46-14/15/16: nested children get their own titles (deepest match wins).
const DEEP_TITLES: Record<string, string> = {
  "account/card": "Public card",
  "data/export": "Download your data",
  "data/books": "Books",
  "data/devices": "Connect a device",
  "sharing/shared": "Shared with me",
  "sharing/family": "Family",
  "sharing/teams": "Team management",
  "sharing/teams/audit": "Team audit log",
  "sharing/teams/books": "Team books",
  "sharing/teams/permissions": "Book permissions",
};

export function TabletSettingsHeader() {
  const pathname = usePathname();
  const subPath = pathname.replace(/^\/settings\/?/, "");
  const segment = subPath.split("/")[0] ?? "";
  if (!segment) return null;
  const title = DEEP_TITLES[subPath] ?? SUBPAGE_TITLES[segment] ?? "Settings";

  return (
    <div className="mb-4 flex items-center gap-2 lg:hidden">
      <Link
        href="/settings"
        aria-label="Back to Settings"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#5c655e] transition hover:bg-[#e9ece7]"
      >
        <WorkspaceIcon name="back" size={18} />
      </Link>
      <span className="text-[13px] font-semibold text-[#5c655e]">Settings</span>
      <WorkspaceIcon name="chevronRight" size={12} strokeWidth={2} className="text-[#aeb4ac]" />
      <span className="text-[13px] font-semibold text-[#1d2823]">{title}</span>
    </div>
  );
}
