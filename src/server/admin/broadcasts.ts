import "server-only";

import { createHash } from "node:crypto";

import type {
  AccountLifecycleState,
  AdminBroadcastStatus,
  SubscriptionPlan,
  SyncProvider,
} from "../../../generated/prisma";

import { createNotification } from "~/server/notifications";
import { db } from "~/server/db";

export type BroadcastAudienceFilters = {
  plans: SubscriptionPlan[];
  lifecycleStates: AccountLifecycleState[];
  providers: SyncProvider[];
  featureFlagKeys: string[];
};

const DEFAULT_LIFECYCLE_STATES: AccountLifecycleState[] = ["ACTIVE", "TRIALING", "GRACE"];

function normalizeFilters(filters: Partial<BroadcastAudienceFilters>): BroadcastAudienceFilters {
  return {
    plans: [...new Set((filters.plans ?? []).filter(Boolean))],
    lifecycleStates: [...new Set((filters.lifecycleStates ?? DEFAULT_LIFECYCLE_STATES).filter(Boolean))],
    providers: [...new Set((filters.providers ?? []).filter(Boolean))],
    featureFlagKeys: [...new Set((filters.featureFlagKeys ?? []).map((value) => value.trim()).filter(Boolean))],
  };
}

function effectivePlanForUser(user: {
  subscriptions: Array<{ plan: SubscriptionPlan }>;
}): SubscriptionPlan {
  return user.subscriptions[0]?.plan ?? "FREE";
}

function userMatchesRollout(flagKey: string, userId: string, rolloutPct: number) {
  const h = createHash("sha256").update(`${flagKey}:${userId}`).digest();
  const bucket = h.readUInt32BE(0) % 100;
  return bucket < rolloutPct;
}

export async function resolveBroadcastAudience(filtersInput: Partial<BroadcastAudienceFilters>) {
  const filters = normalizeFilters(filtersInput);
  const featureFlags = filters.featureFlagKeys.length
    ? await db.featureFlag.findMany({
        where: { key: { in: filters.featureFlagKeys } },
        select: {
          key: true,
          mode: true,
          rolloutPct: true,
          allowedUserIds: true,
          killSwitch: true,
          environmentScope: true,
        },
      })
    : [];

  const users = await db.user.findMany({
    where: {
      role: "USER",
      lifecycleState: { in: filters.lifecycleStates },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      lifecycleState: true,
      subscriptions: {
        where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
        orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { plan: true },
      },
      syncAccounts: {
        where: { status: { in: ["ACTIVE", "PAUSED", "NEEDS_REAUTH", "ERROR", "DISCONNECTED"] } },
        select: { provider: true },
      },
    },
  });

  const env = process.env.NODE_ENV ?? "development";
  const matching = users.filter((user) => {
    const plan = effectivePlanForUser(user);
    if (filters.plans.length > 0 && !filters.plans.includes(plan)) return false;

    if (filters.providers.length > 0) {
      const providers = new Set(user.syncAccounts.map((account) => account.provider));
      if (!filters.providers.some((provider) => providers.has(provider))) return false;
    }

    if (featureFlags.length > 0) {
      const matchesAtLeastOneFlag = featureFlags.some((flag) => {
        if (flag.killSwitch) return false;
        if (flag.environmentScope.length > 0 && !flag.environmentScope.includes(env)) return false;
        switch (flag.mode) {
          case "ALL":
            return true;
          case "SPECIFIC_USERS":
            return flag.allowedUserIds.includes(user.id);
          case "ROLLOUT":
            return userMatchesRollout(flag.key, user.id, flag.rolloutPct);
          default:
            return false;
        }
      });
      if (!matchesAtLeastOneFlag) return false;
    }

    return true;
  });

  return {
    filters,
    count: matching.length,
    sample: matching.slice(0, 5).map((user) => user.email),
    userIds: matching.map((user) => user.id),
  };
}

