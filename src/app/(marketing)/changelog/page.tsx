import type { Metadata } from "next";
import { CtaBand, PageHead } from "../_components/mkt-ui";
import "./changelog.css";
import { CHANGELOG_ENTRIES, type ChangelogCategoryLabel } from "./_entries";

// P50-05 · Direction A: page head, then releases as a hairline list with
// Geist Mono dates in a narrow left column (sticky on desktop). Category
// names are small h3s marked with a coloured dot.
const CATEGORY_CLASS: Record<ChangelogCategoryLabel, string> = {
  Added: "chg-cat--added",
  Improved: "chg-cat--improved",
  Fixed: "chg-cat--fixed",
  Security: "chg-cat--security",
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
  const latest = CHANGELOG_ENTRIES[0];

  return (
    <>
      <PageHead
        label="Changelog"
        title="What’s new in Kontax"
        lede="We ship most weeks — new features, refinements, and fixes as we work toward the most reliable address book on every device. Everything that’s changed is here, newest first."
      >
        <p className="chg-meta">
          {latest ? (
            <>
              <span>
                Updated <time dateTime={latest.date}>{latest.displayDate}</time>
              </span>
              <span className="chg-meta__sep" aria-hidden="true">
                ·
              </span>
            </>
          ) : null}
          <a className="chg-rss" href="/changelog.xml">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M4 11a9 9 0 0 1 9 9" />
              <path d="M4 4a16 16 0 0 1 16 16" />
              <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            Subscribe via RSS
          </a>
        </p>
      </PageHead>

      {/* ── Entries ── */}
      <section className="chg-list" aria-label="Releases">
        <div className="mkt-container">
          {CHANGELOG_ENTRIES.map((entry) => {
            const figure = entry.hasFigure ? FIGURES[entry.id] : undefined;
            return (
              <article className="chg-entry" id={entry.id} key={entry.id}>
                <div className="chg-entry__when">
                  <time className="chg-entry__date" dateTime={entry.date}>
                    {entry.displayDate}
                  </time>
                  <span className="chg-entry__ver">{entry.version}</span>
                </div>
                <div className="chg-entry__main">
                  <h2 className="chg-entry__title">{entry.title}</h2>
                  {entry.summary && <p className="chg-entry__summary">{entry.summary}</p>}
                  {entry.categories.map((cat) => (
                    <div className="chg-cat" key={cat.label}>
                      <h3 className={`chg-cat__label ${CATEGORY_CLASS[cat.label]}`}>{cat.label}</h3>
                      <ul className="chg-cat__items">
                        {cat.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {figure ? <div className="chg-entry__fig">{figure}</div> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <CtaBand
        title="Get every update, automatically"
        sub="Start free and every release lands in your address book the day it ships."
        secondary={null}
      />
    </>
  );
}
