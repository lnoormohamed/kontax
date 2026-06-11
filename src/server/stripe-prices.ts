import { SubscriptionPlan, SubscriptionInterval } from "../../generated/prisma";

export type PriceKey = `${SubscriptionPlan}_${SubscriptionInterval}`;

const PRICE_MAP: Record<PriceKey, string | undefined> = {
  PRO_MONTHLY:    process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
  PRO_YEARLY:     process.env.STRIPE_PRICE_ID_PRO_YEARLY,
  FAMILY_MONTHLY: process.env.STRIPE_PRICE_ID_FAMILY_MONTHLY,
  FAMILY_YEARLY:  process.env.STRIPE_PRICE_ID_FAMILY_YEARLY,
  TEAMS_MONTHLY:  process.env.STRIPE_PRICE_ID_TEAMS_MONTHLY,
  TEAMS_YEARLY:   process.env.STRIPE_PRICE_ID_TEAMS_YEARLY,
  FREE_MONTHLY:   undefined,
  FREE_YEARLY:    undefined,
};

export function getStripePriceId(
  plan: SubscriptionPlan,
  interval: SubscriptionInterval,
): string {
  const key: PriceKey = `${plan}_${interval}`;
  const priceId = PRICE_MAP[key];
  if (!priceId) {
    throw new Error(`No Stripe price ID configured for ${key}. Set STRIPE_PRICE_ID_${key} in env.`);
  }
  return priceId;
}

export function getPlanFromPriceId(priceId: string): {
  plan: SubscriptionPlan;
  interval: SubscriptionInterval;
} | null {
  for (const [key, id] of Object.entries(PRICE_MAP)) {
    if (id === priceId) {
      const [plan, interval] = key.split("_") as [SubscriptionPlan, SubscriptionInterval];
      return { plan, interval };
    }
  }
  return null;
}
