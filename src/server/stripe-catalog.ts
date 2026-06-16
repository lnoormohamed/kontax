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

type CatalogShape = Partial<Record<PlanKey, Partial<Record<IntervalKey, CatalogEntry>>>>;

// Server-process cache — refreshes after TTL or on restart
let _catalog: StripeCatalog | null = null;
let _fetchedAt = 0;
const TTL_MS = 5 * 60 * 1000;

const CONFIGURED_PRICE_IDS: Record<PlanKey, Record<IntervalKey, string | undefined>> = {
  pro: {
    monthly: process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
    annual: process.env.STRIPE_PRICE_ID_PRO_YEARLY,
  },
  family: {
    monthly: process.env.STRIPE_PRICE_ID_FAMILY_MONTHLY,
    annual: process.env.STRIPE_PRICE_ID_FAMILY_YEARLY,
  },
  teams: {
    monthly: process.env.STRIPE_PRICE_ID_TEAMS_MONTHLY,
    annual: process.env.STRIPE_PRICE_ID_TEAMS_YEARLY,
  },
};

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

function toCatalogEntry(price: Stripe.Price): CatalogEntry | null {
  if (price.unit_amount === null || !price.recurring) return null;
  return {
    priceId: price.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
  };
}

function isCompleteCatalog(partial: CatalogShape): partial is StripeCatalog {
  return Boolean(
    partial.pro?.monthly && partial.pro?.annual &&
    partial.family?.monthly && partial.family?.annual &&
    partial.teams?.monthly && partial.teams?.annual,
  );
}

async function getConfiguredCatalog(stripe: Stripe): Promise<StripeCatalog | null> {
  const requests: Array<Promise<{ plan: PlanKey; interval: IntervalKey; entry: CatalogEntry | null }>> = [];

  for (const plan of Object.keys(CONFIGURED_PRICE_IDS) as PlanKey[]) {
    for (const interval of Object.keys(CONFIGURED_PRICE_IDS[plan]) as IntervalKey[]) {
      const priceId = CONFIGURED_PRICE_IDS[plan][interval];
      if (!priceId) continue;
      requests.push(
        stripe.prices.retrieve(priceId).then((price) => ({
          plan,
          interval,
          entry: price.active ? toCatalogEntry(price) : null,
        })),
      );
    }
  }

  if (!requests.length) return null;

  const resolved = await Promise.all(requests);
  const partial: CatalogShape = {};

  for (const { plan, interval, entry } of resolved) {
    if (!entry) continue;
    if (!partial[plan]) partial[plan] = {};
    partial[plan]![interval] = entry;
  }

  return isCompleteCatalog(partial) ? partial : null;
}

export async function getStripeCatalog(): Promise<StripeCatalog | null> {
  const now = Date.now();
  if (_catalog && now - _fetchedAt < TTL_MS) return _catalog;

  try {
    const stripe = getStripeClient();
    const configuredCatalog = await getConfiguredCatalog(stripe);
    if (configuredCatalog) {
      _catalog = configuredCatalog;
      _fetchedAt = now;
      return _catalog;
    }

    const prices = await stripe.prices.list({
      active: true,
      limit: 100,
      expand: ["data.product"],
    });

    const partial: CatalogShape = {};

    for (const price of prices.data) {
      if (!price.unit_amount || !price.recurring) continue;
      const product = price.product as Stripe.Product;
      if (!product.active) continue;

      const planKey = matchPlan(product.name);
      if (!planKey) continue;

      const intervalKey: IntervalKey =
        price.recurring.interval === "year" ? "annual" : "monthly";
      const entry = toCatalogEntry(price);
      if (!entry) continue;

      if (!partial[planKey]) partial[planKey] = {};
      partial[planKey]![intervalKey] = entry;
    }

    if (!isCompleteCatalog(partial)) {
      return null;
    }

    _catalog = partial;
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
