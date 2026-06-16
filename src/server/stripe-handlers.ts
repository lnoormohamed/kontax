import type {
  AccountLifecycleState,
  Prisma,
  SubscriptionPlan,
  SubscriptionStatus,
} from "../../generated/prisma";
import type Stripe from "stripe";

import {
  sendPaymentFailedEmail,
  sendPlanChangedEmail,
  sendTrialEndingEmail,
} from "~/server/billing-emails";
import { db } from "~/server/db";
import { createNotification } from "~/server/notifications";
import { getStripeClient } from "~/server/stripe";
import { getPlanFromPriceIdAsync } from "~/server/stripe-prices";

type Tx = Prisma.TransactionClient;

// ─── Status / lifecycle helpers ───────────────────────────────────────────────

function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status,
): SubscriptionStatus {
  const map: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "PAST_DUE",
    incomplete: "INCOMPLETE",
    incomplete_expired: "EXPIRED",
    paused: "PAUSED",
  };
  return map[stripeStatus] ?? "ACTIVE";
}

function deriveLifecycleState(
  status: SubscriptionStatus,
): AccountLifecycleState {
  if (status === "ACTIVE" || status === "TRIALING") return "ACTIVE";
  if (status === "PAST_DUE") return "GRACE";
  // CANCELED / EXPIRED → user is back on Free, which is still ACTIVE
  return "ACTIVE";
}

const PLAN_RANK: Record<SubscriptionPlan, number> = {
  FREE: 0,
  PRO: 1,
  FAMILY: 2,
  TEAMS: 3,
};
function planRank(plan: SubscriptionPlan): number {
  return PLAN_RANK[plan] ?? 0;
}

const ACTIVE_BILLING_STATUSES: SubscriptionStatus[] = ["ACTIVE", "TRIALING", "PAST_DUE"];

const isLegacyManualSubscription = (subscriptionId: string | null | undefined) =>
  !!subscriptionId && subscriptionId.startsWith("manual_");

// ─── Core upsert ─────────────────────────────────────────────────────────────

async function upsertSubscription(
  userId: string,
  stripeSubscription: Stripe.Subscription,
  tx: Tx,
): Promise<void> {
  const priceId = stripeSubscription.items.data[0]?.price.id;
  if (!priceId) throw new Error("Subscription has no price item");

  const planInfo = await getPlanFromPriceIdAsync(priceId);
  if (!planInfo) throw new Error(`Unknown price ID: ${priceId}`);

  const status = mapStripeStatus(stripeSubscription.status);
  const cancelScheduled =
    stripeSubscription.cancel_at_period_end ||
    (stripeSubscription.cancel_at !== null && stripeSubscription.status !== "canceled");
  // current_period_start/end moved to the subscription item in Stripe API v2026+
  const item = stripeSubscription.items.data[0];
  // For TEAMS per-seat billing, Stripe's quantity is the authoritative seat count.
  const quantity = item?.quantity ?? 1;

  const subscriptionData = {
    plan: planInfo.plan,
    status,
    interval: planInfo.interval,
    currentPeriodStart: item?.current_period_start
      ? new Date(item.current_period_start * 1000)
      : null,
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * 1000)
      : null,
    trialEndsAt: stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000)
      : null,
    cancelAtPeriodEnd: cancelScheduled,
    canceledAt: stripeSubscription.canceled_at
      ? new Date(stripeSubscription.canceled_at * 1000)
      : null,
    ...(planInfo.plan === "TEAMS" ? { memberSlotsLimit: quantity } : {}),
  };

  const existing = await tx.subscription.findFirst({
    where: { userId, providerSubscriptionId: stripeSubscription.id },
  });

  const legacyManualSubscription = existing
    ? null
    : await tx.subscription.findFirst({
        where: {
          userId,
          providerSubscriptionId: { startsWith: "manual_" },
          status: { in: ACTIVE_BILLING_STATUSES },
        },
        orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
        select: { plan: true },
      });

  const fromPlan: SubscriptionPlan =
    existing?.plan ?? legacyManualSubscription?.plan ?? "FREE";

  if (existing) {
    await tx.subscription.update({
      where: { id: existing.id },
      data: subscriptionData,
    });
  } else {
    const subCustomer = await tx.subscriptionCustomer.findUniqueOrThrow({
      where: { userId },
    });
    await tx.subscription.create({
      data: {
        userId,
        subscriptionCustomerId: subCustomer.id,
        provider: "STRIPE",
        providerSubscriptionId: stripeSubscription.id,
        ...subscriptionData,
      },
    });
  }

  await tx.subscription.updateMany({
    where: {
      userId,
      providerSubscriptionId: { startsWith: "manual_" },
      status: { in: ACTIVE_BILLING_STATUSES },
    },
    data: {
      status: "CANCELED",
      cancelAtPeriodEnd: false,
      canceledAt: new Date(),
      endedAt: new Date(),
    },
  });

  await tx.user.update({
    where: { id: userId },
    data: { lifecycleState: deriveLifecycleState(status) },
  });

  if (planRank(planInfo.plan) < planRank(fromPlan)) {
    await applyDowngrade(userId, fromPlan, planInfo.plan, tx, subscriptionData.currentPeriodEnd);
  }

  // Re-upgrading to TEAMS lifts any active grace lock on the owned team group.
  if (planInfo.plan === "TEAMS" && fromPlan !== "TEAMS") {
    await tx.group.updateMany({
      where: { ownerId: userId, type: "TEAM", teamsGraceEndsAt: { not: null } },
      data: { teamsGraceEndsAt: null },
    });
  }

  // Notify on any plan change (P20-08). Fire-and-forget so a slow/failed send
  // never blocks or rolls back the webhook transaction.
  if (fromPlan !== planInfo.plan) {
    void sendPlanChangedEmail({ userId, fromPlan, toPlan: planInfo.plan });
  }
}

