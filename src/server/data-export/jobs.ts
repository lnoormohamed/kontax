import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";

// P49A-04: the cron route that builds an export is capped at 5 minutes
// (maxDuration); a job still PROCESSING long after that was orphaned by a
// restart or crash. Left alone it counts as "active" forever and blocks every
// new export request for that user.
export const DATA_EXPORT_PROCESSING_TIMEOUT_MS = 30 * 60 * 1000;
export const DATA_EXPORT_INTERRUPTED_MESSAGE =
  "Interrupted — the export stopped before it finished (server restart). Request a new export.";

export const staleDataExportWhere = (now: Date) =>
  ({
    status: "PROCESSING",
    OR: [
      { startedAt: { lt: new Date(now.getTime() - DATA_EXPORT_PROCESSING_TIMEOUT_MS) } },
      { startedAt: null },
    ],
  }) satisfies Prisma.DataExportJobWhereInput;

export async function getActiveDataExportJob(userId: string, now: Date = new Date()) {
  return db.dataExportJob.findFirst({
    where: {
      userId,
      status: { in: ["PENDING", "PROCESSING", "READY"] },
      // P49A-04: a stale PROCESSING row is not "active" even before the cron
      // reclaims it — never let it block a fresh request.
      NOT: staleDataExportWhere(now),
    },
    orderBy: { requestedAt: "desc" },
  });
}

/** P49A-04: fail PROCESSING jobs orphaned past the timeout; returns the count. */
export async function reclaimStaleDataExportJobs(now: Date = new Date()) {
  const result = await db.dataExportJob.updateMany({
    where: staleDataExportWhere(now),
    data: { status: "FAILED", completedAt: now, errorMessage: DATA_EXPORT_INTERRUPTED_MESSAGE },
  });
  if (result.count > 0) {
    console.warn(
      `[data-export] reclaimed ${result.count} export job(s) stuck in PROCESSING; marked FAILED.`,
    );
  }
  return result.count;
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
