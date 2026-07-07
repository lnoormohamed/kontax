import "server-only";

import { headers } from "next/headers";

import { getClientIp } from "~/lib/client-ip";
import { db } from "~/server/db";
import type { Prisma } from "../../../generated/prisma";

// P21-02: canonical admin action keys. Strings (not a Prisma enum) so new actions
// can ship without a migration; the UI maps these to labels + tones.
export const ADMIN_ACTIONS = {
  USER_VIEWED: "user.view",
  USER_PLAN_OVERRIDE: "plan.override",
  USER_SUSPENDED: "account.suspend",
  USER_UNSUSPENDED: "account.unlock",
  USER_DELETION_SCHEDULED: "account.delete.schedule",
  SYNC_CAPABILITY_OVERRIDE_UPDATED: "sync.capability.override",
  IMPERSONATION_START: "impersonation.start",
  IMPERSONATION_END: "impersonation.end",
  FEATURE_FLAG_CHANGED: "flag.update",
  SUPPORT_CASE_CREATED: "support.case.create",
  SUPPORT_CASE_UPDATED: "support.case.update",
  PRODUCT_BROADCAST: "product.broadcast",
  PRODUCT_BROADCAST_RETRACTED: "product.broadcast.retract",
} as const;

export type AdminActionKey = (typeof ADMIN_ACTIONS)[keyof typeof ADMIN_ACTIONS];

const PAGE_SIZE = 50;
const EXPORT_LIMIT = 5000;

export type AdminAuditSeverity = "all" | "high" | "standard";

const HIGH_SEVERITY_ACTIONS = new Set<string>([
  ADMIN_ACTIONS.USER_SUSPENDED,
  ADMIN_ACTIONS.USER_DELETION_SCHEDULED,
  ADMIN_ACTIONS.IMPERSONATION_START,
  ADMIN_ACTIONS.SYNC_CAPABILITY_OVERRIDE_UPDATED,
  ADMIN_ACTIONS.FEATURE_FLAG_CHANGED,
  ADMIN_ACTIONS.SUPPORT_CASE_UPDATED,
  ADMIN_ACTIONS.PRODUCT_BROADCAST_RETRACTED,
]);

async function clientIp(): Promise<string | null> {
  try {
    return getClientIp(await headers());
  } catch {
    return null;
  }
}

/** Append-only write of one admin action. Never throws into the caller path. */
export async function emitAdminEvent(args: {
  adminId: string;
  action: string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  details?: Record<string, unknown>;
  actorContext?: {
    tier: string;
    policySource: string;
  };
}): Promise<void> {
  try {
    const details = {
      ...(args.details ?? {}),
      ...(args.actorContext
        ? {
            actorTier: args.actorContext.tier,
            actorPolicySource: args.actorContext.policySource,
          }
        : {}),
    };
    await db.adminAuditEvent.create({
      data: {
        adminUserId: args.adminId,
        action: args.action,
        targetUserId: args.targetUserId ?? null,
        targetEmail: args.targetEmail ?? null,
        details: details as Prisma.InputJsonValue,
        ipAddress: await clientIp(),
      },
    });
  } catch (err) {
    console.error("[admin-audit] failed to record event", args.action, err);
  }
}

export type AdminAuditRow = {
  id: string;
  createdAt: Date;
  adminId: string | null;
  adminName: string;
  action: string;
  targetEmail: string | null;
  targetUserId: string | null;
  ipAddress: string | null;
  severity: Exclude<AdminAuditSeverity, "all">;
  details: Record<string, unknown>;
};

export function adminAuditSeverityForAction(
  action: string,
): Exclude<AdminAuditSeverity, "all"> {
  return HIGH_SEVERITY_ACTIONS.has(action) ? "high" : "standard";
}

function serializeDetailValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function rowMatchesSearch(
  row: AdminAuditRow,
  search: string,
  entity: string,
): boolean {
  const haystacks = [
    row.adminName,
    row.action,
    row.targetEmail ?? "",
    row.targetUserId ?? "",
    row.ipAddress ?? "",
    ...Object.entries(row.details).flatMap(([key, value]) => [key, serializeDetailValue(value)]),
  ]
    .join(" \n ")
    .toLowerCase();

  const searchOk = !search || haystacks.includes(search);
  const entityOk = !entity || haystacks.includes(entity);
  return searchOk && entityOk;
}