// ─── Downgrade side-effects ───────────────────────────────────────────────────

async function applyDowngrade(
  userId: string,
  fromPlan: SubscriptionPlan,
  toPlan: SubscriptionPlan,
  tx: Tx,
  currentPeriodEnd?: Date | null,
): Promise<void> {
  // 1. Pause over-limit sync accounts — Free allows 1; keep oldest active, pause rest
  if (toPlan === "FREE") {
    const syncAccounts = await tx.syncAccount.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
    const toPause = syncAccounts.slice(1);
    if (toPause.length > 0) {
      await tx.syncAccount.updateMany({
        where: { id: { in: toPause.map((s) => s.id) } },
        data: { status: "PAUSED" },
      });
    }
  }

  // 2. Convert outbound live shares to static (lifecycle-policies.md §4a)
  if (!["PRO", "FAMILY", "TEAMS"].includes(toPlan)) {
    await tx.contactShare.updateMany({
      where: { ownerUserId: userId, shareType: "LIVE_SYNC", status: "ACTIVE" },
      data: { shareType: "STATIC_COPY" },
    });
  }

  // 3. Convert inbound live shares to static (user can no longer receive live updates)
  if (!["PRO", "FAMILY", "TEAMS"].includes(toPlan)) {
    await tx.contactShare.updateMany({
      where: {
        recipientUserId: userId,
        shareType: "LIVE_SYNC",
        status: "ACTIVE",
        recipientContactId: { not: null },
      },
      data: { shareType: "STATIC_COPY" },
    });
  }

  // 4. Teams downgrade → start 14-day grace period on the owned team group.
  // Members keep read access; all writes are blocked after grace expires.
  // Re-upgrading to TEAMS clears the field (handled in upsertSubscription).
  if (fromPlan === "TEAMS" && toPlan !== "TEAMS") {
    const graceBase = currentPeriodEnd ?? new Date();
    const teamsGraceEndsAt = new Date(graceBase.getTime() + 14 * 24 * 60 * 60 * 1000);
    await tx.group.updateMany({
      where: { ownerId: userId, type: "TEAM", teamsGraceEndsAt: null },
      data: { teamsGraceEndsAt },
    });
  }
}

