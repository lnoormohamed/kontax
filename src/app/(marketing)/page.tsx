import Link from "next/link";
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
import { auth } from "~/server/auth";

import { FeatureShowcase } from "./_components/home/feature-showcase";
import { HomeFaq } from "./_components/home/home-faq";
import { HowItWorks } from "./_components/home/how-it-works";
import { HomeIconSprite, Icon } from "./_components/home/icons";
import { PricingTeaser } from "./_components/home/pricing-teaser";
import { Signature } from "./_components/home/signature";
import { AudienceCards, CompareTable, SecurityFacts } from "./_components/home/why-kontax";
import { ArrowIcon, CtaBand } from "./_components/mkt-ui";

import "./homepage.css";

export const metadata: Metadata = {
  title: { absolute: "Kontax — Your contacts, organised and synced" },
  description:
    "Manage your address book across every device. Search, labels, CardDAV sync, Google Contacts, shared books, and a public contact card.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Kontax — Your contacts, organised and synced",
    description:
      "Manage your address book across every device. Search, labels, CardDAV sync, Google Contacts, shared books, and a public contact card.",
    url: "/",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=homepage", width: 1200, height: 630, alt: "Kontax — Your contacts, organised, synced, and always with you." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kontax — Your contacts, organised and synced",
    description:
      "Manage your address book across every device. Search, labels, CardDAV sync, Google Contacts, shared books, and a public contact card.",
  },
};

// P49-02 · "Works with" strip lists only connectors that are live on this
// deployment: Outlook appears once the Microsoft connector is configured
// (P50A-01: shared gate — see ~/lib/microsoft-sync-flag).
function worksWith(): string[] {
  return [
    "Apple Contacts",
    "Google Contacts",
    "iCloud",
    "Fastmail",
    ...(isMicrosoftSyncEnabled() ? ["Outlook"] : []),
    "any CardDAV app",
  ];
}

// P50-03 · Homepage in Direction A (design P50-DB01, `?view=home`), on P49's
// section order and verified copy. Hero: headline left, lede + CTAs right,
// then the "three into one" signature panel. Everything is server-rendered;
// the only homepage script is the signature's one-shot inline animation.
// Signed-in visitors get the "Welcome back" hero and CTA.
export default async function HomePage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(/\s+/)[0] ?? null;

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
          {session ? (
            <>
              <div>
                <p className="hp-hero__e">Welcome back</p>
                <h1 className="hp-hero__title">
                  {firstName ? `Welcome back, ${firstName}.` : "Pick up where you left off."}
                </h1>
              </div>
              <div>
                <p className="hp-hero__sub">Your contacts are waiting.</p>
                <div className="hp-hero__ctas">
                  {/* P46: returning users land on the contact list, not Overview */}
                  <Link className="mkt-btn mkt-btn--pri" href="/contacts">
                    Open Kontax
                    <ArrowIcon />
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="hp-hero__e">Contact management, done right</p>
                <h1 className="hp-hero__title">
                  Your contacts. Organised, synced, and always with you.
                </h1>
              </div>
              <div>
                <p className="hp-hero__sub">
                  One address book for your phone, your laptop and the people you share with.
                  Kept tidy, kept private, kept yours.
                </p>
                <div className="hp-hero__ctas">
                  <Link className="mkt-btn mkt-btn--pri" href="/register">
                    Get started free
                  </Link>
                  <a className="mkt-btn mkt-btn--sec" href="#how">
                    See how it works
                    <Icon name="down" size={16} />
                  </a>
                </div>
                <p className="hp-hero__trust">
                  <span>
                    <Icon name="check" size={14} />
                    Free for up to 500 contacts
                  </span>
                  <span>
                    <Icon name="check" size={14} />
                    No card needed
                  </span>
                  <span>
                    <Icon name="check" size={14} />
                    No app to install
                  </span>
                </p>
              </div>
            </>
          )}
        </div>
        <Signature />
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

      {/* ═══════════════════════════ 01–07 ═══════════════════════════ */}
      <HowItWorks />
      <FeatureShowcase />
      <CompareTable />
      <SecurityFacts />
      <AudienceCards />
      <PricingTeaser />
      <HomeFaq />

      {/* ═══════════════════════════ CTA ═══════════════════════════ */}
      {session ? (
        <CtaBand
          title="Your contacts are waiting."
          sub="Pick up where you left off."
          primary={{ label: "Open Kontax", href: "/contacts" }}
        />
      ) : (
        <CtaBand title="Ready to get started?" />
      )}
    </div>
  );
}
