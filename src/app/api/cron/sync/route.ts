import { type NextRequest, NextResponse } from "next/server";

import { purgeDeletedContacts } from "~/server/contact-deletion";
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
  // P49A-12 (A-16): purge permanently deleted contacts once every provider
  // has deleted its copy (the runs above push those deletes). Best-effort — a
  // purge failure must not fail the sync cron.
  const { purged: purgedDeletedContacts } = await purgeDeletedContacts().catch((error: unknown) => {
    console.error("[cron/sync] deleted-contact purge failed:", error);
    return { purged: 0 };
  });

  return NextResponse.json({ enqueued, accountsNotDue, ...result, purgedDeletedContacts });
}
