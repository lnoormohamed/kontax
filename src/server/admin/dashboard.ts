import "server-only";

import { db } from "~/server/db";
import { loadPlatformMetrics } from "~/server/admin/metrics";

const DAY_MS = 24 * 60 * 60 * 1000;
const dayAgo = () => new Date(Date.now() - DAY_MS);

const fmtRelative = (date: Date) => {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

const formatActionLabel = (action: string) =>
  action
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export type AdminOverviewData = Awaited<ReturnType<typeof loadAdminOverview>>;

export async function loadAdminOverview() {
  const since = dayAgo();

  const [
    metrics,
    lockedUsers,
    graceUsers,
    scheduledDeletions,
    planOverrides,
    syncGrouped,
    audit24h,
    recentActionsRaw,
  ] = await Promise.all([
    loadPlatformMetrics(),
    db.user.count({
      where: {
        OR: [{ lifecycleState: "LOCKED" }, { lifecycleState: "CANCELED" }],
      },
    }),
    db.user.count({ where: { lifecycleState: "GRACE" } }),
    db.user.count({ where: { scheduledDeleteAt: { not: null } } }),
    db.user.count({ where: { planOverriddenAt: { not: null } } }),
    db.syncAccount.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.adminAuditEvent.count({ where: { createdAt: { gte: since } } }),
    db.adminAuditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        action: true,
        createdAt: true,
        targetEmail: true,
        admin: { select: { name: true, email: true } },
      },
    }),
  ]);

  const syncByStatus = Object.fromEntries(
    syncGrouped.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;

  const syncNeedsReauth = syncByStatus.NEEDS_REAUTH ?? 0;
  const syncErrors = syncByStatus.ERROR ?? 0;
  const syncPaused = syncByStatus.PAUSED ?? 0;
  const syncRetired = syncByStatus.RETIRED ?? 0;
  const syncActive = syncByStatus.ACTIVE ?? 0;

  const attention = [
    {
      id: "sync-auth",
      label: "Connections need re-auth",
      count: syncNeedsReauth,
      tone: syncNeedsReauth > 0 ? "critical" : "healthy",
      href: "/admin/metrics",
      body:
        syncNeedsReauth > 0
          ? "At least one connected provider cannot refresh until credentials are fixed."
          : "No connected providers are currently blocked on re-authentication.",
    },
    {
      id: "sync-errors",
      label: "Sync accounts in error or paused",
      count: syncErrors + syncPaused,
      tone: syncErrors > 0 ? "warning" : syncPaused > 0 ? "watch" : "healthy",
      href: "/admin/metrics",
      body:
        syncErrors + syncPaused > 0
          ? "Review provider health and recent job failures before issues spread."
          : "Sync status looks stable across active connections.",
    },
    {
      id: "locked-users",
      label: "Locked users or pending deletions",
      count: lockedUsers + scheduledDeletions,
      tone:
        lockedUsers + scheduledDeletions > 0 ? "warning" : "healthy",
      href: "/admin/users",
      body:
        lockedUsers + scheduledDeletions > 0
          ? "Support may need context on suspensions, deletion schedules, or recovery."
          : "No users are currently locked or waiting for deletion handling.",
    },
    {
      id: "grace-users",
      label: "Users in grace",
      count: graceUsers,
      tone: graceUsers > 0 ? "watch" : "healthy",
      href: "/admin/users",
      body:
        graceUsers > 0
          ? "These users may need billing follow-up before their access degrades."
          : "No user accounts are currently in grace.",
    },
  ];

  const criticalCount = attention
    .filter((item) => item.tone === "critical")
    .reduce((sum, item) => sum + item.count, 0);
  const needsAttentionCount = attention
    .filter((item) => item.tone === "critical" || item.tone === "warning")
    .reduce((sum, item) => sum + item.count, 0);

  const recentActions = recentActionsRaw.map((row) => ({
    id: row.id,
    action: row.action,
    actionLabel: formatActionLabel(row.action),
    actor: row.admin?.name?.trim() ?? row.admin?.email ?? "system",
    target: row.targetEmail ?? "No user target",
    when: fmtRelative(row.createdAt),
  }));

  return {
    metrics,
    overviewStats: [
      {
        id: "users",
        label: "Total users",
        value: metrics.stats[0]?.value ?? "0",
        sub: metrics.stats[0]?.delta ?? "",
        href: "/admin/users",
      },
      {
        id: "sync",
        label: "Active sync accounts",
        value: syncActive.toLocaleString(),
        sub: `${(syncNeedsReauth + syncErrors + syncPaused).toLocaleString()} need review`,
        href: "/admin/metrics",
      },
      {
        id: "audit",
        label: "Admin actions (24h)",
        value: audit24h.toLocaleString(),
        sub: "Privileged changes recorded",
        href: "/admin/audit",
      },
      {
        id: "overrides",
        label: "Plan overrides",
        value: planOverrides.toLocaleString(),
        sub: "Accounts on admin-managed billing state",
        href: "/admin/users",
      },
    ],
    attention,
    quickActions: [
      {
        id: "users",
        label: "Search users",
        body: "Open the support-facing user list and jump into one account fast.",
        href: "/admin/users",
        icon: "users",
      },
      {
        id: "metrics",
        label: "Check platform health",
        body: "Review usage, growth, and error rates across the platform.",
        href: "/admin/metrics",
        icon: "metrics",
      },
      {
        id: "audit",
        label: "Review audit log",
        body: "See recent privileged actions and trace who changed what.",
        href: "/admin/audit",
        icon: "audit",
      },
      {
        id: "broadcast",
        label: "Send broadcast",
        body: "Publish a product update to active users from the admin area.",
        href: "/admin/broadcast",
        icon: "share",
      },
      {
        id: "flags",
        label: "Manage feature flags",
        body: "Check rollout state and update internal flag settings.",
        href: "/admin/feature-flags",
        icon: "flag",
      },
    ],
    recentActions,
    summary: {
      criticalCount,
      needsAttentionCount,
      lockedUsers,
      graceUsers,
      scheduledDeletions,
      syncNeedsReauth,
      syncErrors,
      syncPaused,
      syncRetired,
    },
  };
}
