import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { matchWhere } from "./_fake-prisma";

/**
 * P49A-19 item 9 (owner decision 2026-09-26): the Free plan's
 * `monthlyImportLimit: 3` means 3 import RUNS a month from the Import & export
 * page (CSV commits and Kontax archive imports), not 3 contacts. The 500
 * contact cap still applies separately and still creates only what fits.
 *
 * Drives the real CSV preview/commit route handlers and `commitKontaxImport`
 * against an in-memory Prisma stand-in with the transaction semantics that
 * matter here: writes inside a transaction (contacts AND import-job updates)
 * are only visible to others once it commits (discarded on throw), and the
 * `SELECT … FOR UPDATE` User-row lock blocks a second transaction until the
 * first ends — so the concurrent cases are real. `where` filters are matched
 * with `_fake-prisma.ts`'s `matchWhere`, so the real counting query runs.
 */

type Row = Record<string, unknown>;

const USER = "user_1";
const DAY = 24 * 60 * 60 * 1000;

const state = {
  plan: "FREE" as "FREE" | "PRO",
  baseContacts: 0,
  contacts: [] as Row[],
  jobs: new Map<string, Row>(),
  locks: 0,
};
let jobSeq = 0;
const heldLocks = new Map<string, Promise<void>>();

// Prisma `data` with `{ increment: n }` support (used by the Kontax chunk path).
const applyData = (row: Row, data: Row): Row => {
  const next: Row = { ...row, updatedAt: new Date() };
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value && typeof value === "object" && "increment" in (value as Row)) {
      next[key] = Number(row[key] ?? 0) + Number((value as { increment: number }).increment);
    } else {
      next[key] = value;
    }
  }
  return next;
};

type Tx = { contacts: Row[]; jobs: Map<string, Row>; releasers: Array<() => void> };

