import { type SubscriptionPlan } from "../../generated/prisma";

import { db } from "~/server/db";

export type BillingLifecycleState = "ACTIVE" | "TRIALING" | "GRACE" | "CANCELED" | "LOCKED";

type PlanEntitlements = {
  contactsLimit: number;
  monthlyImportLimit: number;
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
  contactsLimit: 25000,
  monthlyImportLimit: 25000,
  syncAccountsLimit: 5,
  appPasswordsLimit: 5,
  advancedMergeEnabled: true,
  premiumExportEnabled: true,
  cardDavSyncEnabled: true,
  liveShareEnabled: true,
  staticShareEnabled: true,
} as const;

const PLAN_DEFAULTS: Record<SubscriptionPlan, PlanEntitlements> = {
  FREE: {
    contactsLimit: 500,
    monthlyImportLimit: 3,
    syncAccountsLimit: 1,
    appPasswordsLimit: 1,
    advancedMergeEnabled: false,
    premiumExportEnabled: false,
    cardDavSyncEnabled: false,
    familyGroupEnabled: false,
    teamsEnabled: false,
    sharedAddressBooksLimit: 0,
    memberSlotsLimit: null,
    activityLogRetentionDays: 0,
    liveShareEnabled: false,
    staticShareEnabled: false,
  },
  PRO: {
    ...PRO_PERSONAL,
    familyGroupEnabled: false,
    teamsEnabled: false,
    sharedAddressBooksLimit: 0,
    memberSlotsLimit: null,
    activityLogRetentionDays: 90,
  },
  FAMILY: {
    ...PRO_PERSONAL,
    familyGroupEnabled: true,
    teamsEnabled: false,
    sharedAddressBooksLimit: 1,
    memberSlotsLimit: 6,
    activityLogRetentionDays: 365,
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
        select: {
          plan: true,
          contactsLimit: true,
          monthlyImportLimit: true,
          syncAccountsLimit: true,
          appPasswordsLimit: true,
          advancedMergeEnabled: true,
          premiumExportEnabled: true,
          cardDavSyncEnabled: true,
          familyGroupEnabled: true,
          teamsEnabled: true,
          sharedAddressBooksLimit: true,
          memberSlotsLimit: true,
          activityLogRetentionDays: true,
          liveShareEnabled: true,
          staticShareEnabled: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User account could not be found.");
  }

  const subscription = user.subscriptions[0];
  const plan = subscription?.plan ?? "FREE";
  const defaults = PLAN_DEFAULTS[plan];

  return {
    lifecycleState: user.lifecycleState,
    plan,
    planLabel: PLAN_LABELS[plan],
    entitlements: {
      contactsLimit: subscription?.contactsLimit ?? defaults.contactsLimit,
      monthlyImportLimit: subscription?.monthlyImportLimit ?? defaults.monthlyImportLimit,
      syncAccountsLimit: subscription?.syncAccountsLimit ?? defaults.syncAccountsLimit,
      appPasswordsLimit: subscription?.appPasswordsLimit ?? defaults.appPasswordsLimit,
      advancedMergeEnabled: subscription?.advancedMergeEnabled ?? defaults.advancedMergeEnabled,
      premiumExportEnabled:
        subscription?.premiumExportEnabled ?? defaults.premiumExportEnabled,
      cardDavSyncEnabled: subscription?.cardDavSyncEnabled ?? defaults.cardDavSyncEnabled,
      familyGroupEnabled: subscription?.familyGroupEnabled ?? defaults.familyGroupEnabled,
      teamsEnabled: subscription?.teamsEnabled ?? defaults.teamsEnabled,
      sharedAddressBooksLimit:
        subscription?.sharedAddressBooksLimit ?? defaults.sharedAddressBooksLimit,
      memberSlotsLimit: subscription?.memberSlotsLimit ?? defaults.memberSlotsLimit,
      activityLogRetentionDays:
        subscription?.activityLogRetentionDays ?? defaults.activityLogRetentionDays,
      liveShareEnabled: subscription?.liveShareEnabled ?? defaults.liveShareEnabled,
      staticShareEnabled: subscription?.staticShareEnabled ?? defaults.staticShareEnabled,
    },
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
    contactsRemaining: Math.max(context.entitlements.contactsLimit - contactsUsed, 0),
    importedThisMonth: importedThisMonthAggregate._sum.importedCount ?? 0,
  };
};

export const assertCanCreateContacts = async (userId: string, incomingCount = 1) => {
  const summary = await getUserPlanSummary(userId);
  assertWritableAccount(summary);

  if (summary.contactsUsed + incomingCount > summary.entitlements.contactsLimit) {
    throw new Error(
      `${summary.planLabel} plan limit reached. You can store up to ${summary.entitlements.contactsLimit} contacts on this plan.`,
    );
  }

  return summary;
};

export const assertCanImportContacts = async (userId: string, incomingCount: number) => {
  const summary = await assertCanCreateContacts(userId, incomingCount);

  if (summary.importedThisMonth + incomingCount > summary.entitlements.monthlyImportLimit) {
    throw new Error(
      `${summary.planLabel} plan import limit reached. You can import up to ${summary.entitlements.monthlyImportLimit} contacts per month on this plan.`,
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
