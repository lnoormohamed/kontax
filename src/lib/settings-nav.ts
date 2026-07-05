// P46-12 / DB07 §5 — the ONE settings nav definition, both breakpoints.
// <SettingsSidebar> (desktop) and <MobileSettingsNav> (mobile index) both map
// this ordered list. INVARIANT: no desktopOnly/mobileOnly flags exist —
// presentation differs per breakpoint; the entry set does not. That is what
// keeps Preferences/Books/Developer reachable on mobile and Shared-with-me on
// desktop by construction (DB07 completeness invariant).

export type SettingsNavEntry = {
  id: string;
  label: string;
  /** WorkspaceIcon name. */
  icon: string;
  route: string;
  /** One-line subtitle shown on the mobile index card. */
  sub: string;
  /** Desktop eyebrow that starts above this entry. */
  divider?: string;
  /** Plan gate — row renders with a PRO pill; the page owns its upsell. */
  gate?: "pro";
};

export const SETTINGS_NAV: readonly SettingsNavEntry[] = [
  { id: "account", label: "Account", icon: "person", route: "/settings/account", sub: "Profile, email, public card", divider: "You" },
  { id: "security", label: "Security", icon: "emergency", route: "/settings/security", sub: "Password, 2FA, sessions" },
  { id: "preferences", label: "Preferences", icon: "gear", route: "/settings/preferences", sub: "Display, interface, phonetic names" },
  { id: "notifications", label: "Notifications", icon: "bell", route: "/settings/notifications", sub: "Toggles, digest, reminders" },
  { id: "data", label: "Data & sync", icon: "sync", route: "/settings/data", sub: "Connections, import & export, books", divider: "Data" },
  { id: "sharing", label: "Sharing & groups", icon: "users", route: "/settings/sharing", sub: "Shared with me, family, teams" },
  // TODO(P46-13): route becomes /settings/billing when the anchor dies.
  { id: "billing", label: "Plan & billing", icon: "briefcase", route: "/settings#plan-billing", sub: "Plan, invoices, seats", divider: "Account-level" },
  { id: "developer", label: "Developer", icon: "code", route: "/settings/developer", sub: "API tokens", gate: "pro" },
];

/** Active test shared by both renderers (hash routes match the settings root). */
export function isSettingsNavActive(route: string, pathname: string): boolean {
  if (route.includes("#")) return pathname === "/settings";
  if (route === "/settings") return pathname === "/settings";
  // The Data & sync group owns the two workspace-level surfaces it links out
  // to (DB07 §5c) — highlight it while the user is on them.
  if (
    route === "/settings/data" &&
    (pathname === "/sync" || pathname === "/import-export" || pathname.startsWith("/import-export/"))
  ) {
    return true;
  }
  return pathname === route || pathname.startsWith(`${route}/`);
}
