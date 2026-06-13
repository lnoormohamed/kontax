import { type SubscriptionPlan } from "../../generated/prisma";

import { db } from "~/server/db";

export type BillingLifecycleState = "ACTIVE" | "TRIALING" | "GRACE" | "CANCELED" | "LOCKED";

type PlanEntitlements = {
  contactsLimit: number | null;
  monthlyImportLimit: number | null;
  syncAccountsLimit: number;
  appPasswordsLimit: number;
  advancedMergeEnabled: boolean;
  premiumExportEnabled: boolean;
  cardDavSyncEnabled: boolean;
  familyGroupEnabled: boolean;
  teamsEnabled: boolean;
  sharedAddressBooksLimit: number | null;
  memberSlotsLimit: number | null;
  activityLogRetentionDays: number | null;
  // Floor: the N most recent events per contact that are always KEPT (survive
  // pruning), even beyond the retention window (P11-05). Free keeps 10.
  historyFloorPerContact: number;
  // Per-contact History tab display cap. null = show all retained events (paid).
  // Free SHOWS fewer than it keeps (keeps 10, shows 3) as an upgrade teaser.
  historyDisplayCap: number | null;
  liveShareEnabled: boolean;
  staticShareEnabled: boolean;
};

type BillingContext = {
  lifecycleState: BillingLifecycleState;
  plan: SubscriptionPlan;
  planLabel: string;
  entitlements: PlanEntitlements;
};

type LifecycleAccessPolicy = {
  label: string;
  description: string;
  canWrite: boolean;
  canUseBasicExport: boolean;
  canAuthenticateExpected: boolean;
};

export const BILLING_PROVIDER_BOUNDARY = {
  providerLabel: "Stripe-first integration boundary",
  integrationShape: [
    "Checkout, upgrades, and customer portal entry points should call a dedicated billing service boundary instead of mutating subscription rows directly from product UI.",
    "Webhook handlers should be the only automated writers for provider customer IDs, provider subscription IDs, renewal timestamps, payment failure state, and cancellation transitions.",
    "Feature gating inside the app should read local entitlement state from Kontax, not make live provider API calls during ordinary product actions.",
  ],
  providerScopedFields: [
    "BillingProvider",
    "providerCustomerId",
    "providerSubscriptionId",
    "provider price or product mapping",
    "webhook event identifiers for idempotency",
  ],
} as const;

export const BILLING_AUDIT_REQUIREMENTS = [
  "subscription customer created or linked",
  "trial started or extended",
  "subscription renewed",
  "payment failed and grace started",
  "subscription canceled or cancellation reversed",
  "account moved to locked or reactivated state",
] as const;

export const BILLING_OPERATIONAL_JOBS = [
  "expire stale export artifacts on a shorter retention window than canonical contacts",
  "clean import upload artifacts after preview or commit windows close",
  "recalculate contact, import, and sync quota usage on a scheduled basis",
  "reconcile provider lifecycle changes into local subscription and user lifecycle state",
  "close or pause queued premium jobs when lifecycle state becomes canceled or locked",
] as const;

const LIFECYCLE_ACCESS_POLICIES: Record<BillingLifecycleState, LifecycleAccessPolicy> = {
  ACTIVE: {
    label: "Active",
    description: "Full read/write access with normal entitlement checks.",
    canWrite: true,
    canUseBasicExport: true,
    canAuthenticateExpected: true,
  },
  TRIALING: {
    label: "Trialing",
    description: "Full product access during the active trial window.",
    canWrite: true,
    canUseBasicExport: true,
    canAuthenticateExpected: true,
  },
  GRACE: {
    label: "Grace",
    description:
      "Writes continue during recovery from billing issues, but billing follow-up is expected before lockout.",
    canWrite: true,
    canUseBasicExport: true,
    canAuthenticateExpected: true,
  },
  CANCELED: {
    label: "Canceled",
    description:
      "Account becomes read-only, but owned contacts remain visible and basic export stays available for portability.",
    canWrite: false,
    canUseBasicExport: true,
    canAuthenticateExpected: true,
  },
  LOCKED: {
    label: "Locked",
    description:
      "Account is restricted until billing recovery or administrative intervention clears the lock.",
    canWrite: false,
    canUseBasicExport: false,
    canAuthenticateExpected: false,
  },
};

