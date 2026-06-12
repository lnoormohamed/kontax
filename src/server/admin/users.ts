import "server-only";

import { db } from "~/server/db";
import { getUserBillingContext } from "~/server/billing";

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

const SEARCH_LIMIT = 50;

/** Search by email or name (DB04 §2). Empty query returns the most recent users. */
export async function searchUsers(query: string): Promise<AdminUserRow[]> {
  const q = query.trim();
  const users = await db.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
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

  const [billing, contactsUsed, syncUsed, appPwdUsed, importsAgg, group, activityRaw, sessionsRaw, lastSession] =
    await Promise.all([
      getUserBillingContext(userId),
      db.contact.count({ where: { userId } }),
      db.syncAccount.count({ where: { userId } }),
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
    ]);

  const ent = billing.entitlements;
  const sub = user.subscriptions[0];
  const dayMs = 24 * 60 * 60 * 1000;

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
