"use client";

import Link from "next/link";
import { useState } from "react";

const CHECK = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);

interface PlanFeat { text: React.ReactNode }
interface Plan {
  id: string;
  name: string;
  tag: string;
  recommended?: boolean;
  price: "free" | { monthly: number; annual: number };
  sublabel: { monthly: string; annual: string } | null;
  cta: { label: string; href: string; variant: "filled" | "outline" };
  features: PlanFeat[];
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tag: "For personal use",
    price: "free",
    sublabel: null,
    cta: { label: "Get started free", href: "/register", variant: "filled" },
    features: [
      { text: <>Up to <strong>100 contacts</strong></> },
      { text: "Labels & advanced search" },
      { text: "1 CardDAV account" },
      { text: "Public contact card" },
      { text: "Full export (GDPR)" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tag: "For power users",
    price: { monthly: 5, annual: 4 },
    sublabel: { monthly: "billed monthly", annual: "billed annually · save 20%" },
    cta: { label: "Choose Pro", href: "/register?plan=pro", variant: "outline" },
    features: [
      { text: <><strong>Unlimited</strong> contacts</> },
      { text: "Unlimited CardDAV accounts" },
      { text: "Google + Outlook sync" },
      { text: "Contact sharing" },
      { text: "Developer API access" },
    ],
  },
  {
    id: "family",
    name: "Family",
    tag: "For households",
    recommended: true,
    price: { monthly: 8, annual: 6 },
    sublabel: { monthly: "billed monthly", annual: "billed annually · save 20%" },
    cta: { label: "Choose Family", href: "/register?plan=family", variant: "filled" },
    features: [
      { text: <><strong>Unlimited</strong> contacts &amp; sync</> },
      { text: "Family shared address book" },
      { text: <>Up to <strong>6 members</strong></> },
      { text: "Shared labels & live edits" },
      { text: "One bill for the whole family" },
    ],
  },
  {
    id: "teams",
    name: "Teams",
    tag: "For organisations",
    price: { monthly: 12, annual: 10 },
    sublabel: { monthly: "billed monthly · per seat", annual: "billed annually · per seat" },
    cta: { label: "Choose Teams", href: "/register?plan=teams", variant: "outline" },
    features: [
      { text: <>Everything in <strong>Pro</strong></> },
      { text: "Team shared address book" },
      { text: <><strong>Unlimited</strong> members</> },
      { text: "Roles & permissions" },
      { text: "Audit log" },
    ],
  },
];

export function PricingToggle() {
  const [annual, setAnnual] = useState(false);

  return (
    <>
      {/* Billing toggle */}
      <section className="pr-billing">
        <div className="pr-toggle" role="tablist" aria-label="Billing period">
          <button
            className="pr-toggle__btn"
            role="tab"
            aria-selected={!annual}
            onClick={() => setAnnual(false)}
          >
            Monthly
          </button>
          <button
            className="pr-toggle__btn"
            role="tab"
            aria-selected={annual}
            onClick={() => setAnnual(true)}
          >
            Annually
            <span className="pr-toggle__badge">Save 20%</span>
          </button>
        </div>
      </section>

      {/* Plan cards */}
      <section className="pr-plans">
        <div className="pr-wrap">
          <div className="pr-grid">
            {PLANS.map((plan) => {
              const isFree = plan.price === "free";
              const priceObj = isFree ? null : (plan.price as { monthly: number; annual: number });
              const amount = priceObj ? (annual ? priceObj.annual : priceObj.monthly) : null;
              const showSave = !isFree && annual;
              const sublabel = plan.sublabel
                ? (annual ? plan.sublabel.annual : plan.sublabel.monthly)
                : null;

              return (
                <article
                  key={plan.id}
                  className={`pr-plan${plan.recommended ? " pr-plan--rec" : ""}`}
                  aria-label={`${plan.name} plan${plan.recommended ? ", most popular" : ""}`}
                >
                  {plan.recommended && (
                    <span className="pr-plan__badge">Most popular</span>
                  )}
                  <h3 className="pr-plan__name">{plan.name}</h3>
                  <p className="pr-plan__tag">{plan.tag}</p>

                  <div className="pr-plan__price">
                    {isFree ? (
                      <span className="pr-plan__free">Free</span>
                    ) : (
                      <>
                        <span className="pr-plan__currency">£</span>
                        <span className="pr-plan__amount">{amount}</span>
                        <span className="pr-plan__per">/mo</span>
                        {showSave && <span className="pr-plan__save">Save 20%</span>}
                      </>
                    )}
                  </div>

                  <p className="pr-plan__sublabel">{sublabel ?? " "}</p>

                  <Link
                    className={`pr-plan__cta pr-plan__cta--${plan.cta.variant}`}
                    href={plan.cta.href}
                  >
                    {plan.cta.label}
                  </Link>

                  <div className="pr-plan__divider" />

                  <ul className="pr-plan__features">
                    {plan.features.map((f, i) => (
                      <li key={i} className="pr-plan__feat">
                        {CHECK}
                        {f.text}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
