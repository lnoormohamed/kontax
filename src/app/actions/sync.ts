"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "~/server/auth";
import { assertCanCreateSyncAccount, assertCanUseCardDavSync } from "~/server/billing";
import { CardDavPreflightError, discoverCardDavAccount, pushCardDavContact } from "~/server/carddav";
import { parseContactPostalAddresses, parseContactStringArray } from "~/server/contact-portability";
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toPortableSyncContact = (contact: {
  fullName: string;
  nickname: string | null;
  email: string | null;
  emailAddresses: unknown;
  phone: string | null;
  phoneNumbers: unknown;
  company: string | null;
  jobTitle: string | null;
  website: string | null;
  birthday: string | null;
  address: string | null;
  postalAddresses: unknown;
  notes: string | null;
}) => ({
  fullName: contact.fullName,
  nickname: contact.nickname,
  email: contact.email,
  emailAddresses: parseContactStringArray(contact.emailAddresses),
  phone: contact.phone,
  phoneNumbers: parseContactStringArray(contact.phoneNumbers),
  company: contact.company,
  jobTitle: contact.jobTitle,
  website: contact.website,
  birthday: contact.birthday,
  address: contact.address,
  postalAddresses: parseContactPostalAddresses(contact.postalAddresses),
  notes: contact.notes,
});

const buildContactWriteDataFromRemoteSnapshot = (snapshot: unknown) => {
  if (!isRecord(snapshot)) {
    throw new Error("Remote sync snapshot is missing or invalid.");
  }

  const fullName = typeof snapshot.fullName === "string" ? snapshot.fullName.trim() : "";

  if (!fullName) {
    throw new Error("Remote sync snapshot does not contain a valid contact name.");
  }

  const emailAddresses = Array.isArray(snapshot.emailAddresses)
    ? snapshot.emailAddresses.filter((value): value is string => typeof value === "string")
    : [];
  const phoneNumbers = Array.isArray(snapshot.phoneNumbers)
    ? snapshot.phoneNumbers.filter((value): value is string => typeof value === "string")
    : [];

  return {
    fullName,
    firstName: typeof snapshot.firstName === "string" ? snapshot.firstName : null,
    middleName: typeof snapshot.middleName === "string" ? snapshot.middleName : null,
    lastName: typeof snapshot.lastName === "string" ? snapshot.lastName : null,
    namePrefix: typeof snapshot.namePrefix === "string" ? snapshot.namePrefix : null,
    nameSuffix: typeof snapshot.nameSuffix === "string" ? snapshot.nameSuffix : null,
    nickname: typeof snapshot.nickname === "string" ? snapshot.nickname : null,
    email: emailAddresses[0] ?? (typeof snapshot.email === "string" ? snapshot.email : null),
    emailAddresses: emailAddresses.length > 0 ? emailAddresses : undefined,
    emailEntries: Array.isArray(snapshot.emailEntries) ? snapshot.emailEntries : undefined,
    phone: phoneNumbers[0] ?? (typeof snapshot.phone === "string" ? snapshot.phone : null),
    phoneNumbers: phoneNumbers.length > 0 ? phoneNumbers : undefined,
    phoneEntries: Array.isArray(snapshot.phoneEntries) ? snapshot.phoneEntries : undefined,
    company: typeof snapshot.company === "string" ? snapshot.company : null,
    jobTitle: typeof snapshot.jobTitle === "string" ? snapshot.jobTitle : null,
    website: typeof snapshot.website === "string" ? snapshot.website : null,
    websiteEntries: Array.isArray(snapshot.websiteEntries) ? snapshot.websiteEntries : undefined,
    birthday: typeof snapshot.birthday === "string" ? snapshot.birthday : null,
    address: typeof snapshot.address === "string" ? snapshot.address : null,
    postalAddresses: Array.isArray(snapshot.postalAddresses) ? snapshot.postalAddresses : undefined,
    addressEntries: Array.isArray(snapshot.addressEntries) ? snapshot.addressEntries : undefined,
    notes: typeof snapshot.notes === "string" ? snapshot.notes : null,
  };
};

