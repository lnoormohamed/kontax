import { type SubscriptionPlan, type SubscriptionStatus } from "../../generated/prisma";

import { getUserBillingContext, getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";

/**
 * Presentation-layer billing state for the P19-DB02 surfaces (settings card +
 * in-app banners). This reads the canonical subscription/lifecycle rows the
 * Stripe webhook maintains and derives the exact state the design renders — it
 * never calls Stripe. Prices stay as the repo-wide "£X" placeholder pending the
 * commercial decision (same convention as pricing-comparison.tsx / plan-data.ts).
 */

// The settings billing card picks one layout per lifecycle moment.
export type BillingSurfaceState =
  | "free"
  | "active" // Pro/Teams active, owner-less
  | "trial"
  | "cancel"
  | "familyOwner"
  | "grace";

export type BillingUsageRow = {
  label: string;
  used: number;
  limit: number | null;
  /** Render as a capped ●○○ dot meter instead of a bar. */
  dots?: boolean;
  /** Override the right-hand value text (e.g. "Unlimited"). */
  valueLabel?: string;
  suffix?: string;
};

export type BillingSurface = {
  state: BillingSurfaceState;
  plan: SubscriptionPlan;
  planLabel: string;
  status: SubscriptionStatus | null;
  /** "Monthly" | "Annual" | null */
  intervalLabel: string | null;
  /** Repo-wide placeholder price; null when there's no recurring charge to show. */
  price: string | null;
  per: string | null;
  /** Formatted period-end / next-billing date, when relevant. */
  renewalDate: string | null;
  trial: {
    endsOn: string;
    daysRemaining: number;
  } | null;
  /** GRACE state: when the card / banner deadline falls. */
  graceDeadline: string | null;
  members: { used: number; total: number } | null;
  usage: BillingUsageRow[] | null;
};

const PLAN_PRICE: Record<SubscriptionPlan, { price: string | null; per: string | null }> = {
  // Placeholder amounts per the locked commercial-decision-pending policy.
  FREE: { price: null, per: null },
  PRO: { price: "£X", per: "/month" },
  FAMILY: { price: "£X", per: "/month" },
  TEAMS: { price: "£X", per: "/seat · month" },
};

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const daysUntil = (date: Date) =>
  Math.max(0, Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

export const getBillingSurface = async (userId: string): Promise<BillingSurface> => {
  const summary = await getUserPlanSummary(userId);
  const { plan, planLabel, entitlements, lifecycleState } = summary;

  const subscription = await db.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] }, plan: { not: "FREE" } },
    orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
    select: {
      status: true,
      interval: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
      graceEndsAt: true,
      cancelAtPeriodEnd: true,
    },
  });

  const intervalLabel = subscription
    ? subscription.interval === "YEARLY"
      ? "Annual"
      : "Monthly"
    : null;
  const { price, per } = PLAN_PRICE[plan];

  // Free plan: usage grid only, no subscription chrome.
  if (plan === "FREE") {
    return {
      state: "free",
      plan,
      planLabel,
      status: null,
      intervalLabel: null,
      price: null,
      per: null,
      renewalDate: null,
      trial: null,
      graceDeadline: null,
      members: null,
      usage: buildUsage(summary),
    };
  }

  const status = subscription?.status ?? null;

  // Grace / payment failed — takes priority over everything else.
  if (lifecycleState === "GRACE" || status === "PAST_DUE") {
    const deadline = subscription?.graceEndsAt ?? null;
    return {
      state: "grace",
      plan,
      planLabel,
      status,
      intervalLabel,
      price,
      per,
      renewalDate: null,
      trial: null,
      graceDeadline: deadline ? formatDate(deadline) : null,
      members: null,
      usage: null,
    };
  }

  // Trialing.
  if (status === "TRIALING" && subscription?.trialEndsAt) {
    return {
      state: "trial",
      plan,
      planLabel,
      status,
      intervalLabel: "Trial",
      price: null,
      per: null,
      renewalDate: null,
      trial: {
        endsOn: formatDate(subscription.trialEndsAt),
        daysRemaining: daysUntil(subscription.trialEndsAt),
      },
      graceDeadline: null,
      members: null,
      usage: null,
    };
  }

  // Cancellation scheduled.
  if (subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
    return {
      state: "cancel",
      plan,
      planLabel,
      status,
      intervalLabel: "Cancelling",
      price: null,
      per: null,
      renewalDate: formatDate(subscription.currentPeriodEnd),
      trial: null,
      graceDeadline: null,
      members: null,
      usage: null,
    };
  }

  // Family owner — show member slots.
  if (plan === "FAMILY" && entitlements.memberSlotsLimit) {
    const membership = await db.groupMember.findFirst({
      where: { userId, inviteStatus: "ACCEPTED", role: "OWNER", group: { type: "FAMILY" } },
      select: { group: { select: { memberSlotsLimit: true, _count: { select: { members: true } } } } },
    });
    return {
      state: "familyOwner",
      plan,
      planLabel,
      status,
      intervalLabel,
      price,
      per,
      renewalDate: subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : null,
      trial: null,
      graceDeadline: null,
      members: {
        used: membership?.group._count.members ?? 1,
        total: membership?.group.memberSlotsLimit ?? entitlements.memberSlotsLimit,
      },
      usage: null,
    };
  }

  // Pro / Teams active.
  return {
    state: "active",
    plan,
    planLabel,
    status,
    intervalLabel,
    price,
    per,
    renewalDate: subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : null,
    trial: null,
    graceDeadline: null,
    members: null,
    usage: buildUsage(summary),
  };
};

