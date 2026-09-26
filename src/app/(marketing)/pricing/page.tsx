import Link from "next/link";
import type { Metadata } from "next";
import { Fragment } from "react";
import { JsonLd, breadcrumbSchema, pricingSoftwareApplicationSchema } from "~/app/_components/json-ld";
import { PLAN_INFO, PLAN_MATRIX, type CellValue, type PlanKey } from "~/app/_components/plan-data";
import { PricingToggle } from "./_pricing-toggle";
import { FaqList } from "./_faq";
import { fetchStripePrices, formatCurrencyAmount } from "./_prices";
import type { StripePrices } from "./_pricing-toggle";
import { isMicrosoftSyncEnabled } from "~/lib/microsoft-sync-flag";
import { CheckIcon, CtaBand, SectionHead } from "../_components/mkt-ui";
import "./pricing.css";

// P49A-14 · no placeholder prices: when the Stripe catalogue is unavailable
// the paid columns show no price at all (like the homepage pricing teaser).
function getMatrixPriceLabel(
  plan: "free" | "pro" | "family" | "teams",
  stripePrices: StripePrices | null,
): string | null {
  if (plan === "free") return formatCurrencyAmount(stripePrices?.currency ?? "gbp", 0);
  if (!stripePrices) return null;
  return `${formatCurrencyAmount(stripePrices.currency, stripePrices[plan].monthly)}/mo`;
}

// P50A-04 · ≤ 60-char title (the marketing layout's title template is "%s",
// so this string is never suffixed again) and ≤ 160-char description.
const TITLE = "Kontax pricing — Free, Pro, Family and Teams";
const DESCRIPTION =
  "Compare Free, Pro, Family and Teams. Start free with 500 contacts; upgrade for unlimited contacts, sync accounts and the API.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/pricing",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=pricing", width: 1200, height: 630, alt: "Kontax — Simple, honest pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

function Cell({ value }: { value: CellValue }) {
  if (value === true) return <span className="pr-yes"><CheckIcon size={18} label="Included" /></span>;
  if (value === false) {
    return (
      <span className="pr-no">
        <span aria-hidden="true">—</span>
        <span className="mkt-sr-only">Not included</span>
      </span>
    );
  }
  if (typeof value === "string") return <>{value}</>;
  return (
    <>
      {value.v} <span className="pr-cell-note">({value.note})</span>
    </>
  );
}

const MATRIX_COLUMNS = [
  { plan: "Free", price: "free" },
  { plan: "Pro", price: "pro" },
  { plan: "Family", price: "family" },
  { plan: "Teams", price: "teams" },
] as const satisfies ReadonlyArray<{ plan: PlanKey; price: "free" | "pro" | "family" | "teams" }>;

// P38-10: statically rendered with hourly ISR for the Stripe price fetch;
// the visitor's current plan resolves client-side inside PricingToggle.
export const revalidate = 3600;

export default async function PricingPage() {
  const stripePrices = await fetchStripePrices();
  // P50A-01: Outlook only appears once Microsoft sync is configured (this
  // page re-renders on ISR's hourly revalidation, so it reflects the live
  // env — see ~/lib/microsoft-sync-flag).
  const outlookLive = isMicrosoftSyncEnabled();

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
          // P50A-03 · Offers only from the live Stripe catalogue.
          pricingSoftwareApplicationSchema(stripePrices),
        ]}
      />
      {/* ── Page head, billing toggle and plan cards (client interactive) ── */}
      <PricingToggle
        stripePrices={stripePrices}
        outlookLive={outlookLive}
        head={{
          label: "Pricing",
          title: "Simple, honest pricing",
          lede: "Start free. Upgrade when you’re ready.",
        }}
      />

      {/* ── Feature matrix ── */}
      <section className="pr-sec" id="compare">
        <div className="mkt-container">
          <SectionHead
            label="Compare plans"
            title="Compare all features"
            lede="Every plan, side by side. No asterisks, no surprises."
          />
          {/* Scrolls sideways inside its own frame on narrow screens; focusable
              so keyboard users can scroll it too. */}
          <div className="pr-mxw" role="region" aria-label="Plan comparison table" tabIndex={0}>
            <table className="pr-mxt">
              <caption className="mkt-sr-only">Plan comparison</caption>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  {MATRIX_COLUMNS.map(({ plan, price }) => {
                    const label = getMatrixPriceLabel(price, stripePrices);
                    return (
                      <th key={plan} scope="col">
                        <span className="pr-mh-name">{PLAN_INFO[plan].name}</span>
                        {label ? <span className="pr-mh-price">{label}</span> : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* P49A-14: every row comes from PLAN_MATRIX (plan-data.ts), whose
                    limits are read from the enforced entitlements. */}
                {PLAN_MATRIX.map((group) => (
                  <Fragment key={group.cat}>
                    <tr className="pr-cat"><th colSpan={5} scope="colgroup">{group.cat}</th></tr>
                    {group.rows
                      .filter((row) => outlookLive || !row.requiresOutlook)
                      .map((row) => (
                        <tr key={row.id} className="pr-row">
                          <th scope="row">{row.label}</th>
                          {MATRIX_COLUMNS.map(({ plan }) => (
                            <td key={plan}><Cell value={row.vals[plan]} /></td>
                          ))}
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="pr-sec pr-sec--last" id="faq">
        <div className="mkt-container">
          <SectionHead label="Billing questions" title="Frequently asked questions" />
          <FaqList />
          <p className="pr-faq-foot">
            Still have questions? <Link href="/contact">Get in touch</Link>.
          </p>
        </div>
      </section>

      {/* ── CTA band ── */}
      <CtaBand title="Ready to get started?" sub="Free for up to 500 contacts. No card needed." secondary={null} />
    </>
  );
}
