import { auth } from "~/server/auth";
import { db } from "~/server/db";

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
        take: 10,
        select: {
          id: true,
          status: true,
          trigger: true,
          syncDirection: true,
          attemptCount: true,
          maxAttempts: true,
          nextRetryAt: true,
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
        take: 10,
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

  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      product: "Kontax",
      type: "sync-recovery-package",
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
      recentJobs: syncAccount.syncJobs,
      recentConflicts: syncAccount.syncConflicts,
      relatedContacts: recoveryContacts,
      notes: [
        "This package intentionally excludes raw credentials.",
        "Use this export before reset or relink operations.",
        "Sync links may be reset locally without changing your canonical Kontax contacts.",
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
