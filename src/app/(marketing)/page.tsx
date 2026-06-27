import Link from "next/link";
import type { Metadata } from "next";

import {
  JsonLd,
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "~/app/_components/json-ld";
import { auth } from "~/server/auth";

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

export default async function HomePage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(/\s+/)[0] ?? null;

  return (
    <>
      <JsonLd
        data={[organizationSchema(), softwareApplicationSchema(), websiteSchema()]}
      />

      {/* ═══════════════════════════ HERO ═══════════════════════════ */}
      <section className="hp-hero">
        <div className="hp-wrap hp-hero__inner">
          <div className="hp-hero__copy">
            {session ? (
              <>
                <p className="hp-hero__eyebrow">Welcome back</p>
                <h1 className="hp-hero__title">
                  {firstName ? `Welcome back, ${firstName}.` : "Pick up where you left off."}
                </h1>
                <p className="hp-hero__sub">Your contacts are waiting.</p>
                <div className="hp-hero__ctas">
                  <Link className="hp-btn--green" href="/contacts?tab=overview">
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
                  One address book that stays current on every device, every app, and every
                  person you share with.
                </p>
                <div className="hp-hero__ctas">
                  <Link className="hp-btn--primary" href="/register">
                    Get started free
                  </Link>
                  <a className="hp-btn--secondary" href="#features">
                    See how it works
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 5v13" />
                      <path d="M6 13l6 6 6-6" />
                    </svg>
                  </a>
                </div>
              </>
            )}
          </div>

          {/* Product screenshot mock */}
          <div className="hp-hero__media">
            <div
              className="hp-shot"
              role="img"
              aria-label="Kontax contacts list with the search dropdown open, showing grouped results and label chips"
            >
              {/* Browser chrome */}
              <div className="hp-shot__chrome" aria-hidden="true">
                <div className="hp-shot__dots">
                  <span className="hp-shot__dot" style={{ background: "#ec6a5e" }} />
                  <span className="hp-shot__dot" style={{ background: "#f4be4f" }} />
                  <span className="hp-shot__dot" style={{ background: "#61c454" }} />
                </div>
                <div className="hp-shot__url">
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#8b938c"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 018 0v4" />
                  </svg>
                  app.getkontax.com
                </div>
              </div>

              {/* App header */}
              <div className="hp-shot__head" aria-hidden="true">
                <div className="hp-shot__brand">
                  <span className="hp-shot__brand-k">K</span>
                  <span className="hp-shot__brand-word">Kontax</span>
                </div>
                <div className="hp-shot__head-actions">
                  <span className="hp-shot__create">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                    New
                  </span>
                  <span className="hp-shot__icon-btn">
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 8a6 6 0 10-12 0c0 7-2 8-2 8h16s-2-1-2-8" />
                      <path d="M10.5 21a1.8 1.8 0 003 0" />
                    </svg>
                  </span>
                  <span className="hp-shot__avatar">L</span>
                </div>
              </div>

              {/* Search field + dropdown */}
              <div className="hp-shot__searchwrap" aria-hidden="true">
                <div className="hp-shot__search">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#4158f4"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.6-3.6" />
                  </svg>
                  <span>al</span>
                  <span className="hp-shot__caret" />
                </div>
                <div className="hp-shot__dropdown">
                  <div className="hp-dd-group">Contacts · 3 matches</div>
                  <div className="hp-dd-row hp-dd-row--active">
                    <span className="hp-dd-av" style={{ background: "#e9e7f4", color: "#5a55a6" }}>
                      AC
                    </span>
                    <span className="hp-dd-text">
                      <span className="hp-dd-name">
                        <mark>Al</mark>ex Chen
                      </span>
                      <span className="hp-dd-meta">alex@acme.com</span>
                    </span>
                    <span className="hp-dd-chips">
                      <span className="hp-lchip hp-lchip--work">Work</span>
                    </span>
                  </div>
                  <div className="hp-dd-row">
                    <span className="hp-dd-av" style={{ background: "#f2e6ea", color: "#9a4a63" }}>
                      AW
                    </span>
                    <span className="hp-dd-text">
                      <span className="hp-dd-name">
                        <mark>Al</mark>exandra Wong
                      </span>
                      <span className="hp-dd-meta">+1 415 555 0192</span>
                    </span>
                    <span className="hp-dd-chips">
                      <span className="hp-lchip hp-lchip--family">Family</span>
                    </span>
                  </div>
                  <div className="hp-dd-row">
                    <span className="hp-dd-av" style={{ background: "#e6ece4", color: "#3f6b53" }}>
                      AS
                    </span>
                    <span className="hp-dd-text">
                      <span className="hp-dd-name">
                        <mark>Al</mark>ima Sow
                      </span>
                      <span className="hp-dd-meta">Studio Atlas</span>
                    </span>
                    <span className="hp-dd-chips">
                      <span className="hp-lchip hp-lchip--client">Clients</span>
                    </span>
                  </div>
                  <div className="hp-dd-divider" />
                  <div className="hp-dd-group">Labels</div>
                  <div className="hp-dd-label-row">
                    <span className="hp-lchip hp-lchip--family">Family</span>
                    <span className="hp-dd-meta">12 contacts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════ FEATURE TILES ═══════════════════════════ */}
      <section className="hp-tiles" id="features">
        <div className="hp-wrap">
          <div className="hp-sec-head">
            <h2 className="hp-sec-title">Everything your contacts need</h2>
            <p className="hp-sec-lede">From first sync to last export, Kontax handles it.</p>
          </div>
          <div className="hp-tile-grid">

            <article className="hp-tile">
              <span className="hp-tile__icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.6-3.6" />
                </svg>
              </span>
              <h3 className="hp-tile__title">Search that actually works</h3>
              <p className="hp-tile__body">
                Grouped results across names, emails, and numbers — with the matched text
                highlighted as you type.
              </p>
            </article>

            <article className="hp-tile">
              <span className="hp-tile__icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.5 13.3l-7.2 7.2a2 2 0 01-2.8 0l-6.5-6.5a2 2 0 01-.6-1.4V4.8a1 1 0 011-1h7.8a2 2 0 011.4.6l6.5 6.5a2 2 0 010 2.8z" />
                  <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <h3 className="hp-tile__title">Labels that organise</h3>
              <p className="hp-tile__body">
                A proper label registry — filter, group, and keep your tags in sync across
                every connected device.
              </p>
            </article>

            <article className="hp-tile">
              <span className="hp-tile__icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 9a8 8 0 0114-3l2 2" />
                  <path d="M20 15a8 8 0 01-14 3l-2-2" />
                  <path d="M20 4v4h-4" />
                  <path d="M4 20v-4h4" />
                </svg>
              </span>
              <h3 className="hp-tile__title">Sync everywhere</h3>
              <p className="hp-tile__body">
                Open CardDAV keeps you live with Google, Outlook, and iCloud — no proprietary
                client to install.
              </p>
            </article>

            <article className="hp-tile">
              <span className="hp-tile__icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="9" r="3.2" />
                  <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" />
                  <path d="M16 5.5a3 3 0 010 5.6" />
                  <path d="M17.5 14.4c2 .8 3.5 2.2 3.5 4.6" />
                </svg>
              </span>
              <h3 className="hp-tile__title">Share with family or team</h3>
              <p className="hp-tile__body">
                Shared address books stay current for everyone, with live edits the whole group
                sees instantly.
              </p>
            </article>

            <article className="hp-tile">
              <span className="hp-tile__icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2.5" />
                  <circle cx="8.5" cy="11" r="2" />
                  <path d="M5.5 16c0-1.7 1.3-2.6 3-2.6s3 .9 3 2.6" />
                  <path d="M14.5 10h4" />
                  <path d="M14.5 13.5h4" />
                </svg>
              </span>
              <h3 className="hp-tile__title">Your public card</h3>
              <p className="hp-tile__body">
                Claim a clean <strong>/u/username</strong> page and let anyone save your
                details with a one-tap vCard.
              </p>
            </article>

            <article className="hp-tile">
              <span className="hp-tile__icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 8l-5 4 5 4" />
                  <path d="M15 8l5 4-5 4" />
                </svg>
              </span>
              <h3 className="hp-tile__title">Developer API</h3>
              <p className="hp-tile__body">
                A clean REST API at <strong>api.getkontax.com</strong> to build, automate,
                and integrate on your own terms.
              </p>
            </article>

          </div>
        </div>
      </section>

      {/* ═══════════════════════════ STATS ═══════════════════════════ */}
      <section className="hp-stats">
        <div className="hp-wrap">
          <h2 className="hp-stats__title">
            Trusted by people who care about their contacts.
          </h2>
          <div className="hp-stat-bar">
            <div className="hp-stat">
              <div className="hp-stat__value">99.9%</div>
              <div className="hp-stat__label">uptime</div>
            </div>
            <div className="hp-stat">
              <div className="hp-stat__value">4</div>
              <div className="hp-stat__label">sync sources</div>
            </div>
            <div className="hp-stat">
              <div className="hp-stat__value">0</div>
              <div className="hp-stat__label">ads, ever</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════ CTA BAND ═══════════════════════════ */}
      <section className="mkt-cta-band">
        <div className="mkt-cta-band__inner">
          <h2 className="mkt-cta-band__title">Ready to get started?</h2>
          <p className="mkt-cta-band__sub">Free plan, no credit card required.</p>
          <Link className="mkt-cta-band__btn" href="/register">
            Get started free
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h13" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  );
}
