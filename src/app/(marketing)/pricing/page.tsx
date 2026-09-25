import Link from "next/link";
import type { Metadata } from "next";
import { Fragment } from "react";
import { PLAN_INFO, PLAN_MATRIX, type CellValue, type PlanKey } from "~/app/_components/plan-data";
import { JsonLd, breadcrumbSchema, pricingSoftwareApplicationSchema } from "~/app/_components/json-ld";
import { PricingToggle } from "./_pricing-toggle";
import { FaqList } from "./_faq";
import { fetchStripePrices, formatCurrencyAmount } from "./_prices";
import type { StripePrices } from "./_pricing-toggle";
import { isMicrosoftSyncEnabled } from "~/lib/microsoft-sync-flag";
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

const CHECK = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);

function Cell({ value }: { value: CellValue }) {
  if (value === true) return <span className="pr-cell-yes" aria-label="Included">{CHECK}</span>;
  if (value === false) return <span className="pr-cell-no" aria-label="Not included">—</span>;
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
          pricingSoftwareApplicationSchema(stripePrices),
        ]}
      />
      {/* ── Hero ── */}
      <section className="pr-hero">
        <div className="pr-wrap">
          <h1 className="pr-hero__title">Simple, honest pricing</h1>
          <p className="pr-hero__sub">Start free. Upgrade when you&apos;re ready.</p>
        </div>
      </section>

      {/* ── Billing toggle + Plan cards (client interactive) ── */}
      <PricingToggle stripePrices={stripePrices} outlookLive={outlookLive} />

      {/* ── Feature matrix ── */}
      <section className="pr-matrix-sec">
        <div className="pr-wrap">
          <h2 className="pr-matrix-head">Compare all features</h2>
          <p className="pr-matrix-lede">Every plan, side by side. No asterisks, no surprises.</p>
          <div className="pr-matrix-wrapper">
            <table className="pr-matrix">
              <thead>
                <tr>
                  <th scope="col"></th>
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
                    <tr className="pr-cat"><td colSpan={5}>{group.cat}</td></tr>
                    {group.rows
                      .filter((row) => outlookLive || !row.requiresOutlook)
                      .map((row) => (
                        <tr key={row.id} className="pr-row">
                          <td>{row.label}</td>
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
      <section className="pr-faq-sec">
        <div className="pr-wrap">
          <div className="pr-faq-inner">
            <h2 className="pr-faq-head">Frequently asked questions</h2>
            <FaqList />
            <p className="pr-faq-foot">
              Still have questions? <Link href="/contact">Get in touch</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="mkt-cta-band">
        <div className="mkt-cta-band__inner">
          <h2 className="mkt-cta-band__title">Ready to get started?</h2>
          <p className="mkt-cta-band__sub">Free plan, no credit card required.</p>
          <Link className="mkt-cta-band__btn" href="/register">
            Get started free
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h13" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  );
}
