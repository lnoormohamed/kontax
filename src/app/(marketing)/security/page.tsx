import Link from "next/link";
import type { Metadata } from "next";
import "./security.css";

export const metadata: Metadata = {
  title: "Security — Kontax",
  description:
    "Kontax is built around the principle that your contacts are yours. Here's how we keep them safe.",
  openGraph: {
    images: [{ url: "/api/og?page=security", width: 1200, height: 630, alt: "Kontax — Security you can trust" }],
  },
  twitter: { card: "summary_large_image" },
};

export default function SecurityPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="sp-hero">
        <div className="sp-wrap">
          <div className="sp-hero__inner">
            <span className="sp-hero__eyebrow">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              Security &amp; privacy
            </span>
            <h1 className="sp-hero__title">Security you can trust</h1>
            <p className="sp-hero__sub">
              Kontax is built around the principle that your contacts are yours. Here&apos;s
              how we keep them safe — in plain terms, no hand-waving.
            </p>
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="sp-trustbar">
        <div className="sp-wrap">
          <div className="sp-trustbar__inner">
            <span className="sp-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              TLS 1.2+
            </span>
            <span className="sp-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6z" />
              </svg>
              HSTS enforced
            </span>
            <span className="sp-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="8" cy="15" r="3.5" />
                <path d="M10.5 12.5 19 4M16 7l2.5 2.5" />
              </svg>
              bcrypt + TOTP
            </span>
            <span className="sp-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              GDPR ready
            </span>
            <span className="sp-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 5h18M5 5v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5M9 5V3h6v2" />
              </svg>
              No ad tracking
            </span>
          </div>
        </div>
      </section>

      {/* ── Protection flow diagram ── */}
      <section className="sp-flow-sec">
        <div className="sp-wrap">
          <div className="sp-flow-head">
            <p className="sp-flow-head__title">End to end</p>
            <p className="sp-flow-head__sub">
              How your contacts stay protected, from your device to every sync
            </p>
          </div>
          <div
            className="sp-flow"
            role="img"
            aria-label="Data protection flow: your devices connect over TLS 1.2+ to Kontax, which stores data encrypted at rest with AES-256, and syncs to Google, Outlook, and CardDAV using encrypted credentials."
          >
            <div className="sp-flow__node">
              <div className="sp-flow__icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="14" height="10" rx="1.5" />
                  <path d="M2 18h16" />
                  <rect x="16" y="9" width="6" height="11" rx="1.5" />
                </svg>
              </div>
              <div className="sp-flow__label">Your devices</div>
              <div className="sp-flow__sub">Web, mobile &amp; CardDAV clients</div>
            </div>
            <div className="sp-flow__edge" aria-hidden="true">
              <span className="sp-flow__pill">TLS 1.2+ · HSTS</span>
              <span className="sp-flow__arrow">
                <span className="sp-flow__arrow-line" />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h13M12 6l6 6-6 6" />
                </svg>
              </span>
            </div>
            <div className="sp-flow__node">
              <div className="sp-flow__icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6z" />
                  <rect x="9.5" y="10.5" width="5" height="4" rx="0.8" />
                  <path d="M10.5 10.5V9a1.5 1.5 0 0 1 3 0v1.5" />
                </svg>
              </div>
              <div className="sp-flow__label">Kontax</div>
              <div className="sp-flow__sub">Encrypted at rest · AES-256</div>
            </div>
            <div className="sp-flow__edge" aria-hidden="true">
              <span className="sp-flow__pill">Encrypted tokens</span>
              <span className="sp-flow__arrow">
                <span className="sp-flow__arrow-line" />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h13M12 6l6 6-6 6" />
                </svg>
              </span>
            </div>
            <div className="sp-flow__node">
              <div className="sp-flow__icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 11a8 8 0 0 0-14.3-3.7M4 5v3h3" />
                  <path d="M4 13a8 8 0 0 0 14.3 3.7M20 19v-3h-3" />
                </svg>
              </div>
              <div className="sp-flow__label">Google · Outlook · CardDAV</div>
              <div className="sp-flow__sub">OAuth tokens &amp; scoped app passwords</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cluster 1 — Encryption ── */}
      <section className="sp-cluster">
        <div className="sp-wrap">
          <div className="sp-cluster__head">
            <span className="sp-cluster__kicker">
              <b>01</b> · Encryption
            </span>
            <h2 className="sp-cluster__title">Encrypted in transit and at rest</h2>
            <p className="sp-cluster__lede">
              From the moment a request leaves your device to the moment it&apos;s written
              to disk, your contacts are encrypted.
            </p>
          </div>
          <div className="sp-sec-grid">
            <article className="sp-scard">
              <div className="sp-scard__icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="8" ry="3" />
                  <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
                  <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
                </svg>
              </div>
              <h3 className="sp-scard__h">Encrypted at rest</h3>
              <p className="sp-scard__p">
                Your contacts live in a managed PostgreSQL database with encryption at the
                storage layer. Sensitive fields go further — your TOTP secret is sealed with{" "}
                <code>AES-256</code> before it ever touches disk, and backups carry the same
                encryption.
              </p>
              <div className="sp-scard__chips">
                <span className="sp-techchip"><span className="sp-techchip__dot" />AES-256</span>
                <span className="sp-techchip"><span className="sp-techchip__dot" />Encrypted backups</span>
              </div>
            </article>
            <article className="sp-scard">
              <div className="sp-scard__icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <h3 className="sp-scard__h">TLS-only connections</h3>
              <p className="sp-scard__p">
                Every request — web, mobile, CardDAV, and API — travels over{" "}
                <code>TLS 1.2</code> or higher. Plain HTTP is redirected, never served, and an{" "}
                <code>HSTS</code> header keeps browsers on HTTPS from the very first visit.
                Certificates renew automatically.
              </p>
              <div className="sp-scard__chips">
                <span className="sp-techchip"><span className="sp-techchip__dot" />TLS 1.2+</span>
                <span className="sp-techchip"><span className="sp-techchip__dot" />HSTS preload</span>
                <span className="sp-techchip"><span className="sp-techchip__dot" />Auto-renewed certs</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ── Cluster 2 — Accounts & access ── */}
      <section className="sp-cluster sp-cluster--alt">
        <div className="sp-wrap">
          <div className="sp-cluster__head">
            <span className="sp-cluster__kicker">
              <b>02</b> · Accounts &amp; access
            </span>
            <h2 className="sp-cluster__title">Getting in is hard for everyone but you</h2>
            <p className="sp-cluster__lede">
              Strong defaults on your account, and careful handling of the credentials you
              give us to sync.
            </p>
          </div>
          <div className="sp-sec-grid">
            <article className="sp-scard">
              <div className="sp-scard__icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="15" r="4" />
                  <path d="M10.8 12.2 19 4" />
                  <path d="M16 7l3 3" />
                  <path d="M14 9l2 2" />
                </svg>
              </div>
              <h3 className="sp-scard__h">Secure by default</h3>
              <p className="sp-scard__p">
                Passwords are hashed with <code>bcrypt</code> — never stored or logged. Turn on{" "}
                <code>TOTP</code> two-factor in under a minute, with single-use recovery codes.
                Sensitive actions re-ask for your password mid-session, and sign-in endpoints are
                rate-limited against brute force.
              </p>
              <div className="sp-scard__chips">
                <span className="sp-techchip"><span className="sp-techchip__dot" />bcrypt</span>
                <span className="sp-techchip"><span className="sp-techchip__dot" />TOTP 2FA</span>
                <span className="sp-techchip"><span className="sp-techchip__dot" />Step-up auth</span>
                <span className="sp-techchip"><span className="sp-techchip__dot" />Rate limiting</span>
              </div>
            </article>
            <article className="sp-scard">
              <div className="sp-scard__icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 11a8 8 0 0 0-14.3-3.7M4 5v3h3" />
                  <path d="M4 13a8 8 0 0 0 14.3 3.7M20 19v-3h-3" />
                </svg>
              </div>
              <h3 className="sp-scard__h">Sync credentials, handled with care</h3>
              <p className="sp-scard__p">
                OAuth tokens for Google and Outlook are encrypted before storage and used only for
                the accounts you link. For CardDAV you issue scoped app passwords instead of your
                main password — revoke one and that client is cut off on its very next request.
              </p>
              <div className="sp-scard__chips">
                <span className="sp-techchip"><span className="sp-techchip__dot" />Encrypted OAuth tokens</span>
                <span className="sp-techchip"><span className="sp-techchip__dot" />Scoped app passwords</span>
                <span className="sp-techchip"><span className="sp-techchip__dot" />Instant revocation</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ── Cluster 3 — Your data & disclosure ── */}
      <section className="sp-cluster">
        <div className="sp-wrap">
          <div className="sp-cluster__head">
            <span className="sp-cluster__kicker">
              <b>03</b> · Your data &amp; disclosure
            </span>
            <h2 className="sp-cluster__title">Your contacts are yours — and we mean it</h2>
            <p className="sp-cluster__lede">
              Take your data with you whenever you like, and tell us if you find a problem.
            </p>
          </div>
          <div className="sp-sec-grid">
            <article className="sp-scard">
              <div className="sp-scard__icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h8l4 4v14H6z" />
                  <path d="M14 3v4h4" />
                  <path d="M9 12h6" />
                  <path d="M9 16h6" />
                </svg>
              </div>
              <h3 className="sp-scard__h">Your data, your rights</h3>
              <p className="sp-scard__p">
                Export everything — contacts, labels, and account data — as vCard, CSV, or a full
                GDPR archive, on any plan including Free. Account deletion runs on a clear
                schedule, export links expire on their own, and we never sell your data or run ads
                against it.
              </p>
              <div className="sp-scard__chips">
                <span className="sp-techchip"><span className="sp-techchip__dot" />vCard &amp; CSV</span>
                <span className="sp-techchip"><span className="sp-techchip__dot" />GDPR archive</span>
                <span className="sp-techchip"><span className="sp-techchip__dot" />Scheduled deletion</span>
              </div>
            </article>
            <article className="sp-scard">
              <div className="sp-scard__icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
              </div>
              <h3 className="sp-scard__h">Responsible disclosure</h3>
              <p className="sp-scard__p">
                Found something? Email <code>security@getkontax.com</code> with steps to reproduce
                and we&apos;ll acknowledge quickly. We won&apos;t pursue legal action against
                good-faith research that respects user privacy and avoids data destruction — just
                give us time to ship a fix first.
              </p>
              <div className="sp-scard__chips">
                <span className="sp-techchip"><span className="sp-techchip__dot" />security@getkontax.com</span>
                <span className="sp-techchip"><span className="sp-techchip__dot" />Coordinated disclosure</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ── Disclosure note ── */}
      <section className="sp-disclose">
        <div className="sp-wrap">
          <div className="sp-disclose__box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8h.01M11 12h1v4h1" />
            </svg>
            <p>
              <strong>No badges we haven&apos;t earned.</strong> We deliberately don&apos;t claim
              SOC 2, ISO 27001, or certifications that are still in progress. Everything on this
              page is true of Kontax today — nothing aspirational.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="mkt-cta-band">
        <div className="mkt-cta-band__inner">
          <h2 className="mkt-cta-band__title">Your contacts, kept safe</h2>
          <p className="mkt-cta-band__sub">
            Start free — no credit card, no tracking, and a full export whenever you want one.
          </p>
          <Link className="mkt-cta-band__btn" href="/register">
            Get started free
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h13" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  );
}
