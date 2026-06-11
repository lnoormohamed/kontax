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
import { getStripeClient } from "~/server/stripe";
import { getPlanFromPriceId } from "~/server/stripe-prices";

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

// ─── Core upsert ─────────────────────────────────────────────────────────────

async function upsertSubscription(
  userId: string,
  stripeSubscription: Stripe.Subscription,
  tx: Tx,
): Promise<void> {
  const priceId = stripeSubscription.items.data[0]?.price.id;
  if (!priceId) throw new Error("Subscription has no price item");

  const planInfo = getPlanFromPriceId(priceId);
  if (!planInfo) throw new Error(`Unknown price ID: ${priceId}`);

  const status = mapStripeStatus(stripeSubscription.status);
  // current_period_start/end moved to the subscription item in Stripe API v2026+
  const item = stripeSubscription.items.data[0];
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
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    canceledAt: stripeSubscription.canceled_at
      ? new Date(stripeSubscription.canceled_at * 1000)
      : null,
  };

  const existing = await tx.subscription.findFirst({
    where: { userId, providerSubscriptionId: stripeSubscription.id },
  });

  const fromPlan: SubscriptionPlan = existing?.plan ?? "FREE";

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

  await tx.user.update({
    where: { id: userId },
    data: { lifecycleState: deriveLifecycleState(status) },
  });

  if (planRank(planInfo.plan) < planRank(fromPlan)) {
    await applyDowngrade(userId, fromPlan, planInfo.plan, tx);
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

  // 4. Group dissolution — Phase 13/14 owns this; log for now
  if (
    ["FAMILY", "TEAMS"].includes(fromPlan) &&
    !["FAMILY", "TEAMS"].includes(toPlan)
  ) {
    console.warn(
      `[billing] TODO(Phase13/14): dissolve group for user ${userId} on downgrade from ${fromPlan} to ${toPlan}`,
    );
  }
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
    select: { userId: true },
  });
  if (!customer) {
    throw new Error(
      `No SubscriptionCustomer found for Stripe customer ${stripeCustomerId}`,
    );
  }

  const stripe = getStripeClient();
  const stripeSubscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);

  await upsertSubscription(customer.userId, stripeSubscription, tx);
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
    select: { userId: true },
  });
  if (!customer) return;

  await upsertSubscription(customer.userId, stripeSubscription, tx);
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
    select: { userId: true },
  });
  if (!customer) return;

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
    select: { userId: true },
  });
  if (!customer) return;

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
    select: { userId: true },
  });
  if (!customer) return;

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
