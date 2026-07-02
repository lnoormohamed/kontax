"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { createBillingPortalSession, createCheckoutSession } from "~/app/actions/billing";

export type StripePrices = {
  currency: string;
  pro: { monthly: number; annual: number };
  family: { monthly: number; annual: number };
  teams: { monthly: number; annual: number };
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  usd: "$", gbp: "£", eur: "€", aud: "A$", cad: "C$", chf: "Fr",
};
function sym(code: string) {
  return CURRENCY_SYMBOLS[code.toLowerCase()] ?? code.toUpperCase();
}
function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}
function savingsPct(monthly: number, annual: number): number {
  if (!monthly) return 0;
  return Math.round((1 - annual / (monthly * 12)) * 100);
}

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

const BASE_PLANS: Omit<Plan, "price">[] = [
  {
    id: "free",
    name: "Free",
    tag: "For personal use",
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
    sublabel: { monthly: "billed monthly", annual: "billed annually" },
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
    sublabel: { monthly: "billed monthly", annual: "billed annually" },
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
    sublabel: { monthly: "per seat · billed monthly", annual: "per seat · billed annually" },
    cta: { label: "Choose Teams", href: "/register?plan=teams", variant: "outline" },
    features: [
      { text: <>Everything in <strong>Pro</strong></> },
      { text: "Team shared address book" },
      { text: <>Minimum <strong>3 seats</strong></> },
      { text: "Roles & permissions" },
      { text: "Audit log" },
    ],
  },
];

const FALLBACK_PRICES: StripePrices = {
  currency: "gbp",
  pro: { monthly: 5, annual: 48 },
  family: { monthly: 8, annual: 72 },
  teams: { monthly: 12, annual: 120 },
};

function getToggleSavingsLabel(prices: StripePrices): string | null {
  const savings = [prices.pro, prices.family, prices.teams]
    .map((plan) => savingsPct(plan.monthly, plan.annual))
    .filter((value) => value > 0);

  if (!savings.length) return null;

  const min = Math.min(...savings);
  const max = Math.max(...savings);
  return min === max ? `Save ${max}%` : `Save up to ${max}%`;
}

function buildPlans(stripePrices: StripePrices | null): Plan[] {
  const p = stripePrices ?? FALLBACK_PRICES;
  return BASE_PLANS.map((base) => ({
    ...base,
    price: base.id === "free" ? "free" : (p[base.id as keyof StripePrices] as { monthly: number; annual: number }),
  }));
}

export function PricingToggle({
  stripePrices,
}: {
  stripePrices?: StripePrices | null;
}) {
  // P38-10: the page renders statically; highlight the visitor's current
  // plan after hydration instead of forcing the whole page dynamic.
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/plan")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { plan: string | null } | null) => {
        if (!cancelled && data?.plan) setCurrentPlan(data.plan);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const prices = stripePrices ?? FALLBACK_PRICES;
  const PLANS = buildPlans(prices);
  const currencySymbol = sym(prices.currency);
  const toggleSavingsLabel = getToggleSavingsLabel(prices);
  const [annual, setAnnual] = useState(false);
  const [teamSeats, setTeamSeats] = useState(3);
  const [loading, setLoading] = useState<string | null>(null);
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const interval = annual ? "YEARLY" : "MONTHLY";

  const handlePaidCta = (planId: string) => {
    setLoading(planId);
    setCtaError(null);
    startTransition(async () => {
      // Always ask the server what the right billing surface is.
      // Real Stripe subscribers are routed to the customer portal there;
      // legacy manual subscribers can be migrated through a fresh checkout.
      const result = await createCheckoutSession({
        plan: planId.toUpperCase(),
        interval,
        seats: planId === "teams" ? teamSeats : undefined,
      });

      if ("url" in result) {
        window.location.href = result.url;
        return;
      }

      if (result.error === "UNAUTHORIZED") {
        // Not logged in — send to register with plan context.
        window.location.href =
          planId === "teams"
            ? `/register?plan=teams&seats=${teamSeats}`
            : `/register?plan=${planId}`;
        return;
      }

      if (result.error === "USE_CUSTOMER_PORTAL") {
        // Active subscription detected server-side — fall through to portal.
        const portalResult = await createBillingPortalSession();
        if ("url" in portalResult) {
          window.location.href = portalResult.url;
          return;
        }
      }

      setCtaError("Something went wrong opening billing. Please try again or contact support.");
      setLoading(null);
    });
  };

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
            {toggleSavingsLabel ? (
              <span className="pr-toggle__badge">{toggleSavingsLabel}</span>
            ) : null}
          </button>
        </div>
      </section>

      {/* Plan cards */}
      <section className="pr-plans">
        <div className="pr-wrap">
          <div className="pr-grid">
            {PLANS.map((plan) => {
              const isFree = plan.price === "free";
              const isTeams = plan.id === "teams";
              const isCurrent = currentPlan === plan.id.toUpperCase();
              const priceObj = isFree ? null : (plan.price as { monthly: number; annual: number });
              const amount = priceObj ? (annual ? priceObj.annual : priceObj.monthly) : null;
              const planSavingsPct = priceObj ? savingsPct(priceObj.monthly, priceObj.annual) : 0;
              const showSave = !isFree && annual && planSavingsPct > 0;
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
                        <span className="pr-plan__currency">{currencySymbol}</span>
                        <span className="pr-plan__amount">{fmt(amount!)}</span>
                        <span className="pr-plan__per">{isTeams ? (annual ? "/seat/yr" : "/seat/mo") : (annual ? "/yr" : "/mo")}</span>
                        {showSave && <span className="pr-plan__save">Save {planSavingsPct}%</span>}
                      </>
                    )}
                  </div>

                  <p className="pr-plan__sublabel">{sublabel ?? " "}</p>

                  {/* Seat picker + total — Teams only, not shown if already on Teams */}
                  {isTeams && !isCurrent && (
                    <>
                    <div className="pr-seat-picker">
                      <button
                        aria-label="Remove seat"
                        className="pr-seat-picker__btn"
                        disabled={teamSeats <= 3}
                        onClick={() => setTeamSeats((s) => Math.max(3, s - 1))}
                        type="button"
                      >−</button>
                      <span className="pr-seat-picker__count">{teamSeats} seats</span>
                      <button
                        aria-label="Add seat"
                        className="pr-seat-picker__btn"
                        onClick={() => setTeamSeats((s) => Math.min(500, s + 1))}
                        type="button"
                      >+</button>
                    </div>
                    <p className="pr-seat-total">
                      {currencySymbol}{fmt((amount ?? 0) * teamSeats)} / {annual ? "yr" : "mo"} total
                    </p>
                    </>
                  )}

                  {isCurrent ? (
                    <span className="pr-plan__cta pr-plan__cta--current">Current plan</span>
                  ) : isFree ? (
                    <Link className={`pr-plan__cta pr-plan__cta--${plan.cta.variant}`} href={plan.cta.href}>
                      {plan.cta.label}
                    </Link>
                  ) : (
                    <button
                      className={`pr-plan__cta pr-plan__cta--${plan.cta.variant} disabled:opacity-60`}
                      disabled={loading === plan.id}
                      onClick={() => handlePaidCta(plan.id)}
                      type="button"
                    >
                      {loading === plan.id ? "Loading…" : plan.cta.label}
                    </button>
                  )}

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
          {ctaError ? (
            <p className="mt-6 flex items-center justify-center gap-2 text-[13.5px] text-[#9a3a23]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b5472f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
              </svg>
              {ctaError}
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
