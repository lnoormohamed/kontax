import { type SubscriptionPlan } from "../../generated/prisma";

import { db } from "~/server/db";

type PlanEntitlements = {
  contactsLimit: number;
  monthlyImportLimit: number;
  syncAccountsLimit: number;
  advancedMergeEnabled: boolean;
  premiumExportEnabled: boolean;
  cardDavSyncEnabled: boolean;
};

type BillingContext = {
  lifecycleState: "ACTIVE" | "TRIALING" | "GRACE" | "CANCELED" | "LOCKED";
  plan: SubscriptionPlan;
  planLabel: string;
  entitlements: PlanEntitlements;
};

const PLAN_DEFAULTS: Record<SubscriptionPlan, PlanEntitlements> = {
  FREE: {
    contactsLimit: 500,
    monthlyImportLimit: 250,
    syncAccountsLimit: 0,
    advancedMergeEnabled: false,
    premiumExportEnabled: false,
    cardDavSyncEnabled: false,
  },
  PLUS: {
    contactsLimit: 5000,
    monthlyImportLimit: 5000,
    syncAccountsLimit: 1,
    advancedMergeEnabled: true,
    premiumExportEnabled: true,
    cardDavSyncEnabled: false,
  },
  PRO: {
    contactsLimit: 25000,
    monthlyImportLimit: 25000,
    syncAccountsLimit: 5,
    advancedMergeEnabled: true,
    premiumExportEnabled: true,
    cardDavSyncEnabled: true,
  },
};

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  FREE: "Free",
  PLUS: "Plus",
  PRO: "Pro",
};

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
          advancedMergeEnabled: true,
          premiumExportEnabled: true,
          cardDavSyncEnabled: true,
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
      advancedMergeEnabled: subscription?.advancedMergeEnabled ?? defaults.advancedMergeEnabled,
      premiumExportEnabled:
        subscription?.premiumExportEnabled ?? defaults.premiumExportEnabled,
      cardDavSyncEnabled: subscription?.cardDavSyncEnabled ?? defaults.cardDavSyncEnabled,
    },
  };
};

const assertWritableAccount = (context: BillingContext) => {
  if (context.lifecycleState === "LOCKED") {
    throw new Error("This account is locked. Update billing before making changes.");
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
  assertWritableAccount(summary);

  if (!summary.entitlements.premiumExportEnabled) {
    throw new Error("vCard export is available on Plus and Pro plans.");
  }

  return summary;
};
