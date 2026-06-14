"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import { createDataExportJob, getActiveDataExportJob } from "~/server/data-export/jobs";
import { db } from "~/server/db";

async function getRequiredUserId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("You must be signed in.");
  return userId;
}

export async function getDataExportStatus() {
  const userId = await getRequiredUserId();
  return db.dataExportJob.findFirst({
    where: { userId },
    orderBy: { requestedAt: "desc" },
  });
}

export async function requestDataExport(params: { includeArchived?: boolean } = {}) {
  const userId = await getRequiredUserId();

  // Return existing active job rather than creating a duplicate
  const existing = await getActiveDataExportJob(userId);
  if (existing) return { jobId: existing.id };

  const job = await createDataExportJob(userId, params.includeArchived ?? false);
  revalidatePath("/settings/account");

  return { jobId: job.id };
}
