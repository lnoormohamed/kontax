import { createId } from "@paralleldrive/cuid2";
import type {
  Actor,
  EventType,
  Prisma,
  PrismaClient,
  SyncAccountStatus,
  SyncProvider,
} from "../../generated/prisma";

import { emitEvent } from "~/lib/activity";
import { db } from "~/server/db";

export const createSyncConnectionId = (): string => createId();

export const SYNC_ACCOUNT_RETIRED_REASON_REPLACED = "REPLACED_BY_NEW_CONNECTION";

type SyncLifecycleWriter =
  | Pick<PrismaClient, "syncAccount" | "activityEvent">
  | Prisma.TransactionClient;

type SyncConnectionLifecycleEventType = Extract<
  EventType,
  | "SYNC_CONNECTION_CONNECTED"
  | "SYNC_CONNECTION_RECONNECTED"
  | "SYNC_CONNECTION_DISCONNECTED"
  | "SYNC_CONNECTION_RETIRED"
  | "SYNC_CONNECTION_REPLACED"
>;

type SyncConnectionLifecycleSeed = {
  syncAccountId: string;
  connectionId: string;
  provider: SyncProvider;
  label: string;
  replacesSyncAccountId?: string | null;
  replacedBySyncAccountId?: string | null;
  retirementReason?: string | null;
};

type ReconnectExistingSyncAccountArgs = {
  client: SyncLifecycleWriter;
  userId: string;
  syncAccountId: string;
  actor: Actor;
  actorDetail?: string | null;
  data: Prisma.SyncAccountUncheckedUpdateInput;
};

type ReplaceSyncAccountWithNewConnectionArgs = {
  client: SyncLifecycleWriter;
  userId: string;
  syncAccountId: string;
  actor: Actor;
  actorDetail?: string | null;
  newAccountData: Omit<
    Prisma.SyncAccountUncheckedCreateInput,
    "id" | "userId" | "connectionId" | "replacesSyncAccountId" | "replacedBySyncAccountId"
  >;
};

type SyncLineageInvariantSubject = {
  id: string;
  connectionId: string | null;
  status: SyncAccountStatus;
  disconnectedAt: Date | null;
  retiredAt: Date | null;
  retiredReason: string | null;
  replacesSyncAccountId: string | null;
  replacedBySyncAccountId: string | null;
  replacesSyncAccount?: {
    id: string;
    replacedBySyncAccountId: string | null;
  } | null;
  replacedBySyncAccount?: {
    id: string;
    replacesSyncAccountId: string | null;
  } | null;
};

export type SyncLineageInvariantIssue = {
  code: string;
  message: string;
};

const selectLifecycleAccount = {
  id: true,
  connectionId: true,
  provider: true,
  label: true,
  status: true,
  replacesSyncAccountId: true,
  replacedBySyncAccountId: true,
} satisfies Prisma.SyncAccountSelect;

const createRetiredSyncAccountLabel = (label: string, syncAccountId: string) =>
  `${label} (retired ${syncAccountId.slice(0, 8)})`;

export const buildSyncConnectionLifecyclePayload = (
  seed: SyncConnectionLifecycleSeed,
) => ({
  syncAccountId: seed.syncAccountId,
  connectionId: seed.connectionId,
  provider: seed.provider,
  label: seed.label,
  replacesSyncAccountId: seed.replacesSyncAccountId ?? undefined,
  replacedBySyncAccountId: seed.replacedBySyncAccountId ?? undefined,
  retirementReason: seed.retirementReason ?? undefined,
});

export const emitSyncConnectionLifecycleEvent = async (
  client: SyncLifecycleWriter,
  {
    userId,
    eventType,
    actor,
    actorDetail,
    seed,
  }: {
    userId: string;
    eventType: SyncConnectionLifecycleEventType;
    actor: Actor;
    actorDetail?: string | null;
    seed: SyncConnectionLifecycleSeed;
  },
) =>
  emitEvent(client, {
    userId,
    eventType,
    actor,
    actorDetail,
    payload: buildSyncConnectionLifecyclePayload(seed),
  });

