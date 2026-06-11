"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { createBillingPortalSession, createCheckoutSession, getDowngradeSummary } from "~/app/actions/billing";
import { CancelPlanModal, type CancelPlanDetails } from "~/app/settings/_components/cancel-plan-modal";

type PlanCol = "FREE" | "PRO" | "FAMILY" | "TEAMS";
type CtaKind = "current" | "primary" | "secondary" | "destructive";
type Cell = "current" | { label: string; kind: CtaKind; sub?: string };

// §4 CTA matrix — the label + style each plan card shows for the viewer's plan.
const CTA_MATRIX: Record<PlanCol, Record<PlanCol, Cell>> = {
  FREE: {
    FREE: "current",
    PRO: { label: "Start free trial", kind: "primary", sub: "14 days free, then £X/month. Cancel anytime." },
    FAMILY: { label: "Upgrade to Family", kind: "primary" },
    TEAMS: { label: "Upgrade to Teams", kind: "primary" },
  },
  PRO: {
    FREE: { label: "Downgrade to Free", kind: "destructive" },
    PRO: "current",
    FAMILY: { label: "Switch to Family", kind: "primary" },
    TEAMS: { label: "Switch to Teams", kind: "primary" },
  },
  FAMILY: {
    FREE: { label: "Downgrade to Free", kind: "destructive" },
    PRO: { label: "Switch to Pro", kind: "secondary" },
    FAMILY: "current",
    TEAMS: { label: "Switch to Teams", kind: "primary" },
  },
  TEAMS: {
    FREE: { label: "Downgrade to Free", kind: "destructive" },
    PRO: { label: "Switch to Pro", kind: "secondary" },
    FAMILY: { label: "Switch to Family", kind: "secondary" },
    TEAMS: "current",
  },
};

