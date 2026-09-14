import { type NextRequest, NextResponse } from "next/server";

import { assertCronSecret } from "~/server/cron-guard";
import { runQueuedSyncJobs } from "~/server/sync-runner";

// P48-10: this endpoint drains the GLOBAL sync queue, so it is a scheduler /
// QA-harness endpoint, not a user endpoint. It used to accept any signed-in
// session (letting one user run every tenant's jobs with an unbounded limit),
// a bearer equal to AUTH_SECRET compared with `===`, and a form-post redirect
// target that allowed `//evil.com`. It now requires the same x-cron-secret as
// /api/cron/*, caps the batch, and returns JSON only. The user-facing
// "Sync now" flow goes through the server actions in src/app/actions/sync.ts,
// which are scoped to the caller's own accounts.
const MAX_LIMIT = 25;

export async function POST(request: NextRequest) {
  const denied = assertCronSecret(request);
  if (denied) return denied;

  let limit = 5;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { limit?: unknown } | null;
    if (typeof body?.limit === "number" && Number.isFinite(body.limit)) limit = body.limit;
  } else {
    const formData = await request.formData().catch(() => null);
    const limitValue = formData?.get("limit");
    if (typeof limitValue === "string" && Number.isFinite(Number(limitValue))) {
      limit = Number(limitValue);
    }
  }
  limit = Math.min(Math.max(Math.floor(limit), 1), MAX_LIMIT);

  const result = await runQueuedSyncJobs({ limit });
  return NextResponse.json(result);
}
