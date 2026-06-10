/**
 * P11-05 — Activity log retention prune job.
 *
 * Deletes ActivityEvent rows older than each user's plan retention window —
 * EXCEPT it always keeps the most recent N events per contact (the floor), so
 * recent history is never lost even past the window. Windows + floor come from
 * the frozen P11-01 matrix:
 *   Free   — no time window; keep only the last 10 per contact (count-based
 *            prune), and the History tab shows just the last 3 (display cap)
 *   Pro    — 365 days, floor 20 per contact
 *   Family — 90 days,  floor 20 per contact
 *   Teams  — unlimited → skipped (never pruned)
 *
 * Retention bounds BOTH the global feed and per-contact history (one set of rows
 * backs both). Contact-less events (deleted contacts) get the window with no
 * floor. Runs per-user (not one bulk delete); re-running is safe (idempotent).
 * The run summary is written to stdout for the scheduler's logs (a dedicated
 * SYSTEM ActivityEvent is intentionally not written — there is no suitable
 * EventType enum value and such a marker would itself be pruned).
 *
 * Run nightly via an external scheduler (Coolify scheduled task / cron):
 *   node scripts/prune-activity-retention.mjs
 * Dry run (report only, no deletes):
 *   node scripts/prune-activity-retention.mjs --dry-run
 */
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

// Per-plan retention window (days) + per-contact floor. Kept in sync with
// PLAN_DEFAULTS in src/server/billing.ts. days 0/null = never pruned.
const PLAN_RETENTION = {
  FREE: { days: 0, floor: 10 },
  PRO: { days: 365, floor: 20 },
  FAMILY: { days: 90, floor: 20 },
  TEAMS: { days: null, floor: 20 },
};

const ACTIVE_SUB_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE"];

const log = (...args) => console.log(`[prune-activity ${new Date().toISOString()}]`, ...args);

// Delete events older than `cutoff`, keeping the `floor` most recent per contact.
// Contact-less events (contactId IS NULL) get the window with no floor.
const PRUNE_SQL = `
  DELETE FROM "ActivityEvent" ae
  WHERE ae."userId" = $1
    AND ae."createdAt" < $2
    AND (
      ae."contactId" IS NULL
      OR ae.id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY "contactId" ORDER BY "createdAt" DESC
          ) AS rn
          FROM "ActivityEvent"
          WHERE "userId" = $1 AND "contactId" IS NOT NULL
        ) ranked
        WHERE ranked.rn <= $3
      )
    )
`;

// Same predicate as a COUNT, for --dry-run.
const COUNT_SQL = PRUNE_SQL.replace('DELETE FROM "ActivityEvent" ae', 'SELECT COUNT(*)::int AS n FROM "ActivityEvent" ae');

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
    const { days, floor } = PLAN_RETENTION[plan] ?? PLAN_RETENTION.FREE;

    // Teams (unlimited / null) is never pruned.
    if (days === null) {
      usersSkipped += 1;
      continue;
    }

    // Free (days === 0): no time window — the floor alone caps storage (keep the
    // last `floor` per contact). Using cutoff = now means every event is "older
    // than the window", so only the per-contact floor survives. Paid tiers use a
    // real time window.
    const cutoff = days === 0 ? new Date() : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    if (DRY_RUN) {
      const rows = await prisma.$queryRawUnsafe(COUNT_SQL, user.id, cutoff, floor);
      const count = Number(rows?.[0]?.n ?? 0);
      if (count > 0) {
        usersPruned += 1;
        totalDeleted += count;
        log(`user ${user.id} (${plan}, ${days}d, floor ${floor}): would delete ${count} events`);
      }
      continue;
    }

    const count = await prisma.$executeRawUnsafe(PRUNE_SQL, user.id, cutoff, floor);
    if (count > 0) {
      usersPruned += 1;
      totalDeleted += count;
      log(`user ${user.id} (${plan}, ${days}d, floor ${floor}): deleted ${count} events`);
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
