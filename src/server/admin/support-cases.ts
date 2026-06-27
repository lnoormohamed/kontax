import "server-only";

import type {
  AdminSupportCaseSeverity,
  AdminSupportCaseStatus,
  Prisma,
} from "../../../generated/prisma";

import { db } from "~/server/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENTLY_RESOLVED_WINDOW_DAYS = 14;
const OPEN_SUPPORT_CASE_STATUSES: AdminSupportCaseStatus[] = [
  "OPEN",
  "WAITING_ON_CUSTOMER",
  "WAITING_ON_PROVIDER",
];
const SUPPORT_CASE_SUBJECT_TYPES = ["USER", "SYNC_ACCOUNT"] as const;

export type AdminSupportCaseQueueId =
  | "open"
  | "unassigned"
  | "mine"
  | "waiting_customer"
  | "waiting_provider"
  | "overdue"
  | "due_today"
  | "resolved";

export type AdminSupportCaseOwnerFilter = "all" | "me" | "assigned" | "unassigned";
export type AdminSupportCaseSubjectTypeFilter =
  | "all"
  | (typeof SUPPORT_CASE_SUBJECT_TYPES)[number];

const SUPPORT_CASE_QUEUES: AdminSupportCaseQueueId[] = [
  "open",
  "unassigned",
  "mine",
  "waiting_customer",
  "waiting_provider",
  "overdue",
  "due_today",
  "resolved",
];

const STATUS_RANK: Record<AdminSupportCaseStatus, number> = {
  OPEN: 0,
  WAITING_ON_PROVIDER: 1,
  WAITING_ON_CUSTOMER: 2,
  RESOLVED: 3,
  ARCHIVED: 4,
};

const SEVERITY_RANK: Record<AdminSupportCaseSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
};

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function isSupportCaseStatus(value: string): value is AdminSupportCaseStatus {
  return ["OPEN", "WAITING_ON_CUSTOMER", "WAITING_ON_PROVIDER", "RESOLVED", "ARCHIVED"].includes(
    value,
  );
}

function isSupportCaseSeverity(value: string): value is AdminSupportCaseSeverity {
  return ["NORMAL", "HIGH", "CRITICAL"].includes(value);
}

function normalizeQueue(value?: string): AdminSupportCaseQueueId {
  return value && SUPPORT_CASE_QUEUES.includes(value as AdminSupportCaseQueueId)
    ? (value as AdminSupportCaseQueueId)
    : "open";
}

function normalizeOwnerFilter(value?: string): AdminSupportCaseOwnerFilter {
  return value === "me" || value === "assigned" || value === "unassigned" ? value : "all";
}

function normalizeSubjectTypeFilter(value?: string): AdminSupportCaseSubjectTypeFilter {
  return value === "USER" || value === "SYNC_ACCOUNT" ? value : "all";
}

function subjectTypeLabel(subjectType: string) {
  switch (subjectType) {
    case "SYNC_ACCOUNT":
      return "Sync account";
    case "USER":
      return "User";
    default:
      return subjectType
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

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

const fmtAbsolute = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
      }).format(date)
    : "—";

export function adminSupportCaseStatusLabel(status: AdminSupportCaseStatus): string {
  switch (status) {
    case "WAITING_ON_CUSTOMER":
      return "Waiting on customer";
    case "WAITING_ON_PROVIDER":
      return "Waiting on provider";
    case "RESOLVED":
      return "Resolved";
    case "ARCHIVED":
      return "Archived";
    default:
      return "Open";
  }
}

export function adminSupportCaseSeverityLabel(severity: AdminSupportCaseSeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "Critical";
    case "HIGH":
      return "High";
    default:
      return "Normal";
  }
}

function supportCaseTargetHref(subjectType: string, subjectId: string, targetUserId: string | null) {
  if (subjectType === "SYNC_ACCOUNT") return `/admin/sync/${subjectId}`;
  if (targetUserId) return `/admin/users/${targetUserId}`;
  if (subjectType === "USER") return `/admin/users/${subjectId}`;
  return null;
}

function followUpTone(nextFollowUpAt: Date | null, todayStart: Date, tomorrowStart: Date) {
  if (!nextFollowUpAt) return "none" as const;
  if (nextFollowUpAt < todayStart) return "overdue" as const;
  if (nextFollowUpAt < tomorrowStart) return "due_today" as const;
  return "scheduled" as const;
}

