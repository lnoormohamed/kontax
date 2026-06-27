import "server-only";

import { ADMIN_ACTIONS } from "~/server/admin/audit";
import {
  adminSupportCaseSeverityLabel,
  adminSupportCaseStatusLabel,
} from "~/server/admin/support-cases";
import { listAdminSupportNotes, listUserSupportTimeline } from "~/server/admin/support-notes";
import { db } from "~/server/db";

type TimelineSource = "notes" | "cases" | "audit" | "sync";
type TimelineTone = "neutral" | "info" | "success" | "warning" | "danger";

export type InvestigationTimelineEntry = {
  id: string;
  source: TimelineSource;
  sourceLabel: string;
  title: string;
  body: string | null;
  actor: string | null;
  when: string;
  atLabel: string;
  href: string | null;
  tone: TimelineTone;
  createdAt: Date;
};

const SYNC_ACTIVITY_EVENTS = new Set([
  "SYNC_CONNECTION_CONNECTED",
  "SYNC_CONNECTION_RECONNECTED",
  "SYNC_CONNECTION_DISCONNECTED",
  "SYNC_CONNECTION_RETIRED",
  "SYNC_CONNECTION_REPLACED",
]);

const USER_TIMELINE_AUDIT_ACTIONS = [
  ADMIN_ACTIONS.SUPPORT_CASE_CREATED,
  ADMIN_ACTIONS.SUPPORT_CASE_UPDATED,
  ADMIN_ACTIONS.USER_PLAN_OVERRIDE,
  ADMIN_ACTIONS.USER_SUSPENDED,
  ADMIN_ACTIONS.USER_UNSUSPENDED,
  ADMIN_ACTIONS.USER_DELETION_SCHEDULED,
  ADMIN_ACTIONS.SYNC_CAPABILITY_OVERRIDE_UPDATED,
  ADMIN_ACTIONS.IMPERSONATION_START,
  ADMIN_ACTIONS.IMPERSONATION_END,
] as const;

const SYNC_TIMELINE_AUDIT_ACTIONS = [
  ADMIN_ACTIONS.SUPPORT_CASE_CREATED,
  ADMIN_ACTIONS.SUPPORT_CASE_UPDATED,
  ADMIN_ACTIONS.SYNC_CAPABILITY_OVERRIDE_UPDATED,
] as const;

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

const fmtAbsolute = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);

function actorLabel(actor: { name: string | null; email: string } | null | undefined) {
  return actor?.name?.trim() ?? actor?.email ?? null;
}

function supportSubjectHref(subjectType: string, subjectId: string, targetUserId: string | null = null) {
  if (subjectType === "SYNC_ACCOUNT") return `/admin/sync/${subjectId}`;
  if (targetUserId) return `/admin/users/${targetUserId}`;
  if (subjectType === "USER") return `/admin/users/${subjectId}`;
  return null;
}

function readString(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "string" ? value : null;
}

function timelineEntry(input: Omit<InvestigationTimelineEntry, "when" | "atLabel">) {
  return {
    ...input,
    when: fmtRelative(input.createdAt),
    atLabel: fmtAbsolute(input.createdAt),
  };
}

function mapSupportCaseAuditEvent(row: {
  id: string;
  createdAt: Date;
  action: string;
  details: Record<string, unknown>;
  admin: { name: string | null; email: string } | null;
}) {
  const details = row.details;
  const title = readString(details, "title");
  const supportCaseId = readString(details, "supportCaseId");
  const status = readString(details, "status");
  const severity = readString(details, "severity");
  const reason =
    row.action === ADMIN_ACTIONS.SUPPORT_CASE_CREATED
      ? title
      : status === "RESOLVED"
        ? "Marked resolved in the support queue."
        : status === "ARCHIVED"
          ? "Archived from the main operator queue."
          : details.assignedToSelf
            ? "Assigned to the acting admin."
            : details.clearedAssignment
              ? "Removed the current assignee."
              : [status ? `Status ${adminSupportCaseStatusLabel(status as never)}` : null, severity ? `Severity ${adminSupportCaseSeverityLabel(severity as never)}` : null]
                  .filter(Boolean)
                  .join(" · ");

  return timelineEntry({
    id: row.id,
    source: "cases",
    sourceLabel: "Support case",
    title:
      row.action === ADMIN_ACTIONS.SUPPORT_CASE_CREATED
        ? "Support case created"
        : status === "RESOLVED"
          ? "Support case resolved"
          : details.assignedToSelf
            ? "Support case assigned"
            : details.clearedAssignment
              ? "Support case unassigned"
              : "Support case updated",
    body: reason || title || null,
    actor: actorLabel(row.admin),
    href: supportCaseId ? `/admin/support?q=${encodeURIComponent(supportCaseId)}` : "/admin/support",
    tone: status === "RESOLVED" ? "success" : severity === "CRITICAL" ? "danger" : "info",
    createdAt: row.createdAt,
  });
}

