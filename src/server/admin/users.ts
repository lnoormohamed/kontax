import "server-only";

import type { Prisma } from "../../../generated/prisma";

import { db } from "~/server/db";
import { normalizeAdminUserViewId, type AdminUserViewId } from "~/server/admin/saved-views";
import {
  countLiveSyncAccountSlots,
  getLifecycleAccessPolicy,
  getUserBillingContext,
} from "~/server/billing";
import { listUserSupportTimeline } from "~/server/admin/support-notes";
import { listSupportCasesForSubject } from "~/server/admin/support-cases";
import { getSyncAccountOperationalHealth, getSyncErrorSupportBucket } from "~/server/sync-health";
import {
  getSyncProviderCapabilityProfileLabel,
  isGenericSafeCardDavProfile,
  resolveSyncProviderCapabilityProfile,
} from "~/server/sync-provider-capabilities";
import {
  formatProviderIdentitySecondaryText,
  resolveSyncProviderIdentity,
} from "~/server/sync-provider-identity";

const PLAN_LABEL: Record<string, string> = {
  FREE: "Free",
  PRO: "Pro",
  FAMILY: "Family",
  TEAMS: "Teams",
};

// Lifecycle → the three pill states the design renders.
function statusOf(lifecycleState: string, scheduledDeleteAt: Date | null): "Active" | "Grace" | "Locked" {
  if (lifecycleState === "LOCKED" || lifecycleState === "CANCELED" || scheduledDeleteAt) return "Locked";
  if (lifecycleState === "GRACE") return "Grace";
  return "Active";
}

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: "Active" | "Grace" | "Locked";
  joined: string;
};

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d);

const providerLabel = (provider: string) => {
  switch (provider) {
    case "GOOGLE":
      return "Google";
    case "MICROSOFT":
      return "Microsoft";
    default:
      return "CardDAV";
  }
};

