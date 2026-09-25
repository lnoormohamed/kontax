// Placeholder provider ids: rows that look like Stripe billing but have no
// Stripe object behind them, so their ids must never be sent to the Stripe API.
//   · "manual_…"          pre-Stripe comp plans, and (P49A-07) admin plan
//                          overrides: "manual_admin-override-<userId>" on both
//                          the Subscription and, when the user had no customer
//                          yet, the SubscriptionCustomer row;
//   · "admin-override-…"  legacy admin overrides from before P49A-07 (prod has
//                          none, but a stale row must never pass as real).
// Fable review (P49A-06/07): the portal, checkout, seat changes, account
// deletion and billing sync all filter these out before calling Stripe.

const PLACEHOLDER_PREFIXES = ["manual_", "admin-override-"] as const;

/** True for a provider customer/subscription id with no Stripe object behind it. */
export function isPlaceholderProviderId(id: string | null | undefined): boolean {
  return !!id && PLACEHOLDER_PREFIXES.some((prefix) => id.startsWith(prefix));
}

/**
 * Prisma `where` fragment for Subscription rows that ARE real Stripe
 * subscriptions. Spread into a `where` that has no `NOT` of its own.
 */
export const REAL_STRIPE_SUBSCRIPTION_WHERE = {
  NOT: PLACEHOLDER_PREFIXES.map((prefix) => ({ providerSubscriptionId: { startsWith: prefix } })),
};
