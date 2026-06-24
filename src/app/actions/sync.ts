"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "../../../generated/prisma";
import { auth } from "~/server/auth";
import { assertCanCreateSyncAccount, assertCanUseCardDavSync } from "~/server/billing";
import { CardDavPreflightError, discoverCardDavAccount, pushCardDavContact } from "~/server/carddav";
import {
  parseContactDateEntries,
  parseContactPostalAddresses,
  parseContactStringArray,
} from "~/server/contact-portability";
import { db } from "~/server/db";
import { emitEvent } from "~/lib/activity";
import { SYNC_ACCOUNT_ACTIVE_STATUSES } from "~/lib/sync-account-status";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";
import {
  createSyncConnectionId,
  emitSyncConnectionLifecycleEvent,
  reconnectExistingSyncAccount,
  replaceSyncAccountWithNewConnection,
} from "~/server/sync-lineage";
import {
  decryptSyncCredentialPayload,
  encryptSyncCredentialPayload,
  getSyncCredentialEncryptionStatus,
} from "~/server/sync-credentials";
import {
  getCurrentElevationContext,
  issueSyncSettingsElevation,
  requireSyncSettingsElevation,
} from "~/server/sync-elevation";
import {
  buildProviderSupportedContactShadow,
  providerSupportsSignificantDates,
  resolveSyncProviderCapabilityProfile,
  type SyncProviderCapabilityProfile,
} from "~/server/sync-provider-capabilities";

const syncDirectionSchema = z.enum(["TWO_WAY", "IMPORT_ONLY", "EXPORT_ONLY"]);
const conflictPolicySchema = z.enum(["SERVER_WINS", "DEVICE_WINS", "MANUAL"]);
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
  username: z.string().trim().min(1, "Username is required.").max(320),
  password: z.string().min(6, "Password or app password is required.").max(500),
  note: z.string().trim().max(200).optional(),
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

  // P21-07: impersonation sessions are read-only.
  if (session?.impersonatedBy) {
    throw new Error("This is a read-only impersonation session — changes are blocked.");
  }

  return userId;
};

const currentSyncAccountWhere = (userId: string, syncAccountId: string) => ({
  id: syncAccountId,
  userId,
  status: { in: [...SYNC_ACCOUNT_ACTIVE_STATUSES] },
});

const getOptionalString = (formData: FormData, key: string) => {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const revalidateSyncViews = () => {
  revalidatePath("/contacts");
  revalidatePath("/sync");
};

const parseCreateSyncAccountInput = (formData: FormData) => {
  const parsed = createSyncAccountSchema.safeParse({
    label: formData.get("label"),
    baseUrl: formData.get("baseUrl"),
    principalUrl: getOptionalString(formData, "principalUrl"),
    addressBookUrl: getOptionalString(formData, "addressBookUrl"),
    syncDirection: formData.get("syncDirection"),
    username: formData.get("username"),
    password: formData.get("password"),
    note: getOptionalString(formData, "note"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid sync account details.");
  }

  return parsed.data;
};

const parseChoiceResolution = (formData: FormData) => {
  const resolution = formData.get("matchResolution");
  const matchedSyncAccountId = formData.get("matchedSyncAccountId");

  return {
    resolution:
      resolution === "reconnect" || resolution === "replace" ? resolution : null,
    matchedSyncAccountId:
      typeof matchedSyncAccountId === "string" && matchedSyncAccountId.trim().length > 0
        ? matchedSyncAccountId.trim()
        : null,
  };
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

const isCredentialValidationFailure = (errorCode: string) =>
  errorCode === "CARDDAV_AUTH_FAILED" ||
  errorCode === "CREDENTIALS_MISSING" ||
  errorCode === "CREDENTIALS_UNREADABLE" ||
  errorCode === "CREDENTIALS_REVOKED";

const isConnectionValidationFailure = (errorCode: string) =>
  isCredentialValidationFailure(errorCode) ||
  errorCode === "CARDDAV_DISCOVERY_EMPTY" ||
  errorCode === "CARDDAV_ADDRESSBOOK_NOT_FOUND" ||
  errorCode === "CARDDAV_ADDRESSBOOK_INVALID" ||
  errorCode === "CARDDAV_ACCOUNT_ID_MISSING" ||
  errorCode === "CARDDAV_NOT_FOUND";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseValueEntries = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (
          typeof entry !== "object" ||
          entry === null ||
          typeof (entry as { value?: unknown }).value !== "string"
        ) {
          return [];
        }

        return [
          {
            label:
              typeof (entry as { label?: unknown }).label === "string"
                ? (entry as { label: string }).label
                : "Other",
            value: (entry as { value: string }).value,
            isPrimary: (entry as { isPrimary?: unknown }).isPrimary === true,
          },
        ];
      })
    : [];

const parseAddressEntries = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (
          typeof entry !== "object" ||
          entry === null ||
          typeof (entry as { formatted?: unknown }).formatted !== "string"
        ) {
          return [];
        }

        return [
          {
            label:
              typeof (entry as { label?: unknown }).label === "string"
                ? (entry as { label: string }).label
                : "Other",
            formatted: (entry as { formatted: string }).formatted,
            isPrimary: (entry as { isPrimary?: unknown }).isPrimary === true,
            ...(typeof (entry as { countryOrRegion?: unknown }).countryOrRegion === "string"
              ? { countryOrRegion: (entry as { countryOrRegion: string }).countryOrRegion }
              : {}),
            ...(typeof (entry as { streetLine1?: unknown }).streetLine1 === "string"
              ? { streetLine1: (entry as { streetLine1: string }).streetLine1 }
              : {}),
            ...(typeof (entry as { streetLine2?: unknown }).streetLine2 === "string"
              ? { streetLine2: (entry as { streetLine2: string }).streetLine2 }
              : {}),
            ...(typeof (entry as { cityOrTown?: unknown }).cityOrTown === "string"
              ? { cityOrTown: (entry as { cityOrTown: string }).cityOrTown }
              : {}),
            ...(typeof (entry as { stateOrProvince?: unknown }).stateOrProvince === "string"
              ? { stateOrProvince: (entry as { stateOrProvince: string }).stateOrProvince }
              : {}),
            ...(typeof (entry as { postcode?: unknown }).postcode === "string"
              ? { postcode: (entry as { postcode: string }).postcode }
              : {}),
            ...(typeof (entry as { poBox?: unknown }).poBox === "string"
              ? { poBox: (entry as { poBox: string }).poBox }
              : {}),
          },
        ];
      })
    : [];

const toPortableSyncContact = (contact: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  namePrefix?: string | null;
  nameSuffix?: string | null;
  fullName: string;
  nickname: string | null;
  email: string | null;
  emailAddresses: unknown;
  emailEntries?: unknown;
  phone: string | null;
  phoneNumbers: unknown;
  phoneEntries?: unknown;
  company: string | null;
  department?: string | null;
  jobTitle: string | null;
  website: string | null;
  websiteEntries?: unknown;
  birthday: string | null;
  significantDates?: unknown;
  address: string | null;
  postalAddresses: unknown;
  addressEntries?: unknown;
  notes: string | null;
}) => ({
  fullName: contact.fullName,
  firstName: contact.firstName,
  middleName: contact.middleName,
  lastName: contact.lastName,
  namePrefix: contact.namePrefix,
  nameSuffix: contact.nameSuffix,
  nickname: contact.nickname,
  email: contact.email,
  emailAddresses: parseContactStringArray(contact.emailAddresses),
  emailEntries: parseValueEntries(contact.emailEntries),
  phone: contact.phone,
  phoneNumbers: parseContactStringArray(contact.phoneNumbers),
  phoneEntries: parseValueEntries(contact.phoneEntries),
  company: contact.company,
  department: contact.department,
  jobTitle: contact.jobTitle,
  website: contact.website,
  websiteEntries: parseValueEntries(contact.websiteEntries),
  birthday: contact.birthday,
  significantDates: parseContactDateEntries(contact.significantDates),
  address: contact.address,
  postalAddresses: parseContactPostalAddresses(contact.postalAddresses),
  addressEntries: parseAddressEntries(contact.addressEntries),
  notes: contact.notes,
});

