"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "~/server/auth";
import { assertCanCreateSyncAccount, assertCanUseCardDavSync } from "~/server/billing";
import {
  CardDavPreflightError,
  discoverCardDavAccount,
  fetchCardDavAddressBookIndex,
} from "~/server/carddav";
import { db } from "~/server/db";
import {
  decryptSyncCredentialPayload,
  encryptSyncCredentialPayload,
  getSyncCredentialEncryptionStatus,
} from "~/server/sync-credentials";

const syncDirectionSchema = z.enum(["TWO_WAY", "IMPORT_ONLY", "EXPORT_ONLY"]);
const syncResolutionStrategySchema = z.enum([
  "KEEP_LOCAL",
  "KEEP_REMOTE",
  "DUPLICATE_LOCAL",
  "ARCHIVE_LOCAL",
  "MANUAL_MERGE",
]);

const createSyncAccountSchema = z.object({
  label: z.string().trim().min(1, "Label is required.").max(120),
  baseUrl: z.string().trim().url("Enter a valid CardDAV base URL.").max(500),
  principalUrl: z.string().trim().url("Enter a valid principal URL.").max(500).optional(),
  addressBookUrl: z.string().trim().url("Enter a valid address book URL.").max(500).optional(),
  syncDirection: syncDirectionSchema,
});

const attachSyncCredentialSchema = z.object({
  syncAccountId: z.string().trim().min(1, "Missing sync account id."),
  username: z.string().trim().min(1, "Username is required.").max(320),
  password: z.string().min(6, "Password or app password is required.").max(500),
  note: z.string().trim().max(200).optional(),
});

const syncAccountIdSchema = z.object({
  syncAccountId: z.string().trim().min(1, "Missing sync account id."),
});

const syncJobIdSchema = z.object({
  syncJobId: z.string().trim().min(1, "Missing sync job id."),
});

const syncConflictResolutionSchema = z.object({
  syncConflictId: z.string().trim().min(1, "Missing sync conflict id."),
  resolutionStrategy: syncResolutionStrategySchema,
  resolutionNotes: z.string().trim().max(500).optional(),
});

const getRequiredUserId = async () => {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("You must be signed in to manage sync accounts.");
  }

  return userId;
};