function makeClient(tx: Tx | null) {
  const jobsView = () => {
    const view = new Map(state.jobs);
    for (const [id, row] of tx?.jobs ?? []) view.set(id, row);
    return [...view.values()];
  };
  const writeJob = (row: Row) => (tx ? tx.jobs : state.jobs).set(row.id as string, row);
  const contactsFor = (userId: string) =>
    [...state.contacts, ...(tx?.contacts ?? [])].filter((c) => c.userId === userId);
  const insertContact = (data: Row) => {
    const row = { id: `c_${state.contacts.length + (tx?.contacts.length ?? 0) + 1}`, ...data };
    (tx ? tx.contacts : state.contacts).push(row);
    return row;
  };

  const client: Record<string, unknown> = {
    user: {
      findUnique: async ({ select }: { select?: Row }) => {
        if (select && "autoFillPhoneticNames" in select) return { autoFillPhoneticNames: false };
        return {
          lifecycleState: "ACTIVE",
          subscriptions: state.plan === "PRO" ? [{ plan: "PRO", memberSlotsLimit: null }] : [],
          groupMemberships: [],
        };
      },
    },
    contact: {
      count: async ({ where }: { where: { userId: string } }) =>
        state.baseContacts + contactsFor(where.userId).length,
      create: async ({ data }: { data: Row }) => insertContact(data),
      createMany: async ({ data }: { data: Row[] }) => {
        for (const row of data) insertContact(row);
        return { count: data.length };
      },
      findMany: async ({ where }: { where: Row }) =>
        contactsFor(where.userId as string)
          .filter((c) => c.importJobId === where.importJobId)
          .map((c) => ({ id: c.id })),
    },
    importJob: {
      count: async ({ where }: { where: Row }) => jobsView().filter((r) => matchWhere(r, where)).length,
      findFirst: async ({ where }: { where: Row }) => jobsView().find((r) => matchWhere(r, where)) ?? null,
      create: async ({ data }: { data: Row }) => {
        const now = new Date();
        const row: Row = {
          id: `job_${++jobSeq}`,
          status: "PENDING",
          importedCount: 0,
          committedAt: null,
          previewedAt: null,
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        writeJob(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = jobsView().find((r) => r.id === where.id);
        if (!row) throw new Error(`importJob ${where.id} not found`);
        const next = applyData(row, data);
        writeJob(next);
        return next;
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const rows = jobsView().filter((r) => matchWhere(r, where));
        for (const row of rows) writeJob(applyData(row, data));
        return { count: rows.length };
      },
    },
    importMappingPreset: { findUnique: async () => null },
    syncAccount: { count: async () => 0 },
    appPassword: { count: async () => 0 },
    activityEvent: { createMany: async () => ({ count: 0 }) },
    contactBookMembership: { createMany: async () => ({ count: 0 }) },
    addressBook: { findMany: async () => [] },
    label: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
    $queryRaw: async (_strings: TemplateStringsArray, userId: string) => {
      if (!tx) throw new Error("lock outside a transaction");
      state.locks += 1;
      while (heldLocks.has(userId)) await heldLocks.get(userId);
      let release!: () => void;
      heldLocks.set(userId, new Promise<void>((resolve) => (release = resolve)));
      tx.releasers.push(() => {
        heldLocks.delete(userId);
        release();
      });
      return [];
    },
  };
  client.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => {
    const inner: Tx = { contacts: [], jobs: new Map(), releasers: [] };
    try {
      const result = await fn(makeClient(inner));
      // commit
      state.contacts.push(...inner.contacts);
      for (const [id, row] of inner.jobs) state.jobs.set(id, row);
      return result;
    } finally {
      for (const release of inner.releasers) release();
    }
  };
  return client;
}

mock.module("~/server/db", { namedExports: { db: makeClient(null) } });
mock.module("~/server/auth/require-session", {
  namedExports: {
    requireUserId: async () => USER,
    requireSession: async () => ({ user: { id: USER } }),
    isSessionError: () => false,
    sessionErrorMessage: () => "",
    SessionError: class SessionError extends Error {},
  },
});
mock.module("next/cache", {
  namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined },
});

const { POST: csvPreview } = await import("../../src/app/api/imports/contacts/preview/route");
const { POST: csvCommit } = await import("../../src/app/api/imports/contacts/commit/route");
const { commitKontaxImport, KontaxImportError } = await import("~/server/export-format/import");
const { getImportCapacity, getUserPlanSummary, importLimitMessage, formatImportResetDate } =
  await import("~/server/billing");

beforeEach(() => {
  state.plan = "FREE";
  state.baseContacts = 0;
  state.contacts = [];
  state.jobs = new Map();
  state.locks = 0;
  heldLocks.clear();
});

// ─── fixtures ────────────────────────────────────────────────────────────────

const monthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

/** A past import run: `importedCount` contacts landed at `committedAt`. */
const seedJob = (fields: Row) => {
  const id = `seed_${++jobSeq}`;
  const at = (fields.committedAt as Date | null | undefined) ?? new Date();
  state.jobs.set(id, {
    id,
    userId: USER,
    status: "COMPLETED",
    importedCount: 5,
    createdAt: at,
    committedAt: at,
    previewedAt: null,
    ...fields,
  });
  return id;
};
const seedImportsThisMonth = (n: number) => {
  for (let i = 0; i < n; i++) seedJob({});
};

const csvOf = (rows: number, prefix = "P") =>
  "First Name,Last Name\n" +
  Array.from({ length: rows }, (_, i) => `${prefix}${i + 1},Tester${prefix}${i + 1}`).join("\n") +
  "\n";

const commitRequest = (csvText: string, jobId?: string) =>
  new Request("https://kontax.test/api/imports/contacts/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csvText, profile: "GENERIC", sourceFileName: "people.csv", jobId }),
  });
const previewRequest = (csvText: string) =>
  new Request("https://kontax.test/api/imports/contacts/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csvText, profile: "GENERIC", sourceFileName: "people.csv" }),
  });

const commit = async (csvText: string, jobId?: string) => {
  const res = await csvCommit(commitRequest(csvText, jobId));
  return { status: res.status, body: (await res.json()) as Row };
};

const importsUsed = async () => (await getUserPlanSummary(USER)).importsThisMonth;

const LIMIT_MESSAGE =
  /^You've used your 3 imports this month on the Free plan\. Upgrade for unlimited imports, or wait until \d{1,2} [A-Z][a-z]+\.$/;

const card = (fullName: string) => ({
  fullName,
  firstName: fullName,
  middleName: null,
  lastName: null,
  phoneticFirstName: null,
  phoneticLastName: null,
  namePrefix: null,
  nameSuffix: null,
  nickname: null,
  company: null,
  phoneticCompany: null,
  department: null,
  jobTitle: null,
  emailEntries: [],
  phoneEntries: [],
  websiteEntries: [],
  addressEntries: [],
  significantDates: [],
  relatedPeople: [],
  customFields: [],
  labels: [],
  labelRegistry: [],
  books: [],
  notes: null,
  isFavorite: false,
  isEmergency: false,
  birthday: null,
  photo: null,
});
const cards = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => card(`${prefix} ${i + 1}`));

// ─── counting ────────────────────────────────────────────────────────────────

