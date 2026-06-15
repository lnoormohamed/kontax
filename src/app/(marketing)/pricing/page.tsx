import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "~/app/_components/json-ld";
import { PricingToggle } from "./_pricing-toggle";
import { FaqList } from "./_faq";
import { auth } from "~/server/auth";
import { getUserBillingContext } from "~/server/billing";
import "./pricing.css";

export const metadata: Metadata = {
  title: "Pricing — Kontax",
  description:
    "Start free with 100 contacts. Upgrade to Pro for unlimited contacts, sync, and the developer API.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing",
    description:
      "Start free with 100 contacts. Upgrade to Pro for unlimited contacts, sync, and the developer API.",
    url: "/pricing",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=pricing", width: 1200, height: 630, alt: "Kontax — Simple, honest pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Kontax",
    description:
      "Start free with 100 contacts. Upgrade to Pro for unlimited contacts, sync, and the developer API.",
  },
};

const CHECK = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);

function Cell({ yes, text }: { yes?: boolean; text?: string }) {
  if (yes) return <span className="pr-cell-yes" aria-label="Included">{CHECK}</span>;
  if (text) return <>{text}</>;
  return <span className="pr-cell-no" aria-label="Not included">—</span>;
}

export default async function PricingPage() {
  const session = await auth();
  const currentPlan = session?.user?.id
    ? await getUserBillingContext(session.user.id).then((b) => b.plan).catch(() => null)
    : null;

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ])}
      />
      {/* ── Hero ── */}
      <section className="pr-hero">
        <div className="pr-wrap">
          <h1 className="pr-hero__title">Simple, honest pricing</h1>
          <p className="pr-hero__sub">Start free. Upgrade when you&apos;re ready.</p>
        </div>
      </section>

      {/* ── Billing toggle + Plan cards (client interactive) ── */}
      <PricingToggle currentPlan={currentPlan} />

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
                  <th scope="col">
                    <span className="pr-mh-name">Free</span>
                    <span className="pr-mh-price">£0</span>
                  </th>
                  <th scope="col">
                    <span className="pr-mh-name">Pro</span>
                    <span className="pr-mh-price">£5/mo</span>
                  </th>
                  <th scope="col">
                    <span className="pr-mh-name">Family</span>
                    <span className="pr-mh-price">£8/mo</span>
                  </th>
                  <th scope="col">
                    <span className="pr-mh-name">Teams</span>
                    <span className="pr-mh-price">£12/mo</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* CORE */}
                <tr className="pr-cat"><td colSpan={5}>Core</td></tr>
                <tr className="pr-row"><td>Contacts</td><td>100</td><td>Unlimited</td><td>Unlimited</td><td>Unlimited</td></tr>
                <tr className="pr-row"><td>Advanced search</td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><td>Labels</td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><td>Import (CSV, vCard)</td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><td>Export (GDPR)</td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><td>Global activity feed</td><td><Cell /></td><td><Cell text="365 days" /></td><td><Cell text="90 days" /></td><td><Cell text="Unlimited" /></td></tr>
                <tr className="pr-row"><td>Minimum events kept</td><td><Cell text="3 events" /></td><td><Cell text="25 events" /></td><td><Cell text="10 events" /></td><td><Cell text="All events" /></td></tr>
                <tr className="pr-row"><td>Per-contact history</td><td><Cell text="Last 3 shown" /></td><td><Cell text="Full · 365 days" /></td><td><Cell text="Full · 90 days" /></td><td><Cell text="Full · unlimited" /></td></tr>
                <tr className="pr-row"><td>Merge duplicates</td><td><Cell /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>

                {/* SYNC */}
                <tr className="pr-cat"><td colSpan={5}>Sync</td></tr>
                <tr className="pr-row"><td>CardDAV accounts</td><td><Cell text="1 account" /></td><td><Cell text="Unlimited" /></td><td><Cell text="Unlimited" /></td><td><Cell text="Unlimited" /></td></tr>
                <tr className="pr-row"><td>Google Contacts</td><td><Cell /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><td>Outlook</td><td><Cell /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><td>iCloud (via CardDAV)</td><td><Cell text="CardDAV" /></td><td><Cell text="CardDAV" /></td><td><Cell text="CardDAV" /></td><td><Cell text="CardDAV" /></td></tr>
                <tr className="pr-row"><td>Two-way sync</td><td><Cell /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>

                {/* SHARING */}
                <tr className="pr-cat"><td colSpan={5}>Sharing</td></tr>
                <tr className="pr-row"><td>Public contact card</td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><td>Share individual contacts</td><td><Cell /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><td>Shared address book</td><td><Cell /></td><td><Cell /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><td>Members</td><td><Cell /></td><td><Cell /></td><td><Cell text="Up to 6" /></td><td><Cell text="Unlimited" /></td></tr>
                <tr className="pr-row"><td>Roles &amp; permissions</td><td><Cell /></td><td><Cell /></td><td><Cell /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><td>Audit log</td><td><Cell /></td><td><Cell /></td><td><Cell /></td><td><Cell yes /></td></tr>

                {/* DEVELOPER */}
                <tr className="pr-cat"><td colSpan={5}>Developer</td></tr>
                <tr className="pr-row"><td>REST API</td><td><Cell /></td><td><Cell yes /></td><td><Cell /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><td>Webhooks</td><td><Cell /></td><td><Cell yes /></td><td><Cell /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><td>API rate limit</td><td><Cell /></td><td><Cell text="5k / day" /></td><td><Cell /></td><td><Cell text="20k / day" /></td></tr>

                {/* SUPPORT */}
                <tr className="pr-cat"><td colSpan={5}>Support</td></tr>
                <tr className="pr-row"><td>Help centre</td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td><td><Cell yes /></td></tr>
                <tr className="pr-row"><td>Email support</td><td><Cell /></td><td><Cell text="Standard" /></td><td><Cell text="Standard" /></td><td><Cell text="Priority" /></td></tr>
                <tr className="pr-row"><td>Priority support</td><td><Cell /></td><td><Cell /></td><td><Cell /></td><td><Cell yes /></td></tr>
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
