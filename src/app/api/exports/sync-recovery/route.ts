import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  AUTO_PAUSE_FAILURE_STREAK,
  getConsecutiveFailureStreak,
  getSyncAccountOperationalHealth,
  getSyncErrorSupportBucket,
} from "~/server/sync-health";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "sync-account";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const syncAccountId = url.searchParams.get("syncAccountId")?.trim();

  if (!syncAccountId) {
    return new Response("Missing syncAccountId", { status: 400 });
  }

  const syncAccount = await db.syncAccount.findFirst({
    where: {
      id: syncAccountId,
      userId,
    },
    include: {
      _count: {
        select: {
          syncJobs: true,
          syncConflicts: true,
          syncLinks: true,
        },
      },
      syncJobs: {
        orderBy: [{ createdAt: "desc" }],
        take: 20,
        select: {
          id: true,
          status: true,
          trigger: true,
          syncDirection: true,
          attemptCount: true,
          maxAttempts: true,
          nextRetryAt: true,
          leaseExpiresAt: true,
          workerId: true,
          cursorBefore: true,
          cursorAfter: true,
          createdCount: true,
          updatedCount: true,
          deletedCount: true,
          conflictCount: true,
          skippedCount: true,
          errorCode: true,
          errorSummary: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
        },
      },
      syncConflicts: {
        orderBy: [{ detectedAt: "desc" }],
        take: 20,
        select: {
          id: true,
          conflictType: true,
          status: true,
          resolutionStrategy: true,
          resolutionNotes: true,
          localSyncVersion: true,
          remoteETag: true,
          detectedAt: true,
          resolvedAt: true,
          contact: {
            select: {
              id: true,
              fullName: true,
              archivedAt: true,
              syncUid: true,
              syncVersion: true,
            },
          },
        },
      },
    },
  });

  if (!syncAccount) {
    return new Response("Sync account not found", { status: 404 });
  }

  const recoveryContacts = await db.contact.findMany({
    where: {
      userId,
      OR: [
        {
          syncLinks: {
            some: {
              syncAccountId: syncAccount.id,
            },
          },
        },
        {
          syncConflicts: {
            some: {
              syncAccountId: syncAccount.id,
            },
          },
        },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      company: true,
      archivedAt: true,
      syncUid: true,
      syncVersion: true,
      syncTombstoneAt: true,
      updatedAt: true,
    },
  });
  const recoveryLinks = await db.syncContactLink.findMany({
    where: {
      syncAccountId: syncAccount.id,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
    select: {
      id: true,
      remoteUid: true,
      remoteHref: true,
      remoteETag: true,
      lastSyncedAt: true,
      tombstonedAt: true,
      remoteDeletedAt: true,
      lastErrorCode: true,
      lastErrorMessage: true,
      contact: {
        select: {
          id: true,
          fullName: true,
          archivedAt: true,
          syncUid: true,
          syncVersion: true,
        },
      },
      _count: {
        select: {
          syncConflicts: true,
        },
      },
    },
  });
  const failureStreak = getConsecutiveFailureStreak(
    syncAccount.syncJobs.map((job) => ({
      status: job.status,
      errorCode: job.errorCode,
    })),
  );
  const operationalHealth = getSyncAccountOperationalHealth({
    status: syncAccount.status,
    lastErrorCode: syncAccount.lastErrorCode,
    recentJobs: syncAccount.syncJobs.map((job) => ({
      status: job.status,
      errorCode: job.errorCode,
    })),
  });

  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      product: "Kontax",
      type: "sync-recovery-package",
      support: {
        autoPauseFailureStreak: AUTO_PAUSE_FAILURE_STREAK,
        failureStreak,
        operationalHealth,
        latestSupportBucket: getSyncErrorSupportBucket(syncAccount.lastErrorCode),
      },
      syncAccount: {
        id: syncAccount.id,
        label: syncAccount.label,
        provider: syncAccount.provider,
        status: syncAccount.status,
        syncDirection: syncAccount.syncDirection,
        baseUrl: syncAccount.baseUrl,
        principalUrl: syncAccount.principalUrl,
        addressBookUrl: syncAccount.addressBookUrl,
        remoteAccountId: syncAccount.remoteAccountId,
        remoteCTag: syncAccount.remoteCTag,
        credentialVersion: syncAccount.credentialVersion,
        credentialUpdatedAt: syncAccount.credentialUpdatedAt,
        credentialRevokedAt: syncAccount.credentialRevokedAt,
        encryptionKeyRef: syncAccount.encryptionKeyRef,
        lastSyncCursor: syncAccount.lastSyncCursor,
        lastSyncedAt: syncAccount.lastSyncedAt,
        lastSucceededAt: syncAccount.lastSucceededAt,
        lastErrorAt: syncAccount.lastErrorAt,
        lastErrorCode: syncAccount.lastErrorCode,
        lastErrorMessage: syncAccount.lastErrorMessage,
        counts: syncAccount._count,
      },
      recentJobs: syncAccount.syncJobs.map((job) => ({
        ...job,
        supportBucket: getSyncErrorSupportBucket(job.errorCode),
      })),
      recentConflicts: syncAccount.syncConflicts,
      syncLinks: recoveryLinks.map((link) => ({
        ...link,
        supportBucket: getSyncErrorSupportBucket(link.lastErrorCode),
      })),
      relatedContacts: recoveryContacts,
      notes: [
        "This package intentionally excludes raw credentials.",
        "Use this export before reset or relink operations.",
        "Sync links may be reset locally without changing your canonical Kontax contacts.",
        "Support buckets group failures by operator-facing cause so repeated issues are easier to triage.",
      ],
    },
    null,
    2,
  );

  const resultFileName = `kontax-sync-recovery-${slugify(syncAccount.label)}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${resultFileName}"`,
    },
  });
}
