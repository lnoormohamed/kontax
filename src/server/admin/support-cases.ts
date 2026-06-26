import "server-only";

import type {
  AdminSupportCaseSeverity,
  AdminSupportCaseStatus,
} from "../../../generated/prisma";

import { db } from "~/server/db";

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
      status: { in: ["OPEN", "WAITING_ON_CUSTOMER", "WAITING_ON_PROVIDER"] },
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
      status: { in: ["OPEN", "WAITING_ON_CUSTOMER", "WAITING_ON_PROVIDER"] },
      archivedAt: null,
    },
  });
}
