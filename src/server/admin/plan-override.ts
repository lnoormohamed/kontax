import "server-only";

import type { PrismaClient, SubscriptionPlan } from "../../../generated/prisma";

// P49A-07 (A-11): an admin plan override must never poison Stripe. Before this
// ticket, `overridePlan` upserted `SubscriptionCustomer.providerCustomerId =
// "admin-override-<userId>"` — a fake id that checkout/portal then handed
// straight to the Stripe API (and that `syncStripeBillingState` tried to list
// subscriptions for). This module implements the override as a comp
// *personal* Subscription row using the SAME placeholder convention the
// pre-Stripe "manual_" comps already use (see stripe-customers.ts /
// stripe-handlers.ts): a "manual_" - prefixed id never reaches Stripe and is
// skipped by `syncStripeBillingState`. Unlike a pre-Stripe comp, an override
// row is NOT swept away when a real subscription goes active — an explicit
// admin grant must survive the customer's own renewals (Fable review); see
// `isAdminOverrideProviderId`.
//
// It never edits `getUserBillingContext` (billing.ts) — that function is
// being changed separately (P49A-06) to resolve the user's *highest-ranked*
// active personal subscription, which is what makes "an override never masks
// a paying user's real plan" true. This module's only job is to make sure the
// rows it writes are safe inputs to that resolution: it never touches an
// existing real (`cus_...`) customer row, and it never cancels or downgrades
// a real subscription row.

/**
 * A provider id that must never be sent to Stripe: the pre-Stripe "manual_"
 * comp convention, and the legacy "admin-override-" ids this ticket replaces
 * (prod has none today, but a future migration or backfill could reintroduce
 * one, so every placeholder check treats both prefixes as equivalent).
 */
export function isPlaceholderProviderId(id: string | null | undefined): boolean {
  return !!id && (id.startsWith("manual_") || id.startsWith("admin-override-"));
}

/** Prefix of the comp Subscription row an admin plan override writes. */
export const ADMIN_OVERRIDE_SUBSCRIPTION_PREFIX = "manual_admin-override-";

/**
 * Is this provider subscription id an admin plan override — a current
 * `manual_admin-override-<userId>` row or a legacy `admin-override-` one?
 * Unlike a pre-Stripe `manual_` comp, an override is an explicit admin grant:
 * the webhook's "a live Stripe subscription supersedes a legacy manual one"
 * sweep skips it, and only `removePlanOverrideForUser` ends it.
 */
export function isAdminOverrideProviderId(id: string | null | undefined): boolean {
  return (
    !!id && (id.startsWith(ADMIN_OVERRIDE_SUBSCRIPTION_PREFIX) || id.startsWith("admin-override-"))
  );
}

/** The single, deterministic placeholder id used for one user's comp override row. */
function overrideProviderId(userId: string): string {
  return `${ADMIN_OVERRIDE_SUBSCRIPTION_PREFIX}${userId}`;
}

export type OverrideDb = Pick<PrismaClient, "subscriptionCustomer" | "subscription">;

export type PlanOverrideResult = {
  providerSubscriptionId: string;
  providerCustomerId: string;
  /** True when the customer row backing this override is a placeholder (not a real `cus_...` id). */
  usedPlaceholderCustomer: boolean;
};

/**
 * Grant (or update) a comp personal subscription for `targetUserId` at `plan`.
 *
 * NEVER overwrites an existing SubscriptionCustomer row's providerCustomerId
 * — if the user already has one (real `cus_...` or a legacy placeholder), it
 * is reused as-is. A new SubscriptionCustomer is only created (with a
 * placeholder id) when the user has none yet.
 */
export async function overridePlanForUser(
  db: OverrideDb,
  args: { targetUserId: string; plan: SubscriptionPlan },
): Promise<PlanOverrideResult> {
  const existingCustomer = await db.subscriptionCustomer.findUnique({
    where: { userId: args.targetUserId },
    select: { id: true, providerCustomerId: true },
  });

  let subscriptionCustomerId: string;
  let providerCustomerId: string;

  if (existingCustomer) {
    subscriptionCustomerId = existingCustomer.id;
    providerCustomerId = existingCustomer.providerCustomerId;
  } else {
    providerCustomerId = overrideProviderId(args.targetUserId);
    const created = await db.subscriptionCustomer.create({
      data: {
        userId: args.targetUserId,
        provider: "STRIPE",
        providerCustomerId,
      },
      select: { id: true },
    });
    subscriptionCustomerId = created.id;
  }

  const providerSubscriptionId = overrideProviderId(args.targetUserId);
  await db.subscription.upsert({
    where: { provider_providerSubscriptionId: { provider: "STRIPE", providerSubscriptionId } },
    update: {
      plan: args.plan,
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      canceledAt: null,
      endedAt: null,
    },
    create: {
      userId: args.targetUserId,
      subscriptionCustomerId,
      provider: "STRIPE",
      providerSubscriptionId,
      plan: args.plan,
      status: "ACTIVE",
    },
  });

  return {
    providerSubscriptionId,
    providerCustomerId,
    usedPlaceholderCustomer: isPlaceholderProviderId(providerCustomerId),
  };
}

/**
 * Cancel the comp override row for `targetUserId` (a "remove override").
 * Never touches any other subscription row — a real, paid Stripe
 * subscription for the same user is left completely alone.
 *
 * Returns false when there was no active override to remove.
 */
export async function removePlanOverrideForUser(
  db: OverrideDb,
  args: { targetUserId: string },
): Promise<boolean> {
  const providerSubscriptionId = overrideProviderId(args.targetUserId);
  const existing = await db.subscription.findUnique({
    where: { provider_providerSubscriptionId: { provider: "STRIPE", providerSubscriptionId } },
    select: { id: true, status: true },
  });
  if (!existing || existing.status === "CANCELED") return false;

  const now = new Date();
  await db.subscription.update({
    where: { id: existing.id },
    data: { status: "CANCELED", cancelAtPeriodEnd: false, canceledAt: now, endedAt: now },
  });
  return true;
}