// ─── Org-anchored upsert (P34F-02) ────────────────────────────────────────────
//
// The Teams counterpart to upsertSubscription. The subscription row is owned by
// the Group (groupId set, userId null) and team capability lives on the Group
// (teamsEnabled / teamsGraceEndsAt / seat count). Per P34F-DB01 §07 this is NOT a
// copy of upsertSubscription: it deliberately does NOT run applyDowngrade's
// personal side-effects (sync-account pause, share conversion — meaningless for
// an org) and does NOT write lifecycleState (an org isn't a user).
async function upsertGroupSubscription(
  groupId: string,
  stripeSubscription: Stripe.Subscription,
  tx: Tx,
): Promise<void> {
  const priceId = stripeSubscription.items.data[0]?.price.id;
  if (!priceId) throw new Error("Subscription has no price item");

  const planInfo = await getPlanFromPriceIdAsync(priceId);
  if (!planInfo) throw new Error(`Unknown price ID: ${priceId}`);

  const status = mapStripeStatus(stripeSubscription.status);
  const cancelScheduled =
    stripeSubscription.cancel_at_period_end ||
    (stripeSubscription.cancel_at !== null && stripeSubscription.status !== "canceled");
  const item = stripeSubscription.items.data[0];
  // Stripe quantity is the authoritative seat count for Teams.
  const quantity = item?.quantity ?? 1;

  const subscriptionData = {
    plan: planInfo.plan,
    status,
    interval: planInfo.interval,
    currentPeriodStart: item?.current_period_start
      ? new Date(item.current_period_start * 1000)
      : null,
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * 1000)
      : null,
    trialEndsAt: stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000)
      : null,
    cancelAtPeriodEnd: cancelScheduled,
    canceledAt: stripeSubscription.canceled_at
      ? new Date(stripeSubscription.canceled_at * 1000)
      : null,
    ...(planInfo.plan === "TEAMS" ? { memberSlotsLimit: quantity } : {}),
  };

  const subCustomer = await tx.subscriptionCustomer.findUniqueOrThrow({
    where: { groupId },
  });

  const existing = await tx.subscription.findFirst({
    where: { groupId, providerSubscriptionId: stripeSubscription.id },
  });

  let subscriptionId: string;
  if (existing) {
    await tx.subscription.update({ where: { id: existing.id }, data: subscriptionData });
    subscriptionId = existing.id;
  } else {
    const created = await tx.subscription.create({
      data: {
        groupId,
        subscriptionCustomerId: subCustomer.id,
        provider: "STRIPE",
        providerSubscriptionId: stripeSubscription.id,
        ...subscriptionData,
      },
    });
    subscriptionId = created.id;
  }

  // Org entitlement (P34F §08): the team's "is Teams active" is read off the
  // Group, not the owner. An active Teams sub enables the team and clears any
  // grace (covers re-upgrade); seat count flows to the group's capacity.
  const teamsActive =
    planInfo.plan === "TEAMS" && ACTIVE_BILLING_STATUSES.includes(status);
  await tx.group.update({
    where: { id: groupId },
    data: {
      subscriptionId,
      teamsEnabled: teamsActive,
      ...(teamsActive ? { teamsGraceEndsAt: null, maxMembers: quantity, memberSlotsLimit: quantity } : {}),
    },
  });
}

// ─── Public handlers (called by webhook router) ───────────────────────────────

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  tx: Tx,
): Promise<void> {
  if (session.mode !== "subscription") return;

  const stripeCustomerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;

  const customer = await tx.subscriptionCustomer.findFirst({
    where: { provider: "STRIPE", providerCustomerId: stripeCustomerId },
    select: { userId: true, groupId: true },
  });
  if (!customer) {
    throw new Error(
      `No SubscriptionCustomer found for Stripe customer ${stripeCustomerId}`,
    );
  }

  const stripe = getStripeClient();
  const stripeSubscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);

  // P34F-02: branch on the billing anchor — Teams customers route to the Group.
  if (customer.groupId) {
    await upsertGroupSubscription(customer.groupId, stripeSubscription, tx);
  } else if (customer.userId) {
    await upsertSubscription(customer.userId, stripeSubscription, tx);
  }
}