const getOptionalString = (formData: FormData, key: string) => {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getRedirectTarget = (formData: FormData) => {
  const value = formData.get("redirectTo");
  return typeof value === "string" && value.startsWith("/") ? value : undefined;
};

const revalidateSyncViews = () => {
  revalidatePath("/");
  revalidatePath("/sync");
};

const parseCreateSyncAccountInput = (formData: FormData) => {
  const parsed = createSyncAccountSchema.safeParse({
    label: formData.get("label"),
    baseUrl: formData.get("baseUrl"),
    principalUrl: getOptionalString(formData, "principalUrl"),
    addressBookUrl: getOptionalString(formData, "addressBookUrl"),
    syncDirection: formData.get("syncDirection"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid sync account details.");
  }

  return parsed.data;
};

const parseAttachSyncCredentialInput = (formData: FormData) => {
  const parsed = attachSyncCredentialSchema.safeParse({
    syncAccountId: formData.get("syncAccountId"),
    username: formData.get("username"),
    password: formData.get("password"),
    note: getOptionalString(formData, "note"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid sync credentials.");
  }

  return parsed.data;
};

const parseSyncAccountId = (formData: FormData) => {
  const parsed = syncAccountIdSchema.safeParse({
    syncAccountId: formData.get("syncAccountId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid sync account id.");
  }

  return parsed.data.syncAccountId;
};

const parseSyncJobId = (formData: FormData) => {
  const parsed = syncJobIdSchema.safeParse({
    syncJobId: formData.get("syncJobId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid sync job id.");
  }

  return parsed.data.syncJobId;
};

const parseSyncConflictResolution = (formData: FormData) => {
  const parsed = syncConflictResolutionSchema.safeParse({
    syncConflictId: formData.get("syncConflictId"),
    resolutionStrategy: formData.get("resolutionStrategy"),
    resolutionNotes: getOptionalString(formData, "resolutionNotes"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid sync conflict update.");
  }

  return parsed.data;
};

const createRetrySchedule = (attemptNumber: number) => {
  const backoffMinutes = [5, 15, 60, 180, 720];
  const minutes = backoffMinutes[Math.min(Math.max(attemptNumber, 1), backoffMinutes.length) - 1]!;
  return new Date(Date.now() + minutes * 60 * 1000);
};

const createIdempotencyKey = (parts: string[]) => `${parts.join(":")}:${Date.now()}`;

const recordFailedPreflight = async ({
  accountId,
  syncDirection,
  accountStatus,
  errorCode,
  errorSummary,
}: {
  accountId: string;
  syncDirection: "TWO_WAY" | "IMPORT_ONLY" | "EXPORT_ONLY";
  accountStatus: "ACTIVE" | "PAUSED" | "NEEDS_REAUTH" | "ERROR";
  errorCode: string;
  errorSummary: string;
}) => {
  const now = new Date();
  const nextStatus =
    errorCode === "CARDDAV_AUTH_FAILED" ||
    errorCode === "CREDENTIALS_MISSING" ||
    errorCode === "CREDENTIALS_UNREADABLE"
      ? "NEEDS_REAUTH"
      : accountStatus === "PAUSED"
        ? "PAUSED"
        : "ERROR";

  await db.$transaction([
    db.syncJob.create({
      data: {
        syncAccountId: accountId,
        status: "FAILED",
        trigger: "MANUAL",
        syncDirection,
        attemptCount: 1,
        maxAttempts: 5,
        nextRetryAt: createRetrySchedule(1),
        startedAt: now,
        completedAt: now,
        idempotencyKey: createIdempotencyKey([accountId, "manual", errorCode.toLowerCase()]),
        errorCode,
        errorSummary,
      },
    }),
    db.syncAccount.update({
      where: { id: accountId },
      data: {
        status: nextStatus,
        lastErrorAt: now,
        lastErrorCode: errorCode,
        lastErrorMessage: errorSummary,
      },
    }),
  ]);
};

export const createSyncAccount = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const input = parseCreateSyncAccountInput(formData);
  const redirectTo = getRedirectTarget(formData) ?? "/sync?created=1";

  await assertCanCreateSyncAccount(userId);

  await db.syncAccount.create({
    data: {
      userId,
      label: input.label,
      baseUrl: input.baseUrl,
      principalUrl: input.principalUrl,
      addressBookUrl: input.addressBookUrl,
      syncDirection: input.syncDirection,
      credentialVersion: 1,
    },
  });

  revalidateSyncViews();
  redirect(redirectTo);
};

export const activateSyncAccount = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const syncAccountId = parseSyncAccountId(formData);
  const redirectTo = getRedirectTarget(formData) ?? "/sync?activated=1";

  await assertCanUseCardDavSync(userId);

  await db.syncAccount.updateMany({
    where: {
      id: syncAccountId,
      userId,
    },
    data: {
      status: "ACTIVE",
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });

  revalidateSyncViews();
  redirect(redirectTo);
};

export const attachSyncCredentials = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const input = parseAttachSyncCredentialInput(formData);
  const redirectTo = getRedirectTarget(formData) ?? "/sync?credentialsSaved=1";

  await assertCanUseCardDavSync(userId);

  const encryptionStatus = getSyncCredentialEncryptionStatus();
  if (!encryptionStatus.available) {
    throw new Error(
      "Credential encryption is not configured. Set SYNC_CREDENTIAL_ENCRYPTION_KEY or AUTH_SECRET first.",
    );
  }

  const syncAccount = await db.syncAccount.findFirst({
    where: {
      id: input.syncAccountId,
      userId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!syncAccount) {
    throw new Error("Sync account not found.");
  }

  const encrypted = encryptSyncCredentialPayload({
    username: input.username,
    password: input.password,
    note: input.note,
    provider: "CARDDAV",
    version: 1,
  });

  await db.syncAccount.update({
    where: { id: syncAccount.id },
    data: {
      credentialReference: encrypted.credentialReference,
      credentialVersion: {
        increment: 1,
      },
      credentialUpdatedAt: new Date(),
      credentialRevokedAt: null,
      encryptionKeyRef: encrypted.encryptionKeyRef,
      status: syncAccount.status === "NEEDS_REAUTH" ? "PAUSED" : syncAccount.status,
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });

  revalidateSyncViews();
  redirect(redirectTo);
};

export const revokeSyncCredentials = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const syncAccountId = parseSyncAccountId(formData);
  const redirectTo = getRedirectTarget(formData) ?? "/sync?credentialsRevoked=1";

  await assertCanUseCardDavSync(userId);

  await db.syncAccount.updateMany({
    where: {
      id: syncAccountId,
      userId,
    },
    data: {
      credentialReference: null,
      credentialVersion: {
        increment: 1,
      },
      credentialRevokedAt: new Date(),
      encryptionKeyRef: null,
      status: "NEEDS_REAUTH",
      lastErrorAt: new Date(),
      lastErrorCode: "CREDENTIALS_REVOKED",
      lastErrorMessage:
        "Stored CardDAV credentials were revoked. Add fresh encrypted credentials before running sync again.",
    },
  });

  revalidateSyncViews();
  redirect(redirectTo);
};

export const prepareSyncRelink = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const syncAccountId = parseSyncAccountId(formData);
  const redirectTo = getRedirectTarget(formData) ?? "/sync?relinkPrepared=1";

  await assertCanUseCardDavSync(userId);

  const account = await db.syncAccount.findFirst({
    where: {
      id: syncAccountId,
      userId,
    },
    select: {
      id: true,
      credentialReference: true,
      credentialRevokedAt: true,
    },
  });

  if (!account) {
    throw new Error("Sync account not found.");
  }

  const now = new Date();
  const nextStatus =
    account.credentialReference && !account.credentialRevokedAt ? "PAUSED" : "NEEDS_REAUTH";

  await db.$transaction([
    db.syncConflict.updateMany({
      where: {
        syncAccountId: account.id,
        status: "OPEN",
      },
      data: {
        status: "IGNORED",
        resolutionNotes: "Ignored during sync relink preparation.",
        resolvedAt: now,
      },
    }),
    db.syncContactLink.deleteMany({
      where: {
        syncAccountId: account.id,
      },
    }),
    db.syncAccount.update({
      where: { id: account.id },
      data: {
        status: nextStatus,
        remoteAccountId: null,
        remoteCTag: null,
        lastSyncCursor: null,
        lastSyncedAt: null,
        lastSucceededAt: null,
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    }),
  ]);

  revalidateSyncViews();
  redirect(redirectTo);
};

export const pauseSyncAccount = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const syncAccountId = parseSyncAccountId(formData);
  const redirectTo = getRedirectTarget(formData) ?? "/sync?paused=1";

  await db.syncAccount.updateMany({
    where: {
      id: syncAccountId,
      userId,
    },
    data: {
      status: "PAUSED",
    },
  });

  revalidateSyncViews();
  redirect(redirectTo);
};

export const queueSyncJob = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const syncAccountId = parseSyncAccountId(formData);
  const redirectTo = getRedirectTarget(formData);

  await assertCanUseCardDavSync(userId);

  const account = await db.syncAccount.findFirst({
    where: {
      id: syncAccountId,
      userId,
    },
    select: {
      id: true,
      status: true,
      syncDirection: true,
      baseUrl: true,
      principalUrl: true,
      addressBookUrl: true,
      remoteAccountId: true,
      credentialReference: true,
      credentialRevokedAt: true,
    },
  });

  if (!account) {
    throw new Error("Sync account not found.");
  }

  const now = new Date();

  if (!account.credentialReference || account.credentialRevokedAt) {
    const errorSummary = account.credentialRevokedAt
      ? "Stored CardDAV credentials were revoked. Add fresh encrypted credentials before running sync again."
      : "Encrypted CardDAV credentials are not attached to this sync account yet.";

    await recordFailedPreflight({
      accountId: account.id,
      syncDirection: account.syncDirection,
      accountStatus: account.status,
      errorCode: "CREDENTIALS_MISSING",
      errorSummary,
    });

    revalidateSyncViews();
    redirect(redirectTo ?? "/sync?preflightFailed=1");
  }

  let decryptedCredentials:
    | ReturnType<typeof decryptSyncCredentialPayload>
    | null = null;

  try {
    decryptedCredentials = decryptSyncCredentialPayload(account.credentialReference);
  } catch (error) {
    const errorSummary =
      error instanceof Error
        ? error.message
        : "Stored CardDAV credentials could not be decrypted.";

    await recordFailedPreflight({
      accountId: account.id,
      syncDirection: account.syncDirection,
      accountStatus: account.status,
      errorCode: "CREDENTIALS_UNREADABLE",
      errorSummary,
    });

    revalidateSyncViews();
    redirect(redirectTo ?? "/sync?preflightFailed=1");
  }

  const needsDiscovery =
    !account.remoteAccountId || !account.principalUrl || !account.addressBookUrl;

  if (needsDiscovery && decryptedCredentials) {
    try {
      const discovery = await discoverCardDavAccount({
        baseUrl: account.baseUrl,
        principalUrl: account.principalUrl,
        addressBookUrl: account.addressBookUrl,
        credentials: {
          username: decryptedCredentials.username,
          password: decryptedCredentials.password,
        },
      });

      await db.$transaction([
        db.syncJob.create({
          data: {
            syncAccountId: account.id,
            status: "SUCCEEDED",
            trigger: "MANUAL",
            syncDirection: account.syncDirection,
            attemptCount: 1,
            maxAttempts: 5,
            cursorAfter: discovery.remoteCTag,
            startedAt: now,
            completedAt: now,
            idempotencyKey: createIdempotencyKey([account.id, "manual", "preflight"]),
            errorSummary: `Preflight discovered ${discovery.addressBookDisplayName ?? "a CardDAV address book"}.`,
          },
        }),
        db.syncAccount.update({
          where: { id: account.id },
          data: {
            status: account.status === "PAUSED" ? "PAUSED" : "ACTIVE",
            principalUrl: discovery.principalUrl,
            addressBookUrl: discovery.addressBookUrl,
            remoteAccountId: discovery.remoteAccountId,
            remoteCTag: discovery.remoteCTag,
            lastSyncCursor: discovery.remoteCTag,
            lastSucceededAt: now,
            lastErrorAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        }),
      ]);
    } catch (error) {
      const errorCode =
        error instanceof CardDavPreflightError ? error.code : "CARDDAV_PREFLIGHT_FAILED";
      const errorSummary =
        error instanceof Error
          ? error.message
          : "CardDAV preflight failed before Kontax could queue a sync run.";

      await recordFailedPreflight({
        accountId: account.id,
        syncDirection: account.syncDirection,
        accountStatus: account.status,
        errorCode,
        errorSummary,
      });

      revalidateSyncViews();
      redirect("/sync?preflightFailed=1");
    }

    revalidateSyncViews();
    redirect("/sync?preflightCompleted=1");
  }

  await db.$transaction([
    db.syncAccount.update({
      where: { id: account.id },
      data: {
        status: account.status === "PAUSED" ? "PAUSED" : "ACTIVE",
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    }),
  ]);

  if (!decryptedCredentials || !account.addressBookUrl) {
    throw new Error("CardDAV sync account is missing decrypted credentials or an address book URL.");
  }

  try {
    const remoteEntries = await fetchCardDavAddressBookIndex({
      addressBookUrl: account.addressBookUrl,
      credentials: {
        username: decryptedCredentials.username,
        password: decryptedCredentials.password,
      },
    });

    const remoteUids = remoteEntries.map((entry) => entry.uid);
    const matchingContacts =
      remoteUids.length > 0
        ? await db.contact.findMany({
            where: {
              userId,
              archivedAt: null,
              syncUid: {
                in: remoteUids,
              },
            },
            select: {
              id: true,
              syncUid: true,
            },
          })
        : [];
    const contactByUid = new Map(matchingContacts.map((contact) => [contact.syncUid, contact]));
    const matchedEntries = remoteEntries.filter((entry) => contactByUid.has(entry.uid));
    const unmatchedEntries = remoteEntries.length - matchedEntries.length;

    if (matchedEntries.length > 0) {
      await db.$transaction(
        matchedEntries.map((entry) => {
          const contact = contactByUid.get(entry.uid)!;

          return db.syncContactLink.upsert({
            where: {
              syncAccountId_contactId: {
                syncAccountId: account.id,
                contactId: contact.id,
              },
            },
            create: {
              syncAccountId: account.id,
              contactId: contact.id,
              remoteHref: entry.href,
              remoteUid: entry.uid,
              remoteETag: entry.etag,
              lastSyncedAt: now,
            },
            update: {
              remoteHref: entry.href,
              remoteUid: entry.uid,
              remoteETag: entry.etag,
              remoteDeletedAt: null,
              tombstonedAt: null,
              lastErrorCode: null,
              lastErrorMessage: null,
              lastSyncedAt: now,
            },
          });
        }),
      );
    }

    await db.$transaction([
      db.syncJob.create({
        data: {
          syncAccountId: account.id,
          status: unmatchedEntries > 0 ? "PARTIAL" : "SUCCEEDED",
          trigger: "MANUAL",
          syncDirection: account.syncDirection,
          attemptCount: 1,
          maxAttempts: 5,
          nextRetryAt: now,
          startedAt: now,
          completedAt: new Date(),
          updatedCount: matchedEntries.length,
          skippedCount: unmatchedEntries,
          cursorBefore: account.remoteAccountId ?? account.addressBookUrl,
          cursorAfter: String(remoteEntries.length),
          idempotencyKey: createIdempotencyKey([account.id, "manual", "index"]),
          errorCode: unmatchedEntries > 0 ? "REMOTE_CONTACTS_UNMATCHED" : null,
          errorSummary:
            unmatchedEntries > 0
              ? `${matchedEntries.length} remote contacts linked and ${unmatchedEntries} remote contacts are still unmatched locally.`
              : `Indexed ${matchedEntries.length} remote contacts and refreshed local sync links.`,
        },
      }),
      db.syncAccount.update({
        where: { id: account.id },
        data: {
          status: account.status === "PAUSED" ? "PAUSED" : "ACTIVE",
          lastSyncedAt: now,
          lastSucceededAt: now,
          lastErrorAt: unmatchedEntries > 0 ? now : null,
          lastErrorCode: unmatchedEntries > 0 ? "REMOTE_CONTACTS_UNMATCHED" : null,
          lastErrorMessage:
            unmatchedEntries > 0
              ? `${unmatchedEntries} remote contacts do not map to a local sync UID yet.`
              : null,
        },
      }),
    ]);
  } catch (error) {
    const errorCode =
      error instanceof CardDavPreflightError ? error.code : "CARDDAV_INDEX_FAILED";
    const errorSummary =
      error instanceof Error
        ? error.message
        : "CardDAV indexing failed before local sync links could be refreshed.";

    await recordFailedPreflight({
      accountId: account.id,
      syncDirection: account.syncDirection,
      accountStatus: account.status,
      errorCode,
      errorSummary,
    });

    revalidateSyncViews();
    redirect("/sync?preflightFailed=1");
  }

  revalidateSyncViews();
  redirect(redirectTo ?? "/sync?queued=1");
};

export const retrySyncJob = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const syncJobId = parseSyncJobId(formData);
  const redirectTo = getRedirectTarget(formData) ?? "/sync?retryQueued=1";

  await assertCanUseCardDavSync(userId);

  const job = await db.syncJob.findFirst({
    where: {
      id: syncJobId,
      syncAccount: {
        userId,
      },
    },
    select: {
      id: true,
      syncAccountId: true,
      status: true,
      attemptCount: true,
      maxAttempts: true,
      syncDirection: true,
      cursorBefore: true,
      cursorAfter: true,
    },
  });

  if (!job) {
    throw new Error("Sync job not found.");
  }

  if (job.status !== "FAILED" && job.status !== "PARTIAL") {
    throw new Error("Only failed or partial sync jobs can be retried.");
  }

  const nextAttempt = job.attemptCount + 1;
  if (nextAttempt > job.maxAttempts) {
    throw new Error("This sync job has exhausted its retry budget.");
  }

  await db.syncJob.create({
    data: {
      syncAccountId: job.syncAccountId,
      status: "QUEUED",
      trigger: "RECOVERY",
      syncDirection: job.syncDirection,
      attemptCount: nextAttempt,
      maxAttempts: job.maxAttempts,
      nextRetryAt: createRetrySchedule(nextAttempt),
      cursorBefore: job.cursorAfter ?? job.cursorBefore,
      idempotencyKey: createIdempotencyKey([job.syncAccountId, job.id, "recovery"]),
    },
  });

  revalidateSyncViews();
  redirect(redirectTo);
};

export const resolveSyncConflict = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const input = parseSyncConflictResolution(formData);
  const redirectTo = getRedirectTarget(formData) ?? "/sync?conflictResolved=1";

  await assertCanUseCardDavSync(userId);

  const conflict = await db.syncConflict.findFirst({
    where: {
      id: input.syncConflictId,
      syncAccount: {
        userId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!conflict) {
    throw new Error("Sync conflict not found.");
  }

  await db.syncConflict.update({
    where: { id: conflict.id },
    data: {
      status: "RESOLVED",
      resolutionStrategy: input.resolutionStrategy,
      resolutionNotes: input.resolutionNotes,
      resolvedAt: new Date(),
    },
  });

  revalidateSyncViews();
  redirect(redirectTo);
};