export const reconnectExistingSyncAccount = async ({
  client,
  userId,
  syncAccountId,
  actor,
  actorDetail,
  data,
}: ReconnectExistingSyncAccountArgs) => {
  const existing = await client.syncAccount.findFirst({
    where: { id: syncAccountId, userId },
    select: selectLifecycleAccount,
  });

  if (!existing) {
    throw new Error("Sync account not found.");
  }
  if (existing.status === "RETIRED") {
    throw new Error("Retired sync accounts cannot be reconnected.");
  }

  const reconnected = await client.syncAccount.update({
    where: { id: existing.id },
    data: {
      ...data,
      connectionId: existing.connectionId ?? createSyncConnectionId(),
      status: "ACTIVE",
      disconnectedAt: null,
      credentialRevokedAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
    select: selectLifecycleAccount,
  });

  await emitSyncConnectionLifecycleEvent(client, {
    userId,
    eventType: "SYNC_CONNECTION_RECONNECTED",
    actor,
    actorDetail,
    seed: {
      syncAccountId: reconnected.id,
      connectionId: reconnected.connectionId!,
      provider: reconnected.provider,
      label: reconnected.label,
      replacesSyncAccountId: reconnected.replacesSyncAccountId,
      replacedBySyncAccountId: reconnected.replacedBySyncAccountId,
    },
  });

  return reconnected;
};

export const replaceSyncAccountWithNewConnection = async ({
  client,
  userId,
  syncAccountId,
  actor,
  actorDetail,
  newAccountData,
}: ReplaceSyncAccountWithNewConnectionArgs) => {
  const existing = await client.syncAccount.findFirst({
    where: { id: syncAccountId, userId },
    select: selectLifecycleAccount,
  });

  if (!existing) {
    throw new Error("Sync account not found.");
  }
  if (existing.status === "RETIRED") {
    throw new Error("Retired sync accounts cannot be replaced again.");
  }

  const now = new Date();
  const retiredLabel = createRetiredSyncAccountLabel(existing.label, existing.id);
  const retiredConnectionId = existing.connectionId ?? createSyncConnectionId();

  await client.syncAccount.update({
    where: { id: existing.id },
    data: {
      connectionId: retiredConnectionId,
      label: retiredLabel,
      status: "RETIRED",
      retiredAt: now,
      retiredReason: SYNC_ACCOUNT_RETIRED_REASON_REPLACED,
    },
  });

  const replacement = await client.syncAccount.create({
    data: {
      ...newAccountData,
      userId,
      connectionId: createSyncConnectionId(),
      replacesSyncAccountId: existing.id,
    },
    select: selectLifecycleAccount,
  });

  await client.syncAccount.update({
    where: { id: existing.id },
    data: { replacedBySyncAccountId: replacement.id },
  });

  await emitSyncConnectionLifecycleEvent(client, {
    userId,
    eventType: "SYNC_CONNECTION_RETIRED",
    actor,
    actorDetail,
    seed: {
      syncAccountId: existing.id,
      connectionId: retiredConnectionId,
      provider: existing.provider,
      label: existing.label,
      replacedBySyncAccountId: replacement.id,
      retirementReason: SYNC_ACCOUNT_RETIRED_REASON_REPLACED,
    },
  });

  await emitSyncConnectionLifecycleEvent(client, {
    userId,
    eventType: "SYNC_CONNECTION_REPLACED",
    actor,
    actorDetail,
    seed: {
      syncAccountId: replacement.id,
      connectionId: replacement.connectionId!,
      provider: replacement.provider,
      label: replacement.label,
      replacesSyncAccountId: existing.id,
    },
  });

  return {
    retiredSyncAccountId: existing.id,
    replacement,
  };
};

export const getSyncLineageInvariantIssues = (
  account: SyncLineageInvariantSubject,
): SyncLineageInvariantIssue[] => {
  const issues: SyncLineageInvariantIssue[] = [];

  if (!account.connectionId?.trim()) {
    issues.push({
      code: "MISSING_CONNECTION_ID",
      message: "Sync account is missing its stable connectionId.",
    });
  }

  if (account.status === "RETIRED" && !account.retiredAt) {
    issues.push({
      code: "RETIRED_MISSING_TIMESTAMP",
      message: "Retired sync account is missing retiredAt.",
    });
  }

  if (account.replacesSyncAccountId && account.replacesSyncAccount?.replacedBySyncAccountId !== account.id) {
    issues.push({
      code: "REPLACES_LINK_NOT_BIDIRECTIONAL",
      message:
        "replacesSyncAccountId is set, but the parent row does not point back via replacedBySyncAccountId.",
    });
  }

  if (account.replacedBySyncAccountId && account.replacedBySyncAccount?.replacesSyncAccountId !== account.id) {
    issues.push({
      code: "REPLACED_BY_LINK_NOT_BIDIRECTIONAL",
      message:
        "replacedBySyncAccountId is set, but the child row does not point back via replacesSyncAccountId.",
    });
  }

  if (
    account.status === "RETIRED" &&
    !account.replacedBySyncAccountId &&
    account.retiredReason === SYNC_ACCOUNT_RETIRED_REASON_REPLACED
  ) {
    issues.push({
      code: "RETIRED_REPLACEMENT_MISSING_CHILD",
      message: "Retired sync account says it was replaced, but no replacement child is linked.",
    });
  }

  return issues;
};

/**
 * Backfill a stable logical connection id for legacy sync-account rows created
 * before Phase 34G landed. Idempotent: rows that already have a connectionId
 * are skipped, and re-running only fills the remaining gaps.
 */
export const backfillSyncAccountConnectionIds = async (): Promise<number> => {
  const accounts = await db.syncAccount.findMany({
    where: { connectionId: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (accounts.length === 0) return 0;

  let updated = 0;
  for (const account of accounts) {
    const result = await db.syncAccount.updateMany({
      where: { id: account.id, connectionId: null },
      data: { connectionId: createSyncConnectionId() },
    });
    updated += result.count;
  }

  return updated;
};
