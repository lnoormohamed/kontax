/**
 * P11-05 — Activity log retention prune job.
 *
 * Deletes ActivityEvent rows older than each user's plan retention window. The
 * window comes from the plan's `activityLogRetentionDays` (the frozen P11-01
 * matrix): Free = 0 (skipped — kept for the query-time last-10 history), Pro =
 * 90, Family = 365, Teams = null (unlimited — skipped).
 *
 * Retention bounds BOTH the global feed and per-contact history (one set of
 * rows backs both). Free is never physically pruned; Teams is never pruned.
 *
 * Runs per-user (not one bulk delete) so a single account can be skipped without
 * affecting others, and re-running is safe (idempotent — only deletes rows that
 * are now outside the window). The per-run summary is written to stdout for the
 * scheduler's logs (see note: a dedicated SYSTEM ActivityEvent is intentionally
 * not written — there is no suitable EventType enum value and such a marker
 * would itself be subject to pruning).
 *
 * Run nightly via an external scheduler (Coolify scheduled task / cron):
 *   node scripts/prune-activity-retention.mjs
 * Dry run (report only, no deletes):
 *   node scripts/prune-activity-retention.mjs --dry-run
 */
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

// Personal-activity retention per plan, in days. 0 and null are never pruned.
const RETENTION_DAYS_BY_PLAN = {
  FREE: 0, // keep all rows; global feed gated, per-contact history capped at query time
  PRO: 90,
  FAMILY: 365,
  TEAMS: null, // unlimited
};

const ACTIVE_SUB_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE"];

const log = (...args) => console.log(`[prune-activity ${new Date().toISOString()}]`, ...args);

try {
  log(DRY_RUN ? "DRY RUN — no rows will be deleted." : "Starting retention prune.");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      subscriptions: {
        where: { status: { in: ACTIVE_SUB_STATUSES } },
        orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { plan: true },
      },
    },
  });

  let usersPruned = 0;
  let totalDeleted = 0;
  let usersSkipped = 0;

  for (const user of users) {
    const plan = user.subscriptions[0]?.plan ?? "FREE";
    const retentionDays = RETENTION_DAYS_BY_PLAN[plan] ?? null;

    // Free (0) and unlimited (null) tiers are never physically pruned.
    if (retentionDays === null || retentionDays <= 0) {
      usersSkipped += 1;
      continue;
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const where = { userId: user.id, createdAt: { lt: cutoff } };

    if (DRY_RUN) {
      const count = await prisma.activityEvent.count({ where });
      if (count > 0) {
        usersPruned += 1;
        totalDeleted += count;
        log(`user ${user.id} (${plan}, ${retentionDays}d): would delete ${count} events`);
      }
      continue;
    }

    const { count } = await prisma.activityEvent.deleteMany({ where });
    if (count > 0) {
      usersPruned += 1;
      totalDeleted += count;
      log(`user ${user.id} (${plan}, ${retentionDays}d): deleted ${count} events`);
    }
  }

  log(
    `Done. users=${users.length} pruned=${usersPruned} skipped=${usersSkipped} ` +
      `events${DRY_RUN ? "_would_delete" : "_deleted"}=${totalDeleted}`,
  );
} catch (error) {
  console.error("[prune-activity] FAILED:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
