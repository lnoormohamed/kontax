import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { Prisma } from "../../generated/prisma";
import {
  getProcessLifecycle,
  PROCESS_LIFECYCLE_KEY,
} from "../../src/server/process-lifecycle";
import {
  createSyncLeaseKeeper,
  decideScheduledRun,
  expiredSyncLeaseWhere,
  isSyncLeaseExpired,
  leaseExpiredFailureData,
  recordOpenSyncConflict,
  SYNC_JOB_IN_FLIGHT_PREFIX,
  SYNC_LEASE_EXPIRED_CODE,
} from "../../src/server/sync-job-lifecycle";
import { staleDataExportWhere } from "../../src/server/data-export/jobs";
import { stalledKontaxExportWhere } from "../../src/server/export-format/jobs";

// P49A-04: sync-job and export lifecycle — lease reclaim, the scheduled-retry
// gate, graceful-shutdown hooks and one-OPEN-conflict-per-link. The db-facing
// code is thin glue over these helpers; the scenarios below replay what the
// runner does against an in-memory model of the rows.

type JobRow = {
  id: string;
  syncAccountId: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "SKIPPED" | "HALTED";
  leaseExpiresAt: Date | null;
  nextRetryAt: Date | null;
  attemptCount: number;
  maxAttempts: number;
  errorCode: string | null;
  createdAt: Date;
};

// Minimal evaluator for the where shapes the helpers emit
// ({ field: value } equality and { field: { lt: Date } }).
const matchesWhere = (row: Record<string, unknown>, where: Record<string, unknown>) =>
  Object.entries(where).every(([field, cond]) => {
    const value = row[field];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date) && "lt" in cond) {
      return value instanceof Date && value.getTime() < (cond as { lt: Date }).lt.getTime();
    }
    return value === cond;
  });

const MIN = 60_000;
const t0 = new Date("2026-09-25T12:00:00.000Z");
const at = (offsetMs: number) => new Date(t0.getTime() + offsetMs);

const job = (overrides: Partial<JobRow>): JobRow => ({
  id: "job-1",
  syncAccountId: "acct-1",
  status: "RUNNING",
  leaseExpiresAt: at(10 * MIN),
  nextRetryAt: null,
  attemptCount: 1,
  maxAttempts: 5,
  errorCode: null,
  createdAt: t0,
  ...overrides,
});

test("expiredSyncLeaseWhere and isSyncLeaseExpired agree", () => {
  const now = at(15 * MIN);
  const cases: JobRow[] = [
    job({ status: "RUNNING", leaseExpiresAt: at(10 * MIN) }), // lapsed
    job({ status: "RUNNING", leaseExpiresAt: at(20 * MIN) }), // live
    job({ status: "RUNNING", leaseExpiresAt: now }), // exactly now → not yet
    job({ status: "QUEUED", leaseExpiresAt: at(1 * MIN) }),
    job({ status: "SUCCEEDED", leaseExpiresAt: null }),
  ];
  const where = expiredSyncLeaseWhere(now);
  for (const row of cases) {
    assert.equal(matchesWhere(row, where), isSyncLeaseExpired(row, now), JSON.stringify(row));
  }
  assert.deepEqual(
    cases.map((row) => isSyncLeaseExpired(row, now)),
    [true, false, false, false, false],
  );
});

test("a RUNNING job with an expired lease is reclaimed and the account is enqueued next tick", () => {
  // Worker claimed at t0 with a 10-minute lease, then the container was
  // SIGKILLed. Nothing renews the lease.
  const rows: JobRow[] = [job({ id: "orphan", status: "RUNNING", leaseExpiresAt: at(10 * MIN) })];

  // Before this ticket: enqueueDueSyncJobs skips any account with a RUNNING
  // job — the account is blocked forever.
  const hasPending = () =>
    rows.some((row) => row.status === "QUEUED" || row.status === "RUNNING");
  assert.equal(hasPending(), true);

  // Next cron tick, 15 minutes later: the drain starts with the reclaim.
  const tick = at(15 * MIN);
  const where = expiredSyncLeaseWhere(tick);
  const data = leaseExpiredFailureData(tick);
  for (const row of rows) {
    if (matchesWhere(row, where)) Object.assign(row, data);
  }

  const orphan = rows[0]!;
  assert.equal(orphan.status, "FAILED");
  assert.equal(orphan.errorCode, SYNC_LEASE_EXPIRED_CODE);
  assert.equal(orphan.leaseExpiresAt, null);
  assert.equal(orphan.nextRetryAt?.getTime(), tick.getTime());

  // The account no longer has a pending job, and the retry gate lets the
  // scheduler enqueue it immediately as the next attempt.
  assert.equal(hasPending(), false);
  assert.deepEqual(decideScheduledRun(orphan, tick), { action: "enqueue", attemptCount: 2 });
});

