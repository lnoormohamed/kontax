"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { createCheckoutSession } from "~/app/actions/billing";
import {
  planCardFeatures,
  TEAMS_SEAT_MAX,
  TEAMS_SEAT_MIN,
  type CardFeature,
  type PlanKey,
} from "~/app/_components/plan-data";
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

interface Plan {
  id: "free" | "pro" | "family" | "teams";
  key: PlanKey;
  name: string;
  tag: string;
  recommended?: boolean;
  /** null = paid plan whose price is unavailable (no Stripe catalogue). */
  price: "free" | { monthly: number; annual: number } | null;
  sublabel: { monthly: string; annual: string } | null;
  cta: { label: string; href: string; variant: "filled" | "outline" };
  features: CardFeature[];
}

// P49A-14 · feature bullets come from plan-data.ts (planCardFeatures), which
// reads every limit from the enforced entitlements — nothing is typed here.
const BASE_PLANS: Omit<Plan, "price" | "features">[] = [
  {
    id: "free",
    key: "Free",
    name: "Free",
    tag: "For personal use",
    sublabel: null,
    cta: { label: "Get started free", href: "/register", variant: "outline" },
  },
  {
    id: "pro",
    key: "Pro",
    name: "Pro",
    tag: "For power users",
    recommended: true,
    sublabel: { monthly: "billed monthly", annual: "billed annually" },
    cta: { label: "Choose Pro", href: "/register?plan=pro", variant: "filled" },
  },
  {
    id: "family",
    key: "Family",
    name: "Family",
    tag: "For households",
    sublabel: { monthly: "billed monthly", annual: "billed annually" },
    cta: { label: "Choose Family", href: "/register?plan=family", variant: "outline" },
  },
  {
    id: "teams",
    key: "Teams",
    name: "Teams",
    tag: "For organisations",
    sublabel: { monthly: "per seat · billed monthly", annual: "per seat · billed annually" },
    cta: { label: "Choose Teams", href: "/register?plan=teams", variant: "outline" },
  },
];

// The annual saving is computed from the live catalogue; with no catalogue
// there is no badge (never a hard-coded percentage).
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
  // P50A-01: Outlook only listed once Microsoft sync is configured — the flag
  // is computed server-side in pricing/page.tsx and passed down, since this is
  // a client component and can't read server env itself.
  const features = planCardFeatures(outlookLive);
  return BASE_PLANS.map((base) => ({
    ...base,
    // P49A-14: no placeholder prices — a paid plan without a catalogue price
    // renders no amount at all.
    price: base.id === "free" ? "free" : (stripePrices?.[base.id] ?? null),
    features: features[base.key],
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
  const prices = stripePrices ?? null;
  const PLANS = buildPlans(prices, outlookLive);
  // Free is formatted in the catalogue currency, falling back to GBP.
  const currencySymbol = sym(prices?.currency ?? "gbp");
  const toggleSavingsLabel = prices ? getToggleSavingsLabel(prices) : null;
  const [annual, setAnnual] = useState(false);
  const [teamSeats, setTeamSeats] = useState(TEAMS_SEAT_MIN);
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
              const priceObj = plan.price === "free" ? null : plan.price;
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
                      ) : amount === null ? null : (
                        <>
                          <b>
                            {currencySymbol}
                            {fmt(amount)}
                          </b>
                          <span>{isTeams ? (annual ? "/seat/yr" : "/seat/mo") : (annual ? "/yr" : "/mo")}</span>
                          {showSave && <span className="pr-save">Save {planSavingsPct}%</span>}
                        </>
                      )}
                    </p>
                    <p className="pr-price__bill">{sublabel ?? "No card needed"}</p>
                  </div>

                  <ul>
                    {plan.features.map((f, i) => (
                      <li key={i}>
                        <CheckIcon />
                        <span>
                          {f.pre}
                          {f.strong ? <strong>{f.strong}</strong> : null}
                          {f.text}
                        </span>
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
                          disabled={teamSeats <= TEAMS_SEAT_MIN}
                          onClick={() => setTeamSeats((s) => Math.max(TEAMS_SEAT_MIN, s - 1))}
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
                          disabled={teamSeats >= TEAMS_SEAT_MAX}
                          onClick={() => setTeamSeats((s) => Math.min(TEAMS_SEAT_MAX, s + 1))}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                      {amount !== null ? (
                        <p className="pr-seats__total">
                          {currencySymbol}{fmt(amount * teamSeats)} / {annual ? "yr" : "mo"} total
                        </p>
                      ) : null}
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
