"use client";

import { usePathname } from "next/navigation";

import { MobileHeader } from "~/app/_components/mobile-header";

// P46-DB06 A1/A2: route-aware mobile settings header (md:hidden), a thin
// wrapper over the ONE MobileHeader primitive. Settings root → Section
// (title + bell). Any sub-page → Detail with a labelled back naming its
// destination ("Settings"), never icon-only.

const SUBPAGE_TITLES: Record<string, string> = {
  profile: "Public card",
  account: "Account",
  notifications: "Notifications",
  preferences: "Preferences",
  devices: "Devices & app passwords",
  developer: "Developer",
  security: "Security",
  family: "Family",
  teams: "Team management",
  books: "Books",
  "import-presets": "Import presets",
  "export-presets": "Export presets",
  data: "Data & sync",
  sharing: "Sharing & groups",
  billing: "Plan & billing",
};

// P46-14: nested children get their own titles (deepest match wins).
const DEEP_TITLES: Record<string, string> = {
  "account/card": "Public card",
  "data/export": "Download your data",
};

export function MobileSettingsHeader({ bell }: { bell: React.ReactNode }) {
  const pathname = usePathname();
  const subPath = pathname.replace(/^\/settings\/?/, "");
  const segment = subPath.split("/")[0] ?? "";
  const isRoot = segment === "";
  const title = isRoot
    ? "Settings"
    : (DEEP_TITLES[subPath] ?? SUBPAGE_TITLES[segment] ?? "Settings");

  if (isRoot) {
    return <MobileHeader variant="section" title="Settings" bell={bell} />;
  }

  return (
    <MobileHeader
      variant="detail"
      title={title}
      backHref="/settings"
      backLabel="Settings"
      action={bell}
    />
  );
}
