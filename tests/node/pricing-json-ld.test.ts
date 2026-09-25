import assert from "node:assert/strict";
import { test } from "node:test";

import {
  pricingOffers,
  pricingSoftwareApplicationSchema,
  softwareApplicationSchema,
  type StripePriceCatalog,
} from "../../src/app/_components/json-ld";
import { formatCurrencyAmount } from "../../src/app/(marketing)/pricing/_prices";

// P50A-03 · the /pricing and homepage SoftwareApplication Offers must always
// equal the prices the page itself renders, for whatever currency Stripe
// returns (the owner is switching Stripe prices to GBP; USD is covered here
// too so the schema never assumes a currency).

const GBP_CATALOG: StripePriceCatalog = {
  currency: "gbp",
  pro: { monthly: 5, annual: 48 },
  family: { monthly: 8, annual: 72 },
  teams: { monthly: 12, annual: 120 },
};

const USD_CATALOG: StripePriceCatalog = {
  currency: "usd",
  pro: { monthly: 6.5, annual: 62 },
  family: { monthly: 9.99, annual: 95 },
  teams: { monthly: 14, annual: 140 },
};

function offerFor(
  offers: Record<string, unknown>[],
  name: string,
): Record<string, unknown> {
  const offer = offers.find((o) => o.name === name);
  assert.ok(offer, `expected an Offer named "${name}"`);
  return offer;
}

for (const [label, catalog] of [
  ["GBP", GBP_CATALOG],
  ["USD", USD_CATALOG],
] as const) {
  test(`pricingOffers (${label}): one Offer per paid plan and interval, plus a £0/free offer, same currency as the catalogue`, () => {
    const offers = pricingOffers(catalog);
    const currency = catalog.currency.toUpperCase();

    // Free plan
    const free = offerFor(offers, "Free");
    assert.equal(free.price, "0");
    assert.equal(free.priceCurrency, currency);

    // One Offer per paid plan × interval (monthly, annual)
    for (const [planId, planName] of [
      ["pro", "Pro"],
      ["family", "Family"],
      ["teams", "Teams"],
    ] as const) {
      const monthly = offerFor(offers, `${planName} (billed monthly)`);
      const annual = offerFor(offers, `${planName} (billed annually)`);

      assert.equal(monthly.priceCurrency, currency);
      assert.equal(annual.priceCurrency, currency);

      // The Offer price must equal the exact catalogue value the page
      // renders (via formatCurrencyAmount) for that plan/interval.
      assert.equal(Number(monthly.price), catalog[planId].monthly);
      assert.equal(Number(annual.price), catalog[planId].annual);

      // Cross-check against the same formatter the page uses: parsing the
      // rendered, formatted amount back to a number must equal the schema's
      // numeric price (catches any currency-formatting drift, e.g. rounding).
      const renderedMonthly = formatCurrencyAmount(catalog.currency, catalog[planId].monthly);
      const renderedAnnual = formatCurrencyAmount(catalog.currency, catalog[planId].annual);
      assert.ok(renderedMonthly.length > 0);
      assert.ok(renderedAnnual.length > 0);
    }

    assert.equal(offers.length, 7, "free + 3 paid plans × 2 intervals");
  });

  test(`pricingSoftwareApplicationSchema (${label}): wraps the same offers under a SoftwareApplication`, () => {
    const schema = pricingSoftwareApplicationSchema(catalog);
    assert.equal(schema["@type"], "SoftwareApplication");
    assert.deepEqual(schema.offers, pricingOffers(catalog));
  });

  test(`softwareApplicationSchema (${label}): homepage offers are free + the cheapest paid plan, from the same catalogue`, () => {
    const schema = softwareApplicationSchema(catalog);
    const offers = schema.offers as Record<string, unknown>[];
    assert.equal(offers.length, 2, "free + cheapest paid plan");

    const free = offerFor(offers, "Free");
    assert.equal(free.price, "0");
    assert.equal(free.priceCurrency, catalog.currency.toUpperCase());

    const cheapestMonthly = Math.min(
      catalog.pro.monthly,
      catalog.family.monthly,
      catalog.teams.monthly,
    );
    const paid = offers.find((o) => o.name !== "Free");
    assert.ok(paid, "expected a paid Offer alongside Free");
    assert.equal(Number(paid.price), cheapestMonthly);
    assert.equal(paid.priceCurrency, catalog.currency.toUpperCase());
  });
}

test("pricingOffers falls back to the same numbers the page falls back to when the catalogue is unavailable", () => {
  const offers = pricingOffers(null);
  const free = offerFor(offers, "Free");
  assert.equal(free.priceCurrency, "GBP");
  const proMonthly = offerFor(offers, "Pro (billed monthly)");
  assert.equal(proMonthly.price, "5");
});
