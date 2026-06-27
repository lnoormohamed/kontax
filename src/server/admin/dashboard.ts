import "server-only";

import type { Prisma } from "../../../generated/prisma";
import { ADMIN_ACTIONS } from "~/server/admin/audit";
import {
  type AdminAttentionState,
  adminAttentionForSyncStatus,
  adminWorstAttention,
} from "~/server/admin/attention";
import {
  countOpenSupportCases,
  listOpenSupportCases,
} from "~/server/admin/support-cases";
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

const supportCaseHref = (subjectType: string, subjectId: string) => {
  if (subjectType === "SYNC_ACCOUNT") return `/admin/sync/${subjectId}`;
  return `/admin/users/${subjectId}`;
};

const supportCaseTone = (supportCase: {
  severity: string;
  status: string;
}): AdminAttentionState => {
  if (supportCase.severity === "CRITICAL") return "action";
  if (supportCase.status === "WAITING_ON_CUSTOMER") return "watch";
  if (supportCase.status === "WAITING_ON_PROVIDER") return "watch";
  if (supportCase.severity === "HIGH") return "warning";
  return "warning";
};

export type AdminOverviewData = Awaited<ReturnType<typeof loadAdminOverview>>;

type OverviewAttentionItem = {
  id: string;
  label: string;
  count: number;
  tone: AdminAttentionState;
  href: string;
  body: string;
};

type WorkQueueItem = {
  id: string;
  href: string;
  label: string;
  sub: string;
  meta: string;
  tone: AdminAttentionState;
};

type WorkQueue = {
  id: string;
  label: string;
  href: string;
  count: number;
  tone: AdminAttentionState;
  body: string;
  items: WorkQueueItem[];
};