// Usage grid for Free and active personal plans (matches §1a / §1b).
function buildUsage(summary: Awaited<ReturnType<typeof getUserPlanSummary>>): BillingUsageRow[] {
  const { entitlements, contactsUsed, importedThisMonth } = summary;
  return [
    { label: "Contacts", used: contactsUsed, limit: entitlements.contactsLimit },
    {
      label: "Imports",
      used: importedThisMonth,
      limit: entitlements.monthlyImportLimit,
      suffix: "this month",
      valueLabel: entitlements.monthlyImportLimit === null ? "Unlimited" : undefined,
    },
    {
      label: "Sync accounts",
      used: Math.min(1, entitlements.syncAccountsLimit),
      limit: entitlements.syncAccountsLimit,
      dots: entitlements.syncAccountsLimit <= 6,
    },
    {
      label: "App passwords",
      used: Math.min(1, entitlements.appPasswordsLimit),
      limit: entitlements.appPasswordsLimit,
      dots: entitlements.appPasswordsLimit <= 6,
    },
  ];
}

// ── In-app banner (§2) ────────────────────────────────────────────────────────

export type BillingBannerVariant =
  | "ownerGrace"
  | "ownerCritical"
  | "familyMember"
  | "trialEnding";

export type BillingBanner = {
  variant: BillingBannerVariant;
  /** Days remaining (trial, or grace window) for copy interpolation. */
  daysRemaining: number | null;
};

const CRITICAL_GRACE_HOURS = 24;

/**
 * Resolve the single billing banner (if any) to pin below the top nav. Owners
 * see grace/critical/trial-ending banners driven by their own subscription;
 * non-owner family members see a read-only "owner needs to pay" notice.
 */
export const getBillingBanner = async (userId: string): Promise<BillingBanner | null> => {
  const context = await getUserBillingContext(userId);

  // Non-owner family member: surface the owner's payment problem (no CTA).
  const familyMember = await db.groupMember.findFirst({
    where: {
      userId,
      inviteStatus: "ACCEPTED",
      role: { not: "OWNER" },
      group: { type: "FAMILY" },
    },
    select: { group: { select: { owner: { select: { lifecycleState: true } } } } },
  });
  if (familyMember) {
    const ownerState = familyMember.group.owner.lifecycleState;
    if (ownerState === "GRACE" || ownerState === "LOCKED") {
      return { variant: "familyMember", daysRemaining: null };
    }
  }

  const subscription = await db.subscription.findFirst({
    where: { userId, status: { in: ["TRIALING", "PAST_DUE"] }, plan: { not: "FREE" } },
    orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
    select: { status: true, trialEndsAt: true, graceEndsAt: true },
  });
  if (!subscription) return null;

  // Owner in grace: split standard vs critical by hours remaining.
  if (context.lifecycleState === "GRACE" || subscription.status === "PAST_DUE") {
    const graceEndsAt = subscription.graceEndsAt;
    const hoursLeft = graceEndsAt
      ? (graceEndsAt.getTime() - Date.now()) / (60 * 60 * 1000)
      : Number.POSITIVE_INFINITY;
    return {
      variant: hoursLeft < CRITICAL_GRACE_HOURS ? "ownerCritical" : "ownerGrace",
      daysRemaining: graceEndsAt ? daysUntil(graceEndsAt) : null,
    };
  }

  // Trial ending within 5 days.
  if (subscription.status === "TRIALING" && subscription.trialEndsAt) {
    const days = daysUntil(subscription.trialEndsAt);
    if (days <= 5) {
      return { variant: "trialEnding", daysRemaining: days };
    }
  }

  return null;
};
