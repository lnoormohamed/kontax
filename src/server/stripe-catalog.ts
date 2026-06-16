import type Stripe from "stripe";
import { getStripeClient } from "./stripe";

export type PlanKey = "pro" | "family" | "teams";
export type IntervalKey = "monthly" | "annual";

export type CatalogEntry = {
  priceId: string;
  unitAmount: number; // in smallest currency unit (e.g. cents)
  currency: string;
};

export type StripeCatalog = {
  [K in PlanKey]: { monthly: CatalogEntry; annual: CatalogEntry };
};

// Server-process cache — refreshes after TTL or on restart
let _catalog: StripeCatalog | null = null;
let _fetchedAt = 0;
const TTL_MS = 5 * 60 * 1000;

// Match product names to plan keys. Teams is checked first to avoid
// a hypothetical "Pro Teams" matching "pro".
const PLAN_PATTERNS: { re: RegExp; key: PlanKey }[] = [
  { re: /\bteams?\b/i, key: "teams" },
  { re: /\bfamily\b/i, key: "family" },
  { re: /\bpro\b/i, key: "pro" },
];

function matchPlan(name: string): PlanKey | null {
  for (const { re, key } of PLAN_PATTERNS) {
    if (re.test(name)) return key;
  }
  return null;
}

export async function getStripeCatalog(): Promise<StripeCatalog | null> {
  const now = Date.now();
  if (_catalog && now - _fetchedAt < TTL_MS) return _catalog;

  try {
    const stripe = getStripeClient();
    const prices = await stripe.prices.list({
      active: true,
      limit: 100,
      expand: ["data.product"],
    });

    const partial: Partial<Record<PlanKey, Partial<Record<IntervalKey, CatalogEntry>>>> = {};

    for (const price of prices.data) {
      if (!price.unit_amount || !price.recurring) continue;
      const product = price.product as Stripe.Product;
      if (!product.active) continue;

      const planKey = matchPlan(product.name);
      if (!planKey) continue;

      const intervalKey: IntervalKey =
        price.recurring.interval === "year" ? "annual" : "monthly";

      if (!partial[planKey]) partial[planKey] = {};
      partial[planKey]![intervalKey] = {
        priceId: price.id,
        unitAmount: price.unit_amount,
        currency: price.currency,
      };
    }

    if (
      !partial.pro?.monthly || !partial.pro?.annual ||
      !partial.family?.monthly || !partial.family?.annual ||
      !partial.teams?.monthly || !partial.teams?.annual
    ) {
      return null;
    }

    _catalog = {
      pro:    { monthly: partial.pro.monthly,    annual: partial.pro.annual },
      family: { monthly: partial.family.monthly, annual: partial.family.annual },
      teams:  { monthly: partial.teams.monthly,  annual: partial.teams.annual },
    };
    _fetchedAt = now;
    return _catalog;
  } catch {
    return null;
  }
}

export async function getCatalogPriceId(
  plan: PlanKey,
  interval: IntervalKey,
): Promise<string | null> {
  const catalog = await getStripeCatalog();
  return catalog?.[plan]?.[interval]?.priceId ?? null;
}
