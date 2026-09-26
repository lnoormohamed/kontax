import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "~/app/_components/json-ld";
import { PricingToggle } from "./_pricing-toggle";
import { FaqList } from "./_faq";
import { fetchStripePrices, formatCurrencyAmount } from "./_prices";
import type { StripePrices } from "./_pricing-toggle";
import { isMicrosoftSyncEnabled } from "~/lib/microsoft-sync-flag";
import { CheckIcon, CtaBand, SectionHead } from "../_components/mkt-ui";
import "./pricing.css";

const DEFAULT_STRIPE_PRICES: StripePrices = {
  currency: "gbp",
  pro: { monthly: 5, annual: 48 },
  family: { monthly: 8, annual: 72 },
  teams: { monthly: 12, annual: 120 },
};

function getMatrixPriceLabel(
  plan: "free" | "pro" | "family" | "teams",
  stripePrices: StripePrices | null,
): string {
  const prices = stripePrices ?? DEFAULT_STRIPE_PRICES;
  if (plan === "free") return formatCurrencyAmount(prices.currency, 0);
  return `${formatCurrencyAmount(prices.currency, prices[plan].monthly)}/mo`;
}

export const metadata: Metadata = {
  title: "Pricing — Kontax",
  description:
    "Start free with 500 contacts. Upgrade to Pro for unlimited contacts, more sync accounts, and the developer API.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing",
    description:
      "Start free with 500 contacts. Upgrade to Pro for unlimited contacts, more sync accounts, and the developer API.",
    url: "/pricing",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=pricing", width: 1200, height: 630, alt: "Kontax — Simple, honest pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Kontax",
    description:
      "Start free with 500 contacts. Upgrade to Pro for unlimited contacts, more sync accounts, and the developer API.",
  },
};

function Cell({ yes, text }: { yes?: boolean; text?: string }) {
  if (yes) return <span className="pr-yes"><CheckIcon size={18} label="Included" /></span>;
  if (text) return <>{text}</>;
  return (
    <span className="pr-no">
      <span aria-hidden="true">—</span>
      <span className="mkt-sr-only">Not included</span>
    </span>
  );
}

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
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ])}
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
                  <th scope="col">
                    <span className="pr-mh-name">Free</span>
                    <span className="pr-mh-price">{getMatrixPriceLabel("free", stripePrices)}</span>
                  </th>
                  <th scope="col">
                    <span className="pr-mh-name">Pro</span>
                    <span className="pr-mh-price">{getMatrixPriceLabel("pro", stripePrices)}</span>
                  </th>
                  <th scope="col">
                    <span className="pr-mh-name">Family</span>
                    <span className="pr-mh-price">{getMatrixPriceLabel("family", stripePrices)}</span>
                  </th>
                  <th scope="col">
                    <span className="pr-mh-name">Teams</span>
                    <span className="pr-mh-price">{getMatrixPriceLabel("teams", stripePrices)}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* CORE */}
                <tr className="pr-cat"><th colSpan={5} scope="colgroup">Core</th></tr>
                <tr className="pr-row"><th scope="row">Contacts</th><td>500</td><td>Unlimited</td><td>Unlimited</td><td>Unlimited</td></tr>
                <tr className="pr-row"><th scope="row">Advanced search</th><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><th scope="row">Labels</th><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><th scope="row">Import (CSV, vCard)</th><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><th scope="row">Export (GDPR)</th><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><th scope="row">Global activity feed</th><td><Cell /></td><td><Cell text="365 days" /></td><td><Cell text="90 days" /></td><td><Cell text="Unlimited" /></td></tr>
                <tr className="pr-row"><th scope="row">Minimum events kept</th><td><Cell text="3 events" /></td><td><Cell text="25 events" /></td><td><Cell text="10 events" /></td><td><Cell text="All events" /></td></tr>
                <tr className="pr-row"><th scope="row">Per-contact history</th><td><Cell text="Last 3 shown" /></td><td><Cell text="Full · 365 days" /></td><td><Cell text="Full · 90 days" /></td><td><Cell text="Full · unlimited" /></td></tr>
                <tr className="pr-row"><th scope="row">Merge duplicates</th><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>

                {/* SYNC */}
                <tr className="pr-cat"><th colSpan={5} scope="colgroup">Sync</th></tr>
                <tr className="pr-row"><th scope="row">CardDAV accounts</th><td><Cell text="1 account" /></td><td><Cell text="Up to 5" /></td><td><Cell text="Up to 5" /></td><td><Cell text="Up to 5" /></td></tr>
                <tr className="pr-row"><th scope="row">Google Contacts</th><td><Cell /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                {outlookLive && (
                  <tr className="pr-row"><th scope="row">Outlook</th><td><Cell /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                )}
                <tr className="pr-row"><th scope="row">iCloud (via CardDAV)</th><td><Cell text="CardDAV" /></td><td><Cell text="CardDAV" /></td><td><Cell text="CardDAV" /></td><td><Cell text="CardDAV" /></td></tr>
                <tr className="pr-row"><th scope="row">Two-way sync</th><td><Cell text="CardDAV" /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>

                {/* SHARING */}
                <tr className="pr-cat"><th colSpan={5} scope="colgroup">Sharing</th></tr>
                <tr className="pr-row"><th scope="row">Public contact card</th><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><th scope="row">Share individual contacts</th><td><Cell /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><th scope="row">Shared address book</th><td><Cell /></td><td><Cell /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><th scope="row">Members</th><td><Cell /></td><td><Cell /></td><td><Cell text="Up to 6" /></td><td><Cell text="Unlimited" /></td></tr>
                <tr className="pr-row"><th scope="row">Roles &amp; permissions</th><td><Cell /></td><td><Cell /></td><td><Cell /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><th scope="row">Audit log</th><td><Cell /></td><td><Cell /></td><td><Cell /></td><td><Cell yes /></td></tr>

                {/* DEVELOPER */}
                <tr className="pr-cat"><th colSpan={5} scope="colgroup">Developer</th></tr>
                <tr className="pr-row"><th scope="row">REST API</th><td><Cell /></td><td><Cell yes /></td><td><Cell /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><th scope="row">API rate limit</th><td><Cell /></td><td><Cell text="5k / day" /></td><td><Cell /></td><td><Cell text="20k / day" /></td></tr>

                {/* SUPPORT */}
                <tr className="pr-cat"><th colSpan={5} scope="colgroup">Support</th></tr>
                <tr className="pr-row"><th scope="row">Help centre</th><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><th scope="row">Email support</th><td><Cell /></td><td><Cell text="Standard" /></td><td><Cell text="Standard" /></td><td><Cell text="Priority" /></td></tr>
                <tr className="pr-row"><th scope="row">Priority support</th><td><Cell /></td><td><Cell /></td><td><Cell /></td><td><Cell yes /></td></tr>
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
      <CtaBand title="Ready to get started?" sub="Free plan, no credit card required." secondary={null} />
    </>
  );
}
