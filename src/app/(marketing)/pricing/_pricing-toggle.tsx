"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { createCheckoutSession } from "~/app/actions/billing";
import { useBillingPortal } from "~/app/_components/use-billing-portal";
import { CheckIcon, PageHead } from "../_components/mkt-ui";

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
    cta: { label: "Get started free", href: "/register", variant: "outline" },
    features: [
      { text: <>Up to <strong>500 contacts</strong></> },
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
    recommended: true,
    sublabel: { monthly: "billed monthly", annual: "billed annually" },
    cta: { label: "Choose Pro", href: "/register?plan=pro", variant: "filled" },
    features: [
      { text: <><strong>Unlimited</strong> contacts</> },
      { text: "Up to 5 CardDAV accounts" },
      { text: "Google + Outlook sync" },
      { text: "Contact sharing" },
      { text: "Developer API access" },
    ],
  },
  {
    id: "family",
    name: "Family",
    tag: "For households",
    sublabel: { monthly: "billed monthly", annual: "billed annually" },
    cta: { label: "Choose Family", href: "/register?plan=family", variant: "outline" },
    features: [
      { text: <><strong>Unlimited</strong> contacts, up to 5 sync accounts</> },
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

function buildPlans(stripePrices: StripePrices | null, outlookLive: boolean): Plan[] {
  const p = stripePrices ?? FALLBACK_PRICES;
  return BASE_PLANS.map((base) => ({
    ...base,
    price: base.id === "free" ? "free" : (p[base.id as keyof StripePrices] as { monthly: number; annual: number }),
    // P50A-01: Outlook only listed once Microsoft sync is configured — the
    // flag is computed server-side in pricing/page.tsx and passed down,
    // since this is a client component and can't read server env itself.
    features:
      base.id === "pro"
        ? base.features.map((f) =>
            f.text === "Google + Outlook sync"
              ? { text: outlookLive ? "Google + Outlook sync" : "Google Contacts sync" }
              : f,
          )
        : base.features,
  }));
}

// P50-04: the tag on the highlighted card. A description, not a ranking
// ("Most popular" was a claim we can't back up).
const HIGHLIGHT_TAG = "Most flexible";

export function PricingToggle({
  stripePrices,
  outlookLive = false,
  head,
}: {
  stripePrices?: StripePrices | null;
  outlookLive?: boolean;
  /** Page head copy; the billing toggle sits under it (Direction A `.tog`). */
  head: { label: string; title: string; lede: string };
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
  const PLANS = buildPlans(prices, outlookLive);
  const currencySymbol = sym(prices.currency);
  const toggleSavingsLabel = getToggleSavingsLabel(prices);
  const [annual, setAnnual] = useState(false);
  const [teamSeats, setTeamSeats] = useState(3);
  const [loading, setLoading] = useState<string | null>(null);
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const portal = useBillingPortal();
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
        // P48-02: the portal may ask for a password first; when it does, the
        // modal owns the rest of the flow, so this is not an error.
        const launch = await portal.launch();
        if (launch !== "failed") {
          setLoading(null);
          return;
        }
      }

      setCtaError("Something went wrong opening billing. Please try again or contact support.");
      setLoading(null);
    });
  };

  return (
    <>
      {portal.modal}
      {/* Page head + billing toggle */}
      <PageHead center label={head.label} title={head.title} lede={head.lede}>
        <div className="pr-tog" role="group" aria-label="Billing period">
          <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>
            Monthly
          </button>
          <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>
            Annually
            {toggleSavingsLabel ? <span className="pr-tog__save">{toggleSavingsLabel}</span> : null}
          </button>
        </div>
      </PageHead>

      {/* Plan cards */}
      <section className="mkt-band pr-plans" aria-label="Plans">
        <div className="mkt-container">
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
              const btnCls = `mkt-btn mkt-btn--${plan.cta.variant === "filled" ? "pri" : "sec"} mkt-btn--block pr-plan__cta`;

              return (
                <article
                  key={plan.id}
                  className={`mkt-plan pr-plan${plan.recommended ? " mkt-plan--hl" : ""}`}
                  aria-labelledby={`plan-${plan.id}`}
                >
                  <div className="mkt-plan__top">
                    <h2 className="mkt-plan__n" id={`plan-${plan.id}`}>
                      {plan.name}
                    </h2>
                    {plan.recommended ? <span className="mkt-tag">{HIGHLIGHT_TAG}</span> : null}
                  </div>
                  <p className="mkt-plan__for">{plan.tag}</p>

                  <div className="pr-price">
                    <p className="mkt-plan__pr">
                      {isFree ? (
                        <b>{currencySymbol}0</b>
                      ) : (
                        <>
                          <b>
                            {currencySymbol}
                            {fmt(amount!)}
                          </b>
                          <span>{isTeams ? (annual ? "/seat/yr" : "/seat/mo") : (annual ? "/yr" : "/mo")}</span>
                          {showSave && <span className="pr-save">Save {planSavingsPct}%</span>}
                        </>
                      )}
                    </p>
                    <p className="pr-price__bill">{sublabel ?? "No credit card required"}</p>
                  </div>

                  <ul>
                    {plan.features.map((f, i) => (
                      <li key={i}>
                        <CheckIcon />
                        <span>{f.text}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Seat picker + total — Teams only, not shown if already on Teams */}
                  {isTeams && !isCurrent && (
                    <div className="pr-seats">
                      <div className="pr-seats__pick" role="group" aria-label="Seats">
                        <button
                          aria-label="Remove seat"
                          className="pr-seats__btn"
                          disabled={teamSeats <= 3}
                          onClick={() => setTeamSeats((s) => Math.max(3, s - 1))}
                          type="button"
                        >
                          −
                        </button>
                        <span className="pr-seats__count" aria-live="polite">
                          {teamSeats} seats
                        </span>
                        <button
                          aria-label="Add seat"
                          className="pr-seats__btn"
                          onClick={() => setTeamSeats((s) => Math.min(500, s + 1))}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                      <p className="pr-seats__total">
                        {currencySymbol}{fmt((amount ?? 0) * teamSeats)} / {annual ? "yr" : "mo"} total
                      </p>
                    </div>
                  )}

                  {isCurrent ? (
                    <span className="mkt-btn mkt-btn--block pr-plan__cta pr-plan__cta--current">Current plan</span>
                  ) : isFree ? (
                    <Link className={btnCls} href={plan.cta.href}>
                      {plan.cta.label}
                    </Link>
                  ) : (
                    <button
                      className={btnCls}
                      disabled={loading === plan.id}
                      onClick={() => handlePaidCta(plan.id)}
                      type="button"
                    >
                      {loading === plan.id ? "Loading…" : plan.cta.label}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          {ctaError ? (
            <p className="pr-err" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