function mapAdminAuditEvent(row: {
  id: string;
  createdAt: Date;
  action: string;
  details: Record<string, unknown>;
  admin: { name: string | null; email: string } | null;
  targetEmail: string | null;
}) {
  const details = row.details;
  const reason = readString(details, "reason");
  const nextOverride = readString(details, "nextOverride");

  switch (row.action) {
    case ADMIN_ACTIONS.USER_PLAN_OVERRIDE:
      return timelineEntry({
        id: row.id,
        source: "audit",
        sourceLabel: "Admin action",
        title: "Billing plan override updated",
        body: [readString(details, "to"), reason].filter(Boolean).join(" · ") || reason,
        actor: actorLabel(row.admin),
        href: "/admin/audit?action=plan.override",
        tone: "info",
        createdAt: row.createdAt,
      });
    case ADMIN_ACTIONS.USER_SUSPENDED:
      return timelineEntry({
        id: row.id,
        source: "audit",
        sourceLabel: "Admin action",
        title: "Account suspended",
        body: reason,
        actor: actorLabel(row.admin),
        href: "/admin/audit?view=destructive-actions",
        tone: "danger",
        createdAt: row.createdAt,
      });
    case ADMIN_ACTIONS.USER_UNSUSPENDED:
      return timelineEntry({
        id: row.id,
        source: "audit",
        sourceLabel: "Admin action",
        title: "Account unsuspended",
        body: reason,
        actor: actorLabel(row.admin),
        href: "/admin/audit?view=destructive-actions",
        tone: "success",
        createdAt: row.createdAt,
      });
    case ADMIN_ACTIONS.USER_DELETION_SCHEDULED:
      return timelineEntry({
        id: row.id,
        source: "audit",
        sourceLabel: "Admin action",
        title: "Account deletion scheduled",
        body: reason,
        actor: actorLabel(row.admin),
        href: "/admin/audit?view=destructive-actions",
        tone: "danger",
        createdAt: row.createdAt,
      });
    case ADMIN_ACTIONS.SYNC_CAPABILITY_OVERRIDE_UPDATED:
      return timelineEntry({
        id: row.id,
        source: "audit",
        sourceLabel: "Admin action",
        title: "Sync capability override changed",
        body: [readString(details, "label") ?? row.targetEmail, nextOverride ? `Override ${nextOverride}` : "Returned to auto-detect", reason]
          .filter(Boolean)
          .join(" · "),
        actor: actorLabel(row.admin),
        href: readString(details, "syncAccountId")
          ? `/admin/sync/${readString(details, "syncAccountId")}`
          : "/admin/audit",
        tone: "warning",
        createdAt: row.createdAt,
      });
    case ADMIN_ACTIONS.IMPERSONATION_START:
      return timelineEntry({
        id: row.id,
        source: "audit",
        sourceLabel: "Admin action",
        title: "Admin impersonation started",
        body: reason,
        actor: actorLabel(row.admin),
        href: "/admin/audit?view=destructive-actions",
        tone: "warning",
        createdAt: row.createdAt,
      });
    case ADMIN_ACTIONS.IMPERSONATION_END:
      return timelineEntry({
        id: row.id,
        source: "audit",
        sourceLabel: "Admin action",
        title: "Admin impersonation ended",
        body: null,
        actor: actorLabel(row.admin),
        href: "/admin/audit?view=destructive-actions",
        tone: "neutral",
        createdAt: row.createdAt,
      });
    default:
      return null;
  }
}

