import { db } from "~/server/db";

export async function getActiveDataExportJob(userId: string) {
  return db.dataExportJob.findFirst({
    where: {
      userId,
      status: { in: ["PENDING", "PROCESSING", "READY"] },
    },
    orderBy: { requestedAt: "desc" },
  });
}

export async function createDataExportJob(userId: string, includeArchived = false) {
  return db.dataExportJob.create({
    data: { userId, includeArchived },
    select: { id: true },
  });
}

export async function markJobProcessing(jobId: string) {
  return db.dataExportJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING", startedAt: new Date() },
  });
}

export async function markJobReady(jobId: string, downloadUrl: string, fileSizeBytes: number) {
  return db.dataExportJob.update({
    where: { id: jobId },
    data: {
      status: "READY",
      downloadUrl,
      fileSizeBytes,
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });
}

export async function markJobFailed(jobId: string, errorMessage: string) {
  return db.dataExportJob.update({
    where: { id: jobId },
    data: { status: "FAILED", errorMessage },
  });
}

export async function expireReadyJobs() {
  return db.dataExportJob.updateMany({
    where: {
      status: "READY",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
}

// Atomically claim the oldest PENDING job to prevent double-processing.
export async function claimOldestPendingJob() {
  return db.$queryRaw<
    Array<{ id: string; userId: string; userEmail: string; includeArchived: boolean }>
  >`
    UPDATE "DataExportJob" j
    SET status = 'PROCESSING', "startedAt" = NOW()
    FROM (
      SELECT j2.id, j2."userId", j2."includeArchived", u.email AS "userEmail"
      FROM "DataExportJob" j2
      JOIN "User" u ON u.id = j2."userId"
      WHERE j2.status = 'PENDING'
      ORDER BY j2."requestedAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    ) sub
    WHERE j.id = sub.id
    RETURNING j.id, j."userId", sub."userEmail" AS "userEmail", sub."includeArchived" AS "includeArchived"
  `;
}
