import type { PrismaClient, SubscriptionStatus } from "../../generated/prisma";

import { isPlaceholderProviderId, REAL_STRIPE_SUBSCRIPTION_WHERE } from "~/server/billing-placeholders";

/**
 * Statuses of a real Stripe subscription that must stop a NEW checkout (the
 * customer is sent to the billing portal instead). P49A-19 (Fable review):
 * PAST_DUE — Stripe `past_due` and `unpaid` — is included: since the 3-day
 * payment grace is enforced, a lapsed customer looks like Free, and a fresh
 * checkout would create a second subscription next to the unpaid one; both
 * would charge once the card is fixed. They fix the payment method instead.
 */
export const CHECKOUT_BLOCKING_STATUSES: SubscriptionStatus[] = ["ACTIVE", "TRIALING", "PAST_DUE"];

type GuardDb = Pick<PrismaClient, "group" | "subscription">;

/**
 * The live Stripe subscription that a new checkout for `plan` would duplicate,
 * or null. Personal plans: the user's own real subscriptions (comp / admin
 * override rows never block — they have no Stripe object). Teams (P34F-02):
 * the subscription of the team group the user owns.
 */
export async function findCheckoutBlockingSubscription(
  client: GuardDb,
  userId: string,
  plan: "PRO" | "FAMILY" | "TEAMS",
): Promise<{ id: string; status: SubscriptionStatus } | null> {
  if (plan === "TEAMS") {
    const teamGroup = await client.group.findFirst({
      where: { ownerId: userId, type: "TEAM" },
      select: { id: true },
    });
    if (!teamGroup) return null;
    const groupSub = await client.subscription.findFirst({
      where: {
        groupId: teamGroup.id,
        status: { in: CHECKOUT_BLOCKING_STATUSES },
        plan: { not: "FREE" },
        ...REAL_STRIPE_SUBSCRIPTION_WHERE,
      },
      select: { id: true, status: true, providerSubscriptionId: true },
    });
    return groupSub && !isPlaceholderProviderId(groupSub.providerSubscriptionId)
      ? { id: groupSub.id, status: groupSub.status }
      : null;
  }

  // Real Stripe subscriptions only: a comp / admin-override row found first
  // must not hide a paid one (which would allow a second, duplicate checkout).
  const sub = await client.subscription.findFirst({
    where: {
      userId,
      status: { in: CHECKOUT_BLOCKING_STATUSES },
      plan: { not: "FREE" },
      ...REAL_STRIPE_SUBSCRIPTION_WHERE,
    },
    select: { id: true, status: true, providerSubscriptionId: true },
  });
  return sub && !isPlaceholderProviderId(sub.providerSubscriptionId) ? { id: sub.id, status: sub.status } : null;
}