function mapSupportNoteEntry(row: {
  id: string;
  subjectType: string;
  subjectId: string;
  body: string;
  createdAt: Date;
  author: string;
  targetUserId?: string | null;
}) {
  return timelineEntry({
    id: row.id,
    source: "notes",
    sourceLabel: "Support note",
    title: "Support note added",
    body: row.body,
    actor: row.author,
    href: supportSubjectHref(row.subjectType, row.subjectId, row.targetUserId ?? null),
    tone: "neutral",
    createdAt: row.createdAt,
  });
}

function mapSyncJobEntry(row: {
  id: string;
  status: string;
  errorCode: string | null;
  errorSummary: string | null;
  completedAt: Date | null;
  startedAt: Date | null;
  createdAt: Date;
  syncAccount: { id: string; label: string; provider: string };
}) {
  const createdAt = row.completedAt ?? row.startedAt ?? row.createdAt;
  return timelineEntry({
    id: row.id,
    source: "sync",
    sourceLabel: "Sync activity",
    title:
      row.status === "FAILED"
        ? "Sync failed"
        : row.status === "PARTIAL"
          ? "Sync partially recovered"
          : "Sync recovered",
    body:
      row.status === "FAILED"
        ? [row.syncAccount.label, row.errorSummary ?? row.errorCode ?? "No error summary captured."].filter(Boolean).join(" · ")
        : `${row.syncAccount.label} · ${row.syncAccount.provider} sync completed ${row.status === "PARTIAL" ? "with partial changes" : "successfully"}.`,
    actor: null,
    href: `/admin/sync/${row.syncAccount.id}`,
    tone: row.status === "FAILED" ? "danger" : row.status === "PARTIAL" ? "warning" : "success",
    createdAt,
  });
}

function mapSyncConflictEntry(row: {
  id: string;
  conflictType: string;
  status: string;
  resolutionStrategy: string | null;
  detectedAt: Date;
  contact: { id: string | null; fullName: string | null };
  syncAccount: { id: string; label: string };
}) {
  return timelineEntry({
    id: row.id,
    source: "sync",
    sourceLabel: "Sync activity",
    title: "Sync conflict detected",
    body: [
      row.syncAccount.label,
      row.contact.fullName ?? "Unknown contact",
      row.conflictType,
      row.resolutionStrategy ? `Resolution ${row.resolutionStrategy}` : `Status ${row.status.toLowerCase()}`,
    ]
      .filter(Boolean)
      .join(" · "),
    actor: null,
    href: `/admin/sync/${row.syncAccount.id}`,
    tone: row.status === "OPEN" ? "warning" : "neutral",
    createdAt: row.detectedAt,
  });
}

function mapSyncActivityEvent(row: {
  id: string;
  eventType: string;
  createdAt: Date;
  payload: Record<string, unknown> | null;
  syncAccountId?: string | null;
}) {
  const payload = row.payload ?? {};
  const label =
    typeof payload.label === "string"
      ? payload.label
      : typeof payload.connectionLabel === "string"
        ? payload.connectionLabel
        : typeof payload.connectionId === "string"
          ? payload.connectionId
          : null;
  const syncAccountId =
    row.syncAccountId ??
    (typeof payload.syncAccountId === "string" ? payload.syncAccountId : null);

  const title =
    row.eventType === "SYNC_CONNECTION_RECONNECTED"
      ? "Connection reconnected"
      : row.eventType === "SYNC_CONNECTION_DISCONNECTED"
        ? "Connection disconnected"
        : row.eventType === "SYNC_CONNECTION_RETIRED"
          ? "Connection retired"
          : row.eventType === "SYNC_CONNECTION_REPLACED"
            ? "Connection replaced"
            : "Connection connected";

  return timelineEntry({
    id: row.id,
    source: "sync",
    sourceLabel: "Sync activity",
    title,
    body: label ? `Connection ${label}` : null,
    actor: null,
    href: syncAccountId ? `/admin/sync/${syncAccountId}` : null,
    tone:
      row.eventType === "SYNC_CONNECTION_DISCONNECTED" || row.eventType === "SYNC_CONNECTION_RETIRED"
        ? "warning"
        : row.eventType === "SYNC_CONNECTION_REPLACED" || row.eventType === "SYNC_CONNECTION_RECONNECTED"
          ? "info"
          : "success",
    createdAt: row.createdAt,
  });
}

