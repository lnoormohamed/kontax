import { type Metadata } from "next";

import { HelpFaq } from "~/app/_components/help-faq";
import { getHelpFaqSections } from "~/app/_components/help-faq-data";
import { HelpProviderGuides } from "~/app/_components/help-provider-guides";
import { breadcrumbSchema, faqPageSchema, JsonLd } from "~/app/_components/json-ld";
import { MarketingFooter } from "~/app/(marketing)/_components/marketing-footer";
import { MarketingNav } from "~/app/(marketing)/_components/marketing-nav";
import { isMicrosoftSyncEnabled } from "~/lib/microsoft-sync-flag";
import "~/app/(marketing)/_components/marketing.css";
import "./help.css";

export const metadata: Metadata = {
  // Root layout's title template already appends " · Kontax" — don't repeat
  // the brand here or the rendered title doubles up ("Help — Kontax · Kontax").
  title: "Help",
  description: "Guides and documentation for using Kontax.",
  alternates: { canonical: "/help" },
};

// P26-12 · public /help FAQ page.
// P50-05 · Direction A chrome: the page lives outside the (marketing) route
// group (so its URL, metadata and title template are untouched) but renders
// the same `.mkt-wrap` + MarketingNav/MarketingFooter shell that group's
// layout does. The docs layout itself is unchanged; help.css restyles it on
// the --mkt-* tokens and type scale.
export default function HelpPage() {
  // P50A-01: Outlook FAQ content is only shown once Microsoft sync is
  // configured — see ~/lib/microsoft-sync-flag. This page has no dynamic
  // API, so it's statically prerendered (build-time read, per that helper's
  // doc comment). The visible FAQ and its FAQPage JSON-LD are built from the
  // same gated `sections`, so they can't drift apart.
  const sections = getHelpFaqSections(isMicrosoftSyncEnabled());

  return (
    <div className="mkt-wrap">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Help & FAQ", path: "/help" },
          ]),
          faqPageSchema(sections.flatMap((s) => s.items)),
        ]}
      />
      <MarketingNav />
      <main>
        <div className="help-wrap">
          <div className="help-head">
            <p className="mkt-lab">Support</p>
            <h1 className="help-h1">Help &amp; FAQ</h1>
            <p className="help-lede">
              Answers to the questions new and long-time Kontax users ask most. Can&rsquo;t find it?
              Reach us at <a className="inline" href="mailto:support@getkontax.com">support@getkontax.com</a>.
            </p>
          </div>

          <HelpProviderGuides />
          <HelpFaq sections={sections} />

          <div className="help-foot">
            <span className="help-foot__k" aria-hidden="true">K</span>
            <span>
              Still stuck? Email{" "}
              <a className="inline" href="mailto:support@getkontax.com">support@getkontax.com</a>{" "}
              — we reply within a day.
            </span>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