const buildContactWriteDataFromRemoteSnapshot = (
  snapshot: unknown,
  profile: SyncProviderCapabilityProfile,
) => {
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

  const writeData = {
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
    department: typeof snapshot.department === "string" ? snapshot.department : null,
    jobTitle: typeof snapshot.jobTitle === "string" ? snapshot.jobTitle : null,
    website: typeof snapshot.website === "string" ? snapshot.website : null,
    websiteEntries: Array.isArray(snapshot.websiteEntries) ? snapshot.websiteEntries : undefined,
    birthday: typeof snapshot.birthday === "string" ? snapshot.birthday : null,
    address: typeof snapshot.address === "string" ? snapshot.address : null,
    postalAddresses: Array.isArray(snapshot.postalAddresses) ? snapshot.postalAddresses : undefined,
    addressEntries: Array.isArray(snapshot.addressEntries) ? snapshot.addressEntries : undefined,
    notes: typeof snapshot.notes === "string" ? snapshot.notes : null,
  };

  if (providerSupportsSignificantDates(profile)) {
    return {
      ...writeData,
      significantDates: Array.isArray(snapshot.significantDates)
        ? snapshot.significantDates
        : undefined,
    };
  }

  return writeData;
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
  const significantDates = mergeUniqueObjects(
    getSnapshotObjectList(localSnapshot, "significantDates"),
    getSnapshotObjectList(remoteSnapshot, "significantDates"),
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
    department:
      getSnapshotStringValue(localSnapshot, "department") ??
      getSnapshotStringValue(remoteSnapshot, "department"),
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
    significantDates: significantDates.length > 0 ? significantDates : undefined,
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
  accountStatus: "ACTIVE" | "PAUSED" | "NEEDS_REAUTH" | "ERROR" | "DISCONNECTED" | "RETIRED";
  errorCode: string;
  errorSummary: string;
}) => {
  const now = new Date();
  const nextStatus =
    isCredentialValidationFailure(errorCode)
      ? "NEEDS_REAUTH"
      : accountStatus === "PAUSED" ||
          accountStatus === "DISCONNECTED" ||
          accountStatus === "RETIRED"
        ? accountStatus
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
        credentialLastValidatedAt: isCredentialValidationFailure(errorCode) ? null : undefined,
        connectionValidatedAt: isConnectionValidationFailure(errorCode) ? null : undefined,
        lastErrorAt: now,
        lastErrorCode: errorCode,
        lastErrorMessage: errorSummary,
      },
    }),
  ]);
};

