import { isSessionError, requireUserId } from "~/server/auth/require-session";
import {
  enqueueMergeSuggestionRefresh,
  getMergeSuggestionRefreshJob,
} from "~/server/merge-suggestion-refresh-queue";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";

// P49A-09: a rescan scores the whole address book, so it never runs on the
// request path. POST enqueues a background refresh (one per user at a time)
// and answers 202 with a job id; the UI polls GET with that id.

export async function POST() {
  let userId: string;
  try {
    userId = await requireUserId({ write: true });
  } catch (err) {
    if (isSessionError(err)) return Response.json({ message: "Unauthorized" }, { status: 401 });
    throw err;
  }

  const limit = await checkRateLimit(rateLimiters.mergeSuggestionRefresh, `user:${userId}`);
  if (!limit.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000));
    return Response.json(
      {
        message: `You've rescanned for duplicates several times recently. Try again in ${Math.ceil(
          retryAfterSeconds / 60,
        )} min.`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const job = enqueueMergeSuggestionRefresh(userId, {
    source: "manual-refresh",
    dedupeKey: "manual-refresh",
  });

  return Response.json({ jobId: job.id, status: job.status }, { status: 202 });
}

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    if (isSessionError(err)) return Response.json({ message: "Unauthorized" }, { status: 401 });
    throw err;
  }

  const jobId = new URL(request.url).searchParams.get("jobId");
  const job = getMergeSuggestionRefreshJob(userId, jobId);
  if (!job) {
    // Finished long ago, ran on another instance, or the process restarted.
    return Response.json({ jobId, status: "unknown" });
  }

  return Response.json({
    jobId: job.id,
    status: job.status,
    suggestionCount: job.suggestionCount,
  });
}
