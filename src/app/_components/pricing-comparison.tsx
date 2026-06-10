"use client";

import Link from "next/link";
import { useState } from "react";

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
 */
export function PricingComparison() {
  const [annual, setAnnual] = useState(false);
  const period = annual ? "billed annually" : "billed monthly";
  const seatPeriod = annual ? "per seat, billed annually" : "per seat, billed monthly";

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
            <span className="save-hint" hidden={!annual}>Save ~20%</span>
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
                      <Link className="plan-cta plan-cta--ghost" href="/register">Get started</Link>
                    </div>
                  </th>
                  <th>
                    <div className="plan-card plan-card--rec">
                      <span className="plan-rec-tag"><span className="chip chip--rec">Recommended</span></span>
                      <div className="plan-name">Pro</div>
                      <p className="plan-who">For individual power users</p>
                      <div className="plan-price">£X<small> / mo</small></div>
                      <p className="plan-period">{period}</p>
                      <Link className="plan-cta plan-cta--primary" href="/register">Upgrade to Pro</Link>
                    </div>
                  </th>
                  <th>
                    <div className="plan-card">
                      <div className="plan-name">Family</div>
                      <p className="plan-who">For households up to 6 people</p>
                      <div className="plan-price">£X<small> / mo</small></div>
                      <p className="plan-period">{period}</p>
                      <Link className="plan-cta plan-cta--ghost" href="/register">Choose Family</Link>
                    </div>
                  </th>
                  <th>
                    <div className="plan-card">
                      <div className="plan-name">Teams</div>
                      <p className="plan-who">For organisations up to 25</p>
                      <div className="plan-price">£X<small> / mo</small></div>
                      <p className="plan-period">{seatPeriod}</p>
                      <Link className="plan-cta plan-cta--ghost" href="/register">Contact sales</Link>
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
                <tr className="cat-row"><td colSpan={5}>Collaboration <span style={{ fontWeight: 600, letterSpacing: "0.02em", textTransform: "none", color: "var(--mute)", fontSize: "11px" }}>· coming soon</span></td></tr>
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
                  <td className="cell"><span className="val">Unlimited</span></td>
                </tr>
                <tr className="feat-row">
                  <td className="feat-name">Roles &amp; admin controls</td>
                  <td className="cell"><Dash /></td>
                  <td className="cell cell-rec"><Dash /></td>
                  <td className="cell">Admin controls</td>
                  <td className="cell">Roles per book</td>
                </tr>
                <tr className="feat-row">
                  <td className="feat-name">Team audit log</td>
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
    </>
  );
}
