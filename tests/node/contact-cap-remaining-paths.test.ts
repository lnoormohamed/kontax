import assert from "node:assert/strict";
import path from "node:path";
import { beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

/**
 * P49A-06 (Fable review) — the contact cap on the create paths the first pass
 * missed: REST API POST, CSV/vCard import commit, Kontax archive import, and
 * sync-conflict DUPLICATE_LOCAL. Each checks inside the inserting transaction
 * with the owner's User row locked; imports create only what fits and report
 * the rest as skipped.
 *
 * Drives the real route handlers / server functions against a programmable
 * Prisma stub with real transaction semantics that matter here: rows created
 * inside a transaction are only visible to others once it commits (discarded
 * on throw), and `SELECT … FOR UPDATE` on a User row blocks a second
 * transaction until the first finishes — so the concurrent case is real.
 */

type Row = Record<string, unknown>;

const state = {
  /** Committed contact counts per owner (pre-existing rows). */
  baseCounts: new Map<string, number>(),
  /** Committed rows created by the code under test. */
  created: [] as Row[],
  locks: [] as string[],
  writes: [] as string[],
  importJobs: new Map<string, Row>(),
  conflict: null as Row | null,
};

// Per-user row locks held until the owning transaction ends.
const heldLocks = new Map<string, Promise<void>>();

function makeClient(pending: Row[] | null, releasers: Array<() => void>) {
  const visibleCount = (userId: string) =>
    (state.baseCounts.get(userId) ?? 0) +
    state.created.filter((r) => r.userId === userId).length +
    (pending ?? []).filter((r) => r.userId === userId).length;
  const insert = (data: Row) => {
    const now = new Date();
    const row = {
      id: `c_${state.created.length + (pending?.length ?? 0) + 1}`,
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    (pending ?? state.created).push(row);
    return row;
  };

  const client: Record<string, unknown> = {
    user: {
      findUnique: async ({ select }: { select?: Row }) => {
        if (select && "password" in select) return { password: "hash" };
        if (select && "autoFillPhoneticNames" in select) return { autoFillPhoneticNames: false };
        return { lifecycleState: "ACTIVE", subscriptions: [], groupMemberships: [] }; // Free
      },
    },
    contact: {
      count: async ({ where }: { where: { userId: string } }) => visibleCount(where.userId),
      create: async ({ data }: { data: Row }) => {
        state.writes.push("contact.create");
        return insert(data);
      },
      createMany: async ({ data }: { data: Row[] }) => {
        for (const row of data) insert(row);
        return { count: data.length };
      },
      findMany: async ({ where }: { where: Row }) =>
        state.created.filter((r) => r.importJobId === where.importJobId).map((r) => ({ id: r.id })),
      update: async () => {
        state.writes.push("contact.update");
        return {};
      },
    },
    importJob: {
      aggregate: async () => ({ _sum: { importedCount: 0 } }),
      findFirst: async () => null,
      create: async ({ data }: { data: Row }) => {
        const job = { id: `job_${state.importJobs.size + 1}`, previewedAt: null, ...data };
        state.importJobs.set(job.id, job);
        return job;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const job = { ...state.importJobs.get(where.id), ...data };
        state.importJobs.set(where.id, job);
        return job;
      },
    },
    syncAccount: { count: async () => 0 },
    appPassword: { count: async () => 0 },
    activityEvent: { create: async () => ({}), createMany: async () => ({ count: 0 }) },
    contactBookMembership: {
      upsert: async () => ({}),
      updateMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 0 }),
    },
    addressBook: { findMany: async () => [] },
    label: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
    syncConflict: {
      findFirst: async () => state.conflict,
      update: async () => {
        state.writes.push("syncConflict.update");
        return {};
      },
    },
    syncContactLink: {
      update: async () => {
        state.writes.push("syncContactLink.update");
        return {};
      },
    },
    $queryRaw: async (_strings: TemplateStringsArray, userId: string) => {
      state.locks.push(userId);
      if (!pending) throw new Error("lock outside a transaction");
      while (heldLocks.has(userId)) await heldLocks.get(userId);
      let release!: () => void;
      heldLocks.set(userId, new Promise<void>((resolve) => (release = resolve)));
      releasers.push(() => {
        heldLocks.delete(userId);
        release();
      });
      return [];
    },
  };
  client.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => {
    const txPending: Row[] = [];
    const txReleasers: Array<() => void> = [];
    try {
      const result = await fn(makeClient(txPending, txReleasers));
      state.created.push(...txPending); // commit
      return result;
    } finally {
      for (const release of txReleasers) release();
    }
  };
  return client;
}

const db = makeClient(null, []);
mock.module("~/server/db", { namedExports: { db } });

mock.module("~/server/auth/require-session", {
  namedExports: {
    requireUserId: async () => "user_1",
    requireSession: async () => ({ user: { id: "user_1" } }),
    isSessionError: () => false,
    sessionErrorMessage: () => "",
    SessionError: class SessionError extends Error {},
  },
});
mock.module("next/cache", {
  namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined },
});

// The REST API's auth wrapper (token → user, plan/API gate, rate limit) is not
// under test: API access is Pro/Teams-only today, so it hands the handler the
// user directly and the cap check below runs against a Free account.
const apiAuthUrl = pathToFileURL(path.join(process.cwd(), "src/app/api/v1/_lib/auth.ts")).href;
mock.module(apiAuthUrl, {
  namedExports: {
    withApiAuth: async (_req: unknown, handler: (userId: string, scope: string) => Promise<Response>) =>
      handler("user_1", "READ_WRITE"),
    requireWriteScope: () => null,
    resolveOwnedBookId: async () => ({ bookId: "book_1" }),
  },
});

