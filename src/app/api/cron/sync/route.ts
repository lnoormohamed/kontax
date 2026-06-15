import { type NextRequest, NextResponse } from "next/server";

import { assertCronSecret } from "~/server/cron-guard";
import { enqueueDueSyncJobs, runQueuedSyncJobs } from "~/server/sync-runner";

export const dynamic = "force-dynamic";

/**
 * P34D-03: scheduled sync runner. Enqueues a SCHEDULED job for every ACTIVE
 * account that is due per its frequency, then drains the queue (manual,
 * scheduled, and retry jobs alike). Guarded by CRON_SECRET; schedule it every
 * ~15 minutes (see PRE-PROD-CHECKLIST.md). Job claiming is atomic per-job; the
 * runner also guards against same-account concurrency (see sync-runner.ts).
 */
export async function POST(req: NextRequest) {
  const denied = assertCronSecret(req);
  if (denied) return denied;

  const { enqueued, skipped: accountsNotDue } = await enqueueDueSyncJobs();
  const result = await runQueuedSyncJobs({ limit: 25 });

  return NextResponse.json({ enqueued, accountsNotDue, ...result });
}
