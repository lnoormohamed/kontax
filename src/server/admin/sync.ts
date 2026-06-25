import "server-only";

import type { Prisma, SyncProvider } from "../../../generated/prisma";

import { db } from "~/server/db";
import { listAdminSupportNotes } from "~/server/admin/support-notes";
import { getSyncLineageInvariantIssues } from "~/server/sync-lineage";
import {
  getConsecutiveFailureStreak,
  getSyncAccountOperationalHealth,
  getSyncErrorSupportBucket,
} from "~/server/sync-health";
import {
  coerceCardDavCapabilityProfileOverrideId,
  getProviderCapabilityNotice,
  getSyncProviderCapabilityProfileDisplayName,
  getSyncProviderCapabilityProfileLabel,
  isGenericSafeCardDavProfile,
  resolveSyncProviderCapabilityProfile,
} from "~/server/sync-provider-capabilities";
import {
  formatProviderIdentitySecondaryText,
  resolveSyncProviderIdentity,
} from "~/server/sync-provider-identity";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_WINDOW = new Date(Date.now() - DAY_MS);
const PROVIDERS: SyncProvider[] = ["CARDDAV", "GOOGLE", "MICROSOFT"];
const MUTABLE_STATUSES = ["ACTIVE", "PAUSED", "NEEDS_REAUTH", "ERROR", "DISCONNECTED", "RETIRED"] as const;