export async function loadAdminOverview() {
  const since = dayAgo();
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);
  const userReviewWhere: Prisma.UserWhereInput = {
    OR: [
      { lifecycleState: { in: ["LOCKED", "CANCELED", "GRACE"] } },
      { scheduledDeleteAt: { not: null } },
    ],
  };
  const lifecycleExceptionWhere: Prisma.UserWhereInput = {
    OR: [
      { lifecycleState: "GRACE" },
      { planOverriddenAt: { not: null } },
      { scheduledDeleteAt: { not: null } },
    ],
  };

  const [
    metrics,
    lockedUsers,
    graceUsers,
    scheduledDeletions,
    planOverrides,
    syncGrouped,
    audit24h,
    recentActionsRaw,
    userReviewCount,
    userReviewItemsRaw,
    syncQueueCount,
    syncQueueItemsRaw,
    lifecycleExceptionCount,
    lifecycleExceptionItemsRaw,
    destructiveActionCount,
    destructiveActionItemsRaw,
    openSupportCaseCount,
    openSupportCasesRaw,
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
    db.user.count({ where: userReviewWhere }),
    db.user.findMany({
      where: userReviewWhere,
      orderBy: [{ scheduledDeleteAt: "desc" }, { updatedAt: "desc" }],
      take: 4,
      select: {
        id: true,
        email: true,
        name: true,
        lifecycleState: true,
        scheduledDeleteAt: true,
        updatedAt: true,
      },
    }),
    db.syncAccount.count({
      where: { status: { in: ["NEEDS_REAUTH", "ERROR", "PAUSED"] } },
    }),
    db.syncAccount.findMany({
      where: { status: { in: ["NEEDS_REAUTH", "ERROR", "PAUSED"] } },
      orderBy: [{ updatedAt: "desc" }],
      take: 4,
      select: {
        id: true,
        label: true,
        provider: true,
        status: true,
        updatedAt: true,
        userId: true,
        user: { select: { email: true, name: true } },
      },
    }),
    db.user.count({ where: lifecycleExceptionWhere }),
    db.user.findMany({
      where: lifecycleExceptionWhere,
      orderBy: [{ planOverriddenAt: "desc" }, { updatedAt: "desc" }],
      take: 4,
      select: {
        id: true,
        email: true,
        name: true,
        lifecycleState: true,
        scheduledDeleteAt: true,
        planOverriddenAt: true,
        updatedAt: true,
      },
    }),
    db.adminAuditEvent.count({
      where: {
        createdAt: { gte: weekAgo },
        action: {
          in: [
            ADMIN_ACTIONS.USER_SUSPENDED,
            ADMIN_ACTIONS.USER_DELETION_SCHEDULED,
            ADMIN_ACTIONS.IMPERSONATION_START,
          ],
        },
      },
    }),
    db.adminAuditEvent.findMany({
      where: {
        createdAt: { gte: weekAgo },
        action: {
          in: [
            ADMIN_ACTIONS.USER_SUSPENDED,
            ADMIN_ACTIONS.USER_DELETION_SCHEDULED,
            ADMIN_ACTIONS.IMPERSONATION_START,
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        action: true,
        createdAt: true,
        targetUserId: true,
        targetEmail: true,
        admin: { select: { name: true, email: true } },
      },
    }),
    countOpenSupportCases(),
    listOpenSupportCases(4),
  ]);

  const syncByStatus = Object.fromEntries(
    syncGrouped.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;

  const syncNeedsReauth = syncByStatus.NEEDS_REAUTH ?? 0;
  const syncErrors = syncByStatus.ERROR ?? 0;
  const syncPaused = syncByStatus.PAUSED ?? 0;
  const syncRetired = syncByStatus.RETIRED ?? 0;
  const syncActive = syncByStatus.ACTIVE ?? 0;

  const attention: OverviewAttentionItem[] = [
    {
      id: "sync-auth",
      label: "Connections need re-auth",
      count: syncNeedsReauth,
      tone: syncNeedsReauth > 0 ? "action" : "healthy",
      href: "/admin/sync",
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
      href: "/admin/sync",
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

  const workQueues: WorkQueue[] = [
    {
      id: "user-review",
      label: "Users needing review",
      href: "/admin/users",
      count: userReviewCount,
      tone:
        userReviewItemsRaw.length > 0
          ? adminWorstAttention(
              ...userReviewItemsRaw.map((row) =>
                row.scheduledDeleteAt || row.lifecycleState === "LOCKED" || row.lifecycleState === "CANCELED"
                  ? "warning"
                  : "watch",
              ),
            )
          : "healthy",
      body:
        userReviewCount > 0
          ? "Accounts in grace, suspension, or scheduled deletion that may need human follow-up."
          : "No user lifecycle issues are currently waiting for review.",
      items: userReviewItemsRaw.map((row) => ({
        id: row.id,
        href: `/admin/users/${row.id}`,
        label: row.email,
        sub:
          row.scheduledDeleteAt != null
            ? `Deletion scheduled · ${fmtRelative(row.scheduledDeleteAt)}`
            : row.lifecycleState === "GRACE"
              ? "Grace period active"
              : row.lifecycleState === "LOCKED"
                ? "Account suspended"
                : "Access restricted",
        meta: row.name?.trim() || "No profile name",
        tone:
          row.scheduledDeleteAt != null || row.lifecycleState === "LOCKED" || row.lifecycleState === "CANCELED"
            ? "warning"
            : "watch",
      })),
    },
    {
      id: "sync-action",
      label: "Sync connections needing action",
      href: "/admin/sync",
      count: syncQueueCount,
      tone:
        syncQueueItemsRaw.length > 0
          ? adminWorstAttention(
              ...syncQueueItemsRaw.map((row) => adminAttentionForSyncStatus(row.status)),
            )
          : "healthy",
      body:
        syncQueueCount > 0
          ? "Paused, errored, or re-auth-blocked connections waiting for support attention."
          : "All sync connections are currently healthy or intentionally retired.",
      items: syncQueueItemsRaw.map((row) => ({
        id: row.id,
        href: `/admin/users/${row.userId}`,
        label: row.label,
        sub: `${row.provider} · ${row.user.email}`,
        meta: fmtRelative(row.updatedAt),
        tone: adminAttentionForSyncStatus(row.status),
      })),
    },
    {
      id: "support-cases",
      label: "Open support cases",
      href: "/admin/support",
      count: openSupportCaseCount,
      tone:
        openSupportCasesRaw.length > 0
          ? adminWorstAttention(
              ...openSupportCasesRaw.map((supportCase) => supportCaseTone(supportCase)),
            )
          : "healthy",
      body:
        openSupportCaseCount > 0
          ? "Tracked support work with ownership, severity, and next follow-up dates."
          : "No open support cases are waiting for triage right now.",
      items: openSupportCasesRaw.map((supportCase) => ({
        id: supportCase.id,
        href: supportCaseHref(supportCase.subjectType, supportCase.subjectId),
        label: supportCase.title,
        sub: `${supportCase.statusLabel} · ${supportCase.severityLabel} · ${supportCase.target}`,
        meta:
          supportCase.nextFollowUpAt != null
            ? `Owner ${supportCase.owner} · Follow-up ${supportCase.nextFollowUpLabel}`
            : `Owner ${supportCase.owner} · Updated ${supportCase.updatedWhen}`,
        tone: supportCaseTone(supportCase),
      })),
    },
    {
      id: "destructive-actions",
      label: "Recent destructive actions",
      href: "/admin/audit",
      count: destructiveActionCount,
      tone: destructiveActionCount > 0 ? "watch" : "healthy",
      body:
        destructiveActionCount > 0
          ? "Suspensions, deletion schedules, and impersonation starts from the last 7 days."
          : "No destructive admin actions have been recorded in the last 7 days.",
      items: destructiveActionItemsRaw.map((row) => ({
        id: row.id,
        href: row.targetUserId ? `/admin/users/${row.targetUserId}` : "/admin/audit",
        label: formatActionLabel(row.action),
        sub: row.targetEmail ?? "No user target",
        meta: `${row.admin?.name?.trim() ?? row.admin?.email ?? "system"} · ${fmtRelative(row.createdAt)}`,
        tone:
          row.action === ADMIN_ACTIONS.USER_DELETION_SCHEDULED
            ? "warning"
            : row.action === ADMIN_ACTIONS.USER_SUSPENDED
              ? "warning"
              : "watch",
      })),
    },
    {
      id: "billing-lifecycle",
      label: "Billing and lifecycle exceptions",
      href: "/admin/users",
      count: lifecycleExceptionCount,
      tone:
        lifecycleExceptionItemsRaw.length > 0
          ? adminWorstAttention(
              ...lifecycleExceptionItemsRaw.map((row) =>
                row.scheduledDeleteAt != null
                  ? "warning"
                  : row.lifecycleState === "GRACE"
                    ? "watch"
                    : row.planOverriddenAt != null
                      ? "watch"
                      : "healthy",
              ),
            )
          : "healthy",
      body:
        lifecycleExceptionCount > 0
          ? "Overrides, grace states, and pending deletion windows that support should keep an eye on."
          : "No billing or lifecycle exceptions are active right now.",
      items: lifecycleExceptionItemsRaw.map((row) => ({
        id: row.id,
        href: `/admin/users/${row.id}`,
        label: row.email,
        sub:
          row.planOverriddenAt != null
            ? "Admin plan override active"
            : row.scheduledDeleteAt != null
              ? "Deletion scheduled"
              : "Grace period active",
        meta: row.name?.trim() || fmtRelative(row.updatedAt),
        tone:
          row.scheduledDeleteAt != null
            ? "warning"
            : row.planOverriddenAt != null || row.lifecycleState === "GRACE"
              ? "watch"
              : "healthy",
      })),
    },
  ];

  const criticalCount = attention
    .filter((item) => item.tone === "critical" || item.tone === "action")
    .reduce((sum, item) => sum + item.count, 0);
  const needsAttentionCount = attention
    .filter((item) => item.tone === "action" || item.tone === "critical" || item.tone === "warning")
    .reduce((sum, item) => sum + item.count, 0);
  const actionRequiredCount = attention
    .filter((item) => item.tone === "action")
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
        href: "/admin/sync",
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
    workQueues,
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
        href: "/admin/sync",
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
      actionRequiredCount,
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
