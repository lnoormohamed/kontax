import "server-only";

import { headers } from "next/headers";

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
  IMPERSONATION_START: "impersonation.start",
  IMPERSONATION_END: "impersonation.end",
  FEATURE_FLAG_CHANGED: "flag.update",
} as const;

export type AdminActionKey = (typeof ADMIN_ACTIONS)[keyof typeof ADMIN_ACTIONS];

const PAGE_SIZE = 50;

async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null
    );
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
}): Promise<void> {
  try {
    await db.adminAuditEvent.create({
      data: {
        adminUserId: args.adminId,
        action: args.action,
        targetUserId: args.targetUserId ?? null,
        targetEmail: args.targetEmail ?? null,
        details: (args.details ?? {}) as Prisma.InputJsonValue,
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
  adminName: string;
  action: string;
  targetEmail: string | null;
  details: Record<string, unknown>;
};

/** Paginated, filterable audit log (DB04 §6). 50 rows/page, newest first. */
export async function loadAdminAudit(filters: {
  action?: string;
  target?: string;
  range?: string;
  page?: number;
}) {
  const page = Math.max(0, filters.page ?? 0);
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
    ...(filters.target?.trim()
      ? { targetEmail: { contains: filters.target.trim(), mode: "insensitive" as const } }
      : {}),
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  const [total, rowsRaw, actionsRaw] = await Promise.all([
    db.adminAuditEvent.count({ where }),
    db.adminAuditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        action: true,
        targetEmail: true,
        details: true,
        admin: { select: { name: true, email: true } },
      },
    }),
    db.adminAuditEvent.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);

  const rows: AdminAuditRow[] = rowsRaw.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    adminName: r.admin?.name?.trim() ?? r.admin?.email ?? "system",
    action: r.action,
    targetEmail: r.targetEmail,
    details: (r.details ?? {}) as Record<string, unknown>,
  }));

  return {
    rows,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
    pageSize: PAGE_SIZE,
    actionTypes: actionsRaw.map((a) => a.action),
  };
}
