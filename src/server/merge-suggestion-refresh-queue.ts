// P49A-09 — merge-suggestion refreshes run as background jobs, never inline in
// a request handler or a sync job.
//
// A refresh scores the user's whole address book and then upserts up to 500
// suggestion rows; even with the blocked, chunked scorer that is seconds of
// work for a large book, and the process that runs it also serves web +
// CardDAV + sync. So `POST /api/merge-suggestions/refresh` and the first
// Google/Microsoft import only ENQUEUE a refresh here and return; the UI polls
// `GET /api/merge-suggestions/refresh?jobId=…` for the outcome.
//
// Guarantees (per process): at most ONE refresh runs per user at a time; later
// requests queue behind it, and a request that matches an already-queued job
// (same `dedupeKey`) joins that job instead of queueing another.
//
// Multi-instance caveat: the guard and the job registry are in-process memory.
// Kontax runs one Node process today (`node server.mjs`); with several app
// instances two refreshes for one user could overlap (harmless — upserts are
// keyed on (userId, pairKey) — just wasted work), a status poll that lands on
// another instance sees "unknown" (the UI treats that as finished), and jobs
// are lost on restart. A shared queue (e.g. Redis) is the fix if we scale out.
import { randomUUID } from "node:crypto";

import { refreshMergeSuggestionsForUser } from "~/server/contact-merge";

export type MergeRefreshJobStatus = "queued" | "running" | "succeeded" | "failed";

export type MergeRefreshJob = {
  id: string;
  source: string;
  status: MergeRefreshJobStatus;
  enqueuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  suggestionCount: number | null;
};

type QueueEntry = {
  job: MergeRefreshJob;
  dedupeKey: string;
  run: () => Promise<unknown>;
};

type UserQueue = {
  running: QueueEntry | null;
  pending: QueueEntry[];
  finished: MergeRefreshJob[];
  evictTimer: ReturnType<typeof setTimeout> | null;
};

// A user can only queue a handful of refreshes (the route is rate-limited and
// imports are rare); beyond this, new requests join the last queued job.
const MAX_PENDING_PER_USER = 4;
// Finished jobs stay pollable for a while, then the user's entry is dropped.
const FINISHED_JOBS_KEPT = 5;
const IDLE_EVICT_MS = 30 * 60 * 1000;

// On globalThis so every bundle/chunk that imports this module (route
// handlers, server actions, the sync runner) shares ONE registry and guard.
const REGISTRY_KEY = Symbol.for("kontax.mergeSuggestionRefreshQueue");
type GlobalWithRegistry = typeof globalThis & { [REGISTRY_KEY]?: Map<string, UserQueue> };
const registry = ((globalThis as GlobalWithRegistry)[REGISTRY_KEY] ??= new Map<string, UserQueue>());

const queueFor = (userId: string) => {
  let queue = registry.get(userId);
  if (!queue) {
    queue = { running: null, pending: [], finished: [], evictTimer: null };
    registry.set(userId, queue);
  }
  if (queue.evictTimer) {
    clearTimeout(queue.evictTimer);
    queue.evictTimer = null;
  }
  return queue;
};

const scheduleEviction = (userId: string, queue: UserQueue) => {
  const timer = setTimeout(() => {
    if (registry.get(userId) === queue && !queue.running && queue.pending.length === 0) {
      registry.delete(userId);
    }
  }, IDLE_EVICT_MS);
  timer.unref?.();
  queue.evictTimer = timer;
};

const drain = async (userId: string) => {
  const queue = registry.get(userId);
  if (!queue || queue.running) return;

  let entry = queue.pending.shift();
  while (entry) {
    queue.running = entry;
    entry.job.status = "running";
    entry.job.startedAt = new Date();
    try {
      const result = await entry.run();
      entry.job.status = "succeeded";
      entry.job.suggestionCount = typeof result === "number" ? result : null;
    } catch (error) {
      entry.job.status = "failed";
      console.error(
        `[merge-suggestions] background refresh failed (job ${entry.job.id}, source ${entry.job.source})`,
        error,
      );
    }
    entry.job.finishedAt = new Date();
    queue.finished.unshift(entry.job);
    queue.finished.length = Math.min(queue.finished.length, FINISHED_JOBS_KEPT);
    queue.running = null;
    entry = queue.pending.shift();
  }

  scheduleEviction(userId, queue);
};

export type EnqueueMergeRefreshOptions = {
  /** Recorded on the suggestion rows (`MergeSuggestion.source`). */
  source?: string;
  /** Requests with the same key join an already-QUEUED job. */
  dedupeKey?: string;
  /** The work to run; defaults to a full refreshMergeSuggestionsForUser. */
  run?: () => Promise<unknown>;
};

/**
 * Queue a merge-suggestion refresh for `userId` and return immediately. The
 * job starts on a later macrotask — never inside the caller's request or sync
 * transaction — and runs only when no other refresh for the user is running.
 */
export const enqueueMergeSuggestionRefresh = (
  userId: string,
  options: EnqueueMergeRefreshOptions = {},
): MergeRefreshJob => {
  const source = options.source ?? "manual-refresh";
  const dedupeKey = options.dedupeKey ?? source;
  const queue = queueFor(userId);

  const queued =
    queue.pending.find((entry) => entry.dedupeKey === dedupeKey) ??
    (queue.pending.length >= MAX_PENDING_PER_USER ? queue.pending.at(-1) : undefined);
  if (queued) {
    return queued.job;
  }

  const job: MergeRefreshJob = {
    id: randomUUID(),
    source,
    status: "queued",
    enqueuedAt: new Date(),
    startedAt: null,
    finishedAt: null,
    suggestionCount: null,
  };
  queue.pending.push({
    job,
    dedupeKey,
    run: options.run ?? (() => refreshMergeSuggestionsForUser(userId, source)),
  });

  if (!queue.running) {
    setImmediate(() => {
      void drain(userId);
    });
  }
  return job;
};

/**
 * A job's status, looked up only within `userId`'s own jobs (a job id from
 * another user reads as "unknown"). Without `jobId`, the newest job.
 */
export const getMergeSuggestionRefreshJob = (
  userId: string,
  jobId?: string | null,
): MergeRefreshJob | null => {
  const queue = registry.get(userId);
  if (!queue) return null;
  const jobs = [
    ...(queue.running ? [queue.running.job] : []),
    ...queue.pending.map((entry) => entry.job),
    ...queue.finished,
  ];
  if (!jobId) {
    return (
      [...jobs].sort((left, right) => right.enqueuedAt.getTime() - left.enqueuedAt.getTime())[0] ??
      null
    );
  }
  return jobs.find((job) => job.id === jobId) ?? null;
};

/** Test-only: resolves once `userId` has nothing running or queued. */
export const waitForMergeSuggestionRefreshIdle = async (userId: string) => {
  for (;;) {
    const queue = registry.get(userId);
    if (!queue || (!queue.running && queue.pending.length === 0)) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
};
