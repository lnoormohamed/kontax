import { getStripeCatalog } from "~/server/stripe-catalog";
import type { StripePrices } from "./_pricing-toggle";

// The one live-price read for the marketing site. /pricing and the homepage
// pricing teaser (P49-04) both call this, so the amounts they show always come
// from the same Stripe catalog. Returns null when the catalog is unavailable
// or incomplete; callers decide what to render without a price.
export async function fetchStripePrices(): Promise<StripePrices | null> {
  try {
    const catalog = await getStripeCatalog();
    if (!catalog) return null;
    const currency = catalog.pro.monthly.currency;
    return {
      currency,
      pro:    { monthly: catalog.pro.monthly.unitAmount / 100,    annual: catalog.pro.annual.unitAmount / 100 },
      family: { monthly: catalog.family.monthly.unitAmount / 100, annual: catalog.family.annual.unitAmount / 100 },
      teams:  { monthly: catalog.teams.monthly.unitAmount / 100,  annual: catalog.teams.annual.unitAmount / 100 },
    };
  } catch {
    return null;
  }
}

export function formatCurrencyAmount(currency: string, amount: number): string {
  const normalizedCurrency = currency.toUpperCase();
  const hasFraction = amount % 1 !== 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