for (const used of [0, 1, 2]) {
  test(`Free with ${used} import(s) used this month can import a 400-row CSV`, async () => {
    seedImportsThisMonth(used);
    const { status, body } = await commit(csvOf(400));
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.importedCount, 400, "all 400 fit under the 500 contact cap");
    assert.equal(body.capSkippedCount, 0);
    assert.equal(state.contacts.length, 400);
    assert.equal(await importsUsed(), used + 1, "the run counts once, not 400 times");
  });
}

test("the 4th import in a month is refused with the monthly-imports message; nothing is created", async () => {
  // Three real runs through the route, so the route's own bookkeeping is what's counted.
  for (const prefix of ["A", "B", "C"]) {
    const { status } = await commit(csvOf(10, prefix));
    assert.equal(status, 200);
  }
  assert.equal(await importsUsed(), 3);

  const { status, body } = await commit(csvOf(1, "D"));
  assert.equal(status, 400);
  assert.match(String(body.message), LIMIT_MESSAGE);
  assert.ok(String(body.message).endsWith(`wait until ${formatImportResetDate()}.`));
  assert.equal(state.contacts.length, 30);
  assert.equal(await importsUsed(), 3, "a refused run doesn't count");
});

test("a run cut short by the contact cap counts as one import (P49A-06 partial import kept)", async () => {
  seedImportsThisMonth(2);
  state.baseContacts = 450;
  const { status, body } = await commit(csvOf(400));
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.importedCount, 50, "only what fits under 500 is created");
  assert.equal(body.capSkippedCount, 350);
  assert.match(String(body.limitMessage), /Free plan limit reached/);
  assert.equal(await importsUsed(), 3);

  state.baseContacts = 0;
  const fourth = await commit(csvOf(1, "Z"));
  assert.equal(fourth.status, 400);
  assert.match(String(fourth.body.message), LIMIT_MESSAGE);
});

test("imports from last month don't count; a preview from last month committed now counts now", async () => {
  const lastMonth = new Date(monthStart().getTime() - DAY);
  for (let i = 0; i < 3; i++) seedJob({ committedAt: lastMonth, createdAt: lastMonth });
  // Legacy row with no committedAt falls back to createdAt.
  seedJob({ committedAt: null, createdAt: lastMonth });
  assert.equal(await importsUsed(), 0);

  const previewJob = seedJob({
    status: "PENDING",
    importedCount: 0,
    committedAt: null,
    createdAt: lastMonth,
    previewedAt: lastMonth,
  });
  const { status } = await commit(csvOf(5), previewJob);
  assert.equal(status, 200);
  assert.equal(await importsUsed(), 1, "counted in the month it was committed");
});

test("failed, empty and abandoned (preview-only) jobs don't count", async () => {
  for (let i = 0; i < 3; i++) seedJob({ status: "FAILED", importedCount: 0 });
  for (let i = 0; i < 3; i++) seedJob({ status: "PENDING", importedCount: 0, committedAt: null });
  seedJob({ status: "COMPLETED", importedCount: 0 }); // ran, created nothing
  assert.equal(await importsUsed(), 0);

  // A commit that fails (nothing importable) doesn't consume a run either.
  const empty = await commit("First Name,Last Name\n");
  assert.equal(empty.status, 400);
  assert.equal(await importsUsed(), 0);

  const { status } = await commit(csvOf(5));
  assert.equal(status, 200);
  assert.equal(await importsUsed(), 1);
});

test("previewing a file doesn't consume an import", async () => {
  seedImportsThisMonth(2);
  for (let i = 0; i < 4; i++) {
    const res = await csvPreview(previewRequest(csvOf(20)));
    assert.equal(res.status, 200);
  }
  assert.equal(await importsUsed(), 2);
  const { status } = await commit(csvOf(20));
  assert.equal(status, 200, "the third import is still available after four previews");
});

// ─── races and retries ───────────────────────────────────────────────────────

test("two concurrent CSV commits at 2 used → exactly one succeeds", async () => {
  seedImportsThisMonth(2);
  const [a, b] = await Promise.all([commit(csvOf(100, "A")), commit(csvOf(100, "B"))]);
  assert.deepEqual([a.status, b.status].sort(), [200, 400]);
  const refused = a.status === 400 ? a : b;
  assert.match(String(refused.body.message), LIMIT_MESSAGE);
  assert.equal(state.contacts.length, 100, "only one run's contacts landed");
  assert.equal(await importsUsed(), 3);
  assert.ok(state.locks >= 2, "both checks ran under the User-row lock");
});

