import Link from "next/link";
import type { Metadata } from "next";

import { JsonLd, breadcrumbSchema } from "~/app/_components/json-ld";
import { webPageSchema } from "../../_components/page-schema";
import { CtaBand, Faq, SectionHead, Ticks } from "../../_components/mkt-ui";
import "../../_components/content-page.css";

// P50A-07 · Single-feature landing page. Facts verified against
// src/server/contact-merge.ts (MergeSuggestionSignal, MergeSuggestionConfidence,
// MERGE_UNDO_WINDOW_DAYS = 30) and src/server/dav/plan-entitlements.mjs
// (advancedMergeEnabled: true on every plan, incl. FREE) — see the report for
// the ticket for the exact references.

const TITLE = "Find and merge duplicate contacts — Kontax";
const DESCRIPTION =
  "Kontax finds likely duplicate contacts, explains why, and merges them field by field with a 30-day undo. Included on every plan, including Free.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/features/duplicates" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/features/duplicates", siteName: "Kontax", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const FAQ_ITEMS = [
  {
    q: "Which plans include duplicate merging?",
    a: "All of them. Merge — including field-level review and the 30-day undo — is part of the Free plan as well as Pro, Family and Teams. It isn't a paid upgrade.",
  },
  {
    q: "Will Kontax merge contacts on its own?",
    a: "No. Kontax suggests likely duplicates with a confidence level and the reason for the match; you review and confirm each merge. Nothing is combined automatically.",
  },
  {
    q: "What if I merge the wrong two contacts?",
    a: "Undo the merge from the contact's history within 30 days and Kontax restores both original records.",
  },
  {
    q: "Does it catch names in different scripts or spellings?",
    a: "Yes — alongside exact matches on email and phone, the matcher also looks at phonetic and romanised name similarity (for example a name typed in Latin letters next to the same name in its native script), and flags contacts with the same name but conflicting details for a closer look.",
  },
];

export default function DuplicatesFeaturePage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Features", path: "/features" },
            { name: "Duplicates", path: "/features/duplicates" },
          ]),
          webPageSchema({ name: TITLE, description: DESCRIPTION, path: "/features/duplicates" }),
        ]}
      />

      {/* ── Hero ── */}
      <section className="mkt-band">
        <div className="mkt-container">
          <SectionHead
            headingLevel={1}
            label="Feature"
            title="Find and merge duplicate contacts"
            lede="Import from a few sources for a while and the same person ends up as three cards
              with slightly different details. Kontax finds the likely duplicates, explains why it
              thinks so, and lets you merge them field by field — with 30 days to change your mind."
          />
        </div>
      </section>

      {/* ── What it does ── */}
      <section className="mkt-band mkt-band--stone" id="what-it-does">
        <div className="mkt-container">
          <SectionHead index="01" label="What it does" title="Suggests, never assumes" />
          <Ticks
            items={[
              "Scans your address book for contacts that are likely the same person and suggests merging them.",
              "Scores each suggestion high, medium or low confidence, with the specific reason it was flagged — a shared email or phone, a close name match, or matching company and near-identical name.",
              "Runs automatically after an import or a sync, and you can trigger a fresh scan of your whole book at any time.",
              "Leaves every contact untouched until you confirm a merge — nothing is combined without a decision from you.",
            ]}
          />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mkt-band" id="how-it-works">
        <div className="mkt-container">
          <SectionHead index="02" label="How it works" title="Field by field, with an explanation" />
          <Ticks
            items={[
              "Matching looks at exact and near-exact email and phone, exact and fuzzy name matching, phonetic name similarity, and company plus name proximity — including names written in different scripts or romanised spellings.",
              "Where two contacts genuinely conflict — different birthdays, or a different surname on an otherwise close match — that's surfaced too, so a false match doesn't get merged by mistake.",
              "The merge review lets you choose which record to keep as the base and pick a value per field where they differ; values you don't choose between, like multiple phone numbers, are kept on both.",
              "Every completed merge stays reversible for 30 days from the contact's history — after that the merge is final.",
            ]}
          />
        </div>
      </section>

      {/* ── Plan availability ── */}
      <section className="mkt-band mkt-band--stone" id="plans">
        <div className="mkt-container">
          <SectionHead index="03" label="Plan availability" title="Included on every plan" />
          <table className="mkt-table" style={{ marginTop: 24 }}>
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Duplicate detection &amp; merge</th>
                <th scope="col">Undo window</th>
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row">Free</th><td>Included</td><td>30 days</td></tr>
              <tr><th scope="row">Pro</th><td>Included</td><td>30 days</td></tr>
              <tr><th scope="row">Family</th><td>Included</td><td>30 days</td></tr>
              <tr><th scope="row">Teams</th><td>Included</td><td>30 days</td></tr>
            </tbody>
          </table>
          <p className="mkt-note">
            Unlike most of Kontax&rsquo;s paid features, merge isn&rsquo;t gated by plan — it&rsquo;s the same tool
            for everyone.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mkt-band" id="faq">
        <div className="mkt-container">
          <SectionHead index="04" label="Questions" title="Duplicates, answered" />
          <div style={{ marginTop: 32 }}>
            <Faq items={FAQ_ITEMS} />
          </div>
          <p className="cp-note">
            See every feature on <Link href="/features">the features page</Link>, or read about{" "}
            <Link href="/features/history">change history</Link>.
          </p>
        </div>
      </section>

      <CtaBand title="Clean up your address book today" sub="Free to start, and merge is included from day one.">
        <Link className="mkt-btn mkt-btn--pri" href="/register">
          Get started free
        </Link>
        <Link className="mkt-btn mkt-btn--sec" href="/features">
          See all features
        </Link>
      </CtaBand>
    </>
  );
}
