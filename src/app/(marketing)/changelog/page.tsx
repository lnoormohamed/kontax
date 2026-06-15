import Link from "next/link";
import type { Metadata } from "next";
import "./changelog.css";

export const metadata: Metadata = {
  title: "Changelog — Kontax",
  description: "Every Kontax update in order — new features, improvements, and fixes.",
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Changelog",
    description: "Every Kontax update in order — new features, improvements, and fixes.",
    url: "/changelog",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=changelog", width: 1200, height: 630, alt: "Kontax — What's new" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Changelog — Kontax",
    description: "Every Kontax update in order — new features, improvements, and fixes.",
  },
};

export default function ChangelogPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="chg-hero">
        <div className="chg-wrap">
          <div className="chg-hero__inner">
            <span className="chg-hero__eyebrow">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 8v4l3 2" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              Changelog
            </span>
            <h1 className="chg-hero__title">What&apos;s new in Kontax</h1>
            <p className="chg-hero__sub">
              We ship most weeks — new features, refinements, and fixes as we work toward the most
              reliable address book on every device. Everything that&apos;s changed is here, newest
              first.
            </p>
            <div className="chg-hero__meta">
              <span>Updated 28 May 2026</span>
              <span aria-hidden="true">·</span>
              <a className="chg-hero__rss" href="/changelog.xml">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 11a9 9 0 0 1 9 9" />
                  <path d="M4 4a16 16 0 0 1 16 16" />
                  <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
                </svg>
                Subscribe via RSS
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Entries ── */}
      <section className="chg-body">
        <div className="chg-wrap">

          {/* v3.3 — Search experience upgrade */}
          <article className="chg-entry">
            <time className="chg-entry__date" dateTime="2026-05-28">28 May 2026</time>
            <div className="chg-entry__content">
              <time className="chg-entry__date--mobile" dateTime="2026-05-28">28 May 2026</time>
              <div className="chg-entry__head">
                <span className="chg-vbadge">v3.3</span>
                <span className="chg-entry__title">Search experience upgrade</span>
              </div>
              <div className="chg-cat-group">
                <span className="chg-cbadge chg-cbadge--added">Added</span>
                <ul className="chg-cat-items">
                  <li>Search results are now grouped by match type — name, email, phone, label, and note.</li>
                  <li>Full keyboard navigation through the search dropdown, with Enter to open.</li>
                </ul>
              </div>
              <div className="chg-cat-group">
                <span className="chg-cbadge chg-cbadge--improved">Improved</span>
                <ul className="chg-cat-items">
                  <li>Search now matches inside notes and company names, not just names.</li>
                  <li>The exact matched text is highlighted in every result.</li>
                </ul>
              </div>
              <div className="chg-cat-group">
                <span className="chg-cbadge chg-cbadge--fixed">Fixed</span>
                <ul className="chg-cat-items">
                  <li>Diacritic-insensitive matching — searching &quot;Perez&quot; now finds &quot;Pérez&quot;.</li>
                </ul>
              </div>
            </div>
          </article>

          {/* v3.2 — Shared address books & roles (with release figure) */}
          <article className="chg-entry">
            <time className="chg-entry__date" dateTime="2026-05-09">9 May 2026</time>
            <div className="chg-entry__content chg-entry__content--fig">
              <div className="chg-entry__main">
                <time className="chg-entry__date--mobile" dateTime="2026-05-09">9 May 2026</time>
                <div className="chg-entry__head">
                  <span className="chg-vbadge">v3.2</span>
                  <span className="chg-entry__title">Shared address books &amp; roles</span>
                </div>
                <p className="chg-entry__summary">
                  Our biggest release this quarter: Family and Teams plans can now share a single
                  address book, with roles that decide who can change what.
                </p>
                <div className="chg-cat-group">
                  <span className="chg-cbadge chg-cbadge--added">Added</span>
                  <ul className="chg-cat-items">
                    <li>Shared address books for Family and Teams plans.</li>
                    <li>Owner, Editor, and Viewer roles with per-book permissions.</li>
                  </ul>
                </div>
                <div className="chg-cat-group">
                  <span className="chg-cbadge chg-cbadge--improved">Improved</span>
                  <ul className="chg-cat-items">
                    <li>Live updates across members — fix a number once and everyone sees it.</li>
                  </ul>
                </div>
                <div className="chg-cat-group">
                  <span className="chg-cbadge chg-cbadge--security">Security</span>
                  <ul className="chg-cat-items">
                    <li>Share invitations now expire after 7 days and can only be used once.</li>
                  </ul>
                </div>
              </div>
              <aside className="chg-entry__aside">
                <div
                  className="chg-fig"
                  role="img"
                  aria-label="A shared address book with three members and Owner, Editor, and Viewer role badges"
                >
                  <div className="chg-fig__head">
                    <span className="chg-fig__bk" aria-hidden="true">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19V6a2 2 0 0 1 2-2h9l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                      </svg>
                    </span>
                    <span>
                      <span className="chg-fig__title">Morales Family</span>
                      <span className="chg-fig__sub">3 members · 248 shared contacts</span>
                    </span>
                  </div>
                  <div className="chg-fig__row chg-fig__row--first">
                    <span className="chg-av" style={{ background: "var(--mkt-green)" }}>EM</span>
                    <span className="chg-nm">Elena Morales</span>
                    <span className="chg-role chg-role--owner">Owner</span>
                  </div>
                  <div className="chg-fig__row">
                    <span className="chg-av" style={{ background: "#6b7cf6" }}>DK</span>
                    <span className="chg-nm">David Kaur</span>
                    <span className="chg-role chg-role--editor">Editor</span>
                  </div>
                  <div className="chg-fig__row">
                    <span className="chg-av" style={{ background: "#c98a3a" }}>TN</span>
                    <span className="chg-nm">Theo Nakamura</span>
                    <span className="chg-role chg-role--viewer">Viewer</span>
                  </div>
                </div>
              </aside>
            </div>
          </article>

          {/* v3.1 — Two-way sync (with release figure) */}
          <article className="chg-entry">
            <time className="chg-entry__date" dateTime="2026-04-21">21 Apr 2026</time>
            <div className="chg-entry__content chg-entry__content--fig">
              <div className="chg-entry__main">
                <time className="chg-entry__date--mobile" dateTime="2026-04-21">21 Apr 2026</time>
                <div className="chg-entry__head">
                  <span className="chg-vbadge">v3.1</span>
                  <span className="chg-entry__title">Two-way sync</span>
                </div>
                <p className="chg-entry__summary">
                  Connect Google and Outlook and Kontax now keeps both sides in step — edits flow
                  in both directions, with a clear status on every connection.
                </p>
                <div className="chg-cat-group">
                  <span className="chg-cbadge chg-cbadge--added">Added</span>
                  <ul className="chg-cat-items">
                    <li>Two-way sync for Google Contacts and Outlook.</li>
                    <li>Per-connection sync status and last-synced time on the Sync page.</li>
                  </ul>
                </div>
                <div className="chg-cat-group">
                  <span className="chg-cbadge chg-cbadge--improved">Improved</span>
                  <ul className="chg-cat-items">
                    <li>Delta sync via CardDAV sync-tokens — far less bandwidth on large books.</li>
                  </ul>
                </div>
                <div className="chg-cat-group">
                  <span className="chg-cbadge chg-cbadge--security">Security</span>
                  <ul className="chg-cat-items">
                    <li>CardDAV app passwords now revoke immediately, on the client&apos;s next request.</li>
                  </ul>
                </div>
              </div>
              <aside className="chg-entry__aside">
                <div
                  className="chg-fig"
                  role="img"
                  aria-label="Sync connections showing Google Contacts and Outlook both synced"
                >
                  <div className="chg-fig__row chg-fig__row--first">
                    <span className="chg-yicn" style={{ background: "#4285f4" }}>G</span>
                    <span>
                      <span className="chg-ynm">Google Contacts</span>
                      <span className="chg-ysub">elena@gmail.com · 1,204 contacts</span>
                    </span>
                    <span className="chg-ystatus">
                      <span className="chg-dot" />
                      Synced 2m ago
                    </span>
                  </div>
                  <div className="chg-fig__row">
                    <span className="chg-yicn" style={{ background: "#0a6ed1" }}>O</span>
                    <span>
                      <span className="chg-ynm">Outlook</span>
                      <span className="chg-ysub">elena@outlook.com · 318 contacts</span>
                    </span>
                    <span className="chg-ystatus">
                      <span className="chg-dot" />
                      Synced 5m ago
                    </span>
                  </div>
                </div>
              </aside>
            </div>
          </article>

          {/* v3.0 — Merge duplicates & mobile app */}
          <article className="chg-entry">
            <time className="chg-entry__date" dateTime="2026-04-02">2 Apr 2026</time>
            <div className="chg-entry__content">
              <time className="chg-entry__date--mobile" dateTime="2026-04-02">2 Apr 2026</time>
              <div className="chg-entry__head">
                <span className="chg-vbadge">v3.0</span>
                <span className="chg-entry__title">Merge duplicates &amp; mobile app</span>
              </div>
              <div className="chg-cat-group">
                <span className="chg-cbadge chg-cbadge--added">Added</span>
                <ul className="chg-cat-items">
                  <li>Duplicate detection with a side-by-side merge review.</li>
                  <li>Installable mobile PWA with offline access to your contacts.</li>
                </ul>
              </div>
              <div className="chg-cat-group">
                <span className="chg-cbadge chg-cbadge--improved">Improved</span>
                <ul className="chg-cat-items">
                  <li>Import mapping now remembers your column choices between files.</li>
                </ul>
              </div>
              <div className="chg-cat-group">
                <span className="chg-cbadge chg-cbadge--fixed">Fixed</span>
                <ul className="chg-cat-items">
                  <li>vCard import no longer drops additional phone numbers on some contacts.</li>
                </ul>
              </div>
            </div>
          </article>

        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="mkt-cta-band">
        <div className="mkt-cta-band__inner">
          <h2 className="mkt-cta-band__title">Get every update, automatically</h2>
          <p className="mkt-cta-band__sub">
            Start free and every release lands in your address book the day it ships.
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