const getSnapshotStringValue = (snapshot: unknown, key: string) => {
  if (!isRecord(snapshot)) {
    return null;
  }

  const value = snapshot[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const getSnapshotStringList = (snapshot: unknown, listKey: string, fallbackKey?: string) => {
  if (!isRecord(snapshot)) {
    return [];
  }

  const listValue = snapshot[listKey];
  const list = Array.isArray(listValue)
    ? listValue.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (list.length > 0) {
    return list;
  }

  if (!fallbackKey) {
    return [];
  }

  const fallback = snapshot[fallbackKey];
  return typeof fallback === "string" && fallback.trim().length > 0 ? [fallback.trim()] : [];
};

const getSnapshotObjectList = (snapshot: unknown, key: string) => {
  if (!isRecord(snapshot)) {
    return [];
  }

  const value = snapshot[key];
  return Array.isArray(value) ? value.filter((item) => isRecord(item)) : [];
};

const mergeUniqueStrings = (...lists: string[][]) => {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const list of lists) {
    for (const item of list) {
      const normalized = item.trim();
      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      values.push(normalized);
    }
  }

  return values;
};

const mergeUniqueObjects = (localValues: Record<string, unknown>[], remoteValues: Record<string, unknown>[]) => {
  const merged = [...localValues];
  const seen = new Set(localValues.map((value) => JSON.stringify(value)));

  for (const value of remoteValues) {
    const key = JSON.stringify(value);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(value);
  }

  return merged;
};

const mergeNotesValue = (localValue: string | null, remoteValue: string | null) => {
  const local = localValue?.trim();
  const remote = remoteValue?.trim();

  if (local && remote && local !== remote) {
    return `${local}\n\nRemote note:\n${remote}`;
  }

  return local ?? remote ?? null;
};

const buildManualMergeWriteData = (localSnapshot: unknown, remoteSnapshot: unknown) => {
  const fullName =
    getSnapshotStringValue(localSnapshot, "fullName") ??
    getSnapshotStringValue(remoteSnapshot, "fullName");

  if (!fullName) {
    throw new Error("Manual merge needs at least one valid contact name.");
  }

  const emailAddresses = mergeUniqueStrings(
    getSnapshotStringList(localSnapshot, "emailAddresses", "email"),
    getSnapshotStringList(remoteSnapshot, "emailAddresses", "email"),
  );
  const phoneNumbers = mergeUniqueStrings(
    getSnapshotStringList(localSnapshot, "phoneNumbers", "phone"),
    getSnapshotStringList(remoteSnapshot, "phoneNumbers", "phone"),
  );
  const postalAddresses = mergeUniqueObjects(
    getSnapshotObjectList(localSnapshot, "postalAddresses"),
    getSnapshotObjectList(remoteSnapshot, "postalAddresses"),
  );

  const emailEntries = mergeUniqueObjects(
    getSnapshotObjectList(localSnapshot, "emailEntries"),
    getSnapshotObjectList(remoteSnapshot, "emailEntries"),
  );
  const phoneEntries = mergeUniqueObjects(
    getSnapshotObjectList(localSnapshot, "phoneEntries"),
    getSnapshotObjectList(remoteSnapshot, "phoneEntries"),
  );
  const websiteEntries = mergeUniqueObjects(
    getSnapshotObjectList(localSnapshot, "websiteEntries"),
    getSnapshotObjectList(remoteSnapshot, "websiteEntries"),
  );
  const addressEntries = mergeUniqueObjects(
    getSnapshotObjectList(localSnapshot, "addressEntries"),
    getSnapshotObjectList(remoteSnapshot, "addressEntries"),
  );

  return {
    fullName,
    firstName:
      getSnapshotStringValue(localSnapshot, "firstName") ??
      getSnapshotStringValue(remoteSnapshot, "firstName"),
    middleName:
      getSnapshotStringValue(localSnapshot, "middleName") ??
      getSnapshotStringValue(remoteSnapshot, "middleName"),
    lastName:
      getSnapshotStringValue(localSnapshot, "lastName") ??
      getSnapshotStringValue(remoteSnapshot, "lastName"),
    namePrefix:
      getSnapshotStringValue(localSnapshot, "namePrefix") ??
      getSnapshotStringValue(remoteSnapshot, "namePrefix"),
    nameSuffix:
      getSnapshotStringValue(localSnapshot, "nameSuffix") ??
      getSnapshotStringValue(remoteSnapshot, "nameSuffix"),
    nickname:
      getSnapshotStringValue(localSnapshot, "nickname") ??
      getSnapshotStringValue(remoteSnapshot, "nickname"),
    email: emailAddresses[0] ?? null,
    emailAddresses: emailAddresses.length > 0 ? emailAddresses : undefined,
    emailEntries: emailEntries.length > 0 ? emailEntries : undefined,
    phone: phoneNumbers[0] ?? null,
    phoneNumbers: phoneNumbers.length > 0 ? phoneNumbers : undefined,
    phoneEntries: phoneEntries.length > 0 ? phoneEntries : undefined,
    company:
      getSnapshotStringValue(localSnapshot, "company") ??
      getSnapshotStringValue(remoteSnapshot, "company"),
    jobTitle:
      getSnapshotStringValue(localSnapshot, "jobTitle") ??
      getSnapshotStringValue(remoteSnapshot, "jobTitle"),
    website:
      getSnapshotStringValue(localSnapshot, "website") ??
      getSnapshotStringValue(remoteSnapshot, "website"),
    websiteEntries: websiteEntries.length > 0 ? websiteEntries : undefined,
    birthday:
      getSnapshotStringValue(localSnapshot, "birthday") ??
      getSnapshotStringValue(remoteSnapshot, "birthday"),
    address:
      getSnapshotStringValue(localSnapshot, "address") ??
      getSnapshotStringValue(remoteSnapshot, "address"),
    postalAddresses: postalAddresses.length > 0 ? postalAddresses : undefined,
    addressEntries: addressEntries.length > 0 ? addressEntries : undefined,
    notes: mergeNotesValue(
      getSnapshotStringValue(localSnapshot, "notes"),
      getSnapshotStringValue(remoteSnapshot, "notes"),
    ),
  };
};

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
      remoteCTag: true,
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

  await db.syncJob.create({
    data: {
      syncAccountId: account.id,
      status: "QUEUED",
      trigger: "MANUAL",
      syncDirection: account.syncDirection,
      attemptCount: 1,
      maxAttempts: 5,
      nextRetryAt: now,
      cursorBefore: account.remoteCTag ?? account.remoteAccountId ?? account.addressBookUrl,
      idempotencyKey: createIdempotencyKey([account.id, "manual", "queue"]),
    },
  });

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
      syncAccountId: true,
      syncContactLinkId: true,
      contactId: true,
      remoteETag: true,
      localSnapshot: true,
      remoteSnapshot: true,
      syncAccount: {
        select: {
          id: true,
          addressBookUrl: true,
          credentialReference: true,
        },
      },
      syncContactLink: {
        select: {
          id: true,
          remoteUid: true,
        },
      },
      contact: {
        select: {
          id: true,
          syncUid: true,
          syncVersion: true,
          fullName: true,
          firstName: true,
          middleName: true,
          lastName: true,
          namePrefix: true,
          nameSuffix: true,
          nickname: true,
          email: true,
          emailAddresses: true,
          phone: true,
          phoneNumbers: true,
          company: true,
          jobTitle: true,
          website: true,
          birthday: true,
          address: true,
          postalAddresses: true,
          notes: true,
        },
      },
    },
  });

  if (!conflict) {
    throw new Error("Sync conflict not found.");
  }

  const resolvedAt = new Date();

  if (input.resolutionStrategy === "KEEP_LOCAL") {
    if (
      !conflict.contact ||
      !conflict.syncAccount.addressBookUrl ||
      !conflict.syncAccount.credentialReference
    ) {
      throw new Error(
        "This conflict cannot keep the local version because the sync account or contact is incomplete.",
      );
    }

    const credentials = decryptSyncCredentialPayload(conflict.syncAccount.credentialReference);
    const pushed = await pushCardDavContact({
      addressBookUrl: conflict.syncAccount.addressBookUrl,
      credentials: {
        username: credentials.username,
        password: credentials.password,
      },
      remoteUid: conflict.syncContactLink?.remoteUid ?? conflict.contact.syncUid,
      contact: toPortableSyncContact(conflict.contact),
    });

    if (conflict.syncContactLinkId) {
      await db.syncContactLink.update({
        where: { id: conflict.syncContactLinkId },
        data: {
          remoteHref: pushed.href,
          remoteUid: conflict.syncContactLink?.remoteUid ?? conflict.contact.syncUid,
          remoteETag: pushed.etag,
          remoteDeletedAt: null,
          tombstonedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastSyncedAt: resolvedAt,
        },
      });
    }
  }

  if (input.resolutionStrategy === "KEEP_REMOTE") {
    if (!conflict.contactId) {
      throw new Error(
        "This conflict cannot keep the remote version because the local contact is missing.",
      );
    }

    await db.contact.update({
      where: { id: conflict.contactId },
      data: {
        ...buildContactWriteDataFromRemoteSnapshot(conflict.remoteSnapshot),
        syncVersion: {
          increment: 1,
        },
      },
    });

    if (conflict.syncContactLinkId) {
      await db.syncContactLink.update({
        where: { id: conflict.syncContactLinkId },
        data: {
          remoteETag: conflict.remoteETag,
          remoteDeletedAt: null,
          tombstonedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastSyncedAt: resolvedAt,
        },
      });
    }
  }

  if (input.resolutionStrategy === "DUPLICATE_LOCAL") {
    if (!conflict.contact) {
      throw new Error(
        "This conflict cannot duplicate the local contact because the current record is missing.",
      );
    }

    await db.contact.create({
      data: {
        userId,
        fullName: conflict.contact.fullName,
        firstName: conflict.contact.firstName,
        middleName: conflict.contact.middleName,
        lastName: conflict.contact.lastName,
        namePrefix: conflict.contact.namePrefix,
        nameSuffix: conflict.contact.nameSuffix,
        nickname: conflict.contact.nickname,
        email: conflict.contact.email,
        emailAddresses: parseContactStringArray(conflict.contact.emailAddresses),
        phone: conflict.contact.phone,
        phoneNumbers: parseContactStringArray(conflict.contact.phoneNumbers),
        company: conflict.contact.company,
        jobTitle: conflict.contact.jobTitle,
        website: conflict.contact.website,
        birthday: conflict.contact.birthday,
        address: conflict.contact.address,
        postalAddresses: parseContactPostalAddresses(conflict.contact.postalAddresses),
        notes: conflict.contact.notes,
      },
    });

    if (conflict.contactId) {
      await db.contact.update({
        where: { id: conflict.contactId },
        data: {
          ...buildContactWriteDataFromRemoteSnapshot(conflict.remoteSnapshot),
          syncVersion: {
            increment: 1,
          },
        },
      });
    }

    if (conflict.syncContactLinkId) {
      await db.syncContactLink.update({
        where: { id: conflict.syncContactLinkId },
        data: {
          remoteETag: conflict.remoteETag,
          remoteDeletedAt: null,
          tombstonedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastSyncedAt: resolvedAt,
        },
      });
    }
  }

  if (input.resolutionStrategy === "ARCHIVE_LOCAL") {
    if (!conflict.contactId) {
      throw new Error(
        "This conflict cannot archive the local contact because it is missing.",
      );
    }

    await db.contact.update({
      where: { id: conflict.contactId },
      data: {
        archivedAt: resolvedAt,
        syncTombstoneAt: resolvedAt,
        syncVersion: {
          increment: 1,
        },
      },
    });

    if (conflict.syncContactLinkId) {
      await db.syncContactLink.update({
        where: { id: conflict.syncContactLinkId },
        data: {
          tombstonedAt: resolvedAt,
          lastSyncedAt: resolvedAt,
        },
      });
    }
  }

  if (input.resolutionStrategy === "MANUAL_MERGE") {
    if (
      !conflict.contactId ||
      !conflict.contact ||
      !conflict.syncAccount.addressBookUrl ||
      !conflict.syncAccount.credentialReference
    ) {
      throw new Error(
        "Manual merge needs an attached local contact plus active remote sync credentials.",
      );
    }

    const mergedWriteData = buildManualMergeWriteData(
      conflict.localSnapshot,
      conflict.remoteSnapshot,
    );

    await db.contact.update({
      where: { id: conflict.contactId },
      data: {
        ...mergedWriteData,
        syncVersion: {
          increment: 1,
        },
      },
    });

    const credentials = decryptSyncCredentialPayload(conflict.syncAccount.credentialReference);
    const pushed = await pushCardDavContact({
      addressBookUrl: conflict.syncAccount.addressBookUrl,
      credentials: {
        username: credentials.username,
        password: credentials.password,
      },
      remoteUid: conflict.syncContactLink?.remoteUid ?? conflict.contact.syncUid,
      contact: {
        fullName: mergedWriteData.fullName,
        nickname: mergedWriteData.nickname ?? null,
        email: mergedWriteData.email ?? null,
        emailAddresses: mergedWriteData.emailAddresses ?? [],
        phone: mergedWriteData.phone ?? null,
        phoneNumbers: mergedWriteData.phoneNumbers ?? [],
        company: mergedWriteData.company ?? null,
        jobTitle: mergedWriteData.jobTitle ?? null,
        website: mergedWriteData.website ?? null,
        birthday: mergedWriteData.birthday ?? null,
        address: mergedWriteData.address ?? null,
        postalAddresses: parseContactPostalAddresses(mergedWriteData.postalAddresses ?? []),
        notes: mergedWriteData.notes ?? null,
      },
    });

    if (conflict.syncContactLinkId) {
      await db.syncContactLink.update({
        where: { id: conflict.syncContactLinkId },
        data: {
          remoteHref: pushed.href,
          remoteUid: conflict.syncContactLink?.remoteUid ?? conflict.contact.syncUid,
          remoteETag: pushed.etag,
          remoteDeletedAt: null,
          tombstonedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastSyncedAt: resolvedAt,
        },
      });
    }
  }

  await db.syncConflict.update({
    where: { id: conflict.id },
    data: {
      status: "RESOLVED",
      resolutionStrategy: input.resolutionStrategy,
      resolutionNotes: input.resolutionNotes,
      resolvedAt,
    },
  });

  const remainingOpenConflicts = await db.syncConflict.count({
    where: {
      syncAccountId: conflict.syncAccountId,
      status: "OPEN",
    },
  });

  if (remainingOpenConflicts === 0) {
    await db.syncAccount.update({
      where: { id: conflict.syncAccountId },
      data: {
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
  }

  revalidateSyncViews();
  redirect(redirectTo);
};
