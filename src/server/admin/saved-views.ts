import "server-only";

export type AdminSavedView = {
  id: string;
  label: string;
  description: string;
  href: string;
  section: "Support" | "Sync" | "Users" | "Audit";
};

export type AdminUserViewId =
  | "all"
  | "user-review"
  | "locked-or-delete"
  | "grace"
  | "billing-exceptions"
  | "plan-overrides";

export type AdminSyncViewId =
  | "all"
  | "action-required"
  | "needs-reauth"
  | "generic-safe-watchlist";

export type AdminAuditViewId =
  | "all"
  | "destructive-actions"
  | "feature-flag-changes"
  | "broadcast-activity";

export const ADMIN_USER_VIEWS: Array<{ id: AdminUserViewId; label: string; href: string }> = [
  { id: "all", label: "All users", href: "/admin/users" },
  { id: "user-review", label: "Needs review", href: "/admin/users?view=user-review" },
  { id: "locked-or-delete", label: "Locked or deleting", href: "/admin/users?view=locked-or-delete" },
  { id: "grace", label: "Grace period", href: "/admin/users?view=grace" },
  { id: "billing-exceptions", label: "Billing exceptions", href: "/admin/users?view=billing-exceptions" },
  { id: "plan-overrides", label: "Plan overrides", href: "/admin/users?view=plan-overrides" },
] as const;

export const ADMIN_SYNC_VIEWS: Array<{ id: AdminSyncViewId; label: string; href: string }> = [
  { id: "all", label: "All connections", href: "/admin/sync" },
  { id: "action-required", label: "Action required", href: "/admin/sync?view=action-required" },
  { id: "needs-reauth", label: "Needs re-auth", href: "/admin/sync?view=needs-reauth" },
  {
    id: "generic-safe-watchlist",
    label: "Generic-safe CardDAV",
    href: "/admin/sync?view=generic-safe-watchlist",
  },
] as const;

export const ADMIN_AUDIT_VIEWS: Array<{ id: AdminAuditViewId; label: string; href: string }> = [
  { id: "all", label: "All audit activity", href: "/admin/audit" },
  {
    id: "destructive-actions",
    label: "Destructive actions",
    href: "/admin/audit?view=destructive-actions",
  },
  {
    id: "feature-flag-changes",
    label: "Flag changes",
    href: "/admin/audit?view=feature-flag-changes",
  },
  {
    id: "broadcast-activity",
    label: "Broadcast activity",
    href: "/admin/audit?view=broadcast-activity",
  },
] as const;

export const ADMIN_GLOBAL_SAVED_VIEWS: AdminSavedView[] = [
  {
    id: "support-unassigned",
    label: "Unassigned support cases",
    description: "Claim new support work before it gets buried in detail pages.",
    href: "/admin/support?queue=unassigned",
    section: "Support",
  },
  {
    id: "sync-reauth",
    label: "Sync re-auth queue",
    description: "Jump straight into connections blocked on expired or revoked credentials.",
    href: "/admin/sync?view=needs-reauth",
    section: "Sync",
  },
  {
    id: "billing-exceptions",
    label: "Billing exceptions",
    description: "Reopen the user queue for grace periods, overrides, and deletion windows.",
    href: "/admin/users?view=billing-exceptions",
    section: "Users",
  },
  {
    id: "destructive-actions",
    label: "Recent destructive actions",
    description: "Review suspensions, deletion schedules, and impersonation starts from the audit log.",
    href: "/admin/audit?view=destructive-actions",
    section: "Audit",
  },
  {
    id: "provider-watchlist",
    label: "Generic-safe CardDAV watchlist",
    description: "Check the fallback CardDAV capability cohort that most often needs operator verification.",
    href: "/admin/sync?view=generic-safe-watchlist",
    section: "Sync",
  },
];

export function normalizeAdminUserViewId(value?: string): AdminUserViewId {
  return ADMIN_USER_VIEWS.some((view) => view.id === value) ? (value as AdminUserViewId) : "all";
}

export function normalizeAdminSyncViewId(value?: string): AdminSyncViewId {
  return ADMIN_SYNC_VIEWS.some((view) => view.id === value) ? (value as AdminSyncViewId) : "all";
}

export function normalizeAdminAuditViewId(value?: string): AdminAuditViewId {
  return ADMIN_AUDIT_VIEWS.some((view) => view.id === value) ? (value as AdminAuditViewId) : "all";
}

export function adminSyncViewDefaults(view: AdminSyncViewId) {
  switch (view) {
    case "action-required":
      return { provider: "all", status: "all", profile: "all", q: "" };
    case "needs-reauth":
      return { provider: "all", status: "NEEDS_REAUTH", profile: "all", q: "" };
    case "generic-safe-watchlist":
      return {
        provider: "CARDDAV",
        status: "all",
        profile: "carddav-generic-safe",
        q: "",
      };
    default:
      return { provider: "all", status: "all", profile: "all", q: "" };
  }
}

export function adminAuditViewDefaults(view: AdminAuditViewId) {
  switch (view) {
    case "destructive-actions":
      return {
        action: "all",
        actor: "all",
        target: "",
        entity: "",
        severity: "high",
        q: "",
        range: "7d",
      };
    case "feature-flag-changes":
      return {
        action: "flag.update",
        actor: "all",
        target: "",
        entity: "",
        severity: "all",
        q: "",
        range: "30d",
      };
    case "broadcast-activity":
      return {
        action: "product.broadcast",
        actor: "all",
        target: "",
        entity: "",
        severity: "all",
        q: "",
        range: "30d",
      };
    default:
      return {
        action: "all",
        actor: "all",
        target: "",
        entity: "",
        severity: "all",
        q: "",
        range: "all",
      };
  }
}