test("a live lease is not reclaimed", () => {
  const live = job({ status: "RUNNING", leaseExpiresAt: at(12 * MIN) });
  assert.equal(matchesWhere(live, expiredSyncLeaseWhere(at(11 * MIN))), false);
});

test("decideScheduledRun honours nextRetryAt", () => {
  const now = at(0);
  assert.deepEqual(decideScheduledRun(null, now), { action: "enqueue", attemptCount: 1 });
  assert.deepEqual(
    decideScheduledRun(job({ status: "SUCCEEDED", attemptCount: 3 }), now),
    { action: "enqueue", attemptCount: 1 },
  );
  assert.deepEqual(
    decideScheduledRun(job({ status: "PARTIAL", attemptCount: 2 }), now),
    { action: "enqueue", attemptCount: 1 },
  );

  const backingOff = job({ status: "FAILED", attemptCount: 2, nextRetryAt: at(15 * MIN) });
  assert.deepEqual(decideScheduledRun(backingOff, now), { action: "defer", until: at(15 * MIN) });
  assert.deepEqual(decideScheduledRun(backingOff, at(15 * MIN)), {
    action: "enqueue",
    attemptCount: 3,
  });

  // Never beyond the job's own budget.
  assert.deepEqual(
    decideScheduledRun(job({ status: "FAILED", attemptCount: 5, nextRetryAt: now }), now),
    { action: "enqueue", attemptCount: 5 },
  );

  // Budget spent (markJobFailed leaves nextRetryAt null): back to the normal
  // cadence with a fresh counter; auto-pause is the streak rule's job.
  assert.deepEqual(
    decideScheduledRun(job({ status: "FAILED", attemptCount: 5, nextRetryAt: null }), now),
    { action: "enqueue", attemptCount: 1 },
  );
});

// ── Conflicts ───────────────────────────────────────────────────────────────

type ConflictRow = {
  id: string;
  syncContactLinkId: string;
  status: "OPEN" | "RESOLVED" | "AUTO_RESOLVED" | "DISMISSED";
  conflictType: string;
  remoteETag: string | null;
  localSnapshot: unknown;
  remoteSnapshot: unknown;
  detectedAt: Date;
};

const createConflictStore = () => {
  const rows: ConflictRow[] = [];
  let seq = 0;
  const tx = {
    syncConflict: {
      findFirst: async ({ where }: { where: { syncContactLinkId: string; status: string } }) => {
        const found = rows
          .filter((r) => r.syncContactLinkId === where.syncContactLinkId && r.status === where.status)
          .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())[0];
        return found ? { id: found.id, localSnapshot: found.localSnapshot } : null;
      },
      create: async ({ data }: { data: Omit<ConflictRow, "id" | "detectedAt"> }) => {
        seq += 1;
        const row: ConflictRow = { ...data, id: `c${seq}`, detectedAt: new Date(t0.getTime() + seq) };
        rows.push(row);
        return { id: row.id };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<ConflictRow> }) => {
        const row = rows.find((r) => r.id === where.id);
        assert.ok(row, "update target exists");
        Object.assign(row, data);
        return row;
      },
    },
  };
  return { rows, tx: tx as unknown as Prisma.TransactionClient };
};

const deleteConflictInput = (run: number) => ({
  syncAccountId: "acct-1",
  syncContactLinkId: "link-1",
  contactId: "contact-1",
  conflictType: "DELETE_CONFLICT" as const,
  localSyncVersion: 3,
  remoteETag: null,
  localSnapshot: { fullName: "Ada Lovelace", run },
  remoteSnapshot: { deleted: true, remoteUid: "uid-1" },
  resolutionNotes: "Remote contact appears missing while the local contact is still active.",
});

test("three runs against a remotely-deleted contact yield exactly one OPEN conflict", async () => {
  const { rows, tx } = createConflictStore();

  const outcomes = [];
  for (const run of [1, 2, 3]) {
    outcomes.push((await recordOpenSyncConflict(tx, deleteConflictInput(run))).outcome);
  }

  assert.deepEqual(outcomes, ["created", "refreshed", "refreshed"]);
  const open = rows.filter((r) => r.status === "OPEN");
  assert.equal(open.length, 1);
  // Refreshed with the latest run's snapshot.
  assert.deepEqual(open[0]!.localSnapshot, { fullName: "Ada Lovelace", run: 3 });
});