function queueWhere(
  queue: AdminSupportCaseQueueId,
  adminId: string,
  todayStart: Date,
  tomorrowStart: Date,
  recentResolvedStart: Date,
): Prisma.AdminSupportCaseWhereInput {
  switch (queue) {
    case "unassigned":
      return {
        status: { in: OPEN_SUPPORT_CASE_STATUSES },
        assigneeAdminUserId: null,
      };
    case "mine":
      return {
        status: { in: OPEN_SUPPORT_CASE_STATUSES },
        assigneeAdminUserId: adminId,
      };
    case "waiting_customer":
      return { status: "WAITING_ON_CUSTOMER" };
    case "waiting_provider":
      return { status: "WAITING_ON_PROVIDER" };
    case "overdue":
      return {
        status: { in: OPEN_SUPPORT_CASE_STATUSES },
        nextFollowUpAt: { lt: todayStart },
      };
    case "due_today":
      return {
        status: { in: OPEN_SUPPORT_CASE_STATUSES },
        nextFollowUpAt: { gte: todayStart, lt: tomorrowStart },
      };
    case "resolved":
      return {
        status: "RESOLVED",
        resolvedAt: { gte: recentResolvedStart },
      };
    default:
      return { status: { in: OPEN_SUPPORT_CASE_STATUSES } };
  }
}

