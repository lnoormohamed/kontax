export const ADMIN_NAV_GROUPS = [
  {
    id: "overview",
    label: "Overview",
    items: [{ id: "overview", label: "Overview", icon: "home", href: "/admin" }],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { id: "users", label: "Users", icon: "users", href: "/admin/users" },
      { id: "sync", label: "Sync ops", icon: "sync", href: "/admin/sync" },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    items: [
      { id: "audit", label: "Audit log", icon: "audit", href: "/admin/audit" },
      { id: "flags", label: "Feature flags", icon: "flag", href: "/admin/feature-flags" },
    ],
  },
  {
    id: "communications",
    label: "Communications",
    items: [
      { id: "broadcast", label: "Broadcast", icon: "share", href: "/admin/broadcast" },
    ],
  },
] as const;

export function activeAdminNavId(pathname: string): string {
  if (pathname === "/admin") return "overview";
  if (pathname.startsWith("/admin/sync") || pathname.startsWith("/admin/metrics")) return "sync";
  if (pathname.startsWith("/admin/feature-flags")) return "flags";
  if (pathname.startsWith("/admin/broadcast")) return "broadcast";
  if (pathname.startsWith("/admin/audit")) return "audit";
  return "users";
}