export async function handleSubscriptionUpserted(
  stripeSubscription: Stripe.Subscription,
  tx: Tx,
): Promise<void> {
  const customer = await tx.subscriptionCustomer.findFirst({
    where: {
      provider: "STRIPE",
      providerCustomerId: stripeSubscription.customer as string,
    },
    select: { userId: true, groupId: true },
  });
  if (!customer) return;

  // P34F-02: Teams customers route to the Group; personal to the User.
  if (customer.groupId) {
    await upsertGroupSubscription(customer.groupId, stripeSubscription, tx);
  } else if (customer.userId) {
    await upsertSubscription(customer.userId, stripeSubscription, tx);
  }
}

export async function handleSubscriptionDeleted(
  stripeSubscription: Stripe.Subscription,
  tx: Tx,
): Promise<void> {
  const customer = await tx.subscriptionCustomer.findFirst({
    where: {
      provider: "STRIPE",
      providerCustomerId: stripeSubscription.customer as string,
    },
    select: { userId: true, groupId: true },
  });
  if (!customer) return;

  // P34F-02: org-anchored cancellation → disable the team and open the 14-day
  // grace window on the Group (read-only until expiry, then locked). No user
  // lifecycle to touch — the org isn't a user.
  if (customer.groupId) {
    const groupSub = await tx.subscription.findFirst({
      where: {
        groupId: customer.groupId,
        providerSubscriptionId: stripeSubscription.id,
      },
      select: { id: true, currentPeriodEnd: true },
    });
    if (groupSub) {
      await tx.subscription.update({
        where: { id: groupSub.id },
        data: { status: "CANCELED", canceledAt: new Date(), endedAt: new Date() },
      });
    }
    const graceBase = groupSub?.currentPeriodEnd ?? new Date();
    await tx.group.update({
      where: { id: customer.groupId },
      data: {
        teamsEnabled: false,
        teamsGraceEndsAt: new Date(graceBase.getTime() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    return;
  }
  if (!customer.userId) return;

  const existing = await tx.subscription.findFirst({
    where: {
      userId: customer.userId,
      providerSubscriptionId: stripeSubscription.id,
    },
  });

  if (existing) {
    await tx.subscription.update({
      where: { id: existing.id },
      data: {
        plan: "FREE",
        status: "CANCELED",
        canceledAt: new Date(),
        endedAt: new Date(),
      },
    });
    await applyDowngrade(customer.userId, existing.plan, "FREE", tx);
  }

  // FREE is an active (not locked) state
  await tx.user.update({
    where: { id: customer.userId },
    data: { lifecycleState: "ACTIVE" },
  });
}

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  tx: Tx,
): Promise<void> {
  const customer = await tx.subscriptionCustomer.findFirst({
    where: {
      provider: "STRIPE",
      providerCustomerId: invoice.customer as string,
    },
    select: { userId: true, groupId: true },
  });
  if (!customer) return;

  // P34F-02: org-anchored payment failure → mark the team's subscription
  // PAST_DUE. No user lifecycle or personal notification (the org isn't a user);
  // billing-manager dunning is a later ticket.
  if (customer.groupId) {
    await tx.subscription.updateMany({
      where: { groupId: customer.groupId, status: { in: ["ACTIVE", "TRIALING"] } },
      data: {
        status: "PAST_DUE",
        graceEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });
    return;
  }
  if (!customer.userId) return;

  const graceEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const activeSub = await tx.subscription.findFirst({
    where: { userId: customer.userId, status: { in: ["ACTIVE", "TRIALING"] } },
    select: { plan: true },
  });

  await tx.user.update({
    where: { id: customer.userId },
    data: { lifecycleState: "GRACE" },
  });

  await tx.subscription.updateMany({
    where: { userId: customer.userId, status: { in: ["ACTIVE", "TRIALING"] } },
    data: { status: "PAST_DUE", graceEndsAt },
  });

  // Prompt the user to update their payment method before grace ends (P20-08).
  void sendPaymentFailedEmail({
    userId: customer.userId,
    graceEndsAt,
    planName: activeSub?.plan ?? "PRO",
  });

  // P22-DB05: in-app BILLING notification (always-on / locked category).
  void createNotification({
    userId: customer.userId,
    category: "BILLING",
    title: "Payment failed",
    body: "We couldn't process your payment. Update your payment method before your grace period ends.",
    actionUrl: "/settings",
  });
}

export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  tx: Tx,
): Promise<void> {
  const customer = await tx.subscriptionCustomer.findFirst({
    where: {
      provider: "STRIPE",
      providerCustomerId: invoice.customer as string,
    },
    select: { userId: true, groupId: true },
  });
  if (!customer) return;

  // P34F-02: org-anchored recovery → clear PAST_DUE on the team's subscription.
  if (customer.groupId) {
    await tx.subscription.updateMany({
      where: { groupId: customer.groupId, status: "PAST_DUE" },
      data: { status: "ACTIVE", graceEndsAt: null },
    });
    return;
  }
  if (!customer.userId) return;

  await tx.user.update({
    where: { id: customer.userId },
    data: { lifecycleState: "ACTIVE" },
  });

  await tx.subscription.updateMany({
    where: { userId: customer.userId, status: "PAST_DUE" },
    data: { status: "ACTIVE", graceEndsAt: null },
  });
}

// Queue a trial-ending email (Phase 20 / P20-08). Looks up the user email so
// the P20 email transport layer can send the reminder without a second DB query.
export async function handleTrialWillEnd(
  subscription: Stripe.Subscription,
  tx: Tx,
): Promise<void> {
  const customer = await tx.subscriptionCustomer.findFirst({
    where: {
      provider: "STRIPE",
      providerCustomerId: subscription.customer as string,
    },
    select: { user: { select: { id: true } } },
  });
  if (!customer) return;
  // P34F-02: a group (Teams) customer has no single user to email a trial
  // reminder to; billing-manager notifications are a later ticket. Skip.
  if (!customer.user) return;

  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000)
    : null;
  if (!trialEndsAt) return;

  const daysLeft = Math.max(
    1,
    Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000),
  );

  // Remind the user to add a payment method before the trial ends (P20-08).
  void sendTrialEndingEmail({
    userId: customer.user.id,
    daysLeft,
    trialEndsAt,
  });
}

/**
 * Pull the latest Stripe subscription state for a user into Kontax outside the
 * webhook path. This is used sparingly on high-signal return points like
 * Checkout success and Billing Portal return so Settings reflects plan changes
 * immediately even if the webhook arrives a moment later.
 */
export async function syncStripeBillingState(userId: string): Promise<boolean> {
  const customer = await db.subscriptionCustomer.findUnique({
    where: { userId },
    select: { provider: true, providerCustomerId: true },
  });
  if (!customer || customer.provider !== "STRIPE") return false;
  if (isLegacyManualSubscription(customer.providerCustomerId)) return false;

  const stripe = getStripeClient();

  const localSubscription = await db.subscription.findFirst({
    where: {
      userId,
      provider: "STRIPE",
      providerSubscriptionId: { not: "" },
    },
    orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
    select: { providerSubscriptionId: true },
  });

  let stripeSubscription: Stripe.Subscription | null = null;

  if (localSubscription?.providerSubscriptionId) {
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(localSubscription.providerSubscriptionId);
    } catch {
      stripeSubscription = null;
    }
  }

  if (!stripeSubscription) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.providerCustomerId,
      status: "all",
      limit: 10,
    });

    stripeSubscription =
      subscriptions.data.find((subscription) => subscription.status !== "incomplete_expired")
      ?? subscriptions.data[0]
      ?? null;
  }

  if (!stripeSubscription) return false;

  await db.$transaction(async (tx) => {
    if (stripeSubscription!.status === "canceled") {
      await handleSubscriptionDeleted(stripeSubscription!, tx);
      return;
    }

    await handleSubscriptionUpserted(stripeSubscription!, tx);
  });

  return true;
}