export const createSyncAccount = async (
  _prev: SyncFormState,
  formData: FormData,
): Promise<SyncFormState> => {
  let input: ReturnType<typeof parseCreateSyncAccountInput>;
  try {
    const userId = await getRequiredUserId();
    input = parseCreateSyncAccountInput(formData);
    const choice = parseChoiceResolution(formData);

    await assertCanCreateSyncAccount(userId);
    await assertCanUseCardDavSync(userId);

    const encryptionStatus = getSyncCredentialEncryptionStatus();
    if (!encryptionStatus.available) {
      return {
        ok: false,
        error:
          "Credential encryption is not configured. Set SYNC_CREDENTIAL_ENCRYPTION_KEY or AUTH_SECRET first.",
      };
    }

    const encrypted = encryptSyncCredentialPayload({
      username: input.username,
      password: input.password,
      note: input.note,
      provider: "CARDDAV",
      version: 1,
    });

    let discovery: Awaited<ReturnType<typeof discoverCardDavAccount>>;
    try {
      discovery = await discoverCardDavAccount({
        baseUrl: input.baseUrl,
        principalUrl: input.principalUrl,
        addressBookUrl: input.addressBookUrl,
        credentials: { username: input.username, password: input.password },
      });
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "CardDAV connection validation failed before Kontax could save the account.",
      };
    }

    const now = new Date();
    // P34H-01: when this add-account attempt matches a previously disconnected
    // CardDAV connection, surface that match to the UI instead of silently
    // reconnecting it.
    const disconnected = await db.syncAccount.findFirst({
      where: { userId, baseUrl: input.baseUrl, label: input.label, status: "DISCONNECTED" },
      select: {
        id: true,
        connectionId: true,
        label: true,
        provider: true,
        disconnectedAt: true,
        lastSucceededAt: true,
      },
    });
    if (disconnected) {
      const connectionId = disconnected.connectionId ?? createSyncConnectionId();
      if (!disconnected.connectionId) {
        await db.syncAccount.update({
          where: { id: disconnected.id },
          data: { connectionId },
        });
      }

      const match: SyncReconnectMatch = {
        syncAccountId: disconnected.id,
        connectionId,
        label: disconnected.label,
        provider: disconnected.provider,
        disconnectedAt: disconnected.disconnectedAt?.toISOString() ?? null,
        lastSucceededAt: disconnected.lastSucceededAt?.toISOString() ?? null,
      };

      if (!choice.resolution || choice.matchedSyncAccountId !== disconnected.id) {
        return {
          ok: false,
          error: null,
          requiresChoice: true,
          match,
        };
      }

      if (choice.resolution === "reconnect") {
        await reconnectExistingSyncAccount({
          client: db,
          userId,
          syncAccountId: disconnected.id,
          actor: "USER",
          data: {
            principalUrl: discovery.principalUrl,
            addressBookUrl: discovery.addressBookUrl,
            addressBookDisplayName: discovery.addressBookDisplayName,
            remoteAccountId: discovery.remoteAccountId,
            remoteCTag: discovery.remoteCTag,
            syncDirection: input.syncDirection,
            credentialReference: encrypted.credentialReference,
            credentialUpdatedAt: now,
            credentialLastValidatedAt: now,
            encryptionKeyRef: encrypted.encryptionKeyRef,
            connectionValidatedAt: now,
          },
        });
        revalidateSyncViews();
        return {
          ok: true,
          error: null,
          accountId: disconnected.id,
          requiresChoice: false,
          match: null,
        };
      }

      const replacementAccountId = await db.$transaction(async (tx) => {
        const { replacement } = await replaceSyncAccountWithNewConnection({
          client: tx,
          userId,
          syncAccountId: disconnected.id,
          actor: "USER",
          newAccountData: {
            label: input.label,
            baseUrl: input.baseUrl,
            principalUrl: discovery.principalUrl,
            addressBookUrl: discovery.addressBookUrl,
            addressBookDisplayName: discovery.addressBookDisplayName,
            remoteAccountId: discovery.remoteAccountId,
            remoteCTag: discovery.remoteCTag,
            lastSyncCursor: discovery.remoteCTag,
            syncDirection: input.syncDirection,
            credentialReference: encrypted.credentialReference,
            credentialVersion: 1,
            credentialUpdatedAt: now,
            credentialLastValidatedAt: now,
            credentialRevokedAt: null,
            encryptionKeyRef: encrypted.encryptionKeyRef,
            connectionValidatedAt: now,
            status: "ACTIVE",
            lastSucceededAt: now,
            lastErrorAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        });

        await tx.syncJob.create({
          data: {
            syncAccountId: replacement.id,
            status: "SUCCEEDED",
            trigger: "MANUAL",
            syncDirection: input.syncDirection,
            attemptCount: 1,
            maxAttempts: 5,
            cursorAfter: discovery.remoteCTag,
            startedAt: now,
            completedAt: now,
            idempotencyKey: createIdempotencyKey([replacement.id, "manual", "replace"]),
            errorSummary: `Replacement connection validated against ${discovery.addressBookDisplayName ?? "the CardDAV address book"}.`,
          },
        });

        return replacement.id;
      });

      revalidateSyncViews();
      return {
        ok: true,
        error: null,
        accountId: replacementAccountId,
        requiresChoice: false,
        match: null,
      };
    }
    let accountId: string;
    try {
      accountId = await db.$transaction(async (tx) => {
        const syncAccount = await tx.syncAccount.create({
          data: {
            userId,
            connectionId: createSyncConnectionId(),
            label: input.label,
            baseUrl: input.baseUrl,
            principalUrl: discovery.principalUrl,
            addressBookUrl: discovery.addressBookUrl,
            addressBookDisplayName: discovery.addressBookDisplayName,
            remoteAccountId: discovery.remoteAccountId,
            remoteCTag: discovery.remoteCTag,
            lastSyncCursor: discovery.remoteCTag,
            syncDirection: input.syncDirection,
            credentialReference: encrypted.credentialReference,
            credentialVersion: 1,
            credentialUpdatedAt: now,
            credentialLastValidatedAt: now,
            credentialRevokedAt: null,
            encryptionKeyRef: encrypted.encryptionKeyRef,
            connectionValidatedAt: now,
            status: "ACTIVE",
            lastSucceededAt: now,
            lastErrorAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        });

        await tx.syncJob.create({
          data: {
            syncAccountId: syncAccount.id,
            status: "SUCCEEDED",
            trigger: "MANUAL",
            syncDirection: input.syncDirection,
            attemptCount: 1,
            maxAttempts: 5,
            cursorAfter: discovery.remoteCTag,
            startedAt: now,
            completedAt: now,
            idempotencyKey: createIdempotencyKey([syncAccount.id, "manual", "connect"]),
            errorSummary: `Connection validated against ${discovery.addressBookDisplayName ?? "the CardDAV address book"}.`,
          },
        });

        await emitSyncConnectionLifecycleEvent(tx, {
          userId,
          eventType: "SYNC_CONNECTION_CONNECTED",
          actor: "USER",
          seed: {
            syncAccountId: syncAccount.id,
            connectionId: syncAccount.connectionId!,
            provider: syncAccount.provider,
            label: syncAccount.label,
          },
        });

        return syncAccount.id;
      });
    } catch (error) {
      const duplicate =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      return {
        ok: false,
        error: duplicate
          ? "A sync account with this label and base URL already exists. Update the existing connection instead."
          : error instanceof Error
            ? error.message
            : "Kontax could not save the validated CardDAV connection.",
      };
    }

    revalidateSyncViews();
    return { ok: true, error: null, accountId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not add the sync account.",
    };
  }
};

export const activateSyncAccount = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const syncAccountId = parseSyncAccountId(formData);

  await assertCanUseCardDavSync(userId);

  await db.syncAccount.updateMany({
    where: currentSyncAccountWhere(userId, syncAccountId),
    data: {
      status: "ACTIVE",
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });

  // No redirect() — a server-action redirect re-runs middleware via a cookieless
  // internal sub-request and bounces the user to /login (see queueSyncJob).
  // Re-render in place; revalidate reflects the new ACTIVE status.
  revalidateSyncViews();
};

export type SyncReconnectMatch = {
  syncAccountId: string;
  connectionId: string;
  label: string;
  provider: "CARDDAV" | "GOOGLE" | "MICROSOFT";
  disconnectedAt: string | null;
  lastSucceededAt: string | null;
};

// Result type for the add/edit CardDAV forms. These use useActionState + client
// navigation instead of a server redirect(), which behind the reverse proxy
// re-runs middleware via a cookieless sub-request and logs the user out.
export type SyncFormState = {
  ok: boolean;
  error: string | null;
  accountId?: string;
  requiresChoice?: boolean;
  match?: SyncReconnectMatch | null;
};

export const attachSyncCredentials = async (
  _prev: SyncFormState,
  formData: FormData,
): Promise<SyncFormState> => {
  try {
    const userId = await getRequiredUserId();
    const input = parseAttachSyncCredentialInput(formData);

    await assertCanUseCardDavSync(userId);

    const encryptionStatus = getSyncCredentialEncryptionStatus();
    if (!encryptionStatus.available) {
      return {
        ok: false,
        error:
          "Credential encryption is not configured. Set SYNC_CREDENTIAL_ENCRYPTION_KEY or AUTH_SECRET first.",
      };
    }

    const syncAccount = await db.syncAccount.findFirst({
      where: currentSyncAccountWhere(userId, input.syncAccountId),
      select: { id: true, status: true },
    });
    if (!syncAccount) {
      return { ok: false, error: "Sync account not found." };
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
        credentialVersion: { increment: 1 },
        credentialUpdatedAt: new Date(),
        credentialLastValidatedAt: null,
        credentialRevokedAt: null,
        encryptionKeyRef: encrypted.encryptionKeyRef,
        connectionValidatedAt: null,
        status: "PAUSED",
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });

    revalidateSyncViews();
    return { ok: true, error: null, accountId: syncAccount.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save credentials.",
    };
  }
};

export const revokeSyncCredentials = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const syncAccountId = parseSyncAccountId(formData);

  await assertCanUseCardDavSync(userId);

  await db.syncAccount.updateMany({
    where: currentSyncAccountWhere(userId, syncAccountId),
    data: {
      credentialReference: null,
      credentialVersion: {
        increment: 1,
      },
      credentialRevokedAt: new Date(),
      credentialLastValidatedAt: null,
      encryptionKeyRef: null,
      connectionValidatedAt: null,
      status: "NEEDS_REAUTH",
      lastErrorAt: new Date(),
      lastErrorCode: "CREDENTIALS_REVOKED",
      lastErrorMessage:
        "Stored CardDAV credentials were revoked. Add fresh encrypted credentials before running sync again.",
    },
  });

  // No redirect() — a server-action redirect re-runs middleware via a cookieless
  // internal sub-request and bounces the user to /login (see queueSyncJob).
  revalidateSyncViews();
};

export const prepareSyncRelink = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const syncAccountId = parseSyncAccountId(formData);

  await assertCanUseCardDavSync(userId);

  const account = await db.syncAccount.findFirst({
    where: currentSyncAccountWhere(userId, syncAccountId),
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
        connectionValidatedAt: null,
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

  // No redirect() — see queueSyncJob (avoids the cookieless-middleware logout).
  revalidateSyncViews();
};

export const pauseSyncAccount = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const syncAccountId = parseSyncAccountId(formData);

  await db.syncAccount.updateMany({
    where: currentSyncAccountWhere(userId, syncAccountId),
    data: {
      status: "PAUSED",
    },
  });

  // No redirect() — a server-action redirect re-runs middleware via a cookieless
  // internal sub-request and bounces the user to /login (see queueSyncJob).
  // Re-render in place; revalidate reflects the new PAUSED status.
  revalidateSyncViews();
};