// Per-plan default entitlements (P11-01 matrix). NOTE: contactsLimit /
// monthlyImportLimit / syncAccountsLimit remain numeric ceilings here; the
// matrix's "null = unlimited" semantics for paid tiers are applied in
// enforcement during P11-03. Family/Teams mirror Pro's personal-library limits
// (their group/sharing entitlements are the net-new flags below).
const PRO_PERSONAL = {
  contactsLimit: null,
  monthlyImportLimit: null,
  syncAccountsLimit: 5,
  appPasswordsLimit: 5,
  advancedMergeEnabled: true,
  premiumExportEnabled: true,
  cardDavSyncEnabled: true,
  historyFloorPerContact: 20,
  historyDisplayCap: null,
  liveShareEnabled: true,
  staticShareEnabled: true,
} as const;

const PLAN_DEFAULTS: Record<SubscriptionPlan, PlanEntitlements> = {
  FREE: {
    contactsLimit: 500,
    monthlyImportLimit: 3,
    // Free includes 1 CardDAV sync account; Pro+ raises the cap to 5. The whole
    // feature is enabled (cardDavSyncEnabled) and the ceiling is enforced by
    // syncAccountsLimit, so the UI shows a 1-account cap with an upgrade nudge
    // rather than a blanket upsell.
    syncAccountsLimit: 1,
    appPasswordsLimit: 1,
    advancedMergeEnabled: false,
    premiumExportEnabled: false,
    cardDavSyncEnabled: true,
    familyGroupEnabled: false,
    teamsEnabled: false,
    sharedAddressBooksLimit: 0,
    memberSlotsLimit: null,
    activityLogRetentionDays: 0,
    historyFloorPerContact: 10,
    historyDisplayCap: 3,
    liveShareEnabled: false,
    staticShareEnabled: false,
  },
  PRO: {
    ...PRO_PERSONAL,
    familyGroupEnabled: false,
    teamsEnabled: false,
    sharedAddressBooksLimit: 0,
    memberSlotsLimit: null,
    activityLogRetentionDays: 365,
  },
  FAMILY: {
    ...PRO_PERSONAL,
    familyGroupEnabled: true,
    teamsEnabled: false,
    sharedAddressBooksLimit: 1,
    memberSlotsLimit: 6,
    // Retention is the one exception to "everything in Pro per member": Family
    // personal history is 90d vs Pro's 365d (per-seat economics). Family's value
    // is seats + the shared book, not retention depth. The last-20-per-contact
    // floor (PRO_PERSONAL) still applies, so recent history is never lost.
    activityLogRetentionDays: 90,
  },
  TEAMS: {
    ...PRO_PERSONAL,
    familyGroupEnabled: false,
    teamsEnabled: true,
    sharedAddressBooksLimit: null,
    memberSlotsLimit: 25,
    activityLogRetentionDays: null,
  },
};

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  FREE: "Free",
  PRO: "Pro",
  FAMILY: "Family",
  TEAMS: "Teams",
};

export const getLifecycleAccessPolicy = (state: BillingLifecycleState) =>
  LIFECYCLE_ACCESS_POLICIES[state];

const getMonthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
};

export const getUserBillingContext = async (userId: string): Promise<BillingContext> => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      lifecycleState: true,
      subscriptions: {
        where: {
          status: {
            in: ["ACTIVE", "TRIALING", "PAST_DUE"],
          },
        },
        orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { plan: true },
      },
    },
  });

  if (!user) {
    throw new Error("User account could not be found.");
  }

  const subscription = user.subscriptions[0];
  const plan = subscription?.plan ?? "FREE";

  // Entitlements are tier-driven: the frozen P11-01 matrix (PLAN_DEFAULTS) is the
  // single source of truth. The per-subscription entitlement columns added in
  // P11-02 remain in the schema for future custom/enterprise overrides, but are
  // intentionally NOT merged here — non-nullable boolean columns default to false
  // and would otherwise silently strip paid-tier features from existing rows.
  return {
    lifecycleState: user.lifecycleState,
    plan,
    planLabel: PLAN_LABELS[plan],
    entitlements: PLAN_DEFAULTS[plan],
  };
};

const assertWritableAccount = (context: BillingContext) => {
  const policy = getLifecycleAccessPolicy(context.lifecycleState);

  if (!policy.canWrite) {
    if (context.lifecycleState === "CANCELED") {
      throw new Error(
        "This account is canceled and currently read-only. Export your contacts or reactivate billing to resume changes.",
      );
    }

    throw new Error("This account is locked. Update billing before making changes.");
  }
};

const assertExportableAccount = (context: BillingContext) => {
  const policy = getLifecycleAccessPolicy(context.lifecycleState);

  if (!policy.canUseBasicExport) {
    throw new Error("This account is locked. Update billing before exporting contacts.");
  }
};

