import Link from "next/link";

import { fetchStripePrices, formatCurrencyAmount } from "../../pricing/_prices";
import { ArrowIcon, PlanCard, SectionHead } from "../mkt-ui";

// P49-04 / P50-03 · §06 Pricing teaser — Free vs Pro only (decision D4).
//
// The Pro price is the same live Stripe read /pricing uses (fetchStripePrices
// → getStripeCatalog); nothing is hard-coded. The homepage is ISR (hourly,
// like /pricing), so this runs at build/revalidation time, never per request.
// If the catalog is unavailable the Pro card renders without a price. Free is
// formatted like the Free column on /pricing (catalog currency, else GBP).

// Limits from the verified fact list (src/server/billing.ts).
const FREE_POINTS = ["Up to 500 contacts", "1 sync source", "1 phone or Mac over CardDAV", "CSV and Kontax archive export"];
const PRO_POINTS = ["Unlimited contacts", "Up to 5 sync sources", "5 devices", "Developer API", "vCard export"];

export async function PricingTeaser() {
  const prices = await fetchStripePrices();
  const currency = prices?.currency ?? "gbp";

  return (
    <section className="mkt-band" id="pricing">
      <div className="mkt-container">
        <SectionHead index="06" label="Pricing" title="Free until you need more" />
        <div className="mkt-plans mkt-plans--2 hp-plans">
          <PlanCard
            name="Free"
            audience="For one person getting organised."
            price={<span className="mkt-plan__amount">{formatCurrencyAmount(currency, 0)}</span>}
            features={FREE_POINTS}
          />
          <PlanCard
            name="Pro"
            highlight
            badge="Most flexible"
            audience="For you, across every account."
            price={
              prices ? (
                <>
                  <span className="mkt-plan__amount">{formatCurrencyAmount(prices.currency, prices.pro.monthly)}</span>
                  <span>/month</span>
                </>
              ) : null
            }
            features={PRO_POINTS}
          />
        </div>
        <div className="hp-plans-foot">
          <Link className="mkt-more" href="/pricing">
            Compare all plans
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}
