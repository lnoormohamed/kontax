import type { Metadata } from "next";

import { HOMEPAGE_FAQ } from "~/app/_components/help-faq-data";
import {
  JsonLd,
  faqPageSchema,
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "~/app/_components/json-ld";
import { isMicrosoftSyncEnabled } from "~/lib/microsoft-sync-flag";

import { FeatureShowcase } from "./_components/home/feature-showcase";
import { HomeFaq } from "./_components/home/home-faq";
import { ClosingCta, HeroEyebrow, HeroPrimaryCta } from "./_components/home/home-session";
import { HowItWorks } from "./_components/home/how-it-works";
import { HomeIconSprite } from "./_components/home/icons";
import { PricingTeaser } from "./_components/home/pricing-teaser";
import { ThreeIntoOne } from "./_components/home/three-into-one";
import { AudienceCards, CompareTable, SecurityFacts } from "./_components/home/why-kontax";

import "./homepage.css";

// P50A-04 · ≤ 60-char title (absolute: the marketing layout's "%s" template
// and the root "%s · Kontax" template are both bypassed) and ≤ 160-char
// description.
const TITLE = "Kontax — One address book for iCloud, Google and Fastmail";
const DESCRIPTION =
  "Kontax keeps your iCloud, Google and Fastmail contacts in step and shows up in your iPhone Contacts app. No app to install. Free for up to 500 contacts.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=homepage", width: 1200, height: 630, alt: "Kontax — Your contacts, organised, synced, and always with you." }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// P50A-02 · Static with hourly ISR, like /pricing: no per-request auth().
// The HTML is the signed-out page; the signed-in differences (hero eyebrow and
// primary button, closing band) are client islands in home-session.tsx that
// swap in place after hydration. Revalidation also refreshes the Stripe price
// in the pricing teaser and the works-with list below.
export const revalidate = 3600;

// P49-02 · "Works with" lists only connectors that are live on this
// deployment: Outlook appears once the Microsoft connector is configured
// (P50A-01: shared gate — see ~/lib/microsoft-sync-flag).
function worksWith(): string[] {
  return [
    "Apple Contacts",
    "Google Contacts",
    "iCloud",
    "Fastmail",
    ...(isMicrosoftSyncEnabled() ? ["Outlook"] : []),
    "any CardDAV server",
  ];
}

// P50-03 · Homepage in Direction A (roadmap/design-briefs/p50-db01-handoff,
// ?view=home). P49's section order and verified copy: hero + "three into one"
// signature → works with → 01 how it works → 02 features → 03 comparison →
// 04 privacy → 05 who it's for → 06 pricing → 07 FAQ → closing CTA.
export default function HomePage() {
  return (
    <div className="hp">
      <JsonLd
        data={[
          organizationSchema(),
          softwareApplicationSchema(),
          websiteSchema(),
          faqPageSchema(HOMEPAGE_FAQ),
        ]}
      />
      <HomeIconSprite />

      {/* ═══════════════════════════ HERO + SIGNATURE ═══════════════════════════ */}
      <section className="hp-hero">
        <div className="mkt-container hp-hero__g">
          <div>
            <HeroEyebrow />
            <h1 className="hp-hero__h1">Your contacts. Organised, synced, and always with you.</h1>
          </div>
          <div>
            <p className="hp-hero__sub">
              One address book for your phone, your laptop and the people you share with. Kept
              tidy, kept private, kept yours.
            </p>
            <div className="hp-hero__ctas">
              <HeroPrimaryCta />
              <a className="mkt-btn mkt-btn--sec" href="#how">
                See how it works
              </a>
            </div>
            <p className="hp-hero__trust">
              <span>Free for up to 500 contacts</span>
              <span>No card needed</span>
              <span>No app to install</span>
            </p>
          </div>
        </div>
        <div className="mkt-container">
          <ThreeIntoOne />
        </div>
      </section>

      {/* ═══════════════════════════ WORKS WITH ═══════════════════════════ */}
      <section className="hp-works" aria-label="Works with">
        <p className="mkt-container hp-works__in">
          <b>Works with</b>
          {worksWith().map((name) => (
            <span key={name}>{name}</span>
          ))}
        </p>
      </section>

      <HowItWorks />
      <FeatureShowcase />
      <CompareTable />
      <SecurityFacts />
      <AudienceCards />
      <PricingTeaser />
      <HomeFaq />
      <ClosingCta />
    </div>
  );
}