export const getUserPlanSummary = async (userId: string) => {
  const context = await getUserBillingContext(userId);
  const monthStart = getMonthStart();

  const [contactsUsed, importedThisMonthAggregate] = await Promise.all([
    db.contact.count({ where: { userId } }),
    db.importJob.aggregate({
      where: {
        userId,
        status: "COMPLETED",
        createdAt: {
          gte: monthStart,
        },
      },
      _sum: {
        importedCount: true,
      },
    }),
  ]);

  return {
    ...context,
    lifecyclePolicy: getLifecycleAccessPolicy(context.lifecycleState),
    contactsUsed,
    // null = unlimited (Pro/Family/Teams) → no finite "remaining".
    contactsRemaining:
      context.entitlements.contactsLimit === null
        ? null
        : Math.max(context.entitlements.contactsLimit - contactsUsed, 0),
    importedThisMonth: importedThisMonthAggregate._sum.importedCount ?? 0,
  };
};

export const assertCanCreateContacts = async (userId: string, incomingCount = 1) => {
  const summary = await getUserPlanSummary(userId);
  assertWritableAccount(summary);

  const limit = summary.entitlements.contactsLimit;
  if (limit !== null && summary.contactsUsed + incomingCount > limit) {
    throw new Error(
      `${summary.planLabel} plan limit reached. You can store up to ${limit} contacts on this plan.`,
    );
  }

  return summary;
};

export const assertCanImportContacts = async (userId: string, incomingCount: number) => {
  const summary = await assertCanCreateContacts(userId, incomingCount);

  const limit = summary.entitlements.monthlyImportLimit;
  if (limit !== null && summary.importedThisMonth + incomingCount > limit) {
    throw new Error(
      `${summary.planLabel} plan import limit reached. You can import up to ${limit} contacts per month on this plan.`,
    );
  }

  return summary;
};

export const assertCanUsePremiumExport = async (userId: string) => {
  const summary = await getUserPlanSummary(userId);
  assertExportableAccount(summary);

  if (!summary.entitlements.premiumExportEnabled) {
    throw new Error("vCard export is available on the Pro plan.");
  }

  return summary;
};

export const assertCanUseCardDavSync = async (userId: string) => {
  const summary = await getUserPlanSummary(userId);
  assertWritableAccount(summary);

  if (!summary.entitlements.cardDavSyncEnabled) {
    throw new Error("CardDAV sync is available on the Pro plan.");
  }

  return summary;
};

export const assertCanCreateSyncAccount = async (userId: string) => {
  const summary = await assertCanUseCardDavSync(userId);
  const syncAccountsUsed = await db.syncAccount.count({
    where: { userId },
  });

  if (syncAccountsUsed + 1 > summary.entitlements.syncAccountsLimit) {
    throw new Error(
      `${summary.planLabel} plan sync limit reached. You can connect up to ${summary.entitlements.syncAccountsLimit} sync account${summary.entitlements.syncAccountsLimit === 1 ? "" : "s"} on this plan.`,
    );
  }

  return {
    ...summary,
    syncAccountsUsed,
    syncAccountsRemaining: Math.max(summary.entitlements.syncAccountsLimit - syncAccountsUsed, 0),
  };
};

// --- Activity log & sharing gates (P11-03) -----------------------------------

// The global activity feed is gated by retention: Free has retention 0 (no feed);
// Pro (90), Family (365), and Teams (unlimited/null) all qualify. Using the
// retention entitlement instead of a plan-name list means new paid tiers are
// included automatically.
export const isActivityLogEnabled = (entitlements: PlanEntitlements) =>
  entitlements.activityLogRetentionDays !== 0;

export const assertCanUseActivityLog = async (userId: string) => {
  const context = await getUserBillingContext(userId);
  if (!isActivityLogEnabled(context.entitlements)) {
    throw new Error("The activity log is available on the Pro plan and above.");
  }
  return context;
};

// Sharing gates — stubbed now (P11-03) so Phases 12–14 can call them directly.
// Live/static Kontax-to-Kontax sharing requires Pro and above on the sender side.
export const assertCanLiveShare = async (userId: string) => {
  const context = await getUserBillingContext(userId);
  if (!context.entitlements.liveShareEnabled) {
    throw new Error("Live contact sharing is available on the Pro plan and above.");
  }
  return context;
};

export const assertCanStaticShare = async (userId: string) => {
  const context = await getUserBillingContext(userId);
  if (!context.entitlements.staticShareEnabled) {
    throw new Error("Contact sharing is available on the Pro plan and above.");
  }
  return context;
};

// Shared address books exist only on Family (1) and Teams (unlimited).
export const assertCanUseSharedAddressBooks = async (userId: string) => {
  const context = await getUserBillingContext(userId);
  const limit = context.entitlements.sharedAddressBooksLimit;
  if (limit === 0) {
    throw new Error("Shared address books are available on the Family and Teams plans.");
  }
  return context;
};