export async function saveAdminBroadcastDraft(input: {
  adminId: string;
  broadcastId?: string | null;
  title: string;
  body: string;
  actionUrl?: string | null;
  filters: Partial<BroadcastAudienceFilters>;
  status: Extract<AdminBroadcastStatus, "DRAFT" | "SCHEDULED">;
  scheduledFor?: Date | null;
}) {
  const audience = await resolveBroadcastAudience(input.filters);
  const payload = {
    title: input.title,
    body: input.body,
    actionUrl: input.actionUrl ?? null,
    status: input.status,
    scheduledFor: input.status === "SCHEDULED" ? input.scheduledFor ?? null : null,
    audienceFilters: audience.filters,
    audienceSummary: { sample: audience.sample },
    previewRecipientCount: audience.count,
  };

  if (input.broadcastId) {
    return db.adminBroadcast.update({
      where: { id: input.broadcastId },
      data: payload,
    });
  }

  return db.adminBroadcast.create({
    data: {
      createdByAdminUserId: input.adminId,
      ...payload,
    },
  });
}

export async function sendAdminBroadcast(input: {
  adminId: string;
  broadcastId: string;
}) {
  const broadcast = await db.adminBroadcast.findUnique({
    where: { id: input.broadcastId },
    select: {
      id: true,
      title: true,
      body: true,
      actionUrl: true,
      status: true,
      audienceFilters: true,
    },
  });
  if (!broadcast) return null;
  if (broadcast.status === "RETRACTED") return null;

  const audience = await resolveBroadcastAudience(
    (broadcast.audienceFilters ?? {}) as Partial<BroadcastAudienceFilters>,
  );

  let deliveredRecipientCount = 0;
  for (const userId of audience.userIds) {
    const created = await createNotification({
      userId,
      category: "PRODUCT_UPDATES",
      title: broadcast.title,
      body: broadcast.body,
      actionUrl: broadcast.actionUrl ?? null,
      adminBroadcastId: broadcast.id,
    });
    if (created) deliveredRecipientCount += 1;
  }

  return db.adminBroadcast.update({
    where: { id: broadcast.id },
    data: {
      status: "SENT",
      sentAt: new Date(),
      sentByAdminUserId: input.adminId,
      deliveredRecipientCount,
      previewRecipientCount: audience.count,
      audienceSummary: { sample: audience.sample },
    },
  });
}

export async function retractAdminBroadcast(input: {
  adminId: string;
  broadcastId: string;
}) {
  const broadcast = await db.adminBroadcast.findUnique({
    where: { id: input.broadcastId },
    select: { id: true, status: true, title: true },
  });
  if (!broadcast || broadcast.status === "RETRACTED") return null;

  await db.notification.updateMany({
    where: { adminBroadcastId: broadcast.id, dismissedAt: null },
    data: { dismissedAt: new Date() },
  });

  return db.adminBroadcast.update({
    where: { id: broadcast.id },
    data: {
      status: "RETRACTED",
      retractedAt: new Date(),
      retractedByAdminUserId: input.adminId,
    },
  });
}

export async function processScheduledAdminBroadcasts(systemAdminId?: string | null, limit = 10) {
  const due = await db.adminBroadcast.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: { lte: new Date() },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
    select: { id: true, createdByAdminUserId: true },
  });

  const processed: string[] = [];
  for (const broadcast of due) {
    await sendAdminBroadcast({
      adminId: systemAdminId ?? broadcast.createdByAdminUserId,
      broadcastId: broadcast.id,
    });
    processed.push(broadcast.id);
  }

  return { processed };
}

export async function listAdminBroadcasts(limit = 12, query = "") {
  const q = query.trim();
  const rows = await db.adminBroadcast.findMany({
    where: q
      ? {
          OR: [
            { id: { contains: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      body: true,
      actionUrl: true,
      status: true,
      scheduledFor: true,
      sentAt: true,
      retractedAt: true,
      previewRecipientCount: true,
      deliveredRecipientCount: true,
      audienceFilters: true,
      creator: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    actionUrl: row.actionUrl,
    status: row.status,
    scheduledFor: row.scheduledFor,
    scheduledForLabel: row.scheduledFor
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "UTC",
        }).format(row.scheduledFor)
      : "—",
    sentAtLabel: row.sentAt
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "UTC",
        }).format(row.sentAt)
      : "—",
    retractedAtLabel: row.retractedAt
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "UTC",
        }).format(row.retractedAt)
      : "—",
    previewRecipientCount: row.previewRecipientCount,
    deliveredRecipientCount: row.deliveredRecipientCount,
    filters: row.audienceFilters as BroadcastAudienceFilters,
    createdBy: row.creator.name?.trim() ?? row.creator.email,
  }));
}
