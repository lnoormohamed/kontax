"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

const SUBPAGE_TITLES: Record<string, string> = {
  account: "Account",
  notifications: "Notifications",
  preferences: "Preferences",
  devices: "Devices & app passwords",
  developer: "Developer",
  security: "Security",
  family: "Family",
  teams: "Team management",
  "export-presets": "Export presets",
  "import-presets": "Import presets",
};

export function TabletSettingsHeader() {
  const pathname = usePathname();
  const segment = pathname.replace(/^\/settings\/?/, "").split("/")[0] ?? "";
  if (!segment) return null;
  const title = SUBPAGE_TITLES[segment] ?? "Settings";

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
