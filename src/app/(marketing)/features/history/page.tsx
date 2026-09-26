import Link from "next/link";
import type { Metadata } from "next";

import { JsonLd, breadcrumbSchema } from "~/app/_components/json-ld";
import { webPageSchema } from "../../_components/page-schema";
import { CtaBand, Faq, SectionHead, Ticks } from "../../_components/mkt-ui";
import "../../_components/content-page.css";

// P50A-07 · Single-feature landing page. Facts verified against
// src/server/dav/plan-entitlements.mjs (historyDisplayCap, activityLogRetentionDays)
// and src/app/api/contacts/[id]/history/route.ts (how the per-contact History
// tab applies the display cap) — see the report for the ticket for the exact
// references. Numbers here are the entitlement matrix in plan-entitlements.mjs,
// not the (separately worded) row on /pricing.

const TITLE = "Change history for every contact — Kontax";
const DESCRIPTION =
  "Every edit, merge, import and sync to a contact is recorded — who changed what, and when. Free shows the last 3 events; Pro, Family and Teams show it all.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/features/history" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/features/history", siteName: "Kontax", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const FAQ_ITEMS = [
  {
    q: "What counts as an event?",
    a: "Creating a contact, editing a field, merging two contacts, importing from a file, and every sync that changes the contact from a connected provider. Each event records what changed and who or what made the change.",
  },
  {
    q: "What does Free actually show?",
    a: "The 3 most recent events for that contact, without pagination. Upgrading to Pro, Family or Teams shows the complete history for every contact, not just the newest few.",
  },
  {
    q: "Is per-contact history the same as the account activity feed?",
    a: "No — they're related but different. Per-contact history is what you see on one contact's own History tab. The account-wide activity feed is a single timeline across your whole address book, and it's a separate plan feature: it shows the last 365 days on Pro, the last 90 days on Family and all activity on Teams, and isn't included on Free.",
  },
  {
    q: "Who gets credited for changes in a shared book?",
    a: "The member who made the change. In a Family or Teams book, every member with access can see who added or edited a shared contact, not just their own edits.",
  },
];

export default function HistoryFeaturePage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Features", path: "/features" },
            { name: "History", path: "/features/history" },
          ]),
          webPageSchema({ name: TITLE, description: DESCRIPTION, path: "/features/history" }),
        ]}
      />

      {/* ── Hero ── */}
      <section className="mkt-band">
        <div className="mkt-container">
          <SectionHead
            headingLevel={1}
            label="Feature"
            title="A change history for every contact"
            lede="When a phone number is wrong, the question is always the same: who changed it, and
              when? Kontax keeps a record of every edit, merge, import and sync on each contact, so
              you don't have to guess."
          />
        </div>
      </section>

      {/* ── What it does ── */}
      <section className="mkt-band mkt-band--stone" id="what-it-does">
        <div className="mkt-container">
          <SectionHead index="01" label="What it does" title="A timeline on every contact" />
          <Ticks
            items={[
              "Every contact has a History tab listing what changed, when, and who or what made the change — a person, an import, or a connected sync.",
              "In a shared Family or Team book, every member's edits show up, each attributed by name — not just your own changes.",
              "Merges show up as events too, so you can see when and how two contacts became one.",
            ]}
          />
        </div>
      </section>

      {/* ── How it works, by plan ── */}
      <section className="mkt-band" id="plans">
        <div className="mkt-container">
          <SectionHead
            index="02"
            label="Plan availability"
            title="What each plan shows"
            lede="Two separate things share the word 'history': the History tab on one contact, and the
              account-wide activity feed across your whole address book."
          />
          <table className="mkt-table" style={{ marginTop: 24 }}>
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Per-contact History tab</th>
                <th scope="col">Account-wide activity feed</th>
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row">Free</th><td>Last 3 events</td><td>Not included</td></tr>
              <tr><th scope="row">Pro</th><td>Full history</td><td>Last 365 days</td></tr>
              <tr><th scope="row">Family</th><td>Full history</td><td>Last 90 days</td></tr>
              <tr><th scope="row">Teams</th><td>Full history</td><td>All activity</td></tr>
            </tbody>
          </table>
          <p className="mkt-note">
            &ldquo;Full history&rdquo; means the History tab shows everything recorded for that contact, with
            no display limit.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mkt-band mkt-band--stone" id="faq">
        <div className="mkt-container">
          <SectionHead index="03" label="Questions" title="History, answered" />
          <div style={{ marginTop: 32 }}>
            <Faq items={FAQ_ITEMS} />
          </div>
          <p className="cp-note">
            Also see how <Link href="/features/duplicates">merging duplicates</Link> works, or how
            Kontax protects your data on <Link href="/security">Security</Link>.
          </p>
        </div>
      </section>

      <CtaBand title="Always know what changed, and who changed it" sub="Free shows the last 3 events. Upgrade for the complete history.">
        <Link className="mkt-btn mkt-btn--pri" href="/register">
          Get started free
        </Link>
        <Link className="mkt-btn mkt-btn--sec" href="/pricing">
          Compare plans
        </Link>
      </CtaBand>
    </>
  );
}
