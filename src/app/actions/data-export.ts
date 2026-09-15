"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult } from "~/lib/action-result";
import { requireUserId } from "~/server/auth/require-session";
import { verifyStepUpPassword } from "~/server/auth/step-up";
import { createDataExportJob, getActiveDataExportJob } from "~/server/data-export/jobs";
import { db } from "~/server/db";

export async function getDataExportStatus() {
  const userId = await requireUserId();
  return db.dataExportJob.findFirst({
    where: { userId },
    orderBy: { requestedAt: "desc" },
  });
}

/**
 * P48-02: a data export packages the user's entire address book into one
 * downloadable archive, so it carries a real server-side step-up. The password
 * is verified here rather than by the modal that used to "protect" it —
 * `currentPassword` is optional in the type only so a caller that has no way to
 * collect one gets a STEP_UP_REQUIRED it can prompt on, never a silent pass.
 */
export async function requestDataExport(
  params: { includeArchived?: boolean; currentPassword?: string } = {},
): Promise<ActionResult<{ jobId: string }>> {
  let userId: string;
  try {
    userId = await requireUserId({ write: true });
  } catch {
    return { ok: false, reason: "SESSION_EXPIRED" };
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!user) return { ok: false, reason: "SESSION_EXPIRED" };

  const stepUp = await verifyStepUpPassword(userId, user.password, params.currentPassword);
  if (stepUp === "STEP_UP_REQUIRED") return { ok: false, reason: "STEP_UP_REQUIRED" };
  if (stepUp !== "OK") return { ok: false, reason: "ERROR", message: stepUp };

  // Return existing active job rather than creating a duplicate
  const existing = await getActiveDataExportJob(userId);
  if (existing) return { ok: true, data: { jobId: existing.id } };

  const job = await createDataExportJob(userId, params.includeArchived ?? false);
  revalidatePath("/settings/account");

  return { ok: true, data: { jobId: job.id } };
}