export const revalidateSyncAccount = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const syncAccountId = parseSyncAccountId(formData);

  await assertCanUseCardDavSync(userId);

  const account = await db.syncAccount.findFirst({
    where: currentSyncAccountWhere(userId, syncAccountId),
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
      credentialUpdatedAt: true,
      credentialLastValidatedAt: true,
      credentialRevokedAt: true,
      connectionValidatedAt: true,
    },
  });

  if (!account) {
    throw new Error("Sync account not found.");
  }

  const now = new Date();

  if (!account.credentialReference || account.credentialRevokedAt) {
    const errorSummary = account.credentialRevokedAt
      ? "Stored CardDAV credentials were revoked. Add fresh encrypted credentials before revalidating this connection."
      : "Encrypted CardDAV credentials are not attached to this sync account yet.";

    await recordFailedPreflight({
      accountId: account.id,
      syncDirection: account.syncDirection,
      accountStatus: account.status,
      errorCode: "CREDENTIALS_MISSING",
      errorSummary,
    });

    // No redirect() — see queueSyncJob (avoids the cookieless-middleware logout).
    revalidateSyncViews();
    return;
  }

  let decryptedCredentials: ReturnType<typeof decryptSyncCredentialPayload>;

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

    // No redirect() — see queueSyncJob (avoids the cookieless-middleware logout).
    revalidateSyncViews();
    return;
  }

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
          idempotencyKey: createIdempotencyKey([account.id, "manual", "revalidate"]),
          errorSummary: `Connection revalidated against ${discovery.addressBookDisplayName ?? "the CardDAV address book"}.`,
        },
      }),
      db.syncAccount.update({
        where: { id: account.id },
        data: {
          status: account.status === "PAUSED" ? "PAUSED" : "ACTIVE",
          principalUrl: discovery.principalUrl,
          addressBookUrl: discovery.addressBookUrl,
          addressBookDisplayName: discovery.addressBookDisplayName,
          remoteAccountId: discovery.remoteAccountId,
          remoteCTag: discovery.remoteCTag,
          lastSyncCursor: discovery.remoteCTag,
          credentialLastValidatedAt: now,
          connectionValidatedAt: now,
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
        : "CardDAV revalidation failed before Kontax could refresh the connection state.";

    await recordFailedPreflight({
      accountId: account.id,
      syncDirection: account.syncDirection,
      accountStatus: account.status,
      errorCode,
      errorSummary,
    });

    // No redirect() — see queueSyncJob (avoids the cookieless-middleware logout).
    revalidateSyncViews();
    return;
  }

  revalidateSyncViews();
};

export const queueSyncJob = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const syncAccountId = parseSyncAccountId(formData);

  const account = await db.syncAccount.findFirst({
    where: currentSyncAccountWhere(userId, syncAccountId),
    select: {
      id: true,
      provider: true,
      status: true,
      syncDirection: true,
      baseUrl: true,
      principalUrl: true,
      addressBookUrl: true,
      remoteAccountId: true,
      remoteCTag: true,
      credentialReference: true,
      credentialUpdatedAt: true,
      credentialLastValidatedAt: true,
      credentialRevokedAt: true,
      connectionValidatedAt: true,
    },
  });

  if (!account) {
    throw new Error("Sync account not found.");
  }

  // Google and Microsoft accounts use OAuth — skip the CardDAV preflight
  // (credential format is different; discovery is not applicable).
  if (account.provider === "GOOGLE" || account.provider === "MICROSOFT") {
    await db.syncAccount.update({
      where: { id: account.id },
      data: {
        status: account.status === "PAUSED" ? "PAUSED" : "ACTIVE",
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
    await db.syncJob.create({
      data: {
        syncAccountId: account.id,
        status: "QUEUED",
        trigger: "MANUAL",
        syncDirection: account.syncDirection,
        attemptCount: 1,
        maxAttempts: 5,
        nextRetryAt: new Date(),
        idempotencyKey: createIdempotencyKey([account.id, "manual", "queue"]),
      },
    });
    // Run the queued job inline so "Sync now" actually imports immediately,
    // rather than leaving the job QUEUED until a background runner picks it up
    // (there is no scheduled runner yet — see follow-up). Scoped to this account.
    // Dynamic import keeps the googleapis/MSAL graph server-only (this file is
    // imported by the client sync page).
    try {
      const { runQueuedSyncJobs } = await import("~/server/sync-runner");
      await runQueuedSyncJobs({ syncAccountId: account.id, limit: 1 });
    } catch (error) {
      // The job stays QUEUED/recorded with its error; surface nothing fatal to
      // the action so the page still re-renders with the latest account state.
      console.error("[sync] inline run failed", error);
    }

    // NOTE: do NOT redirect() here. A server-action redirect() makes Next.js
    // re-run middleware for the target URL via an internal sub-request that
    // carries NO cookies, so the cookie-presence gate in middleware.ts bounces
    // it to /login — logging the user out on every sync action behind the
    // reverse proxy. Returning lets the form re-render in place using this
    // request's own (authenticated) context. revalidateSyncViews() refreshes
    // the job list + imported contacts.
    revalidateSyncViews();
    return;
  }

  await assertCanUseCardDavSync(userId);

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

    // No redirect() — see the note above (avoids the cookieless-middleware logout).
    revalidateSyncViews();
    return;
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

    // No redirect() — see the note above (avoids the cookieless-middleware logout).
    revalidateSyncViews();
    return;
  }

  const needsCredentialValidation =
    !account.credentialLastValidatedAt ||
    (account.credentialUpdatedAt != null &&
      account.credentialLastValidatedAt.getTime() < account.credentialUpdatedAt.getTime());

  const needsDiscovery =
    !account.remoteAccountId ||
    !account.principalUrl ||
    !account.addressBookUrl ||
    !account.connectionValidatedAt;

  if ((needsDiscovery || needsCredentialValidation) && decryptedCredentials) {
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
            addressBookDisplayName: discovery.addressBookDisplayName,
            remoteAccountId: discovery.remoteAccountId,
            remoteCTag: discovery.remoteCTag,
            lastSyncCursor: discovery.remoteCTag,
            credentialLastValidatedAt: now,
            connectionValidatedAt: now,
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
      return;
    }

    revalidateSyncViews();
    return;
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

  // Run the queued job inline so "Sync now" imports/pushes immediately (matches
  // the Google/Microsoft branch). Dynamic import keeps the heavy runner graph
  // server-only. No redirect() — see the note above.
  try {
    const { runQueuedSyncJobs } = await import("~/server/sync-runner");
    await runQueuedSyncJobs({ syncAccountId: account.id, limit: 1 });
  } catch (error) {
    console.error("[sync] inline CardDAV run failed", error);
  }

  revalidateSyncViews();
};

export const retrySyncJob = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const syncJobId = parseSyncJobId(formData);

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

  // No redirect() — see queueSyncJob (avoids the cookieless-middleware logout).
  revalidateSyncViews();
};

export const resolveSyncConflict = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const input = parseSyncConflictResolution(formData);

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
          provider: true,
          baseUrl: true,
          label: true,
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
          emailEntries: true,
          phone: true,
          phoneNumbers: true,
          phoneEntries: true,
          company: true,
          department: true,
          jobTitle: true,
          website: true,
          websiteEntries: true,
          birthday: true,
          significantDates: true,
          address: true,
          postalAddresses: true,
          addressEntries: true,
          notes: true,
        },
      },
    },
  });

  if (!conflict) {
    throw new Error("Sync conflict not found.");
  }

  // Conflict resolution here applies to outbound CardDAV-sync conflicts, which
  // always have a linked sync account. Inbound device-write conflicts (P9-08)
  // have no sync account and are not resolvable through this action.
  if (!conflict.syncAccount || !conflict.syncAccountId) {
    throw new Error("This sync conflict is not linked to a sync account and cannot be resolved here.");
  }
  const syncAccount = conflict.syncAccount;
  const conflictSyncAccountId = conflict.syncAccountId;
  const capabilityProfile = resolveSyncProviderCapabilityProfile({
    provider: syncAccount.provider,
    baseUrl: syncAccount.baseUrl,
    addressBookUrl: syncAccount.addressBookUrl,
    label: syncAccount.label,
  });

  const resolvedAt = new Date();

  if (input.resolutionStrategy === "KEEP_LOCAL") {
    if (
      !conflict.contact ||
      !syncAccount.addressBookUrl ||
      !syncAccount.credentialReference
    ) {
      throw new Error(
        "This conflict cannot keep the local version because the sync account or contact is incomplete.",
      );
    }

    const credentials = decryptSyncCredentialPayload(syncAccount.credentialReference);
    const pushed = await pushCardDavContact({
      addressBookUrl: syncAccount.addressBookUrl,
      credentials: {
        username: credentials.username,
        password: credentials.password,
      },
      remoteUid: conflict.syncContactLink?.remoteUid ?? conflict.contact.syncUid,
      contact: toPortableSyncContact(conflict.contact),
    });

    if (conflict.syncContactLinkId) {
      const localShadow = buildProviderSupportedContactShadow(
        toPortableSyncContact(conflict.contact),
        capabilityProfile,
      );
      await db.syncContactLink.update({
        where: { id: conflict.syncContactLinkId },
        data: {
          remoteHref: pushed.href,
          remoteUid: conflict.syncContactLink?.remoteUid ?? conflict.contact.syncUid,
          remoteETag: pushed.etag,
          capabilityProfileId: capabilityProfile.id,
          supportedFieldShadow: localShadow as Prisma.InputJsonValue,
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
        ...buildContactWriteDataFromRemoteSnapshot(
          conflict.remoteSnapshot,
          capabilityProfile,
        ),
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
          capabilityProfileId: capabilityProfile.id,
          supportedFieldShadow: buildProviderSupportedContactShadow(
            buildContactWriteDataFromRemoteSnapshot(
              conflict.remoteSnapshot,
              capabilityProfile,
            ),
            capabilityProfile,
          ) as Prisma.InputJsonValue,
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
        significantDates: parseContactDateEntries(conflict.contact.significantDates),
        address: conflict.contact.address,
        postalAddresses: parseContactPostalAddresses(conflict.contact.postalAddresses),
        notes: conflict.contact.notes,
      },
    });

    if (conflict.contactId) {
      await db.contact.update({
        where: { id: conflict.contactId },
        data: {
          ...buildContactWriteDataFromRemoteSnapshot(
            conflict.remoteSnapshot,
            capabilityProfile,
          ),
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
          capabilityProfileId: capabilityProfile.id,
          supportedFieldShadow: buildProviderSupportedContactShadow(
            buildContactWriteDataFromRemoteSnapshot(
              conflict.remoteSnapshot,
              capabilityProfile,
            ),
            capabilityProfile,
          ) as Prisma.InputJsonValue,
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
      !syncAccount.addressBookUrl ||
      !syncAccount.credentialReference
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
        fullName: mergedWriteData.fullName,
        firstName: mergedWriteData.firstName,
        middleName: mergedWriteData.middleName,
        lastName: mergedWriteData.lastName,
        namePrefix: mergedWriteData.namePrefix,
        nameSuffix: mergedWriteData.nameSuffix,
        nickname: mergedWriteData.nickname,
        email: mergedWriteData.email,
        emailAddresses: mergedWriteData.emailAddresses,
        emailEntries: mergedWriteData.emailEntries as Prisma.InputJsonValue | undefined,
        phone: mergedWriteData.phone,
        phoneNumbers: mergedWriteData.phoneNumbers,
        phoneEntries: mergedWriteData.phoneEntries as Prisma.InputJsonValue | undefined,
        company: mergedWriteData.company,
        department: mergedWriteData.department,
        jobTitle: mergedWriteData.jobTitle,
        website: mergedWriteData.website,
        websiteEntries: mergedWriteData.websiteEntries as Prisma.InputJsonValue | undefined,
        birthday: mergedWriteData.birthday,
        significantDates: mergedWriteData.significantDates as Prisma.InputJsonValue | undefined,
        address: mergedWriteData.address,
        postalAddresses: mergedWriteData.postalAddresses as Prisma.InputJsonValue | undefined,
        addressEntries: mergedWriteData.addressEntries as Prisma.InputJsonValue | undefined,
        notes: mergedWriteData.notes,
        syncVersion: {
          increment: 1,
        },
      },
    });

    const credentials = decryptSyncCredentialPayload(syncAccount.credentialReference);
    const pushed = await pushCardDavContact({
      addressBookUrl: syncAccount.addressBookUrl,
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
        department: mergedWriteData.department ?? null,
        jobTitle: mergedWriteData.jobTitle ?? null,
        website: mergedWriteData.website ?? null,
        birthday: mergedWriteData.birthday ?? null,
        significantDates: parseContactDateEntries(mergedWriteData.significantDates ?? []),
        address: mergedWriteData.address ?? null,
        postalAddresses: parseContactPostalAddresses(mergedWriteData.postalAddresses ?? []),
        notes: mergedWriteData.notes ?? null,
      },
    });

    if (conflict.syncContactLinkId) {
      const mergedShadow = buildProviderSupportedContactShadow(
        {
          fullName: mergedWriteData.fullName,
          firstName: mergedWriteData.firstName ?? null,
          middleName: mergedWriteData.middleName ?? null,
          lastName: mergedWriteData.lastName ?? null,
          namePrefix: mergedWriteData.namePrefix ?? null,
          nameSuffix: mergedWriteData.nameSuffix ?? null,
          nickname: mergedWriteData.nickname ?? null,
          email: mergedWriteData.email ?? null,
          emailAddresses: mergedWriteData.emailAddresses ?? [],
          emailEntries: parseValueEntries(mergedWriteData.emailEntries ?? []),
          phone: mergedWriteData.phone ?? null,
          phoneNumbers: mergedWriteData.phoneNumbers ?? [],
          phoneEntries: parseValueEntries(mergedWriteData.phoneEntries ?? []),
          company: mergedWriteData.company ?? null,
          department: mergedWriteData.department ?? null,
          jobTitle: mergedWriteData.jobTitle ?? null,
          website: mergedWriteData.website ?? null,
          websiteEntries: parseValueEntries(mergedWriteData.websiteEntries ?? []),
          birthday: mergedWriteData.birthday ?? null,
          significantDates: parseContactDateEntries(mergedWriteData.significantDates ?? []),
          address: mergedWriteData.address ?? null,
          postalAddresses: parseContactPostalAddresses(mergedWriteData.postalAddresses ?? []),
          addressEntries: parseAddressEntries(mergedWriteData.addressEntries ?? []),
          notes: mergedWriteData.notes ?? null,
        },
        capabilityProfile,
      );
      await db.syncContactLink.update({
        where: { id: conflict.syncContactLinkId },
        data: {
          remoteHref: pushed.href,
          remoteUid: conflict.syncContactLink?.remoteUid ?? conflict.contact.syncUid,
          remoteETag: pushed.etag,
          capabilityProfileId: capabilityProfile.id,
          supportedFieldShadow: mergedShadow as Prisma.InputJsonValue,
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

  await emitEvent(db, {
    userId,
    contactId: conflict.contactId,
    eventType: "SYNC_CONFLICT_RESOLVED",
    actor: "USER",
    payload: { conflictId: conflict.id, resolutionStrategy: input.resolutionStrategy },
  });

  const remainingOpenConflicts = await db.syncConflict.count({
    where: {
      syncAccountId: conflictSyncAccountId,
      status: "OPEN",
    },
  });

  if (remainingOpenConflicts === 0) {
    await db.syncAccount.update({
      where: { id: conflictSyncAccountId },
      data: {
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
  }

  // No redirect() — see queueSyncJob (avoids the cookieless-middleware logout).
  revalidateSyncViews();
};

export const disconnectSyncAccount = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const syncAccountId = parseSyncAccountId(formData);

  // P27-07: revoke OAuth authorisation before deleting the account (best-effort —
  // a revoke failure must not block disconnect).
  const account = await db.syncAccount.findFirst({
    where: currentSyncAccountWhere(userId, syncAccountId),
    select: { id: true, provider: true, credentialReference: true, connectionId: true, label: true },
  });
  // Dynamic import keeps the googleapis/MSAL dependency graph server-only — a
  // static import would drag it into this "use server" file's client reference
  // graph (it's imported by the sync page client) and break the action module.
  if (account?.provider === "GOOGLE") {
    const { revokeGoogleToken } = await import("~/server/google-sync");
    await revokeGoogleToken(account);
  } else if (account?.provider === "MICROSOFT") {
    const { revokeMicrosoftToken } = await import("~/server/microsoft-sync");
    await revokeMicrosoftToken(account);
  }

  // P36-DB03: soft disconnect — revoke credentials and hide the connection, but
  // retain its settings, contact links, and history so re-adding the same remote
  // (matched by email / baseUrl+label) restores it cleanly without duplicating
  // contacts. Cancel any pending jobs so the runner doesn't pick them up.
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.syncJob.deleteMany({
      where: { syncAccountId, status: { in: ["QUEUED", "RUNNING"] } },
    });

    const updated = await tx.syncAccount.updateMany({
      where: currentSyncAccountWhere(userId, syncAccountId),
      data: {
        status: "DISCONNECTED",
        disconnectedAt: now,
        credentialRevokedAt: now,
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });

    if (updated.count > 0 && account?.connectionId) {
      await emitSyncConnectionLifecycleEvent(tx, {
        userId,
        eventType: "SYNC_CONNECTION_DISCONNECTED",
        actor: "USER",
        seed: {
          syncAccountId: account.id,
          connectionId: account.connectionId,
          provider: account.provider,
          label: account.label,
        },
      });
    }
  });

  // No redirect() — see queueSyncJob: a server-action redirect re-runs middleware
  // via a cookieless internal sub-request and bounces the user to /login. The
  // account is now hidden from the active rail, so revalidate lets the list
  // re-render in place (the detail panel falls back to the empty state).
  revalidateSyncViews();
};

// P23-06: confirm the user's password to gain a 15-minute "sudo" elevation for
// editing sync settings. Returns { elevated } so the re-auth modal can react.
export const confirmSyncSettingsPassword = async (
  password: string,
): Promise<{ elevated: boolean; error?: string }> => {
  const context = await getCurrentElevationContext();
  if (!context) {
    return { elevated: false, error: "You must be signed in." };
  }

  const rl = await checkRateLimit(rateLimiters.syncSettingsElevation, `user:${context.userId}`);
  if (!rl.allowed) {
    return { elevated: false, error: "Too many attempts. Try again in a few minutes." };
  }

  const user = await db.user.findUnique({
    where: { id: context.userId },
    select: { password: true },
  });
  if (!user) {
    return { elevated: false, error: "You must be signed in." };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { elevated: false };
  }

  await issueSyncSettingsElevation(context.userId, context.jti);
  return { elevated: true };
};

// P23-02: update per-connection advanced settings (SyncAccountSettings, P23-01).
// Object-input action consumed directly by the connection settings drawer so the
// client can do an optimistic update and revert on the returned error. Note:
// `syncFrequencyMinutes` uses the P23-01 convention — null = platform default,
// 0 = "Manual only", otherwise a positive minute count.
const updateSyncAccountSettingsSchema = z.object({
  syncAccountId: z.string().min(1, "Sync account id is required."),
  syncDirection: syncDirectionSchema.optional(),
  conflictPolicy: conflictPolicySchema.optional(),
  syncFrequencyMinutes: z.number().int().min(0).max(100_000).nullable().optional(),
  // P36 — advanced settings.
  importLabelId: z.string().min(1).nullable().optional(),
  maxDeletionsThreshold: z.number().int().min(1).max(9999).nullable().optional(),
  notifyOnFailure: z.boolean().optional(),
  // Sync window: local hour 0–23, or null for no restriction. Both or neither.
  syncWindowStart: z.number().int().min(0).max(23).nullable().optional(),
  syncWindowEnd: z.number().int().min(0).max(23).nullable().optional(),
  excludedFields: z.array(z.string().min(1)).max(32).optional(),
  exportLabelFilter: z.array(z.string().min(1)).max(64).optional(),
  // 0 = never auto-pause; null = platform default (5).
  maxAttemptsBeforePause: z.number().int().min(0).max(100).nullable().optional(),
});

export type UpdateSyncAccountSettingsInput = z.infer<typeof updateSyncAccountSettingsSchema>;

export const updateSyncAccountSettings = async (
  input: UpdateSyncAccountSettingsInput,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  let userId: string;
  try {
    userId = await getRequiredUserId();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Not signed in." };
  }

  const parsed = updateSyncAccountSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }
  const {
    syncAccountId,
    syncDirection,
    conflictPolicy,
    syncFrequencyMinutes,
    importLabelId,
    maxDeletionsThreshold,
    notifyOnFailure,
    syncWindowStart,
    syncWindowEnd,
    excludedFields,
    exportLabelFilter,
    maxAttemptsBeforePause,
  } = parsed.data;

  // A sync window needs both bounds or neither — reject a half-open range.
  if ((syncWindowStart == null) !== (syncWindowEnd == null)) {
    return { ok: false, error: "Set both a start and end hour for the sync window, or neither." };
  }
  if (syncWindowStart != null && syncWindowStart === syncWindowEnd) {
    return { ok: false, error: "The sync window start and end hours must be different." };
  }

  // P23-06: require a valid re-auth elevation before changing settings.
  const elevation = await requireSyncSettingsElevation();
  if (!elevation.ok) return elevation;

  // Verify ownership before touching anything. Select the fields P23-04 needs to
  // decide whether a direction change should trigger a catch-up re-sync, plus the
  // previous setting values for the P23-06 audit diff.
  const account = await db.syncAccount.findFirst({
    where: currentSyncAccountWhere(userId, syncAccountId),
    select: {
      id: true,
      provider: true,
      baseUrl: true,
      label: true,
      status: true,
      syncDirection: true,
      addressBookUrl: true,
      remoteCTag: true,
      remoteAccountId: true,
      credentialReference: true,
      credentialRevokedAt: true,
      settings: {
        select: {
          conflictPolicy: true,
          syncFrequencyMinutes: true,
          importLabelId: true,
          maxDeletionsThreshold: true,
          notifyOnFailure: true,
          syncWindowStart: true,
          syncWindowEnd: true,
          excludedFields: true,
          exportLabelFilter: true,
          maxAttemptsBeforePause: true,
        },
      },
    },
  });
  if (!account) {
    return { ok: false, error: "Sync account not found." };
  }

  // P36: a non-null import label must belong to the same user.
  if (importLabelId) {
    const label = await db.label.findFirst({
      where: { id: importLabelId, userId },
      select: { id: true },
    });
    if (!label) {
      return { ok: false, error: "That label could not be found." };
    }
  }

  // P23-04: a change to a pulling direction (TWO_WAY / IMPORT_ONLY) may need to
  // catch up on remote contacts skipped while the connection was EXPORT_ONLY.
  const directionChanged = syncDirection != null && syncDirection !== account.syncDirection;
  // P23-05: switching the conflict policy away from MANUAL should clear the
  // existing review queue by auto-resolving open conflicts under the new policy.
  const prevPolicy = account.settings?.conflictPolicy ?? "SERVER_WINS";
  const leavingManual =
    conflictPolicy != null && conflictPolicy !== "MANUAL" && prevPolicy === "MANUAL";
  const capabilityProfile = resolveSyncProviderCapabilityProfile({
    provider: account.provider,
    baseUrl: account.baseUrl,
    addressBookUrl: account.addressBookUrl,
    label: account.label,
  });

  // Only include fields the caller actually sent (all are optional patches). The
  // same object seeds both the create and update branches of the upsert, so it
  // holds plain scalars/arrays only (no field-update-operation wrappers).
  const settingsPatch = {
    ...(syncDirection ? { syncDirection } : {}),
    ...(conflictPolicy ? { conflictPolicy } : {}),
    ...(syncFrequencyMinutes !== undefined ? { syncFrequencyMinutes } : {}),
    ...(importLabelId !== undefined ? { importLabelId } : {}),
    ...(maxDeletionsThreshold !== undefined ? { maxDeletionsThreshold } : {}),
    ...(notifyOnFailure !== undefined ? { notifyOnFailure } : {}),
    ...(syncWindowStart !== undefined ? { syncWindowStart } : {}),
    ...(syncWindowEnd !== undefined ? { syncWindowEnd } : {}),
    ...(excludedFields !== undefined ? { excludedFields } : {}),
    ...(exportLabelFilter !== undefined ? { exportLabelFilter } : {}),
    ...(maxAttemptsBeforePause !== undefined ? { maxAttemptsBeforePause } : {}),
  };

  await db.$transaction(async (tx) => {
    await tx.syncAccountSettings.upsert({
      where: { syncAccountId },
      create: { syncAccountId, ...settingsPatch },
      update: settingsPatch,
    });

    // P23-01 reconcile: direction also lives on SyncAccount (copied onto each
    // SyncJob and read by the engine). Keep the two in sync until the engine
    // reads direction from settings directly.
    if (syncDirection) {
      await tx.syncAccount.update({
        where: { id: syncAccountId },
        data: { syncDirection },
      });
    }

    // P23-04: on a direction change, queue a re-sync so the new direction applies
    // on the next cycle and catches up any previously-skipped pulls. Only enqueue
    // for pulling directions on a syncable account — EXPORT_ONLY has nothing to
    // pull and is not yet runnable in the live CardDAV slice, so queuing it would
    // just produce an immediate failure.
    const syncable =
      account.status === "ACTIVE" &&
      !!account.credentialReference &&
      !account.credentialRevokedAt &&
      !!account.addressBookUrl;

    if (directionChanged && syncDirection !== "EXPORT_ONLY" && syncable) {
      await tx.syncJob.create({
        data: {
          syncAccountId,
          status: "QUEUED",
          trigger: "MANUAL",
          syncDirection,
          attemptCount: 1,
          maxAttempts: 5,
          nextRetryAt: new Date(),
          cursorBefore: account.remoteCTag ?? account.remoteAccountId ?? account.addressBookUrl,
          idempotencyKey: createIdempotencyKey([syncAccountId, "direction", syncDirection]),
        },
      });
    }
  });

  // P23-05: clear the manual review queue when leaving the MANUAL policy. For
  // SERVER_WINS, apply each remote snapshot over the local contact; for
  // DEVICE_WINS, keep the local version. Either way the row becomes AUTO_RESOLVED.
  if (leavingManual && conflictPolicy != null) {
    const openConflicts = await db.syncConflict.findMany({
      where: { syncAccountId, status: "OPEN", contactId: { not: null } },
      select: {
        id: true,
        contactId: true,
        remoteETag: true,
        remoteSnapshot: true,
        syncContactLinkId: true,
      },
    });
    const resolvedAt = new Date();
    const strategy = conflictPolicy === "SERVER_WINS" ? "KEEP_REMOTE" : "KEEP_LOCAL";

    for (const conflict of openConflicts) {
      if (conflictPolicy === "SERVER_WINS" && conflict.contactId && conflict.remoteSnapshot) {
        try {
          await db.contact.update({
            where: { id: conflict.contactId },
            data: {
              ...buildContactWriteDataFromRemoteSnapshot(
                conflict.remoteSnapshot,
                capabilityProfile,
              ),
              syncVersion: { increment: 1 },
            },
          });
          if (conflict.syncContactLinkId) {
            await db.syncContactLink.update({
              where: { id: conflict.syncContactLinkId },
              data: {
                remoteETag: conflict.remoteETag,
                capabilityProfileId: capabilityProfile.id,
                supportedFieldShadow: buildProviderSupportedContactShadow(
                  buildContactWriteDataFromRemoteSnapshot(
                    conflict.remoteSnapshot,
                    capabilityProfile,
                  ),
                  capabilityProfile,
                ) as Prisma.InputJsonValue,
                lastSyncedAt: resolvedAt,
              },
            });
          }
        } catch {
          // Snapshot may be incomplete (e.g. a delete conflict); still mark the
          // row resolved so it leaves the queue rather than blocking forever.
        }
      }

      await db.syncConflict.update({
        where: { id: conflict.id },
        data: {
          status: "AUTO_RESOLVED",
          resolutionStrategy: strategy,
          resolvedAt,
          resolutionNotes: `Auto-resolved when the conflict policy changed to ${conflictPolicy}.`,
        },
      });
    }

    // Resolving the queue may bring the account back under the auto-pause limit.
    if (account.status === "PAUSED") {
      await db.syncAccount.updateMany({
        where: { id: syncAccountId, status: "PAUSED", lastErrorCode: "SYNC_CONFLICT_QUEUE_FULL" },
        data: { status: "ACTIVE", lastErrorCode: null, lastErrorMessage: null, lastErrorAt: null },
      });
    }
  }

  // P23-06: audit the change. Record a field diff for each setting that moved.
  const prevFreq = account.settings?.syncFrequencyMinutes ?? null;
  const changes: Array<{ field: string; before: unknown; after: unknown }> = [];
  if (syncDirection && syncDirection !== account.syncDirection) {
    changes.push({ field: "syncDirection", before: account.syncDirection, after: syncDirection });
  }
  if (conflictPolicy && conflictPolicy !== prevPolicy) {
    changes.push({ field: "conflictPolicy", before: prevPolicy, after: conflictPolicy });
  }
  if (syncFrequencyMinutes !== undefined && syncFrequencyMinutes !== prevFreq) {
    changes.push({ field: "syncFrequencyMinutes", before: prevFreq, after: syncFrequencyMinutes });
  }
  // P36 advanced fields: record a diff for each that actually moved. Arrays are
  // compared by JSON since order is meaningful and lengths are small.
  const prev = account.settings;
  const diffScalar = (field: string, before: unknown, after: unknown) => {
    if (after !== undefined && after !== (before ?? null)) {
      changes.push({ field, before: before ?? null, after });
    }
  };
  const diffArray = (field: string, before: string[] | undefined, after: string[] | undefined) => {
    if (after !== undefined && JSON.stringify(before ?? []) !== JSON.stringify(after)) {
      changes.push({ field, before: before ?? [], after });
    }
  };
  diffScalar("importLabelId", prev?.importLabelId, importLabelId);
  diffScalar("maxDeletionsThreshold", prev?.maxDeletionsThreshold, maxDeletionsThreshold);
  diffScalar("notifyOnFailure", prev?.notifyOnFailure, notifyOnFailure);
  diffScalar("syncWindowStart", prev?.syncWindowStart, syncWindowStart);
  diffScalar("syncWindowEnd", prev?.syncWindowEnd, syncWindowEnd);
  diffScalar("maxAttemptsBeforePause", prev?.maxAttemptsBeforePause, maxAttemptsBeforePause);
  diffArray("excludedFields", prev?.excludedFields, excludedFields);
  diffArray("exportLabelFilter", prev?.exportLabelFilter, exportLabelFilter);
  if (changes.length > 0) {
    await emitEvent(db, {
      userId,
      eventType: "SYNC_SETTINGS_CHANGED",
      actor: "USER",
      payload: { syncAccountId, changes },
    });
  }

  revalidateSyncViews();
  return { ok: true };
};

// P36-DB02: confirm initial setup for a freshly-connected account. Applies the
// chosen settings (no re-auth gate — the user just connected and authenticated),
// stamps setupCompletedAt, and queues the held first sync. Only operates while
// setup is pending (setupCompletedAt null), so it cannot be used to bypass the
// elevation gate that protects edits on an already-set-up connection.
export const completeSyncSetup = async (
  input: UpdateSyncAccountSettingsInput,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  let userId: string;
  try {
    userId = await getRequiredUserId();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Not signed in." };
  }

  const parsed = updateSyncAccountSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }
  const {
    syncAccountId,
    syncDirection,
    conflictPolicy,
    syncFrequencyMinutes,
    importLabelId,
    maxDeletionsThreshold,
    notifyOnFailure,
    syncWindowStart,
    syncWindowEnd,
    excludedFields,
    exportLabelFilter,
    maxAttemptsBeforePause,
  } = parsed.data;

  if ((syncWindowStart == null) !== (syncWindowEnd == null)) {
    return { ok: false, error: "Set both a start and end hour for the sync window, or neither." };
  }
  if (syncWindowStart != null && syncWindowStart === syncWindowEnd) {
    return { ok: false, error: "The sync window start and end hours must be different." };
  }

  const account = await db.syncAccount.findFirst({
    where: currentSyncAccountWhere(userId, syncAccountId),
    select: {
      id: true,
      status: true,
      setupCompletedAt: true,
      syncDirection: true,
      addressBookUrl: true,
      remoteCTag: true,
      remoteAccountId: true,
      credentialReference: true,
      credentialRevokedAt: true,
    },
  });
  if (!account) {
    return { ok: false, error: "Sync account not found." };
  }
  // Idempotent: a double-submit / reload after setup is a no-op.
  if (account.setupCompletedAt) {
    revalidateSyncViews();
    return { ok: true };
  }

  if (importLabelId) {
    const label = await db.label.findFirst({ where: { id: importLabelId, userId }, select: { id: true } });
    if (!label) {
      return { ok: false, error: "That label could not be found." };
    }
  }

  const settingsPatch = {
    ...(syncDirection ? { syncDirection } : {}),
    ...(conflictPolicy ? { conflictPolicy } : {}),
    ...(syncFrequencyMinutes !== undefined ? { syncFrequencyMinutes } : {}),
    ...(importLabelId !== undefined ? { importLabelId } : {}),
    ...(maxDeletionsThreshold !== undefined ? { maxDeletionsThreshold } : {}),
    ...(notifyOnFailure !== undefined ? { notifyOnFailure } : {}),
    ...(syncWindowStart !== undefined ? { syncWindowStart } : {}),
    ...(syncWindowEnd !== undefined ? { syncWindowEnd } : {}),
    ...(excludedFields !== undefined ? { excludedFields } : {}),
    ...(exportLabelFilter !== undefined ? { exportLabelFilter } : {}),
    ...(maxAttemptsBeforePause !== undefined ? { maxAttemptsBeforePause } : {}),
  };

  const now = new Date();
  const effectiveDir = syncDirection ?? account.syncDirection;
  const syncable =
    account.status === "ACTIVE" && !!account.credentialReference && !account.credentialRevokedAt;

  await db.$transaction(async (tx) => {
    await tx.syncAccountSettings.upsert({
      where: { syncAccountId },
      create: { syncAccountId, ...settingsPatch },
      update: settingsPatch,
    });
    await tx.syncAccount.update({
      where: { id: syncAccountId },
      data: { setupCompletedAt: now, ...(syncDirection ? { syncDirection } : {}) },
    });
    // Queue the held first sync. EXPORT_ONLY has nothing to pull and isn't runnable
    // in the live slice yet, so skip it (mirrors updateSyncAccountSettings).
    if (syncable && effectiveDir !== "EXPORT_ONLY") {
      await tx.syncJob.create({
        data: {
          syncAccountId,
          status: "QUEUED",
          trigger: "MANUAL",
          syncDirection: effectiveDir,
          attemptCount: 1,
          maxAttempts: 5,
          nextRetryAt: now,
          cursorBefore: account.remoteCTag ?? account.remoteAccountId ?? account.addressBookUrl,
          idempotencyKey: createIdempotencyKey([syncAccountId, "setup", String(now.getTime())]),
        },
      });
    }
  });

  await emitEvent(db, {
    userId,
    eventType: "SYNC_SETTINGS_CHANGED",
    actor: "USER",
    payload: {
      syncAccountId,
      changes: [{ field: "setupCompletedAt", before: null, after: now.toISOString() }],
    },
  });

  revalidateSyncViews();
  return { ok: true };
};

// P23-03: persist the remote address-book allowlist for a connection. Empty array
// = sync all discovered books (default). The sync engine honors the allowlist by
// skipping this account's book when the list is non-empty and excludes it
// (see sync-runner). Re-scope archiving of contacts from excluded books is not
// implemented: the engine syncs a single book per account and contacts do not
// track a per-book source, so there is nothing to selectively archive yet.
const updateBookAllowlistSchema = z.object({
  syncAccountId: z.string().min(1, "Sync account id is required."),
  allowlist: z.array(z.string().trim().url()).max(200),
});

export type UpdateBookAllowlistInput = z.infer<typeof updateBookAllowlistSchema>;

export const updateBookAllowlist = async (
  input: UpdateBookAllowlistInput,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  let userId: string;
  try {
    userId = await getRequiredUserId();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Not signed in." };
  }

  const parsed = updateBookAllowlistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid book selection." };
  }
  const { syncAccountId, allowlist } = parsed.data;

  // P23-06: require a valid re-auth elevation before changing settings.
  const elevation = await requireSyncSettingsElevation();
  if (!elevation.ok) return elevation;

  const account = await db.syncAccount.findFirst({
    where: currentSyncAccountWhere(userId, syncAccountId),
    select: { id: true, settings: { select: { bookAllowlist: true } } },
  });
  if (!account) {
    return { ok: false, error: "Sync account not found." };
  }

  // Deduplicate before persisting.
  const unique = Array.from(new Set(allowlist));
  const prevAllowlist = account.settings?.bookAllowlist ?? [];

  await db.syncAccountSettings.upsert({
    where: { syncAccountId },
    create: { syncAccountId, bookAllowlist: unique },
    update: { bookAllowlist: unique },
  });

  // P23-06: audit the allowlist change when the set actually changed.
  const changed =
    prevAllowlist.length !== unique.length ||
    [...prevAllowlist].sort().join("\n") !== [...unique].sort().join("\n");
  if (changed) {
    await emitEvent(db, {
      userId,
      eventType: "SYNC_SETTINGS_CHANGED",
      actor: "USER",
      payload: {
        syncAccountId,
        changes: [{ field: "bookAllowlist", before: prevAllowlist, after: unique }],
      },
    });
  }

  revalidateSyncViews();
  return { ok: true };
};