function sortAndTrim(entries: InvestigationTimelineEntry[], limit: number) {
  return entries
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function loadUserInvestigationTimeline(userId: string, limit = 28) {
  const [notes, auditRows, syncJobs, syncConflicts, syncActivity] = await Promise.all([
    listUserSupportTimeline(userId, 16),
    db.adminAuditEvent.findMany({
      where: {
        targetUserId: userId,
        action: { in: [...USER_TIMELINE_AUDIT_ACTIONS] },
      },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: {
        id: true,
        createdAt: true,
        action: true,
        targetEmail: true,
        details: true,
        admin: { select: { name: true, email: true } },
      },
    }),
    db.syncJob.findMany({
      where: {
        syncAccount: { userId },
        status: { in: ["FAILED", "SUCCEEDED", "PARTIAL"] },
      },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: {
        id: true,
        status: true,
        errorCode: true,
        errorSummary: true,
        completedAt: true,
        startedAt: true,
        createdAt: true,
        syncAccount: { select: { id: true, label: true, provider: true } },
      },
    }),
    db.syncConflict.findMany({
      where: { syncAccount: { userId } },
      orderBy: { detectedAt: "desc" },
      take: 10,
      select: {
        id: true,
        conflictType: true,
        status: true,
        resolutionStrategy: true,
        detectedAt: true,
        contact: { select: { id: true, fullName: true } },
        syncAccount: { select: { id: true, label: true } },
      },
    }),
    db.activityEvent.findMany({
      where: {
        userId,
        eventType: { in: [...SYNC_ACTIVITY_EVENTS] as never[] },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        eventType: true,
        createdAt: true,
        payload: true,
      },
    }),
  ]);

  const entries = [
    ...notes.map((note) =>
      mapSupportNoteEntry({
        id: note.id,
        subjectType: note.subjectType,
        subjectId: note.subjectId,
        body: note.body,
        createdAt: note.createdAt,
        author: note.author,
      }),
    ),
    ...auditRows
      .map((row) => {
        const details = (row.details ?? {}) as Record<string, unknown>;
        if (
          row.action === ADMIN_ACTIONS.SUPPORT_CASE_CREATED ||
          row.action === ADMIN_ACTIONS.SUPPORT_CASE_UPDATED
        ) {
          return mapSupportCaseAuditEvent({
            ...row,
            details,
          });
        }
        return mapAdminAuditEvent({
          ...row,
          details,
        });
      })
      .filter((row): row is InvestigationTimelineEntry => !!row),
    ...syncJobs.map(mapSyncJobEntry),
    ...syncConflicts
      .filter((row) => !!row.syncAccount)
      .map((row) =>
        mapSyncConflictEntry({
          ...row,
          syncAccount: row.syncAccount!,
          contact: { id: row.contact?.id ?? null, fullName: row.contact?.fullName ?? null },
        }),
      ),
    ...syncActivity.map((row) =>
      mapSyncActivityEvent({
        id: row.id,
        eventType: row.eventType,
        createdAt: row.createdAt,
        payload: (row.payload ?? {}) as Record<string, unknown>,
      }),
    ),
  ];

  return sortAndTrim(entries, limit);
}

export async function loadSyncAccountInvestigationTimeline(input: {
  syncAccountId: string;
  userId: string;
  label: string;
  disconnectedAt: Date | null;
  retiredAt: Date | null;
  replaces?: { id: string; label: string; retiredAt: Date | null } | null;
  replacedBy?: { id: string; label: string; createdAt: Date | null } | null;
  limit?: number;
}) {
  const [notes, auditRows, syncJobs, syncConflicts] = await Promise.all([
    listAdminSupportNotes({
      subjectType: "SYNC_ACCOUNT",
      subjectId: input.syncAccountId,
      limit: 12,
    }),
    db.adminAuditEvent.findMany({
      where: {
        targetUserId: input.userId,
        action: { in: [...SYNC_TIMELINE_AUDIT_ACTIONS] },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        createdAt: true,
        action: true,
        targetEmail: true,
        details: true,
        admin: { select: { name: true, email: true } },
      },
    }),
    db.syncJob.findMany({
      where: {
        syncAccountId: input.syncAccountId,
        status: { in: ["FAILED", "SUCCEEDED", "PARTIAL"] },
      },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: {
        id: true,
        status: true,
        errorCode: true,
        errorSummary: true,
        completedAt: true,
        startedAt: true,
        createdAt: true,
        syncAccount: { select: { id: true, label: true, provider: true } },
      },
    }),
    db.syncConflict.findMany({
      where: { syncAccountId: input.syncAccountId },
      orderBy: { detectedAt: "desc" },
      take: 12,
      select: {
        id: true,
        conflictType: true,
        status: true,
        resolutionStrategy: true,
        detectedAt: true,
        contact: { select: { id: true, fullName: true } },
        syncAccount: { select: { id: true, label: true } },
      },
    }),
  ]);

  const mappedAuditRows = auditRows
    .map((row) => {
      const details = (row.details ?? {}) as Record<string, unknown>;
      const subjectId = readString(details, "subjectId");
      const syncAccountId = readString(details, "syncAccountId");
      if (
        row.action === ADMIN_ACTIONS.SUPPORT_CASE_CREATED ||
        row.action === ADMIN_ACTIONS.SUPPORT_CASE_UPDATED
      ) {
        return subjectId === input.syncAccountId &&
          readString(details, "subjectType") === "SYNC_ACCOUNT"
          ? mapSupportCaseAuditEvent({ ...row, details })
          : null;
      }
      return syncAccountId === input.syncAccountId
        ? mapAdminAuditEvent({ ...row, details })
        : null;
    })
    .filter((row): row is InvestigationTimelineEntry => !!row);

  const lifecycleEntries: InvestigationTimelineEntry[] = [
    ...(input.disconnectedAt
      ? [
          timelineEntry({
            id: `sync-disconnected-${input.syncAccountId}`,
            source: "sync",
            sourceLabel: "Sync activity",
            title: "Connection disconnected",
            body: `${input.label} was marked disconnected from the provider.`,
            actor: null,
            href: `/admin/sync/${input.syncAccountId}`,
            tone: "warning",
            createdAt: input.disconnectedAt,
          }),
        ]
      : []),
    ...(input.retiredAt
      ? [
          timelineEntry({
            id: `sync-retired-${input.syncAccountId}`,
            source: "sync",
            sourceLabel: "Sync activity",
            title: "Connection retired",
            body: `${input.label} left the active fleet and became a lineage record.`,
            actor: null,
            href: `/admin/sync/${input.syncAccountId}`,
            tone: "warning",
            createdAt: input.retiredAt,
          }),
        ]
      : []),
    ...(input.replacedBy?.createdAt
      ? [
          timelineEntry({
            id: `sync-replacedby-${input.replacedBy.id}`,
            source: "sync",
            sourceLabel: "Sync activity",
            title: "Connection replaced",
            body: `Replacement connection ${input.replacedBy.label} took over this lineage.`,
            actor: null,
            href: `/admin/sync/${input.replacedBy.id}`,
            tone: "info",
            createdAt: input.replacedBy.createdAt,
          }),
        ]
      : []),
    ...(input.replaces?.retiredAt
      ? [
          timelineEntry({
            id: `sync-replaces-${input.replaces.id}`,
            source: "sync",
            sourceLabel: "Sync activity",
            title: "Connected as replacement",
            body: `This connection replaced ${input.replaces.label}.`,
            actor: null,
            href: `/admin/sync/${input.replaces.id}`,
            tone: "info",
            createdAt: input.replaces.retiredAt,
          }),
        ]
      : []),
  ];

  const entries = [
    ...notes.map((note) =>
      mapSupportNoteEntry({
        id: note.id,
        subjectType: "SYNC_ACCOUNT",
        subjectId: input.syncAccountId,
        body: note.body,
        createdAt: note.createdAt,
        author: note.author,
        targetUserId: input.userId,
      }),
    ),
    ...mappedAuditRows,
    ...syncJobs.map(mapSyncJobEntry),
    ...syncConflicts
      .filter((row) => !!row.syncAccount)
      .map((row) =>
        mapSyncConflictEntry({
          ...row,
          syncAccount: row.syncAccount!,
          contact: { id: row.contact?.id ?? null, fullName: row.contact?.fullName ?? null },
        }),
      ),
    ...lifecycleEntries,
  ];

  return sortAndTrim(entries, input.limit ?? 28);
}
