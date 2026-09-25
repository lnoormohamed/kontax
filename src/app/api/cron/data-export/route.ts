import { type NextRequest, NextResponse } from "next/server";

import { assertCronSecret } from "~/server/cron-guard";
import { generateDataExport } from "~/server/data-export/generate-export";
import {
  claimOldestPendingJob,
  markJobFailed,
  markJobReady,
  reclaimStaleDataExportJobs,
} from "~/server/data-export/jobs";
import {
  expireKontaxExportJobs,
  processNextKontaxExportJob,
  reclaimStalledKontaxExportJobs,
} from "~/server/export-format/jobs";
import { uploadExportZip } from "~/server/data-export/s3";
import { sendEmail } from "~/server/email";
import { getPublicOrigin } from "~/lib/public-origin";
import { isShuttingDown } from "~/server/process-lifecycle";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5-minute cap for large exports

export async function POST(req: NextRequest) {
  const denied = assertCronSecret(req);
  if (denied) return denied;

  // P49A-04: a draining process claims nothing new; the next tick (on the
  // replacement container) picks the work up.
  if (isShuttingDown()) {
    return NextResponse.json({ message: "Shutting down" }, { status: 503 });
  }

  // P49A-04: jobs orphaned mid-build by a restart must not stay PROCESSING
  // forever (a stuck GDPR export blocks every new request for that user).
  const reclaimedDataExports = await reclaimStaleDataExportJobs().catch((err) => {
    console.error("[data-export] stale-job reclaim failed:", err);
    return 0;
  });
  const reclaimedKontaxExports = await reclaimStalledKontaxExportJobs().catch((err) => {
    console.error("[data-export] Kontax archive stale-job reclaim failed:", err);
    return 0;
  });

  // P45-DB01: the same seam drives Kontax Archive jobs — pick up anything the
  // in-process kick dropped (deploy restarts, crashes) and expire stale links.
  const kontaxProcessed = await processNextKontaxExportJob().catch((err) => {
    console.error("[data-export] Kontax archive job failed:", err);
    return false;
  });
  const kontaxExpired = await expireKontaxExportJobs().catch((err) => {
    console.error("[data-export] Kontax archive expiry failed:", err);
    return 0;
  });

  const reclaimed = { reclaimedDataExports, reclaimedKontaxExports };
  if (isShuttingDown()) {
    return NextResponse.json({ message: "Shutting down", kontaxProcessed, kontaxExpired, ...reclaimed });
  }

  const [claimed] = await claimOldestPendingJob();
  if (!claimed) {
    return NextResponse.json({ message: "No pending jobs", kontaxProcessed, kontaxExpired, ...reclaimed });
  }

  const { id: jobId, userId, userEmail, includeArchived } = claimed;

  try {
    const zipBuffer = await generateDataExport(userId, includeArchived);
    const downloadUrl = await uploadExportZip(userId, zipBuffer);
    await markJobReady(jobId, downloadUrl, zipBuffer.length);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[data-export] Job ${jobId} failed:`, err);
    await markJobFailed(jobId, errorMessage);
    return NextResponse.json({ failed: jobId, error: errorMessage }, { status: 500 });
  }

  // P49A-04: the export is READY once markJobReady commits — the download is
  // on the settings page regardless. A failed "your export is ready" email is
  // logged, never allowed to flip the finished job to FAILED.
  let emailed = false;
  try {
    const appUrl = await getPublicOrigin();
    const sent = await sendEmail({
      to: userEmail,
      subject: "Your Kontax data export is ready",
      html: `<p>Your Kontax data export has been prepared. <a href="${appUrl}/settings/account">Download it within 48 hours.</a></p>`,
      text: `Your Kontax data export is ready. Download within 48 hours at: ${appUrl}/settings/account`,
    });
    emailed = sent.success;
  } catch (err) {
    console.error(`[data-export] Job ${jobId} is READY but the notification email failed:`, err);
  }

  return NextResponse.json({ processed: jobId, emailed, ...reclaimed });
}