async function loadAdminAuditBase(filters: {
  action?: string;
  actor?: string;
  target?: string;
  entity?: string;
  severity?: AdminAuditSeverity;
  q?: string;
  range?: string;
  page?: number;
  limit?: number;
}) {
  const rangeMs: Record<string, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };
  const since = filters.range && rangeMs[filters.range]
    ? new Date(Date.now() - rangeMs[filters.range]!)
    : null;
  const where = {
    ...(filters.action && filters.action !== "all" ? { action: filters.action } : {}),
    ...(filters.actor && filters.actor !== "all" ? { adminUserId: filters.actor } : {}),
    ...(filters.target?.trim()
      ? { targetEmail: { contains: filters.target.trim(), mode: "insensitive" as const } }
      : {}),
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  const [rowsRaw, actionsRaw, actorsRaw] = await Promise.all([
    db.adminAuditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? EXPORT_LIMIT,
      select: {
        id: true,
        adminUserId: true,
        createdAt: true,
        action: true,
        targetEmail: true,
        targetUserId: true,
        details: true,
        ipAddress: true,
        admin: { select: { name: true, email: true } },
      },
    }),
    db.adminAuditEvent.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    db.user.findMany({
      where: { role: "ADMIN" },
      orderBy: { email: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
      },
    }),
  ]);

  const severity = filters.severity ?? "all";
  const search = filters.q?.trim().toLowerCase() ?? "";
  const entity = filters.entity?.trim().toLowerCase() ?? "";

  const rows: AdminAuditRow[] = rowsRaw
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      adminId: r.adminUserId,
      adminName: r.admin?.name?.trim() ?? r.admin?.email ?? "system",
      action: r.action,
      targetEmail: r.targetEmail,
      targetUserId: r.targetUserId,
      ipAddress: r.ipAddress,
      severity: adminAuditSeverityForAction(r.action),
      details: (r.details ?? {}) as Record<string, unknown>,
    }))
    .filter((row) => (severity === "all" ? true : row.severity === severity))
    .filter((row) => rowMatchesSearch(row, search, entity));

  return {
    rows,
    actionTypes: actionsRaw.map((a) => a.action),
    actors: actorsRaw
      .map((actor) => ({
        id: actor.id,
        label: actor.name?.trim() ?? actor.email,
      }))
      .filter((actor): actor is { id: string; label: string } => !!actor.id),
  };
}

/** Paginated, filterable audit log (DB04 §6 + P34N-01). */
export async function loadAdminAudit(filters: {
  action?: string;
  actor?: string;
  target?: string;
  entity?: string;
  severity?: AdminAuditSeverity;
  q?: string;
  range?: string;
  page?: number;
}) {
  const page = Math.max(0, filters.page ?? 0);
  const base = await loadAdminAuditBase({ ...filters, limit: EXPORT_LIMIT });
  const start = page * PAGE_SIZE;

  return {
    rows: base.rows.slice(start, start + PAGE_SIZE),
    page,
    pageCount: Math.max(1, Math.ceil(base.rows.length / PAGE_SIZE)),
    total: base.rows.length,
    pageSize: PAGE_SIZE,
    actionTypes: base.actionTypes,
    actors: base.actors,
  };
}

export async function exportAdminAudit(filters: {
  action?: string;
  actor?: string;
  target?: string;
  entity?: string;
  severity?: AdminAuditSeverity;
  q?: string;
  range?: string;
}) {
  const base = await loadAdminAuditBase({ ...filters, limit: EXPORT_LIMIT });
  return base.rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    adminName: row.adminName,
    action: row.action,
    severity: row.severity,
    targetEmail: row.targetEmail ?? "",
    targetUserId: row.targetUserId ?? "",
    ipAddress: row.ipAddress ?? "",
    details: JSON.stringify(row.details),
  }));
}

export function buildAdminAuditHref(filters: {
  action?: string | null;
  actor?: string | null;
  target?: string | null;
  entity?: string | null;
  severity?: string | null;
  q?: string | null;
  range?: string | null;
}) {
  const params = new URLSearchParams();
  if (filters.action && filters.action !== "all") params.set("action", filters.action);
  if (filters.actor && filters.actor !== "all") params.set("actor", filters.actor);
  if (filters.target) params.set("target", filters.target);
  if (filters.entity) params.set("entity", filters.entity);
  if (filters.severity && filters.severity !== "all") params.set("severity", filters.severity);
  if (filters.q) params.set("q", filters.q);
  if (filters.range && filters.range !== "all") params.set("range", filters.range);
  const query = params.toString();
  return `/admin/audit${query ? `?${query}` : ""}`;
}

export async function loadFeatureFlagAuditHistory(key: string, limit = 8) {
  const rows = await loadAdminAuditBase({
    action: ADMIN_ACTIONS.FEATURE_FLAG_CHANGED,
    entity: key,
    limit: Math.min(100, limit * 3),
  });

  return rows.rows
    .filter((row) => row.details.flag === key)
    .slice(0, limit);
}

export async function loadSupportTimelineForUser(targetUserId: string, limit = 20) {
  const rows = await loadAdminAuditBase({
    limit: Math.min(200, limit * 3),
  });
  return rows.rows
    .filter((row) => row.targetUserId === targetUserId)
    .slice(0, limit);
}

export async function loadSupportTimelineForSyncAccount(syncAccountId: string, limit = 20) {
  const rows = await loadAdminAuditBase({
    entity: syncAccountId,
    limit: Math.min(200, limit * 3),
  });
  return rows.rows
    .filter((row) => row.details.syncAccountId === syncAccountId)
    .slice(0, limit);
}

export async function loadAuditSearchTargets(query: string, limit = 8) {
  const rows = await loadAdminAuditBase({ q: query, limit: 250 });
  return rows.rows.slice(0, limit).map((row) => ({
    id: row.id,
    label: row.targetEmail ?? row.action,
    action: row.action,
    href: buildAdminAuditHref({
      target: row.targetEmail ?? undefined,
      action: row.action,
    }),
  }));
}
