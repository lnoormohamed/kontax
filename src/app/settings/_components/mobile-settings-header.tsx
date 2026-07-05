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
};

export function MobileSettingsHeader({ bell }: { bell: React.ReactNode }) {
  const pathname = usePathname();
  // First segment under /settings ("" at the root).
  const segment = pathname.replace(/^\/settings\/?/, "").split("/")[0] ?? "";
  const isRoot = segment === "";
  const title = isRoot ? "Settings" : (SUBPAGE_TITLES[segment] ?? "Settings");

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