const { POST: apiPost } = await import("../../src/app/api/v1/contacts/route");
const { POST: csvCommit } = await import("../../src/app/api/imports/contacts/commit/route");
const { commitKontaxImport } = await import("~/server/export-format/import");
const { resolveSyncConflict } = await import("~/app/actions/sync");

beforeEach(() => {
  state.baseCounts = new Map([["user_1", 0]]);
  state.created = [];
  state.locks = [];
  state.writes = [];
  state.importJobs = new Map();
  state.conflict = null;
  heldLocks.clear();
});

const apiRequest = (body: Row) =>
  new Request("https://kontax.test/api/v1/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer ktx_live_test" },
    body: JSON.stringify(body),
  }) as never;

// ─── REST API POST ────────────────────────────────────────────────────────────

test("API POST: a Free account at the cap is refused (403 LIMIT_REACHED) inside the locked transaction", async () => {
  state.baseCounts.set("user_1", 500);
  const res = await apiPost(apiRequest({ fullName: "Over Cap" }));
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: string; message: string };
  assert.equal(body.error, "LIMIT_REACHED");
  assert.match(body.message, /Free plan limit reached\. You can store up to 500 contacts/);
  assert.deepEqual(state.locks, ["user_1"], "the owner's User row was locked for the check");
  assert.equal(state.created.length, 0);

  state.baseCounts.set("user_1", 499);
  const ok = await apiPost(apiRequest({ fullName: "Contact 500" }));
  assert.equal(ok.status, 201, "contact #500 is still allowed");
});

test("API POST: two concurrent creates at 499 → exactly one lands (the lock serialises them)", async () => {
  state.baseCounts.set("user_1", 499);
  const [a, b] = await Promise.all([
    apiPost(apiRequest({ fullName: "Racer A" })),
    apiPost(apiRequest({ fullName: "Racer B" })),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 403]);
  assert.equal(state.created.length, 1);
});

// ─── CSV / vCard import commit ────────────────────────────────────────────────

const csvRequest = (csvText: string) =>
  new Request("https://kontax.test/api/imports/contacts/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csvText, profile: "GENERIC", sourceFileName: "people.csv" }),
  });

test("CSV import at 499/500: creates the one that fits, reports the rest as skipped, never fails", async () => {
  state.baseCounts.set("user_1", 499);
  const csv = "First Name,Last Name,Email\nAda,Lovelace,ada@example.invalid\nGrace,Hopper,grace@example.invalid\n";

  const res = await csvCommit(csvRequest(csv));
  const body = (await res.json()) as Row;

  assert.equal(res.status, 200, JSON.stringify(body));
  assert.equal(body.importedCount, 1);
  assert.equal(body.capSkippedCount, 1);
  assert.equal(body.skippedCount, 1);
  assert.match(String(body.limitMessage), /Free plan limit reached/);
  assert.equal(state.created.length, 1);
  assert.equal(state.created[0]!.firstName, "Ada", "the first rows that fit are created");
  const job = [...state.importJobs.values()][0]!;
  assert.equal(job.status, "COMPLETED");
  assert.equal(job.importedCount, 1);
  assert.match(String(job.errorSummary), /1 contact not imported: Free plan limit reached/);
  assert.ok(state.locks.includes("user_1"), "checked under the User-row lock");
});

test("CSV import with no room at all is refused with the plan-limit message", async () => {
  state.baseCounts.set("user_1", 500);
  const res = await csvCommit(csvRequest("First Name,Last Name\nAda,Lovelace\n"));
  assert.equal(res.status, 400);
  assert.match(((await res.json()) as { message: string }).message, /Free plan limit reached/);
  assert.equal(state.created.length, 0);
});

// ─── Kontax archive import ────────────────────────────────────────────────────

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

test("Kontax import at 498/500: creates 2 of 5, reports 3 skipped at the cap, job completes", async () => {
  state.baseCounts.set("user_1", 498);
  const result = await commitKontaxImport(
    "user_1",
    ["A", "B", "C", "D", "E"].map(card),
    "kontax-archive",
    { skippedCount: 1 },
  );

  assert.equal(result.importedCount, 2);
  assert.equal(result.capSkippedCount, 3);
  assert.equal(result.skippedCount, 4, "parse skips + cap skips");
  assert.match(String(result.limitMessage), /Free plan limit reached/);
  assert.deepEqual(state.created.map((c) => c.fullName), ["A", "B"]);
  assert.equal(state.importJobs.get(result.jobId)!.status, "COMPLETED");
  assert.ok(state.locks.includes("user_1"));
});

// ─── Sync conflict DUPLICATE_LOCAL ────────────────────────────────────────────

test("DUPLICATE_LOCAL at the cap is refused before any write; the conflict stays open", async () => {
  state.baseCounts.set("user_1", 500);
  state.conflict = {
    id: "conf_1",
    syncAccountId: "sa_1",
    syncContactLinkId: "link_1",
    contactId: "contact_1",
    remoteETag: "etag",
    localSnapshot: {},
    remoteSnapshot: {},
    syncAccount: {
      id: "sa_1",
      provider: "GENERIC_CARDDAV",
      baseUrl: "https://dav.example.invalid",
      label: "Dav",
      addressBookUrl: null,
      credentialReference: null,
      settings: null,
    },
    syncContactLink: { id: "link_1", remoteUid: "uid" },
    contact: { id: "contact_1", fullName: "Local Copy", firstName: "Local" },
  };
  const form = new FormData();
  form.set("syncConflictId", "conf_1");
  form.set("resolutionStrategy", "DUPLICATE_LOCAL");

  await assert.rejects(() => resolveSyncConflict(form), /Free plan limit reached/);
  assert.deepEqual(state.writes, [], "no contact created, no link/conflict update");
  assert.deepEqual(state.locks, ["user_1"]);
});