test("retrying a committed preview job is refused (409) — no duplicate contacts, counted once", async () => {
  const preview = await csvPreview(previewRequest(csvOf(10)));
  const { jobId } = (await preview.json()) as { jobId: string };

  const first = await commit(csvOf(10), jobId);
  assert.equal(first.status, 200);
  const retry = await commit(csvOf(10), jobId);
  assert.equal(retry.status, 409);
  assert.equal(state.contacts.length, 10);
  assert.equal(await importsUsed(), 1);
  assert.equal(state.jobs.get(jobId)!.status, "COMPLETED", "the retry didn't touch the finished job");
});

test("a double-submitted commit of one preview job imports once", async () => {
  const preview = await csvPreview(previewRequest(csvOf(10)));
  const { jobId } = (await preview.json()) as { jobId: string };
  const [a, b] = await Promise.all([commit(csvOf(10), jobId), commit(csvOf(10), jobId)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(state.contacts.length, 10);
  assert.equal(await importsUsed(), 1);
});

test("a preview job whose commit failed can be retried and then counts once", async () => {
  seedImportsThisMonth(3);
  const preview = await csvPreview(previewRequest(csvOf(5)));
  const { jobId } = (await preview.json()) as { jobId: string };
  const refused = await commit(csvOf(5), jobId);
  assert.equal(refused.status, 400);
  assert.equal(state.jobs.get(jobId)!.status, "FAILED");

  state.jobs.forEach((row, id) => {
    if (id.startsWith("seed_")) state.jobs.set(id, { ...row, committedAt: new Date(0), createdAt: new Date(0) });
  }); // new month
  const retried = await commit(csvOf(5), jobId);
  assert.equal(retried.status, 200);
  assert.equal(await importsUsed(), 1);
});

// ─── Kontax archive import ───────────────────────────────────────────────────

test("Kontax archive: 3 used → refused with the monthly-imports message, nothing created", async () => {
  seedImportsThisMonth(3);
  await assert.rejects(
    commitKontaxImport(USER, cards(3, "K"), "kontax-archive"),
    (error: unknown) => error instanceof KontaxImportError && LIMIT_MESSAGE.test(error.message),
  );
  assert.equal(state.contacts.length, 0);
  assert.equal(await importsUsed(), 3);
});

test("Kontax archive: a multi-chunk import counts as one run", async () => {
  const result = await commitKontaxImport(USER, cards(250, "K"), "kontax-archive");
  assert.equal(result.importedCount, 250);
  assert.equal(await importsUsed(), 1);
  assert.equal(state.jobs.get(result.jobId)!.importedCount, 250);
});

test("Kontax archive: two concurrent imports at 2 used → exactly one lands", async () => {
  seedImportsThisMonth(2);
  const results = await Promise.allSettled([
    commitKontaxImport(USER, cards(20, "A"), "kontax-archive"),
    commitKontaxImport(USER, cards(20, "B"), "kontax-archive"),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), ["fulfilled", "rejected"]);
  const rejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected")!;
  assert.match(String((rejected.reason as Error).message), LIMIT_MESSAGE);
  assert.equal(state.contacts.length, 20);
  assert.equal(await importsUsed(), 3);
});

test("CSV and Kontax runs share the same monthly allowance", async () => {
  await commit(csvOf(5, "A"));
  await commitKontaxImport(USER, cards(5, "K"), "kontax-archive");
  await commit(csvOf(5, "B"));
  assert.equal(await importsUsed(), 3);
  await assert.rejects(
    commitKontaxImport(USER, cards(1, "L"), "kontax-archive"),
    (error: unknown) => error instanceof Error && LIMIT_MESSAGE.test(error.message),
  );
});

// ─── paid plans ──────────────────────────────────────────────────────────────

test("paid plans have unlimited imports", async () => {
  state.plan = "PRO";
  seedImportsThisMonth(12);
  const { status, body } = await commit(csvOf(400));
  assert.equal(status, 200, JSON.stringify(body));
  await commitKontaxImport(USER, cards(5, "K"), "kontax-archive");
  const capacity = await getImportCapacity(USER, 1_000);
  assert.equal(capacity.toCreate, 1_000);
  assert.equal(await importsUsed(), 14);
});

// ─── message ─────────────────────────────────────────────────────────────────

test("limit message names the 1st of next month (UTC), in UK English", () => {
  assert.equal(
    importLimitMessage("Free", 3, new Date("2026-09-26T12:00:00Z")),
    "You've used your 3 imports this month on the Free plan. Upgrade for unlimited imports, or wait until 1 October.",
  );
  assert.match(importLimitMessage("Free", 3, new Date("2026-12-31T23:59:00Z")), /wait until 1 January\.$/);
});
