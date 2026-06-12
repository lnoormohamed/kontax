import "server-only";

import { db } from "~/server/db";

// Approximate per-seat monthly revenue used for the MRR stat. Display-only — the
// authoritative figure lives in Stripe; this is a directional admin signal.
const PLAN_MRR: Record<string, number> = { FREE: 0, PRO: 8, FAMILY: 14, TEAMS: 10 };
const PLAN_COLOR: Record<string, string> = {
  Free: "#8b938c",
  Pro: "#4158f4",
  Family: "#7e22ce",
  Teams: "#15803d",
};
const PLAN_LABEL: Record<string, string> = { FREE: "Free", PRO: "Pro", FAMILY: "Family", TEAMS: "Teams" };

function errRate(failed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((failed / total) * 1000) / 10;
}

export async function loadPlatformMetrics() {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersThisWeek,
    activeSessions,
    payingPlans,
    newPayingThisWeek,
    syncAccounts,
    importsLast30,
    importTotals,
    importFailed,
    syncTotals,
    syncFailed,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: weekAgo } } }),
    db.userSession.findMany({
      where: { revokedAt: null, lastActiveAt: { gte: sevenDaysAgo } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    db.subscription.groupBy({
      by: ["plan"],
      where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
      _count: { _all: true },
    }),
    db.subscription.count({
      where: { status: { in: ["ACTIVE", "TRIALING"] }, plan: { not: "FREE" }, createdAt: { gte: weekAgo } },
    }),
    db.syncAccount.count(),
    db.importJob.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.importJob.count({ where: { createdAt: { gte: dayAgo } } }),
    db.importJob.count({ where: { createdAt: { gte: dayAgo }, status: "FAILED" } }),
    db.syncJob.count({ where: { createdAt: { gte: dayAgo } } }),
    db.syncJob.count({ where: { createdAt: { gte: dayAgo }, status: "FAILED" } }),
  ]);

  // Plan breakdown — fold the grouped subscription counts; everyone without a
  // paid subscription counts as Free.
  const paidCounts: Record<string, number> = {};
  let payingUsers = 0;
  let mrr = 0;
  for (const row of payingPlans) {
    const count = row._count._all;
    paidCounts[row.plan] = (paidCounts[row.plan] ?? 0) + count;
    if (row.plan !== "FREE") {
      payingUsers += count;
      mrr += count * (PLAN_MRR[row.plan] ?? 0);
    }
  }
  const freeCount = Math.max(0, totalUsers - payingUsers - (paidCounts.FREE ?? 0)) + (paidCounts.FREE ?? 0);

  const plans = (["FREE", "PRO", "FAMILY", "TEAMS"] as const).map((p) => ({
    plan: PLAN_LABEL[p]!,
    count: p === "FREE" ? freeCount : paidCounts[p] ?? 0,
    color: PLAN_COLOR[PLAN_LABEL[p]!]!,
  }));

  const fmtNum = (n: number) => n.toLocaleString();

  const stats = [
    { value: fmtNum(totalUsers), label: "Total users", delta: `+${fmtNum(newUsersThisWeek)} this week`, up: true },
    { value: fmtNum(activeSessions.length), label: "Active (7-day)", delta: "rolling sessions", up: true },
    { value: fmtNum(payingUsers), label: "Paying users", delta: `+${fmtNum(newPayingThisWeek)} this week`, up: true },
    { value: `$${fmtNum(mrr)}`, label: "MRR (est.)", delta: "from active plans", up: true },
    { value: fmtNum(syncAccounts), label: "Sync accounts", delta: "connected", up: true },
    { value: fmtNum(importsLast30), label: "Imports (30d)", delta: "last 30 days", up: importsLast30 >= 0 },
  ];

  const errors = [
    { label: "Import processing", rate: errRate(importFailed, importTotals) },
    { label: "CardDAV sync jobs", rate: errRate(syncFailed, syncTotals) },
  ];

  const worst = Math.max(0, ...errors.map((e) => e.rate));

  return { stats, plans, errors, worst };
}