const syncStatusLabel = (status: string) => {
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

const SEARCH_LIMIT = 50;

function userWhereForView(view: AdminUserViewId): Prisma.UserWhereInput {
  switch (view) {
    case "user-review":
      return {
        OR: [
          { lifecycleState: { in: ["GRACE", "LOCKED", "CANCELED"] } },
          { scheduledDeleteAt: { not: null } },
        ],
      };
    case "locked-or-delete":
      return {
        OR: [
          { lifecycleState: { in: ["LOCKED", "CANCELED"] } },
          { scheduledDeleteAt: { not: null } },
        ],
      };
    case "grace":
      return { lifecycleState: "GRACE" };
    case "billing-exceptions":
      return {
        OR: [
          { lifecycleState: "GRACE" },
          { planOverriddenAt: { not: null } },
          { scheduledDeleteAt: { not: null } },
        ],
      };
    case "plan-overrides":
      return { planOverriddenAt: { not: null } };
    default:
      return {};
  }
}

/** Search by email, name, or id. Empty query returns the most relevant view set. */
export async function searchUsers(input: {
  query: string;
  view?: string;
}): Promise<AdminUserRow[]> {
  const q = input.query.trim();
  const view = normalizeAdminUserViewId(input.view);
  const users = await db.user.findMany({
    where: {
      AND: [
        userWhereForView(view),
        ...(q
          ? [
              {
                OR: [
                  { email: { contains: q, mode: "insensitive" as const } },
                  { name: { contains: q, mode: "insensitive" as const } },
                  { id: { contains: q, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy:
      view === "locked-or-delete" || view === "billing-exceptions" || view === "user-review"
        ? [{ scheduledDeleteAt: "desc" }, { updatedAt: "desc" }]
        : [{ createdAt: "desc" }],
    take: SEARCH_LIMIT,
    select: {
      id: true,
      name: true,
      email: true,
      lifecycleState: true,
      scheduledDeleteAt: true,
      createdAt: true,
      subscriptions: {
        where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
        orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { plan: true },
      },
    },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name?.trim() ?? u.email.split("@")[0] ?? "—",
    email: u.email,
    plan: PLAN_LABEL[u.subscriptions[0]?.plan ?? "FREE"] ?? "Free",
    status: statusOf(u.lifecycleState, u.scheduledDeleteAt),
    joined: fmtDate(u.createdAt),
  }));
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  return `${Math.floor(months / 12)} year${months < 24 ? "" : "s"} ago`;
}

const EVENT_META: Record<string, { icon: string; label: string }> = {
  CONTACT_CREATED: { icon: "edit", label: "Contact created" },
  CONTACT_UPDATED: { icon: "edit", label: "Contact updated" },
  CONTACT_ARCHIVED: { icon: "edit", label: "Contact archived" },
  CONTACT_RESTORED: { icon: "edit", label: "Contact restored" },
  CONTACT_DELETED: { icon: "edit", label: "Contact deleted" },
  CONTACT_MERGED: { icon: "merge", label: "Merged duplicate contacts" },
  CONTACT_MERGE_UNDONE: { icon: "merge", label: "Merge undone" },
  CONTACT_IMPORTED: { icon: "import", label: "Import completed" },
  CONTACT_SHARED: { icon: "share", label: "Contact shared" },
  CONTACT_SHARE_RECEIVED: { icon: "share", label: "Share received" },
  SYNC_PULLED: { icon: "sync", label: "CardDAV sync pulled changes" },
  SYNC_PUSHED: { icon: "sync", label: "CardDAV sync pushed changes" },
  SYNC_CONFLICT_DETECTED: { icon: "sync", label: "Sync conflict detected" },
  SYNC_CONFLICT_RESOLVED: { icon: "sync", label: "Sync conflict resolved" },
  SYNC_CONNECTION_CONNECTED: { icon: "sync", label: "Sync connection connected" },
  SYNC_CONNECTION_RECONNECTED: { icon: "sync", label: "Sync connection reconnected" },
  SYNC_CONNECTION_DISCONNECTED: { icon: "sync", label: "Sync connection disconnected" },
  SYNC_CONNECTION_RETIRED: { icon: "archive", label: "Sync connection retired" },
  SYNC_CONNECTION_REPLACED: { icon: "sync", label: "Sync connection replaced" },
  ACCOUNT_UPDATED: { icon: "account", label: "Account updated" },
};

export type AdminUserDetail = Awaited<ReturnType<typeof loadUserDetail>>;

/** Full deep-dive record for the user detail panel (DB04 §3). */
export async function loadUserDetail(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      emailStatus: true,
      lifecycleState: true,
      scheduledDeleteAt: true,
      planOverriddenAt: true,
      planOverrideReason: true,
      createdAt: true,
      subscriptions: {
        orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          plan: true,
          status: true,
          interval: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          trialEndsAt: true,
        },
      },
    },
  });
  if (!user) return null;

  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

  const [
    billing,
    contactsUsed,
    syncUsed,
    appPwdUsed,
    importsAgg,
    group,
    activityRaw,
    sessionsRaw,
    lastSession,
    syncAccountsRaw,
    adminActionsRaw,
    supportNotesRaw,
    supportCases,
  ] =
    await Promise.all([
      getUserBillingContext(userId),
      db.contact.count({ where: { userId } }),
      countLiveSyncAccountSlots(userId),
      db.appPassword.count({ where: { userId, revokedAt: null } }),
      db.importJob.aggregate({
        where: { userId, status: "COMPLETED", createdAt: { gte: monthStart } },
        _sum: { importedCount: true },
      }),
      db.groupMember.findFirst({
        where: { userId, inviteStatus: "ACCEPTED" },
        select: {
          role: true,
          group: {
            select: {
              name: true,
              type: true,
              maxMembers: true,
              _count: { select: { members: { where: { inviteStatus: "ACCEPTED" } } } },
            },
          },
        },
      }),
      db.activityEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { eventType: true, createdAt: true, contact: { select: { fullName: true } }, payload: true },
      }),
      db.userSession.findMany({
        where: { userId, revokedAt: null },
        orderBy: { lastActiveAt: "desc" },
        take: 5,
        select: { deviceHint: true, userAgent: true, ipAddress: true, lastActiveAt: true },
      }),
      db.userSession.findFirst({
        where: { userId, revokedAt: null },
        orderBy: { lastActiveAt: "desc" },
        select: { lastActiveAt: true },
      }),
      db.syncAccount.findMany({
        where: { userId },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          connectionId: true,
          label: true,
          provider: true,
          status: true,
          baseUrl: true,
          addressBookUrl: true,
          lastErrorCode: true,
          lastErrorAt: true,
          lastSucceededAt: true,
          updatedAt: true,
          settings: { select: { capabilityProfileOverride: true } },
          syncJobs: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { status: true, errorCode: true },
          },
          _count: {
            select: {
              syncConflicts: { where: { status: "OPEN" } },
              syncLinks: true,
            },
          },
        },
      }),
      db.adminAuditEvent.findMany({
        where: {
          targetUserId: userId,
          action: {
            in: [
              "plan.override",
              "account.suspend",
              "account.unlock",
              "account.delete.schedule",
              "sync.capability.override",
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          action: true,
          createdAt: true,
          details: true,
          admin: { select: { name: true, email: true } },
        },
      }),
      listUserSupportTimeline(userId, 12),
      listSupportCasesForSubject("USER", userId),
    ]);

  const ent = billing.entitlements;
  const sub = user.subscriptions[0];
  const dayMs = 24 * 60 * 60 * 1000;
  const lifecyclePolicy = getLifecycleAccessPolicy(user.lifecycleState);

  const syncAccounts = syncAccountsRaw.map((account) => {
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
    const health = getSyncAccountOperationalHealth({
      status: account.status,
      lastErrorCode: account.lastErrorCode,
      recentJobs: account.syncJobs.map((job) => ({
        status: job.status,
        errorCode: job.errorCode,
      })),
    });
    return {
      id: account.id,
      href: `/admin/sync/${account.id}`,
      connectionId: account.connectionId,
      label: account.label,
      provider: providerLabel(account.provider),
      status: syncStatusLabel(account.status),
      health,
      profileLabel: getSyncProviderCapabilityProfileLabel(capabilityProfile),
      genericSafe: isGenericSafeCardDavProfile(capabilityProfile),
      providerDisplayName: providerIdentity.providerDisplayName,
      providerHost: providerIdentity.providerHost,
      providerVerificationState: providerIdentity.providerVerificationState,
      providerSecondaryText: formatProviderIdentitySecondaryText(providerIdentity),
      openConflicts: account._count.syncConflicts,
      syncLinks: account._count.syncLinks,
      lastSuccess: account.lastSucceededAt ? relativeTime(account.lastSucceededAt) : "Never",
      lastError: account.lastErrorAt ? relativeTime(account.lastErrorAt) : null,
      supportBucket: getSyncErrorSupportBucket(account.lastErrorCode),
      capabilityOverride: account.settings?.capabilityProfileOverride ?? null,
    };
  });

  const supportNotes = adminActionsRaw.map((event) => {
    const actor = event.admin?.name?.trim() ?? event.admin?.email ?? "Admin";
    const details = (event.details ?? {}) as Record<string, unknown>;
    const nextOverride =
      typeof details.nextOverride === "string" ? details.nextOverride : null;
    const reason = typeof details.reason === "string" ? details.reason : null;
    const label =
      event.action === "plan.override"
        ? "Plan override updated"
        : event.action === "account.suspend"
          ? "Account suspended"
          : event.action === "account.unlock"
            ? "Account unlocked"
            : event.action === "account.delete.schedule"
              ? "Deletion scheduled"
              : event.action === "sync.capability.override"
                ? `Sync capability override set${nextOverride ? ` to ${nextOverride}` : " to auto-detect"}`
                : event.action;
    return {
      id: event.id,
      label,
      when: relativeTime(event.createdAt),
      createdAt: event.createdAt,
      actor,
      reason,
    };
  });

  const supportTimeline = [
    ...supportNotes.map((note) => ({
      id: note.id,
      type: "audit" as const,
      label: note.label,
      body: note.reason,
      when: note.when,
      actor: note.actor,
      createdAt: note.createdAt,
    })),
    ...supportNotesRaw.map((note) => ({
      id: note.id,
      type: "note" as const,
      label: "Internal support note",
      body: note.body,
      when: note.when,
      actor: note.author,
      createdAt: note.createdAt,
    })),
  ]
    .sort((left, right) => {
      const leftDate = "createdAt" in left && left.createdAt instanceof Date ? left.createdAt.getTime() : 0;
      const rightDate = "createdAt" in right && right.createdAt instanceof Date ? right.createdAt.getTime() : 0;
      return rightDate - leftDate;
    })
    .slice(0, 16)
    .map((item) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      body: item.body ?? null,
      when: item.when,
      actor: item.actor,
    }));

  const usage = [
    {
      label: "Contacts",
      value: contactsUsed.toLocaleString(),
      limit: ent.contactsLimit === null ? "unlimited" : ent.contactsLimit.toLocaleString(),
      pct: ent.contactsLimit === null ? null : Math.min(1, contactsUsed / ent.contactsLimit),
    },
    {
      label: "Sync accounts",
      value: String(syncUsed),
      limit: String(ent.syncAccountsLimit),
      pct: ent.syncAccountsLimit ? Math.min(1, syncUsed / ent.syncAccountsLimit) : null,
    },
    {
      label: "App passwords",
      value: String(appPwdUsed),
      limit: String(ent.appPasswordsLimit),
      pct: ent.appPasswordsLimit ? Math.min(1, appPwdUsed / ent.appPasswordsLimit) : null,
    },
    {
      label: "Imports / mo",
      value:
        ent.monthlyImportLimit === null
          ? "Unlimited"
          : String(importsAgg._sum.importedCount ?? 0),
      limit: ent.monthlyImportLimit === null ? "" : String(ent.monthlyImportLimit),
      pct: ent.monthlyImportLimit === null ? null : Math.min(1, (importsAgg._sum.importedCount ?? 0) / ent.monthlyImportLimit),
    },
  ];

  return {
    id: user.id,
    name: user.name?.trim() ?? user.email.split("@")[0] ?? "—",
    email: user.email,
    role: user.role,
    plan: PLAN_LABEL[billing.plan] ?? "Free",
    status: statusOf(user.lifecycleState, user.scheduledDeleteAt),
    overridden: !!user.planOverriddenAt,
    overriddenAt: user.planOverriddenAt,
    suspended: user.lifecycleState === "LOCKED" && !user.scheduledDeleteAt,
    deletionScheduled: !!user.scheduledDeleteAt,
    overview: {
      userId: user.id,
      created: fmtDate(user.createdAt),
      lastActive: lastSession ? relativeTime(lastSession.lastActiveAt) : "never",
      emailStatus: user.emailStatus === "OK" ? "OK" : user.emailStatus === "BOUNCED" ? "Bouncing" : "Complained",
    },
    subscription: {
      plan: sub ? `${PLAN_LABEL[sub.plan]} ${sub.interval === "YEARLY" ? "Annual" : "Monthly"}` : "Free",
      status: sub?.status ?? "—",
      periodEnds: sub?.currentPeriodEnd ? fmtDate(sub.currentPeriodEnd) : "—",
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    },
    usage,
    billingDiagnostics: {
      lifecycleState: user.lifecycleState,
      lifecycleLabel: lifecyclePolicy.label,
      lifecycleDescription: lifecyclePolicy.description,
      canWrite: lifecyclePolicy.canWrite,
      canAuthenticateExpected: lifecyclePolicy.canAuthenticateExpected,
      basePlan: sub ? (PLAN_LABEL[sub.plan] ?? "Free") : "Free",
      effectivePlan: PLAN_LABEL[billing.plan] ?? "Free",
      subscriptionStatus: sub?.status ?? "FREE",
      trialEndsAt: sub?.trialEndsAt ? fmtDate(sub.trialEndsAt) : null,
      periodEndsAt: sub?.currentPeriodEnd ? fmtDate(sub.currentPeriodEnd) : null,
      overrideReason: user.planOverrideReason?.trim() || null,
      overrideAt: user.planOverriddenAt ? fmtDate(user.planOverriddenAt) : null,
      scheduledDeleteAt: user.scheduledDeleteAt ? fmtDate(user.scheduledDeleteAt) : null,
      syncAllowanceUsed: syncUsed,
      syncAllowanceLimit: ent.syncAccountsLimit,
      syncAllowanceRemaining: Math.max(0, ent.syncAccountsLimit - syncUsed),
    },
    syncSupport: {
      summary: {
        total: syncAccounts.length,
        active: syncAccounts.filter((account) => account.status === "Active").length,
        needsReauth: syncAccounts.filter((account) => account.status === "Needs re-auth").length,
        errors: syncAccounts.filter((account) => account.status === "Error").length,
        paused: syncAccounts.filter((account) => account.status === "Paused").length,
        retired: syncAccounts.filter((account) => account.status === "Retired").length,
        genericSafe: syncAccounts.filter((account) => account.genericSafe).length,
        openConflicts: syncAccounts.reduce((sum, account) => sum + account.openConflicts, 0),
      },
      accounts: syncAccounts,
      notes: supportNotes,
    },
    supportCases,
    supportTimeline,
    group: group?.group
      ? {
          isTeam: group.group.type === "TEAM",
          name: group.group.name,
          role: group.role.charAt(0) + group.role.slice(1).toLowerCase(),
          members: `${group.group._count.members} / ${group.group.maxMembers}`,
        }
      : null,
    activity: activityRaw.map((a) => {
      const meta = EVENT_META[a.eventType] ?? { icon: "edit", label: a.eventType };
      const fullName = a.contact?.fullName;
      return {
        type: meta.icon,
        text: fullName ? `${meta.label}: "${fullName}"` : meta.label,
        when: relativeTime(a.createdAt),
      };
    }),
    sessions: sessionsRaw.map((s) => ({
      ua: s.deviceHint ?? "Unknown device",
      ip: s.ipAddress ?? "—",
      when: `Active ${relativeTime(s.lastActiveAt)}`,
      current: Date.now() - s.lastActiveAt.getTime() < dayMs,
    })),
  };
}