export async function loadAdminSupportCaseWorkbench(input: {
  adminId: string;
  queue?: string;
  status?: string;
  severity?: string;
  owner?: string;
  subjectType?: string;
  q?: string;
}) {
  const todayStart = startOfUtcDay();
  const tomorrowStart = addUtcDays(todayStart, 1);
  const recentResolvedStart = addUtcDays(todayStart, -RECENTLY_RESOLVED_WINDOW_DAYS);
  const queue = normalizeQueue(input.queue);
  const owner = normalizeOwnerFilter(input.owner);
  const subjectType = normalizeSubjectTypeFilter(input.subjectType?.trim().toUpperCase());
  const q = input.q?.trim() ?? "";
  const status =
    input.status?.trim().toUpperCase() && isSupportCaseStatus(input.status.trim().toUpperCase())
      ? (input.status.trim().toUpperCase() as AdminSupportCaseStatus)
      : "all";
  const severity =
    input.severity?.trim().toUpperCase() && isSupportCaseSeverity(input.severity.trim().toUpperCase())
      ? (input.severity.trim().toUpperCase() as AdminSupportCaseSeverity)
      : "all";
  const containsInsensitive = (value: string) => ({ contains: value, mode: "insensitive" as const });
  const whereAnd: Prisma.AdminSupportCaseWhereInput[] = [
    queueWhere(queue, input.adminId, todayStart, tomorrowStart, recentResolvedStart),
  ];

  if (status !== "all") whereAnd.push({ status });
  if (severity !== "all") whereAnd.push({ severity });
  if (owner === "me") whereAnd.push({ assigneeAdminUserId: input.adminId });
  if (owner === "assigned") whereAnd.push({ assigneeAdminUserId: { not: null } });
  if (owner === "unassigned") whereAnd.push({ assigneeAdminUserId: null });
  if (subjectType !== "all") whereAnd.push({ subjectType });
  if (q) {
    whereAnd.push({
      OR: [
        { id: containsInsensitive(q) },
        { title: containsInsensitive(q) },
        { summary: containsInsensitive(q) },
        { subjectId: containsInsensitive(q) },
        { targetUser: { email: containsInsensitive(q) } },
        { targetUser: { name: containsInsensitive(q) } },
        { assignee: { email: containsInsensitive(q) } },
        { assignee: { name: containsInsensitive(q) } },
      ],
    });
  }

  const where: Prisma.AdminSupportCaseWhereInput = {
    archivedAt: null,
    AND: whereAnd,
  };

  const queueCountsWhere = (queueId: AdminSupportCaseQueueId): Prisma.AdminSupportCaseWhereInput => ({
    archivedAt: null,
    ...queueWhere(queueId, input.adminId, todayStart, tomorrowStart, recentResolvedStart),
  });

  const [rows, counts] = await Promise.all([
    db.adminSupportCase.findMany({
      where,
      orderBy:
        queue === "resolved"
          ? [{ resolvedAt: "desc" }, { updatedAt: "desc" }]
          : [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: queue === "resolved" ? 120 : 160,
      select: {
        id: true,
        subjectType: true,
        subjectId: true,
        targetUserId: true,
        title: true,
        summary: true,
        status: true,
        severity: true,
        nextFollowUpAt: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        creator: { select: { name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        targetUser: { select: { email: true, name: true } },
      },
    }),
    Promise.all([
      db.adminSupportCase.count({ where: queueCountsWhere("open") }),
      db.adminSupportCase.count({ where: queueCountsWhere("unassigned") }),
      db.adminSupportCase.count({ where: queueCountsWhere("mine") }),
      db.adminSupportCase.count({ where: queueCountsWhere("waiting_customer") }),
      db.adminSupportCase.count({ where: queueCountsWhere("waiting_provider") }),
      db.adminSupportCase.count({ where: queueCountsWhere("overdue") }),
      db.adminSupportCase.count({ where: queueCountsWhere("due_today") }),
      db.adminSupportCase.count({ where: queueCountsWhere("resolved") }),
    ]),
  ]);

  const syncAccountIds = Array.from(
    new Set(rows.filter((row) => row.subjectType === "SYNC_ACCOUNT").map((row) => row.subjectId)),
  );
  const syncAccounts = syncAccountIds.length
    ? await db.syncAccount.findMany({
        where: { id: { in: syncAccountIds } },
        select: {
          id: true,
          label: true,
          provider: true,
          user: { select: { email: true, name: true } },
        },
      })
    : [];
  const syncAccountMap = new Map(syncAccounts.map((account) => [account.id, account]));

  const mappedRows = rows
    .map((row) => {
      const syncAccount = row.subjectType === "SYNC_ACCOUNT" ? syncAccountMap.get(row.subjectId) : null;
      const targetHref = supportCaseTargetHref(row.subjectType, row.subjectId, row.targetUserId ?? null);
      const followUpState = followUpTone(row.nextFollowUpAt, todayStart, tomorrowStart);
      const target =
        row.subjectType === "SYNC_ACCOUNT"
          ? syncAccount?.label?.trim() || syncAccount?.user.email || `Sync account ${row.subjectId.slice(0, 8)}`
          : row.targetUser?.email ??
            row.targetUser?.name?.trim() ??
            `${subjectTypeLabel(row.subjectType)} ${row.subjectId.slice(0, 8)}`;
      const targetDetail =
        row.subjectType === "SYNC_ACCOUNT"
          ? [subjectTypeLabel(row.subjectType), syncAccount?.provider, syncAccount?.user.email]
              .filter(Boolean)
              .join(" · ")
          : row.targetUser?.name?.trim() && row.targetUser.name.trim() !== row.targetUser.email
            ? `${subjectTypeLabel(row.subjectType)} · ${row.targetUser.name.trim()}`
            : subjectTypeLabel(row.subjectType);

      return {
        id: row.id,
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        subjectLabel: subjectTypeLabel(row.subjectType),
        target,
        targetDetail,
        targetHref,
        title: row.title,
        summary: row.summary,
        status: row.status,
        statusLabel: adminSupportCaseStatusLabel(row.status),
        severity: row.severity,
        severityLabel: adminSupportCaseSeverityLabel(row.severity),
        owner:
          row.assignee?.id === input.adminId
            ? "You"
            : row.assignee?.name?.trim() ?? row.assignee?.email ?? "Unassigned",
        ownerState:
          row.assignee?.id === input.adminId
            ? ("me" as const)
            : row.assignee?.id
              ? ("assigned" as const)
              : ("unassigned" as const),
        createdBy: row.creator.name?.trim() ?? row.creator.email,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        updatedWhen: fmtRelative(row.updatedAt),
        nextFollowUpAt: row.nextFollowUpAt,
        nextFollowUpIso: row.nextFollowUpAt?.toISOString() ?? "",
        nextFollowUpLabel: fmtAbsolute(row.nextFollowUpAt),
        followUpState,
        resolvedAt: row.resolvedAt,
        resolvedAtLabel: fmtAbsolute(row.resolvedAt),
      };
    })
    .sort((a, b) => {
      if (queue === "resolved") {
        const resolvedDiff =
          (b.resolvedAt?.getTime() ?? b.updatedAt.getTime()) -
          (a.resolvedAt?.getTime() ?? a.updatedAt.getTime());
        if (resolvedDiff !== 0) return resolvedDiff;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      }

      const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (severityDiff !== 0) return severityDiff;

      const followUpPriority: Record<(typeof a)["followUpState"], number> = {
        overdue: 0,
        due_today: 1,
        scheduled: 2,
        none: 3,
      };
      const followUpDiff = followUpPriority[a.followUpState] - followUpPriority[b.followUpState];
      if (followUpDiff !== 0) return followUpDiff;

      if (a.nextFollowUpAt && b.nextFollowUpAt) {
        const nextFollowUpDiff = a.nextFollowUpAt.getTime() - b.nextFollowUpAt.getTime();
        if (nextFollowUpDiff !== 0) return nextFollowUpDiff;
      } else if (a.nextFollowUpAt || b.nextFollowUpAt) {
        return a.nextFollowUpAt ? -1 : 1;
      }

      const statusDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (statusDiff !== 0) return statusDiff;

      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

  return {
    filters: {
      queue,
      status,
      severity,
      owner,
      subjectType,
      q,
    },
    queueTabs: [
      { id: "open" as const, label: "Open", count: counts[0] },
      { id: "unassigned" as const, label: "Unassigned", count: counts[1] },
      { id: "mine" as const, label: "Assigned to me", count: counts[2] },
      { id: "waiting_customer" as const, label: "Waiting on customer", count: counts[3] },
      { id: "waiting_provider" as const, label: "Waiting on provider", count: counts[4] },
      { id: "overdue" as const, label: "Overdue", count: counts[5] },
      { id: "due_today" as const, label: "Due today", count: counts[6] },
      { id: "resolved" as const, label: "Recently resolved", count: counts[7] },
    ],
    summary: {
      open: counts[0],
      unassigned: counts[1],
      mine: counts[2],
      overdue: counts[5],
      dueToday: counts[6],
      resolved: counts[7],
    },
    rows: mappedRows,
  };
}

export async function listSupportCasesForSubject(subjectType: string, subjectId: string) {
  const rows = await db.adminSupportCase.findMany({
    where: {
      subjectType: subjectType.trim().toUpperCase(),
      subjectId,
      archivedAt: null,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 8,
    select: {
      id: true,
      title: true,
      summary: true,
      status: true,
      severity: true,
      nextFollowUpAt: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
      creator: { select: { name: true, email: true } },
      assignee: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    statusLabel: adminSupportCaseStatusLabel(row.status),
    severity: row.severity,
    severityLabel: adminSupportCaseSeverityLabel(row.severity),
    owner: row.assignee?.name?.trim() ?? row.assignee?.email ?? "Unassigned",
    createdBy: row.creator.name?.trim() ?? row.creator.email,
    updatedAt: row.updatedAt,
    updatedWhen: fmtRelative(row.updatedAt),
    nextFollowUpAt: row.nextFollowUpAt,
    nextFollowUpIso: row.nextFollowUpAt?.toISOString() ?? "",
    nextFollowUpLabel: fmtAbsolute(row.nextFollowUpAt),
    resolvedAt: row.resolvedAt,
    resolvedAtLabel: fmtAbsolute(row.resolvedAt),
  }));
}

export async function listOpenSupportCases(limit = 8) {
  const rows = await db.adminSupportCase.findMany({
    where: {
      status: { in: OPEN_SUPPORT_CASE_STATUSES },
      archivedAt: null,
    },
    orderBy: [
      { severity: "desc" },
      { nextFollowUpAt: "asc" },
      { updatedAt: "desc" },
    ],
    take: limit,
    select: {
      id: true,
      subjectType: true,
      subjectId: true,
      title: true,
      status: true,
      severity: true,
      nextFollowUpAt: true,
      updatedAt: true,
      targetUser: { select: { email: true, name: true } },
      assignee: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    title: row.title,
    status: row.status,
    statusLabel: adminSupportCaseStatusLabel(row.status),
    severity: row.severity,
    severityLabel: adminSupportCaseSeverityLabel(row.severity),
    target:
      row.targetUser?.email ??
      row.targetUser?.name?.trim() ??
      `${row.subjectType} ${row.subjectId}`,
    owner: row.assignee?.name?.trim() ?? row.assignee?.email ?? "Unassigned",
    updatedWhen: fmtRelative(row.updatedAt),
    nextFollowUpAt: row.nextFollowUpAt,
    nextFollowUpLabel: fmtAbsolute(row.nextFollowUpAt),
  }));
}

export async function countOpenSupportCases() {
  return db.adminSupportCase.count({
    where: {
      status: { in: OPEN_SUPPORT_CASE_STATUSES },
      archivedAt: null,
    },
  });
}
