import type { SubscriptionPlan, SubscriptionInterval } from "../../generated/prisma";
import { getCatalogPriceId, type PlanKey, type IntervalKey } from "./stripe-catalog";

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

/** Resolves a price ID: env var first, then auto-discovered from the Stripe catalog. */
export async function getStripePriceIdAsync(
  plan: SubscriptionPlan,
  interval: SubscriptionInterval,
): Promise<string> {
  const key: PriceKey = `${plan}_${interval}`;
  const fromEnv = PRICE_MAP[key];
  if (fromEnv) return fromEnv;

  const planKey = plan.toLowerCase() as PlanKey;
  const intervalKey: IntervalKey = interval === "YEARLY" ? "annual" : "monthly";
  const fromCatalog = await getCatalogPriceId(planKey, intervalKey);
  if (fromCatalog) return fromCatalog;

  throw new Error(`No Stripe price found for ${key}`);
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

/** Like getPlanFromPriceId but also checks the auto-discovered catalog. */
export async function getPlanFromPriceIdAsync(priceId: string): Promise<{
  plan: SubscriptionPlan;
  interval: SubscriptionInterval;
} | null> {
  const fromEnv = getPlanFromPriceId(priceId);
  if (fromEnv) return fromEnv;

  const { getStripeCatalog } = await import("./stripe-catalog");
  const catalog = await getStripeCatalog();
  if (!catalog) return null;

  const PLAN_MAP: [PlanKey, SubscriptionPlan][] = [
    ["pro", "PRO"], ["family", "FAMILY"], ["teams", "TEAMS"],
  ];
  for (const [planKey, plan] of PLAN_MAP) {
    if (catalog[planKey].monthly.priceId === priceId) return { plan, interval: "MONTHLY" };
    if (catalog[planKey].annual.priceId === priceId)  return { plan, interval: "YEARLY" };
  }
  return null;
}
