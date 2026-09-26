import Link from "next/link";
import type { Metadata } from "next";

import { JsonLd } from "~/app/_components/json-ld";

import { ArrowIcon, IndexLabel } from "../_components/mkt-ui";
import { StillStuck } from "./_components/help-chrome";
import { HelpSearch } from "./_components/help-search";
import { LegacyAnchorRedirect } from "./_components/legacy-anchor-redirect";
import {
  articleHref,
  buildSearchIndex,
  categoryHref,
  HELP_CATEGORIES,
  resolveRef,
  TOP_TASKS,
} from "./_content";
import { LEGACY_HELP_ANCHORS } from "./_content/anchors";
import { helpBreadcrumbSchema } from "./_content/schema";
import "./help.css";

const DESCRIPTION =
  "Step-by-step help for Kontax: connect iPhone, Mac, iCloud, Google and Fastmail, fix sync problems, merge duplicates, import and export, and manage your account.";

export const metadata: Metadata = {
  title: "Help centre — Kontax",
  description: DESCRIPTION,
  alternates: { canonical: "/help" },
  openGraph: {
    title: "Kontax help centre",
    description: DESCRIPTION,
    url: "/help",
    siteName: "Kontax",
    type: "website",
  },
};

// P50A-05 · Help hub: search, top tasks, categories. Fully static — the search
// index is built here at build time and handed to a small client island.
export default function HelpHubPage() {
  const legacyMap = Object.fromEntries(
    Object.entries(LEGACY_HELP_ANCHORS).flatMap(([anchor, ref]) => {
      const r = resolveRef(ref);
      return r ? [[anchor, r.href]] : [];
    }),
  );
  const topTasks = TOP_TASKS.flatMap((ref) => {
    const r = resolveRef(ref);
    return r ? [r] : [];
  });

  return (
    <>
      <JsonLd data={helpBreadcrumbSchema()} />
      <LegacyAnchorRedirect map={legacyMap} />
      <div className="hc-page hc-page--hub">
        <div className="mkt-container">
          <div className="hc-hub-head">
            <IndexLabel>Help centre</IndexLabel>
            <h1 className="hc-hub-head__title">How can we help?</h1>
            <p className="hc-hub-head__lede">
              Short, step-by-step answers for getting your contacts in, keeping them in sync and
              keeping your account safe.
            </p>
            <HelpSearch index={buildSearchIndex()} />
          </div>

          <section className="hc-block" aria-labelledby="hc-top">
            <h2 id="hc-top" className="hc-block__title">Top tasks</h2>
            <ul className="hc-tasks">
              {topTasks.map((t) => (
                <li key={t.href}>
                  <Link href={t.href} className="hc-task">
                    <span>{t.title}</span>
                    <ArrowIcon size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="hc-block" aria-labelledby="hc-cats">
            <h2 id="hc-cats" className="hc-block__title">Browse by topic</h2>
            <ul className="hc-cats">
              {HELP_CATEGORIES.map((c) => (
                <li key={c.id} className="hc-cat">
                  <h3 className="hc-cat__title">
                    <Link href={categoryHref(c.id)}>{c.title}</Link>
                  </h3>
                  <p className="hc-cat__desc">{c.description}</p>
                  <ul className="hc-cat__list">
                    {c.articles.slice(0, 3).map((a) => (
                      <li key={a.slug}>
                        <Link href={articleHref(a)}>{a.title}</Link>
                      </li>
                    ))}
                  </ul>
                  <Link href={categoryHref(c.id)} className="mkt-more hc-cat__more">
                    All {c.articles.length} articles
                    <span className="mkt-sr-only"> in {c.title}</span>
                    <ArrowIcon size={15} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <StillStuck />
        </div>
      </div>
    </>
  );
}
