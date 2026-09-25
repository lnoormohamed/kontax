import Link from "next/link";
import type { Metadata } from "next";
import "./changelog.css";
import { CHANGELOG_ENTRIES, type ChangelogCategoryLabel } from "./_entries";

const CATEGORY_BADGE_CLASS: Record<ChangelogCategoryLabel, string> = {
  Added: "chg-cbadge--added",
  Improved: "chg-cbadge--improved",
  Fixed: "chg-cbadge--fixed",
  Security: "chg-cbadge--security",
};

// Hand-drawn release-figure mocks for headline releases — presentational
// only, so they stay here rather than in the shared _entries.ts data. Keyed
// by ChangelogEntry.id.
//
// P50A-01: the two release figures that used to live here (a shared address
// book mock and a Google+Outlook sync mock) were tied to the fabricated
// v3.1/v3.2 entries removed from _entries.ts — the sync one also showed
// Outlook, which isn't live in production. No current entry sets
// `hasFigure: true`; add a new mock here (keyed by the entry's `id`) if a
// future release should get one.
const FIGURES: Record<string, React.ReactNode> = {};

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
              <span>Updated {CHANGELOG_ENTRIES[0]?.displayDate}</span>
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
          {CHANGELOG_ENTRIES.map((entry) => {
            const categoryGroups = entry.categories.map((cat) => (
              <div className="chg-cat-group" key={cat.label}>
                <span className={`chg-cbadge ${CATEGORY_BADGE_CLASS[cat.label]}`}>{cat.label}</span>
                <ul className="chg-cat-items">
                  {cat.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ));

            if (entry.hasFigure) {
              return (
                <article className="chg-entry" id={entry.id} key={entry.id}>
                  <time className="chg-entry__date" dateTime={entry.date}>{entry.displayDate}</time>
                  <div className="chg-entry__content chg-entry__content--fig">
                    <div className="chg-entry__main">
                      <time className="chg-entry__date--mobile" dateTime={entry.date}>{entry.displayDate}</time>
                      <div className="chg-entry__head">
                        <span className="chg-vbadge">{entry.version}</span>
                        <span className="chg-entry__title">{entry.title}</span>
                      </div>
                      {entry.summary && <p className="chg-entry__summary">{entry.summary}</p>}
                      {categoryGroups}
                    </div>
                    <aside className="chg-entry__aside">{FIGURES[entry.id]}</aside>
                  </div>
                </article>
              );
            }

            return (
              <article className="chg-entry" id={entry.id} key={entry.id}>
                <time className="chg-entry__date" dateTime={entry.date}>{entry.displayDate}</time>
                <div className="chg-entry__content">
                  <time className="chg-entry__date--mobile" dateTime={entry.date}>{entry.displayDate}</time>
                  <div className="chg-entry__head">
                    <span className="chg-vbadge">{entry.version}</span>
                    <span className="chg-entry__title">{entry.title}</span>
                  </div>
                  {entry.summary && <p className="chg-entry__summary">{entry.summary}</p>}
                  {categoryGroups}
                </div>
              </article>
            );
          })}
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
