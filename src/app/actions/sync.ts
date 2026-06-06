"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "~/server/auth";
import { assertCanCreateSyncAccount, assertCanUseCardDavSync } from "~/server/billing";
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

    await db.$transaction([
      db.syncJob.create({
        data: {
          syncAccountId: account.id,
          status: "FAILED",
          trigger: "MANUAL",
          syncDirection: account.syncDirection,
          attemptCount: 1,
          maxAttempts: 5,
          nextRetryAt: createRetrySchedule(1),
          startedAt: now,
          completedAt: now,
          idempotencyKey: createIdempotencyKey([account.id, "manual", "blocked"]),
          errorCode: "CREDENTIALS_MISSING",
          errorSummary,
        },
      }),
      db.syncAccount.update({
        where: { id: account.id },
        data: {
          status: "NEEDS_REAUTH",
          lastErrorAt: now,
          lastErrorCode: "CREDENTIALS_MISSING",
          lastErrorMessage: errorSummary,
        },
      }),
    ]);

    revalidateSyncViews();
    redirect(redirectTo ?? "/sync?preflightFailed=1");
  }

  try {
    decryptSyncCredentialPayload(account.credentialReference);
  } catch (error) {
    const errorSummary =
      error instanceof Error
        ? error.message
        : "Stored CardDAV credentials could not be decrypted.";

    await db.$transaction([
      db.syncJob.create({
        data: {
          syncAccountId: account.id,
          status: "FAILED",
          trigger: "MANUAL",
          syncDirection: account.syncDirection,
          attemptCount: 1,
          maxAttempts: 5,
          nextRetryAt: createRetrySchedule(1),
          startedAt: now,
          completedAt: now,
          idempotencyKey: createIdempotencyKey([account.id, "manual", "undecryptable"]),
          errorCode: "CREDENTIALS_UNREADABLE",
          errorSummary,
        },
      }),
      db.syncAccount.update({
        where: { id: account.id },
        data: {
          status: "NEEDS_REAUTH",
          lastErrorAt: now,
          lastErrorCode: "CREDENTIALS_UNREADABLE",
          lastErrorMessage: errorSummary,
        },
      }),
    ]);

    revalidateSyncViews();
    redirect(redirectTo ?? "/sync?preflightFailed=1");
  }

  await db.$transaction([
    db.syncJob.create({
      data: {
        syncAccountId: account.id,
        status: "QUEUED",
        trigger: "MANUAL",
        syncDirection: account.syncDirection,
        attemptCount: 0,
        maxAttempts: 5,
        nextRetryAt: now,
        idempotencyKey: createIdempotencyKey([account.id, "manual", "queue"]),
      },
    }),
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
