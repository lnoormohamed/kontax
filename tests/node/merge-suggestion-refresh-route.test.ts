// P49A-09 — POST /api/merge-suggestions/refresh enqueues a background refresh
// and answers 202 + job id; refreshes for one user never overlap; the route is
// rate-limited (3/hour/user → 429). The real in-memory rate limiter is used
// (test:repo sets no REDIS_URL); auth and the DB-backed refresh are mocked.
import assert from "node:assert/strict";
import { mock, test } from "node:test";

class FakeSessionError extends Error {}
let currentUserId = "user-1";
let signedIn = true;

mock.module("~/server/auth/require-session", {
  namedExports: {
    requireUserId: async () => {
      if (!signedIn) throw new FakeSessionError("UNAUTHENTICATED");
      return currentUserId;
    },
    isSessionError: (error: unknown) => error instanceof FakeSessionError,
  },
});

// The refresh itself (DB reads + upserts) is faked with a controllable
// promise so the test can observe queued/running/succeeded states.
type Deferred = { resolve: (count: number) => void; reject: (error: Error) => void };
const inFlight: Deferred[] = [];
let running = 0;
let maxConcurrent = 0;
const refreshCalls: Array<{ userId: string; source: string }> = [];

mock.module("~/server/contact-merge", {
  namedExports: {
    refreshMergeSuggestionsForUser: (userId: string, source: string) => {
      refreshCalls.push({ userId, source });
      running += 1;
      maxConcurrent = Math.max(maxConcurrent, running);
      return new Promise<number>((resolve, reject) => {
        inFlight.push({
          resolve: (count) => {
            running -= 1;
            resolve(count);
          },
          reject: (error) => {
            running -= 1;
            reject(error);
          },
        });
      });
    },
  },
});

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

const post = async () => {
  const { POST } = await import("../../src/app/api/merge-suggestions/refresh/route");
  return POST();
};

const getStatus = async (jobId: string) => {
  const { GET } = await import("../../src/app/api/merge-suggestions/refresh/route");
  const response = await GET(
    new Request(`http://localhost/api/merge-suggestions/refresh?jobId=${encodeURIComponent(jobId)}`),
  );
  return (await response.json()) as { status: string; suggestionCount?: number | null };
};

test("POST returns 202 + job id at once; the refresh runs in the background", async () => {
  const response = await post();
  assert.equal(response.status, 202);
  const body = (await response.json()) as { jobId: string; status: string };
  assert.match(body.jobId, /^[0-9a-f-]{36}$/);
  assert.equal(body.status, "queued");
  // Nothing ran on the request path.
  assert.equal(refreshCalls.length, 0);

  await tick();
  assert.equal(refreshCalls.length, 1);
  assert.deepEqual(refreshCalls[0], { userId: "user-1", source: "manual-refresh" });
  assert.equal((await getStatus(body.jobId)).status, "running");

  // A second rescan while one runs is queued behind it, not run concurrently.
  const second = await post();
  assert.equal(second.status, 202);
  const secondBody = (await second.json()) as { jobId: string };
  assert.notEqual(secondBody.jobId, body.jobId);
  await tick();
  assert.equal(refreshCalls.length, 1, "at most one refresh in flight per user");
  assert.equal((await getStatus(secondBody.jobId)).status, "queued");

  inFlight.shift()!.resolve(7);
  await tick();
  await tick();
  const done = await getStatus(body.jobId);
  assert.equal(done.status, "succeeded");
  assert.equal(done.suggestionCount, 7);
  assert.equal(refreshCalls.length, 2);
  assert.equal(maxConcurrent, 1);

  inFlight.shift()!.resolve(3);
  await tick();
  assert.equal((await getStatus(secondBody.jobId)).status, "succeeded");
});

test("a third rescan within the hour is allowed, the fourth gets 429 + Retry-After", async () => {
  // Two points were spent by the previous test (same user, same process).
  const third = await post();
  assert.equal(third.status, 202);
  await tick();
  inFlight.shift()?.resolve(0);

  const fourth = await post();
  assert.equal(fourth.status, 429);
  const retryAfter = Number(fourth.headers.get("Retry-After"));
  assert.ok(retryAfter > 0 && retryAfter <= 3600, `Retry-After ${retryAfter}`);
  const body = (await fourth.json()) as { message: string };
  assert.match(body.message, /Try again/);

  // The limit is per user.
  currentUserId = "user-2";
  const otherUser = await post();
  assert.equal(otherUser.status, 202);
  await tick();
  inFlight.shift()?.resolve(0);
  currentUserId = "user-1";
});

test("job status is scoped to its owner", async () => {
  currentUserId = "user-3";
  const response = await post();
  const { jobId } = (await response.json()) as { jobId: string };
  await tick();

  currentUserId = "user-4";
  assert.equal((await getStatus(jobId)).status, "unknown");
  currentUserId = "user-3";
  assert.equal((await getStatus(jobId)).status, "running");

  const logged = mock.method(console, "error", () => undefined);
  inFlight.shift()!.reject(new Error("db down"));
  await tick();
  logged.mock.restore();
  assert.equal((await getStatus(jobId)).status, "failed");
  assert.equal(logged.mock.callCount(), 1, "a failed background refresh is logged");
  currentUserId = "user-1";
});

test("unauthenticated requests get 401 and enqueue nothing", async () => {
  signedIn = false;
  const before = refreshCalls.length;
  const response = await post();
  assert.equal(response.status, 401);
  await tick();
  assert.equal(refreshCalls.length, before);
  signedIn = true;
});

test("queue: same dedupe key joins the queued job; other users run in parallel", async () => {
  const { enqueueMergeSuggestionRefresh, waitForMergeSuggestionRefreshIdle } = await import(
    "../../src/server/merge-suggestion-refresh-queue"
  );
  const order: string[] = [];
  const gate: Array<() => void> = [];
  const task = (label: string) => () =>
    new Promise<number>((resolve) => {
      order.push(`start:${label}`);
      gate.push(() => {
        order.push(`end:${label}`);
        resolve(1);
      });
    });

  const first = enqueueMergeSuggestionRefresh("user-q", { dedupeKey: "import:1", run: task("a1") });
  const otherUser = enqueueMergeSuggestionRefresh("user-r", { dedupeKey: "import:1", run: task("b1") });
  await tick();
  const queued = enqueueMergeSuggestionRefresh("user-q", { dedupeKey: "import:2", run: task("a2") });
  const joined = enqueueMergeSuggestionRefresh("user-q", { dedupeKey: "import:2", run: task("a2-dup") });
  assert.equal(joined.id, queued.id, "same key while queued → same job");
  assert.notEqual(first.id, queued.id);
  assert.notEqual(otherUser.id, first.id);
  assert.deepEqual(order, ["start:a1", "start:b1"], "different users run concurrently");

  gate.shift()!(); // end a1 → a2 starts
  await tick();
  gate.shift()!(); // end b1
  await tick();
  gate.shift()!(); // end a2
  await waitForMergeSuggestionRefreshIdle("user-q");
  await waitForMergeSuggestionRefreshIdle("user-r");
  assert.deepEqual(order, ["start:a1", "start:b1", "end:a1", "start:a2", "end:b1", "end:a2"]);
});
