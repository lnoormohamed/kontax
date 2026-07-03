import { type NextRequest, NextResponse } from "next/server";

import { assertCronSecret } from "~/server/cron-guard";
import { generateDataExport } from "~/server/data-export/generate-export";
import { claimOldestPendingJob, markJobFailed, markJobReady } from "~/server/data-export/jobs";
import { expireKontaxExportJobs, processNextKontaxExportJob } from "~/server/export-format/jobs";
import { uploadExportZip } from "~/server/data-export/s3";
import { sendEmail } from "~/server/email";
import { getPublicOrigin } from "~/lib/public-origin";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5-minute cap for large exports

export async function POST(req: NextRequest) {
  const denied = assertCronSecret(req);
  if (denied) return denied;

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

  const [claimed] = await claimOldestPendingJob();
  if (!claimed) return NextResponse.json({ message: "No pending jobs", kontaxProcessed, kontaxExpired });

  const { id: jobId, userId, userEmail, includeArchived } = claimed;

  try {
    const zipBuffer = await generateDataExport(userId, includeArchived);
    const downloadUrl = await uploadExportZip(userId, zipBuffer);
    await markJobReady(jobId, downloadUrl, zipBuffer.length);

    const appUrl = await getPublicOrigin();
    await sendEmail({
      to: userEmail,
      subject: "Your Kontax data export is ready",
      html: `<p>Your Kontax data export has been prepared. <a href="${appUrl}/settings/account">Download it within 48 hours.</a></p>`,
      text: `Your Kontax data export is ready. Download within 48 hours at: ${appUrl}/settings/account`,
    });

    return NextResponse.json({ processed: jobId });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[data-export] Job ${jobId} failed:`, err);
    await markJobFailed(jobId, errorMessage);
    return NextResponse.json({ failed: jobId, error: errorMessage }, { status: 500 });
  }
}
