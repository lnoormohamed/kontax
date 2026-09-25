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
import { HeroSearchDemo } from "./_components/home/hero-search-demo";
import { HomeFaq } from "./_components/home/home-faq";
import { HowItWorks } from "./_components/home/how-it-works";
import { HomeIconSprite, Icon } from "./_components/home/icons";
import { PricingTeaser } from "./_components/home/pricing-teaser";
import { AudienceCards, CompareTable, SecurityFacts } from "./_components/home/why-kontax";

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

// P49 · Homepage refresh (design P49-DB01). Ten sections: show → differentiate
// → reassure → ask. Everything is server-rendered except the hero search
// typing effect (HeroSearchDemo). Signed-in visitors get the "Welcome back"
// copy in the hero; the rest of the page is the same for everyone.
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

      {/* ═══════════════════════════ 1 · HERO ═══════════════════════════ */}
      <section className="hp-hero">
        <div className="hp-hero__inner">
          <div className="hp-hero__copy">
            {session ? (
              <>
                <p className="hp-hero__eyebrow">Welcome back</p>
                <h1 className="hp-hero__title">
                  {firstName ? `Welcome back, ${firstName}.` : "Pick up where you left off."}
                </h1>
                <p className="hp-hero__sub">Your contacts are waiting.</p>
                <div className="hp-hero__ctas">
                  {/* P46: returning users land on the contact list, not Overview */}
                  <Link className="hp-btn--green" href="/contacts">
                    Open Kontax
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h13" /><path d="M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="hp-hero__eyebrow">Contact management, done right</p>
                <h1 className="hp-hero__title">
                  Your contacts. Organised, synced, and always with you.
                </h1>
                <p className="hp-hero__sub">
                  One address book for your phone, your laptop and the people you share with.
                  Kept tidy, kept private, kept yours.
                </p>
                <div className="hp-hero__ctas">
                  <Link className="hp-btn--primary" href="/register">
                    Get started free
                  </Link>
                  <a className="hp-btn--secondary" href="#how">
                    See how it works
                    <Icon name="down" size={16} />
                  </a>
                </div>
                <p className="hp-hero__trust">
                  <span>Free for up to 500 contacts</span>
                  <span>No card needed</span>
                  <span>Works on iPhone, Android and the web</span>
                </p>
              </>
            )}
          </div>
          <HeroSearchDemo />
        </div>
      </section>

      {/* ═══════════════════════════ 2 · WORKS WITH ═══════════════════════════ */}
      <section className="hp-works" aria-label="Works with">
        <p className="hp-works__inner">
          <b>Works with</b>
          {worksWith().map((name) => (
            <span key={name}>{name}</span>
          ))}
        </p>
      </section>

      {/* ═══════════════════════════ 3–9 ═══════════════════════════ */}
      <HowItWorks />
      <FeatureShowcase />
      <CompareTable />
      <SecurityFacts />
      <AudienceCards />
      <PricingTeaser />
      <HomeFaq />

      {/* ═══════════════════════════ 10 · CTA ═══════════════════════════ */}
      <section className="hp-cta-band">
        <div className="hp-cta-band__inner">
          {session ? (
            <>
              <h2 className="hp-cta-band__title">Your contacts are waiting.</h2>
              <p className="hp-cta-band__sub">Pick up where you left off.</p>
              <div className="hp-cta-band__btns">
                <Link className="hp-btn--primary" href="/contacts">
                  Open Kontax
                </Link>
                <Link className="hp-btn--ghost" href="/pricing">
                  Compare plans
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="hp-cta-band__title">Ready to get started?</h2>
              <p className="hp-cta-band__sub">Free for up to 500 contacts. No card needed.</p>
              <div className="hp-cta-band__btns">
                <Link className="hp-btn--primary" href="/register">
                  Get started free
                </Link>
                <Link className="hp-btn--ghost" href="/pricing">
                  Compare plans
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