function Check() {
  return (
    <svg className="ck" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}

const Dash = () => <span className="dash">—</span>;

/**
 * Pricing comparison: four-tier table with a Monthly/Annual billing toggle.
 * Prices are placeholders (£X) pending the commercial decision — the toggle
 * swaps the billing-period label and the "save ~20%" hint, per the design.
 *
 * currentPlan: the authenticated user's current plan ("FREE"|"PRO"|"FAMILY"|"TEAMS"),
 * or null if not logged in.
 */
// Display price strings from env (NEXT_PUBLIC_PRICE_*). Falls back to "£X".
const DISPLAY_PRICES: Record<string, { monthly: string; yearly: string }> = {
  PRO:    { monthly: process.env.NEXT_PUBLIC_PRICE_PRO_MONTHLY    ?? "£X", yearly: process.env.NEXT_PUBLIC_PRICE_PRO_YEARLY    ?? "£X" },
  FAMILY: { monthly: process.env.NEXT_PUBLIC_PRICE_FAMILY_MONTHLY ?? "£X", yearly: process.env.NEXT_PUBLIC_PRICE_FAMILY_YEARLY ?? "£X" },
  TEAMS:  { monthly: process.env.NEXT_PUBLIC_PRICE_TEAMS_MONTHLY  ?? "£X", yearly: process.env.NEXT_PUBLIC_PRICE_TEAMS_YEARLY  ?? "£X" },
};

function parsePence(s: string): number | null {
  const m = s.replace(/[£$€]/g, "").trim();
  const n = parseFloat(m);
  return isNaN(n) ? null : n;
}

function savingsBadge(plan: string): string | null {
  const p = DISPLAY_PRICES[plan];
  if (!p) return null;
  const monthly = parsePence(p.monthly);
  const yearly = parsePence(p.yearly);
  if (!monthly || !yearly) return null;
  const pct = Math.round((1 - yearly / (monthly * 12)) * 100);
  return pct > 0 ? `Save ${pct}%` : null;
}

export function PricingComparison({ currentPlan }: { currentPlan?: string | null }) {
  const [annual, setAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [downgradeDetails, setDowngradeDetails] = useState<CancelPlanDetails | null>(null);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const period = annual ? "billed annually" : "billed monthly";
  const seatPeriod = annual ? "per seat, billed annually" : "per seat, billed monthly";
  const interval = annual ? "YEARLY" : "MONTHLY";

  const priceLabel = (plan: string) => {
    const p = DISPLAY_PRICES[plan];
    if (!p) return "£X";
    const raw = annual ? p.yearly : p.monthly;
    if (annual) {
      const yearly = parsePence(raw);
      if (yearly) return `${raw.replace(/[\d.]+/, (parseFloat((yearly / 12).toFixed(2)).toString()))}`;
    }
    return raw;
  };

  const handleUpgrade = (plan: string) => {
    setLoadingPlan(plan);
    startTransition(async () => {
      const result = await createCheckoutSession({ plan, interval });
      if ("url" in result) {
        window.location.href = result.url;
      } else if (result.error === "USE_CUSTOMER_PORTAL") {
        window.location.href = "/settings";
      } else if (result.error === "UNAUTHORIZED") {
        window.location.href = plan === "PRO" ? "/register?plan=pro" : "/register";
      } else {
        // BILLING_NOT_CONFIGURED or STRIPE_ERROR — surface gracefully
        window.location.href = "/pricing?error=billing";
      }
      setLoadingPlan(null);
    });
  };

  // Existing paid subscriber switching tiers → the Stripe customer portal.
  const handlePortal = (card: string) => {
    setLoadingPlan(card);
    startTransition(async () => {
      const result = await createBillingPortalSession();
      window.location.href = "url" in result ? result.url : "/settings";
      setLoadingPlan(null);
    });
  };

  const handleDowngrade = () => {
    setLoadingPlan("FREE");
    startTransition(async () => {
      const result = await getDowngradeSummary();
      setLoadingPlan(null);
      if ("error" in result) {
        window.location.href = result.error === "UNAUTHORIZED" ? "/login" : "/settings";
        return;
      }
      setDowngradeDetails(result);
      setDowngradeOpen(true);
    });
  };

  const fallbackLabel: Record<PlanCol, string> = {
    FREE: "Get started",
    PRO: "Choose Pro",
    FAMILY: "Choose Family",
    TEAMS: "Choose Teams",
  };

  /**
   * Resolves the CTA for a plan column against the viewer's current plan (§4).
   * Logged-out / no-plan visitors keep the marketing labels and checkout flow;
   * logged-in users see Current / Switch / Downgrade per the matrix.
   */
  const PlanCta = ({ card }: { card: PlanCol }) => {
    const viewer = (currentPlan as PlanCol | null) ?? null;
    const isLoading = loadingPlan === card;

    // Logged out or plan unknown → marketing CTAs.
    if (!viewer) {
      if (card === "FREE") {
        return <Link className="plan-cta plan-cta--ghost" href="/register">Get started</Link>;
      }
      return (
        <button
          className={`plan-cta plan-cta--${card === "PRO" ? "primary" : "ghost"} disabled:opacity-60`}
          disabled={isLoading}
          onClick={() => handleUpgrade(card)}
          type="button"
        >
          {isLoading ? "Loading…" : fallbackLabel[card]}
        </button>
      );
    }

    const cell = CTA_MATRIX[viewer][card];
    if (cell === "current") {
      return <span className="plan-cta plan-cta--current">Current plan</span>;
    }

    const variantClass =
      cell.kind === "primary"
        ? "plan-cta--primary"
        : cell.kind === "destructive"
          ? "plan-cta--destructive"
          : "plan-cta--ghost";

    // Downgrade to Free — load live usage data then show confirmation modal.
    if (cell.kind === "destructive") {
      return (
        <button
          className={`plan-cta ${variantClass} disabled:opacity-60`}
          disabled={isLoading}
          onClick={handleDowngrade}
          type="button"
        >
          {isLoading ? "Loading…" : cell.label}
        </button>
      );
    }

    // Free viewer → checkout; existing paid subscriber → portal.
    const onClick = () => (viewer === "FREE" ? handleUpgrade(card) : handlePortal(card));
    return (
      <>
        <button
          className={`plan-cta ${variantClass} disabled:opacity-60`}
          disabled={isLoading}
          onClick={onClick}
          type="button"
        >
          {isLoading ? "Loading…" : cell.label}
        </button>
        {cell.sub ? <p className="plan-cta-sub">{cell.sub}</p> : null}
      </>
    );
  };

  return (
    <>
      <section className="phead">
        <div className="container">
          <p className="section-kicker" style={{ textAlign: "center" }}>Pricing</p>
          <h1 className="section-title">Plans that grow with you</h1>
          <p className="section-lede">Start free and stay free for as long as you like. Upgrade when you need unlimited contacts, deeper history, or a shared address book.</p>
          <div className="toggle-wrap">
            <div className="seg" role="group" aria-label="Billing period">
              <button aria-pressed={!annual} onClick={() => setAnnual(false)} type="button">Monthly</button>
              <button aria-pressed={annual} onClick={() => setAnnual(true)} type="button">Annual</button>
            </div>
            <span className="save-hint" hidden={!annual}>{savingsBadge("PRO") ?? "Save ~20%"}</span>
          </div>
        </div>
      </section>

      <section className="pricing">
        <div className="container">
          <div className="ptable-scroll">
            <table className="ptable">
              <colgroup>
                <col className="col-feat" />
                <col className="col-plan" />
                <col className="col-plan" />
                <col className="col-plan" />
                <col className="col-plan" />
              </colgroup>
              <thead>
                <tr>
                  <th className="feat-corner"></th>
                  <th>
                    <div className="plan-card">
                      <div className="plan-name">Free</div>
                      <p className="plan-who">For getting started and small libraries</p>
                      <div className="plan-price">£0</div>
                      <p className="plan-period">Free forever</p>
                      <PlanCta card="FREE" />
                    </div>
                  </th>
                  <th>
                    <div className="plan-card plan-card--rec">
                      <span className="plan-rec-tag"><span className="chip chip--rec">Recommended</span></span>
                      <div className="plan-name">Pro</div>
                      <p className="plan-who">For individual power users</p>
                      <div className="plan-price">{priceLabel("PRO")}<small> / mo</small></div>
                      <p className="plan-period">{period}{annual && savingsBadge("PRO") ? <> · <span className="save-inline">{savingsBadge("PRO")}</span></> : null}</p>
                      <PlanCta card="PRO" />
                    </div>
                  </th>
                  <th>
                    <div className="plan-card">
                      <div className="plan-name">Family</div>
                      <p className="plan-who">For households up to 6 people</p>
                      <div className="plan-price">{priceLabel("FAMILY")}<small> / mo</small></div>
                      <p className="plan-period">{period}{annual && savingsBadge("FAMILY") ? <> · <span className="save-inline">{savingsBadge("FAMILY")}</span></> : null}</p>
                      <PlanCta card="FAMILY" />
                    </div>
                  </th>
                  <th>
                    <div className="plan-card">
                      <div className="plan-name">Teams</div>
                      <p className="plan-who">For organisations up to 25</p>
                      <div className="plan-price">{priceLabel("TEAMS")}<small> / mo</small></div>
                      <p className="plan-period">{seatPeriod}{annual && savingsBadge("TEAMS") ? <> · <span className="save-inline">{savingsBadge("TEAMS")}</span></> : null}</p>
                      <PlanCta card="TEAMS" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* CONTACTS */}
                <tr className="cat-row"><td colSpan={5}>Contacts</td></tr>
                <tr className="feat-row">
                  <td className="feat-name">Contacts</td>
                  <td className="cell"><span className="val">500</span></td>
                  <td className="cell cell-rec"><span className="val">Unlimited</span></td>
                  <td className="cell"><span className="val">Unlimited</span><br /><span className="cell-note">per member</span></td>
                  <td className="cell"><span className="val">Unlimited</span><br /><span className="cell-note">per member</span></td>
                </tr>
                <tr className="feat-row">
                  <td className="feat-name">Monthly imports</td>
                  <td className="cell"><span className="val">3 / mo</span></td>
                  <td className="cell cell-rec"><span className="val">Unlimited</span></td>
                  <td className="cell"><span className="val">Unlimited</span></td>
                  <td className="cell"><span className="val">Unlimited</span></td>
                </tr>
                <tr className="feat-row">
                  <td className="feat-name">Export formats</td>
                  <td className="cell">CSV, vCard</td>
                  <td className="cell cell-rec">All formats</td>
                  <td className="cell">All formats</td>
                  <td className="cell">All formats</td>
                </tr>
                <tr className="feat-row">
                  <td className="feat-name">Duplicate merge</td>
                  <td className="cell">Basic suggestions</td>
                  <td className="cell cell-rec"><span className="val">Advanced</span><br /><span className="cell-note">field-level, bulk, 30-day undo</span></td>
                  <td className="cell">Advanced</td>
                  <td className="cell">Advanced</td>
                </tr>

                {/* SYNC */}
                <tr className="cat-row"><td colSpan={5}>Sync</td></tr>
                <tr className="feat-row">
                  <td className="feat-name">CardDAV sync accounts</td>
                  <td className="cell"><span className="val">1</span></td>
                  <td className="cell cell-rec"><span className="val">5</span></td>
                  <td className="cell"><span className="val">5</span><br /><span className="cell-note">per member</span></td>
                  <td className="cell"><span className="val">5</span><br /><span className="cell-note">per member</span></td>
                </tr>
                <tr className="feat-row">
                  <td className="feat-name">Device app passwords</td>
                  <td className="cell"><span className="val">1</span></td>
                  <td className="cell cell-rec"><span className="val">5</span></td>
                  <td className="cell"><span className="val">5</span></td>
                  <td className="cell"><span className="val">5</span></td>
                </tr>
                <tr className="feat-row">
                  <td className="feat-name">Team-level CardDAV sync</td>
                  <td className="cell"><Dash /></td>
                  <td className="cell cell-rec"><Dash /></td>
                  <td className="cell"><Dash /></td>
                  <td className="cell"><Check /></td>
                </tr>

                {/* SHARING */}
                <tr className="cat-row"><td colSpan={5}>Sharing</td></tr>
                <tr className="feat-row">
                  <td className="feat-name">vCard share links</td>
                  <td className="cell">Expire after 7 days</td>
                  <td className="cell cell-rec">No expiry, revocable</td>
                  <td className="cell">No expiry, revocable</td>
                  <td className="cell">No expiry, revocable</td>
                </tr>
                <tr className="feat-row">
                  <td className="feat-name">Static contact sharing</td>
                  <td className="cell"><Dash /></td>
                  <td className="cell cell-rec"><Check /></td>
                  <td className="cell"><Check /></td>
                  <td className="cell"><Check /></td>
                </tr>
                <tr className="feat-row">
                  <td className="feat-name">Live contact sharing</td>
                  <td className="cell"><Dash /></td>
                  <td className="cell cell-rec"><Check /></td>
                  <td className="cell"><Check /></td>
                  <td className="cell"><Check /></td>
                </tr>

                {/* COLLABORATION */}
                <tr className="cat-row"><td colSpan={5}>Collaboration <span style={{ fontWeight: 600, letterSpacing: "0.02em", textTransform: "none", color: "var(--mute)", fontSize: "11px" }}>· shared books — Phase 13+</span></td></tr>
                <tr className="feat-row">
                  <td className="feat-name">Members</td>
                  <td className="cell"><Dash /></td>
                  <td className="cell cell-rec"><Dash /></td>
                  <td className="cell"><span className="val">Up to 6</span></td>
                  <td className="cell"><span className="val">Up to 25</span></td>
                </tr>
                <tr className="feat-row">
                  <td className="feat-name">Shared address books</td>
                  <td className="cell"><Dash /></td>
                  <td className="cell cell-rec"><Dash /></td>
                  <td className="cell"><span className="val">1 shared book</span></td>
                  <td className="cell"><span className="val">Multiple</span></td>
                </tr>
                <tr className="feat-row">
                  <td className="feat-name">Roles &amp; admin controls</td>
                  <td className="cell"><Dash /></td>
                  <td className="cell cell-rec"><Dash /></td>
                  <td className="cell">Admin controls</td>
                  <td className="cell">Roles per book</td>
                </tr>
                <tr className="feat-row">
                  <td className="feat-name">Audit log</td>
                  <td className="cell"><Dash /></td>
                  <td className="cell cell-rec"><Dash /></td>
                  <td className="cell"><Dash /></td>
                  <td className="cell"><span className="val">Unlimited retention</span></td>
                </tr>

                {/* ACTIVITY */}
                <tr className="cat-row"><td colSpan={5}>Activity</td></tr>
                <tr className="feat-row">
                  <td className="feat-name">Global activity feed</td>
                  <td className="cell"><Dash /></td>
                  <td className="cell cell-rec"><span className="val">365 days</span></td>
                  <td className="cell"><span className="val">90 days</span></td>
                  <td className="cell"><span className="val">Unlimited</span></td>
                </tr>
                <tr className="feat-row">
                  <td className="feat-name">Per-contact history</td>
                  <td className="cell">Last 3 shown</td>
                  <td className="cell cell-rec">Full, 365 days</td>
                  <td className="cell">Full, 90 days</td>
                  <td className="cell">Full, unlimited</td>
                </tr>

                {/* SUPPORT */}
                <tr className="cat-row"><td colSpan={5}>Support</td></tr>
                <tr className="feat-row">
                  <td className="feat-name">Support</td>
                  <td className="cell">Community</td>
                  <td className="cell cell-rec">Priority</td>
                  <td className="cell">Priority</td>
                  <td className="cell"><span className="val">Dedicated manager</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="pfoot-note">Prices shown are placeholders pending launch (commercial decision in progress). Family and Teams shared address books are coming soon. Your data is never deleted by changing plans — contacts over a plan&rsquo;s limit become read-only, and export is always available. See the <Link href="/privacy">privacy policy</Link> for details.</p>
        </div>
      </section>

      {downgradeDetails ? (
        <CancelPlanModal
          details={downgradeDetails}
          family={currentPlan === "FAMILY"}
          open={downgradeOpen}
          onOpenChange={setDowngradeOpen}
        />
      ) : null}
    </>
  );
}