const fmtRelative = (date: Date | null) => {
  if (!date) return "Never";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

const providerLabel = (provider: SyncProvider) => {
  switch (provider) {
    case "GOOGLE":
      return "Google";
    case "MICROSOFT":
      return "Microsoft";
    default:
      return "CardDAV";
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case "NEEDS_REAUTH":
      return "Needs re-auth";
    case "ERROR":
      return "Error";
    case "PAUSED":
      return "Paused";
    case "DISCONNECTED":
      return "Disconnected";
    case "RETIRED":
      return "Retired";
    default:
      return "Active";
  }
};

const healthTone = (
  health:
    | "healthy"
    | "watch"
    | "needs_attention"
    | "paused_for_safety"
    | "needs_reauth"
    | "retired",
): "healthy" | "watch" | "warning" | "critical" | "action" => {
  switch (health) {
    case "needs_reauth":
      return "action";
    case "needs_attention":
    case "paused_for_safety":
      return "warning";
    case "watch":
      return "watch";
    case "retired":
      return "healthy";
    default:
      return "healthy";
  }
};

export type AdminSyncFilters = {
  provider?: string;
  status?: string;
  profile?: string;
  q?: string;
};

export async function loadAdminSyncOverview(filters: AdminSyncFilters = {}) {
  const providerFilter =
    filters.provider && PROVIDERS.includes(filters.provider as SyncProvider)
      ? (filters.provider as SyncProvider)
      : "all";
  const statusFilter =
    filters.status && [...MUTABLE_STATUSES].includes(filters.status as (typeof MUTABLE_STATUSES)[number])
      ? filters.status
      : "all";
  const profileFilter = filters.profile?.trim() || "all";
  const q = filters.q?.trim() || "";

  const where: Prisma.SyncAccountWhereInput = {
    ...(providerFilter !== "all" ? { provider: providerFilter } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter as Prisma.SyncAccountWhereInput["status"] } : {}),
    ...(q
      ? {
          OR: [
            { label: { contains: q, mode: "insensitive" } },
            { remoteAccountId: { contains: q, mode: "insensitive" } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { connectionId: { contains: q, mode: "insensitive" } },
            { baseUrl: { contains: q, mode: "insensitive" } },
            { addressBookUrl: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [accounts, recentFailedJobs, recentRecoveredJobs, recentConflicts] = await Promise.all([
    db.syncAccount.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take: 150,
      select: {
        id: true,
        connectionId: true,
        label: true,
        provider: true,
        status: true,
        baseUrl: true,
        addressBookUrl: true,
        remoteAccountId: true,
        lastErrorCode: true,
        lastErrorMessage: true,
        lastErrorAt: true,
        lastSucceededAt: true,
        lastSyncedAt: true,
        updatedAt: true,
        userId: true,
        user: { select: { email: true, name: true } },
        settings: { select: { capabilityProfileOverride: true } },
        syncJobs: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { status: true, errorCode: true },
        },
        _count: {
          select: {
            syncJobs: true,
            syncConflicts: { where: { status: "OPEN" } },
            syncLinks: true,
          },
        },
      },
    }),
    db.syncJob.findMany({
      where: { status: "FAILED", createdAt: { gte: RECENT_WINDOW } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        errorCode: true,
        errorSummary: true,
        createdAt: true,
        syncAccount: {
          select: {
            id: true,
            label: true,
            provider: true,
            userId: true,
            user: { select: { email: true } },
          },
        },
      },
    }),
    db.syncJob.findMany({
      where: { status: { in: ["SUCCEEDED", "PARTIAL"] }, completedAt: { gte: RECENT_WINDOW } },
      orderBy: { completedAt: "desc" },
      take: 12,
      select: {
        id: true,
        status: true,
        completedAt: true,
        createdCount: true,
        updatedCount: true,
        deletedCount: true,
        syncAccount: {
          select: {
            id: true,
            label: true,
            provider: true,
            userId: true,
            status: true,
            user: { select: { email: true } },
          },
        },
      },
    }),
    db.syncConflict.count({ where: { status: "OPEN" } }),
  ]);

  const enriched = accounts
    .map((account) => {
      const capabilityProfile = resolveSyncProviderCapabilityProfile({
        provider: account.provider,
        baseUrl: account.baseUrl,
        addressBookUrl: account.addressBookUrl,
        label: account.label,
        capabilityProfileOverride: account.settings?.capabilityProfileOverride ?? null,
      });
      const providerIdentity = resolveSyncProviderIdentity({
        provider: account.provider,
        baseUrl: account.baseUrl,
        addressBookUrl: account.addressBookUrl,
        label: account.label,
      });
      const profileId = capabilityProfile.id;
      if (profileFilter !== "all" && profileFilter !== profileId) {
        return null;
      }
      const health = getSyncAccountOperationalHealth({
        status: account.status,
        lastErrorCode: account.lastErrorCode,
        recentJobs: account.syncJobs.map((job) => ({
          status: job.status,
          errorCode: job.errorCode,
        })),
      });
      return {
        ...account,
        health,
        healthToneValue: healthTone(health),
        profileId,
        profileLabel: getSyncProviderCapabilityProfileLabel(capabilityProfile),
        genericSafe: isGenericSafeCardDavProfile(capabilityProfile),
        supportBucket: getSyncErrorSupportBucket(account.lastErrorCode),
        providerDisplayName: providerIdentity.providerDisplayName,
        providerHost: providerIdentity.providerHost,
        providerVerificationState: providerIdentity.providerVerificationState,
        providerBrandKey: providerIdentity.providerBrandKey,
        providerDetectionSource: providerIdentity.detectionSource,
        providerSecondaryText: formatProviderIdentitySecondaryText(providerIdentity),
      };
    })
    .filter((value): value is NonNullable<typeof value> => value != null);

  const providerCards = PROVIDERS.map((provider) => {
    const rows = enriched.filter((row) => row.provider === provider);
    const actionRequired = rows.filter((row) => row.healthToneValue === "action").length;
    const warningCount = rows.filter(
      (row) => row.healthToneValue === "warning" || row.healthToneValue === "critical",
    ).length;
    const genericSafeCount = rows.filter((row) => row.genericSafe).length;
    const recentFailures = recentFailedJobs.filter((job) => job.syncAccount.provider === provider).length;
    const tone =
      actionRequired > 0
        ? "action"
        : warningCount > 0
          ? "warning"
          : rows.length > 0
            ? "healthy"
            : "watch";
    return {
      id: provider,
      label: providerLabel(provider),
      count: rows.length,
      actionRequired,
      warningCount,
      genericSafeCount,
      recentFailures,
      tone,
    };
  });

  const statusBuckets = [...MUTABLE_STATUSES].map((status) => ({
    id: status,
    label: statusLabel(status),
    count: enriched.filter((row) => row.status === status).length,
  }));

  const profileBuckets = Object.values(
    enriched.reduce<Record<string, { id: string; label: string; count: number }>>((acc, row) => {
      const existing = acc[row.profileId];
      if (existing) {
        existing.count += 1;
      } else {
        acc[row.profileId] = { id: row.profileId, label: row.profileLabel, count: 1 };
      }
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const needsAction = enriched
    .filter((row) => row.healthToneValue !== "healthy")
    .sort((a, b) => {
      const toneOrder = ["action", "critical", "warning", "watch", "healthy"];
      return toneOrder.indexOf(a.healthToneValue) - toneOrder.indexOf(b.healthToneValue)
        || (b.lastErrorAt?.getTime() ?? b.updatedAt.getTime()) - (a.lastErrorAt?.getTime() ?? a.updatedAt.getTime());
    })
    .slice(0, 12)
    .map((row) => ({
      id: row.id,
      href: `/admin/sync/${row.id}`,
      label: row.label,
      provider: providerLabel(row.provider),
      userEmail: row.user.email,
      status: statusLabel(row.status),
      profileLabel: row.profileLabel,
      supportBucket: row.supportBucket,
      lastEvent: row.lastErrorAt ?? row.updatedAt,
      lastEventLabel: fmtRelative(row.lastErrorAt ?? row.updatedAt),
      tone: row.healthToneValue,
      body:
        row.lastErrorMessage?.trim() ||
        (row.status === "NEEDS_REAUTH"
          ? "Credentials need to be refreshed before syncing can continue."
          : row.status === "PAUSED"
            ? "This connection is paused and may need manual review."
            : "Recent sync behavior needs support attention."),
      providerSecondaryText: row.providerSecondaryText,
    }));

  const connectionRows = enriched.slice(0, 50).map((row) => ({
    id: row.id,
    href: `/admin/sync/${row.id}`,
    label: row.label,
    provider: providerLabel(row.provider),
    userEmail: row.user.email,
    status: statusLabel(row.status),
    health: row.health,
    healthToneValue: row.healthToneValue,
    profileLabel: row.profileLabel,
    genericSafe: row.genericSafe,
    openConflicts: row._count.syncConflicts,
    syncLinks: row._count.syncLinks,
    lastSuccess: fmtRelative(row.lastSucceededAt),
    lastError: row.lastErrorAt ? fmtRelative(row.lastErrorAt) : null,
    supportBucket: row.supportBucket,
    connectionId: row.connectionId,
    providerDisplayName: row.providerDisplayName,
    providerHost: row.providerHost,
    providerVerificationState: row.providerVerificationState,
    providerDetectionSource: row.providerDetectionSource,
    providerSecondaryText: row.providerSecondaryText,
  }));

  return {
    filters: {
      provider: providerFilter,
      status: statusFilter,
      profile: profileFilter,
      q,
    },
    summary: {
      totalConnections: enriched.length,
      actionRequired: enriched.filter((row) => row.healthToneValue === "action").length,
      warningConnections: enriched.filter(
        (row) => row.healthToneValue === "warning" || row.healthToneValue === "critical",
      ).length,
      openConflicts: recentConflicts,
      genericSafeConnections: enriched.filter((row) => row.genericSafe).length,
    },
    providerCards,
    statusBuckets,
    profileBuckets,
    needsAction,
    connectionRows,
    recentFailures: recentFailedJobs.map((job) => ({
      id: job.id,
      href: `/admin/sync/${job.syncAccount.id}`,
      label: job.syncAccount.label,
      provider: providerLabel(job.syncAccount.provider),
      userEmail: job.syncAccount.user.email,
      when: fmtRelative(job.createdAt),
      supportBucket: getSyncErrorSupportBucket(job.errorCode),
      errorSummary: job.errorSummary ?? "Failed without a captured summary.",
    })),
    recentRecoveries: recentRecoveredJobs.map((job) => ({
      id: job.id,
      href: `/admin/sync/${job.syncAccount.id}`,
      label: job.syncAccount.label,
      provider: providerLabel(job.syncAccount.provider),
      userEmail: job.syncAccount.user.email,
      when: fmtRelative(job.completedAt),
      status: job.status,
      changes: job.createdCount + job.updatedCount + job.deletedCount,
    })),
  };
}

export async function loadAdminSyncConnectionDetail(syncAccountId: string) {
  const [account, supportNotes] = await Promise.all([
    db.syncAccount.findUnique({
      where: { id: syncAccountId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            lifecycleState: true,
          },
        },
        settings: true,
        replacesSyncAccount: {
          select: {
            id: true,
            label: true,
            connectionId: true,
            status: true,
            retiredAt: true,
            replacedBySyncAccountId: true,
          },
        },
        replacedBySyncAccount: {
          select: {
            id: true,
            label: true,
            connectionId: true,
            status: true,
            createdAt: true,
            replacesSyncAccountId: true,
          },
        },
        syncJobs: {
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        syncConflicts: {
          orderBy: { detectedAt: "desc" },
          take: 12,
          include: {
            contact: { select: { id: true, fullName: true } },
          },
        },
        _count: {
          select: {
            syncJobs: true,
            syncConflicts: { where: { status: "OPEN" } },
            syncLinks: true,
          },
        },
      },
    }),
    listAdminSupportNotes({ subjectType: "SYNC_ACCOUNT", subjectId: syncAccountId, limit: 12 }),
  ]);

  if (!account) return null;

  const capabilityProfile = resolveSyncProviderCapabilityProfile({
    provider: account.provider,
    baseUrl: account.baseUrl,
    addressBookUrl: account.addressBookUrl,
    label: account.label,
    capabilityProfileOverride: account.settings?.capabilityProfileOverride ?? null,
  });
  const providerIdentity = resolveSyncProviderIdentity({
    provider: account.provider,
    baseUrl: account.baseUrl,
    addressBookUrl: account.addressBookUrl,
    label: account.label,
  });
  const capabilityNotice = getProviderCapabilityNotice(capabilityProfile);
  const recentJobs = account.syncJobs.map((job) => ({
    status: job.status,
    errorCode: job.errorCode,
  }));
  const operationalHealth = getSyncAccountOperationalHealth({
    status: account.status,
    lastErrorCode: account.lastErrorCode,
    recentJobs,
  });
  const failureStreak = getConsecutiveFailureStreak(recentJobs);
  const invariantIssues = getSyncLineageInvariantIssues(account);

  return {
    id: account.id,
    label: account.label,
    provider: account.provider,
    providerLabel: providerLabel(account.provider),
    status: account.status,
    statusLabel: statusLabel(account.status),
    connectionId: account.connectionId,
    user: {
      id: account.user.id,
      email: account.user.email,
      name: account.user.name?.trim() || account.user.email,
      lifecycleState: account.user.lifecycleState,
    },
    health: operationalHealth,
    healthToneValue: healthTone(operationalHealth),
    supportBucket: getSyncErrorSupportBucket(account.lastErrorCode),
    failureStreak,
    lastSyncedAt: fmtRelative(account.lastSyncedAt),
    lastSucceededAt: fmtRelative(account.lastSucceededAt),
    lastErrorAt: account.lastErrorAt ? fmtRelative(account.lastErrorAt) : null,
    lastErrorCode: account.lastErrorCode,
    lastErrorMessage: account.lastErrorMessage,
    baseUrl: account.baseUrl,
    principalUrl: account.principalUrl,
    addressBookUrl: account.addressBookUrl,
    addressBookDisplayName: account.addressBookDisplayName,
    remoteAccountId: account.remoteAccountId,
    remoteCTag: account.remoteCTag,
    syncDirection: account.settings?.syncDirection ?? account.syncDirection,
    conflictPolicy: account.settings?.conflictPolicy ?? "SERVER_WINS",
    capabilityProfileId: capabilityProfile.id,
    capabilityProfileLabel: getSyncProviderCapabilityProfileLabel(capabilityProfile),
    capabilityProfileDisplayName: getSyncProviderCapabilityProfileDisplayName(capabilityProfile),
    capabilityProfileOverride: coerceCardDavCapabilityProfileOverrideId(
      account.settings?.capabilityProfileOverride ?? null,
    ),
    capabilityGenericSafe: isGenericSafeCardDavProfile(capabilityProfile),
    providerDisplayName: providerIdentity.providerDisplayName,
    providerHost: providerIdentity.providerHost,
    providerVerificationState: providerIdentity.providerVerificationState,
    providerBrandKey: providerIdentity.providerBrandKey,
    providerDetectionSource: providerIdentity.detectionSource,
    providerSecondaryText: formatProviderIdentitySecondaryText(providerIdentity),
    capabilityNotice,
    setupCompletedAt: account.setupCompletedAt ? fmtRelative(account.setupCompletedAt) : "Pending setup",
    credentialStatus:
      account.credentialRevokedAt != null
        ? "Revoked"
        : account.credentialLastValidatedAt != null
          ? `Validated ${fmtRelative(account.credentialLastValidatedAt)}`
          : account.credentialUpdatedAt != null
            ? `Updated ${fmtRelative(account.credentialUpdatedAt)}`
            : "Not validated yet",
    connectionValidatedAt: account.connectionValidatedAt
      ? fmtRelative(account.connectionValidatedAt)
      : "Not validated yet",
    discoveredBooksAt: account.booksDiscoveredAt ? fmtRelative(account.booksDiscoveredAt) : "Never discovered",
    retiredAt: account.retiredAt ? fmtRelative(account.retiredAt) : null,
    retiredReason: account.retiredReason,
    disconnectedAt: account.disconnectedAt ? fmtRelative(account.disconnectedAt) : null,
    counts: account._count,
    invariants: invariantIssues,
    lineage: {
      replaces: account.replacesSyncAccount
        ? {
            id: account.replacesSyncAccount.id,
            label: account.replacesSyncAccount.label,
            connectionId: account.replacesSyncAccount.connectionId,
            status: statusLabel(account.replacesSyncAccount.status),
            retiredAt: account.replacesSyncAccount.retiredAt
              ? fmtRelative(account.replacesSyncAccount.retiredAt)
              : null,
          }
        : null,
      replacedBy: account.replacedBySyncAccount
        ? {
            id: account.replacedBySyncAccount.id,
            label: account.replacedBySyncAccount.label,
            connectionId: account.replacedBySyncAccount.connectionId,
            status: statusLabel(account.replacedBySyncAccount.status),
            createdAt: fmtRelative(account.replacedBySyncAccount.createdAt),
          }
        : null,
    },
    settings: {
      capabilityProfileOverride: coerceCardDavCapabilityProfileOverrideId(
        account.settings?.capabilityProfileOverride ?? null,
      ),
      syncFrequencyMinutes: account.settings?.syncFrequencyMinutes ?? null,
      importLabelId: account.settings?.importLabelId ?? null,
      notifyOnFailure: account.settings?.notifyOnFailure ?? true,
      maxDeletionsThreshold: account.settings?.maxDeletionsThreshold ?? null,
      syncWindowStart: account.settings?.syncWindowStart ?? null,
      syncWindowEnd: account.settings?.syncWindowEnd ?? null,
      excludedFields: account.settings?.excludedFields ?? [],
      exportLabelFilter: account.settings?.exportLabelFilter ?? [],
      maxAttemptsBeforePause: account.settings?.maxAttemptsBeforePause ?? null,
    },
    recentJobs: account.syncJobs.map((job) => ({
      id: job.id,
      status: job.status,
      trigger: job.trigger,
      when: fmtRelative(job.completedAt ?? job.startedAt ?? job.createdAt),
      supportBucket: getSyncErrorSupportBucket(job.errorCode),
      errorCode: job.errorCode,
      errorSummary: job.errorSummary,
      changes: {
        created: job.createdCount,
        updated: job.updatedCount,
        deleted: job.deletedCount,
        conflicts: job.conflictCount,
        skipped: job.skippedCount,
        pushedCreated: job.pushedCreatedCount,
        pushedUpdated: job.pushedUpdatedCount,
        pushedDeleted: job.pushedDeletedCount,
      },
    })),
    recentConflicts: account.syncConflicts.map((conflict) => ({
      id: conflict.id,
      contactId: conflict.contact?.id ?? null,
      contactName: conflict.contact?.fullName ?? "Unknown contact",
      type: conflict.conflictType,
      status: conflict.status,
      detectedAt: fmtRelative(conflict.detectedAt),
      resolutionStrategy: conflict.resolutionStrategy,
    })),
    supportNotes,
  };
}
