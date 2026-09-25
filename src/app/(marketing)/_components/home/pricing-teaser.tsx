import Link from "next/link";
import { Suspense } from "react";

import { fetchStripePrices, formatCurrencyAmount } from "../../pricing/_prices";
import type { StripePrices } from "../../pricing/_pricing-toggle";
import { Icon } from "./icons";

// P49-04 · §8 Pricing teaser — Free vs Pro only (decision D4).
//
// The Pro price is the same live Stripe read /pricing uses (fetchStripePrices
// → getStripeCatalog); nothing is hard-coded. If the catalog is unavailable
// the Pro card renders without a price. Free is formatted exactly like the
// Free column on /pricing (the catalog currency, falling back to GBP).
//
// The read is streamed behind <Suspense> so a cold Stripe call never holds up
// the hero; the fallback is the same cards without the Pro price.

const FREE_POINTS = [
  "Up to 500 contacts",
  "1 sync source",
  "One phone or Mac over CardDAV",
  "Export any time",
];

// Pro's syncAccountsLimit is 5 (src/server/billing.ts).
const PRO_POINTS = ["Unlimited contacts", "Up to 5 sync sources", "Developer API", "Everything in Free"];

function Points({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>
          <Icon name="check" size={16} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function PricingCards({ prices }: { prices: StripePrices | null }) {
  const currency = prices?.currency ?? "gbp";
  return (
    <div className="hp-ptz">
      <div className="hp-ptz__card">
        <div className="hp-ptz__top">
          <span className="hp-ptz__name">Free</span>
          <span className="hp-ptz__price">
            <b>{formatCurrencyAmount(currency, 0)}</b>
          </span>
        </div>
        <Points items={FREE_POINTS} />
      </div>
      <div className="hp-ptz__card hp-ptz__card--pro">
        <div className="hp-ptz__top">
          <span className="hp-ptz__name">Pro</span>
          {prices ? (
            <span className="hp-ptz__price">
              <b>{formatCurrencyAmount(prices.currency, prices.pro.monthly)}</b>/mo
            </span>
          ) : null}
        </div>
        <Points items={PRO_POINTS} />
      </div>
    </div>
  );
}

async function LivePricingCards() {
  const prices = await fetchStripePrices();
  return <PricingCards prices={prices} />;
}

export function PricingTeaser() {
  return (
    <section className="hp-band" id="pricing">
      <div className="hp-container">
        <div className="hp-section-head hp-section-head--center">
          <p className="hp-section-kicker">Pricing</p>
          <h2 className="hp-section-title">Free until you need more</h2>
        </div>
        <Suspense fallback={<PricingCards prices={null} />}>
          <LivePricingCards />
        </Suspense>
        <div className="hp-ptz-foot">
          <Link className="hp-more-link" href="/pricing">
            Compare plans
            <Icon name="arrow" size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