test("a resolved conflict does not block a new one on the same link", async () => {
  const { rows, tx } = createConflictStore();
  await recordOpenSyncConflict(tx, deleteConflictInput(1));
  rows[0]!.status = "RESOLVED";

  const again = await recordOpenSyncConflict(tx, deleteConflictInput(2));
  assert.equal(again.outcome, "created");
  assert.equal(rows.filter((r) => r.status === "OPEN").length, 1);
  assert.equal(rows.length, 2);
});

test("an OPEN photo conflict on the link is kept, not overwritten", async () => {
  const { rows, tx } = createConflictStore();
  rows.push({
    id: "photo",
    syncContactLinkId: "link-1",
    status: "OPEN",
    conflictType: "LOCAL_REMOTE_MUTATION",
    remoteETag: null,
    localSnapshot: { fullName: "Ada", __photoConflict: true },
    remoteSnapshot: { __photo: {} },
    detectedAt: t0,
  });

  const result = await recordOpenSyncConflict(tx, deleteConflictInput(1));
  assert.deepEqual(result, { outcome: "kept", id: "photo" });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0]!.localSnapshot, { fullName: "Ada", __photoConflict: true });
});

// ── Lease keeper / graceful shutdown ────────────────────────────────────────

const inFlightLabels = () => [...getProcessLifecycle().inFlight.values()];

test("lease keeper holds claimed jobs as in-flight work and renews their lease", async () => {
  const renewals: string[][] = [];
  const keeper = createSyncLeaseKeeper({
    renew: async (ids) => {
      renewals.push(ids);
    },
    intervalMs: 5,
  });

  const seen: string[] = [];
  for (const id of keeper.iterate(["a", "b"])) {
    keeper.hold(id);
    assert.deepEqual(inFlightLabels(), [`${SYNC_JOB_IN_FLIGHT_PREFIX}${id}`]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    seen.push(id);
  }

  assert.deepEqual(seen, ["a", "b"]);
  assert.deepEqual(keeper.held(), []);
  assert.deepEqual(inFlightLabels(), []);
  assert.ok(renewals.some((ids) => ids.includes("a")), "a's lease renewed while held");
  assert.ok(renewals.some((ids) => ids.includes("b")), "b's lease renewed while held");
});

test("lease keeper releases the hold when the loop body throws", () => {
  const keeper = createSyncLeaseKeeper({ renew: async () => undefined, intervalMs: 5 });
  assert.throws(() => {
    for (const id of keeper.iterate(["a", "b"])) {
      keeper.hold(id);
      throw new Error("boom");
    }
  }, /boom/);
  assert.deepEqual(keeper.held(), []);
  assert.deepEqual(inFlightLabels(), []);
});

test("lease keeper stops claiming once the process is shutting down", () => {
  const lifecycle = getProcessLifecycle();
  const keeper = createSyncLeaseKeeper({ renew: async () => undefined, intervalMs: 5 });
  const seen: string[] = [];
  try {
    for (const id of keeper.iterate(["a", "b", "c"])) {
      keeper.hold(id);
      seen.push(id);
      if (id === "a") lifecycle.shuttingDown = true;
    }
  } finally {
    lifecycle.shuttingDown = false;
  }
  assert.deepEqual(seen, ["a"]);
  assert.deepEqual(inFlightLabels(), []);
});

test("server.mjs reads the same process-lifecycle key and in-flight label", () => {
  const source = readFileSync(new URL("../../server.mjs", import.meta.url), "utf8");
  assert.ok(source.includes(`Symbol.for("${PROCESS_LIFECYCLE_KEY}")`));
  assert.ok(source.includes(`"${SYNC_JOB_IN_FLIGHT_PREFIX}"`));
});

// ── Exports ─────────────────────────────────────────────────────────────────

test("stale export predicates only target PROCESSING rows past the timeout", () => {
  const now = at(60 * MIN);
  const data = staleDataExportWhere(now);
  assert.equal(data.status, "PROCESSING");
  assert.equal((data.OR[0]!.startedAt as { lt: Date }).lt.getTime(), at(30 * MIN).getTime());
  assert.deepEqual(data.OR[1], { startedAt: null });

  const archive = stalledKontaxExportWhere(now);
  assert.equal(archive.status, "PROCESSING");
  assert.equal(archive.updatedAt.lt.getTime(), at(30 * MIN).getTime());
  assert.equal(matchesWhere({ status: "PROCESSING", updatedAt: at(29 * MIN) }, archive), true);
  assert.equal(matchesWhere({ status: "PROCESSING", updatedAt: at(31 * MIN) }, archive), false);
  assert.equal(matchesWhere({ status: "COMPLETED", updatedAt: at(0) }, archive), false);
});
