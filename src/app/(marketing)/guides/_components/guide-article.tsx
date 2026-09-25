/**
 * P50A-06 · Shared long-form layout for /guides/* and /compare/* pages.
 *
 * Direction A: mono eyebrow, balanced headline, a boxed short answer at the
 * top (the one-paragraph direct answer), a sticky "On this page" list beside
 * the prose on wide screens, related links as cards and the stone CTA band.
 * Server-only, no client JS. Emits Article + BreadcrumbList JSON-LD.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { JsonLd } from "~/app/_components/json-ld";

import { ArrowIcon, CtaBand } from "../../_components/mkt-ui";
import {
  LAST_REVIEWED_ISO,
  LAST_REVIEWED_LABEL,
  THIRD_PARTY_CHECKED_LABEL,
  type GuidePage,
  type GuideSectionIndex,
} from "../_content/pages";
import { articleSchema, breadcrumbListSchema, crumbsFor } from "../_content/seo";

import "./guide.css";

export type GuideSection = { id: string; title: string; body: ReactNode };
export type RelatedLink = { href: string; title: string; body: string };
export type SourceLink = { href: string; label: string };

/* ─── Building blocks for page bodies ─────────────────────────────── */

/** Numbered steps. */
export function Steps({ items }: { items: readonly ReactNode[] }) {
  return (
    <ol className="ga-steps">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

/** Boxed aside. `kontax` = where Kontax helps; `plain` = a neutral note. */
export function Callout({
  tone = "plain",
  title,
  children,
}: {
  tone?: "kontax" | "plain";
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className={`ga-callout ga-callout--${tone}`} aria-label={title}>
      <p className="ga-callout__t">{title}</p>
      <div className="ga-callout__b">{children}</div>
    </aside>
  );
}

/** Factual comparison table: row headers down the side, one column per product. */
export function FactTable({
  caption,
  columns,
  rows,
  note,
}: {
  caption: string;
  columns: readonly string[];
  rows: readonly { label: string; cells: readonly ReactNode[] }[];
  note?: ReactNode;
}) {
  return (
    <figure className="ga-table">
      <div className="mkt-table-wrap" role="region" aria-label={caption} tabIndex={0}>
        <table className="mkt-table">
          <caption className="mkt-sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="mkt-sr-only">Feature</span>
              </th>
              {columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {r.cells.map((cell, i) => (
                  <td key={i}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note ? <figcaption className="ga-table__note">{note}</figcaption> : null}
    </figure>
  );
}

/** Link to a third-party help page. */
export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} rel="noopener noreferrer" target="_blank">
      {children}
      <span className="mkt-sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/* ─── Breadcrumbs ─────────────────────────────────────────────────── */

export function Breadcrumbs({ page }: { page: GuidePage | GuideSectionIndex }) {
  const crumbs = crumbsFor(page);
  return (
    <nav aria-label="Breadcrumb" className="ga-crumbs">
      <ol>
        {crumbs.map((c, i) => (
          <li key={c.path}>
            {i === crumbs.length - 1 ? (
              <span aria-current="page">{c.name}</span>
            ) : (
              <Link href={c.path}>{c.name}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ─── The article layout ──────────────────────────────────────────── */

export function GuideArticle({
  page,
  answer,
  sections,
  related,
  sources,
  checksThirdParty = true,
  cta,
}: {
  page: GuidePage;
  /** The one-paragraph direct answer shown under the H1. */
  answer: ReactNode;
  sections: readonly GuideSection[];
  related: readonly RelatedLink[];
  /** Apple / Google help pages the page's third-party facts were checked against. */
  sources?: readonly SourceLink[];
  /** Show "Apple and Google details checked …" beside the review date. */
  checksThirdParty?: boolean;
  cta?: { title: string; sub: string };
}) {
  const kind = page.section === "compare" ? "Comparison" : "Guide";
  return (
    <>
      <JsonLd data={[articleSchema(page), breadcrumbListSchema(crumbsFor(page))]} />
      <article className="ga">
        <header className="ga-head">
          <div className="mkt-container">
            <Breadcrumbs page={page} />
            <p className="ga-eyebrow">{kind}</p>
            <h1 className="ga-h1">{page.h1}</h1>
            <div className="ga-answer">
              <p className="ga-answer__label">Short answer</p>
              <div className="ga-answer__body">{answer}</div>
            </div>
            <p className="ga-meta">
              Last reviewed <time dateTime={LAST_REVIEWED_ISO}>{LAST_REVIEWED_LABEL}</time>
              {checksThirdParty ? (
                <>
                  <span aria-hidden="true"> · </span>
                  Apple and Google details checked against their help pages, {THIRD_PARTY_CHECKED_LABEL}
                </>
              ) : null}
            </p>
          </div>
        </header>

        <div className="ga-main">
          <div className="mkt-container ga-grid">
            <nav className="ga-toc" aria-label="On this page">
              <p className="ga-toc__t">On this page</p>
              <ol>
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>{s.title}</a>
                  </li>
                ))}
                {sources?.length ? (
                  <li>
                    <a href="#sources">Sources</a>
                  </li>
                ) : null}
              </ol>
            </nav>

            <div className="ga-body">
              {sections.map((s) => (
                <section key={s.id} id={s.id} className="ga-sec" aria-labelledby={`${s.id}-h`}>
                  <h2 id={`${s.id}-h`} className="ga-h2">
                    {s.title}
                  </h2>
                  {s.body}
                </section>
              ))}

              {sources?.length ? (
                <section id="sources" className="ga-sec ga-sources" aria-labelledby="sources-h">
                  <h2 id="sources-h" className="ga-h2">
                    Sources
                  </h2>
                  <p>
                    Details about Apple and Google products were checked against these help pages in{" "}
                    {THIRD_PARTY_CHECKED_LABEL}. Menus and names change between software versions; if a step
                    doesn’t match what you see, the linked page will have the current wording.
                  </p>
                  <ul>
                    {sources.map((s) => (
                      <li key={s.href}>
                        <Ext href={s.href}>{s.label}</Ext>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </div>
        </div>

        <section className="ga-related" aria-labelledby="related-h">
          <div className="mkt-container">
            <h2 id="related-h" className="ga-related__t">
              Related
            </h2>
            <ul className="ga-cards">
              {related.map((r) => (
                <li key={r.href}>
                  <Link href={r.href} className="mkt-card ga-card">
                    <span className="mkt-card__title">{r.title}</span>
                    <span className="mkt-card__body">{r.body}</span>
                    <span className="mkt-card__foot mkt-more">
                      Read <ArrowIcon />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </article>

      <CtaBand
        title={cta?.title ?? "One address book for iCloud, Google and Fastmail"}
        sub={
          cta?.sub ??
          "Free for up to 500 contacts, one sync source and one device over CardDAV. No card needed."
        }
      >
        <Link href="/register" className="mkt-btn mkt-btn--pri">
          Create a free account
        </Link>
        <Link href="/pricing" className="mkt-btn mkt-btn--sec">
          Compare plans
        </Link>
      </CtaBand>
    </>
  );
}

/* ─── Index pages (/guides, /compare) ─────────────────────────────── */

export function GuideIndex({
  index,
  pages,
  aside,
}: {
  index: GuideSectionIndex;
  pages: readonly GuidePage[];
  aside?: ReactNode;
}) {
  return (
    <>
      <JsonLd data={breadcrumbListSchema(crumbsFor(index))} />
      <header className="ga-head ga-head--index">
        <div className="mkt-container">
          <Breadcrumbs page={index} />
          <h1 className="ga-h1">{index.h1}</h1>
          <p className="ga-index-lede">{index.lede}</p>
        </div>
      </header>
      <section className="ga-index" aria-label={index.crumb}>
        <div className="mkt-container">
          <ul className="ga-cards ga-cards--index">
            {pages.map((p) => (
              <li key={p.path}>
                <Link href={p.path} className="mkt-card ga-card">
                  <span className="mkt-card__title">{p.h1}</span>
                  <span className="mkt-card__body">{p.summary}</span>
                  <span className="mkt-card__foot mkt-more">
                    Read <ArrowIcon />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {aside ? <div className="ga-index__aside">{aside}</div> : null}
        </div>
      </section>
    </>
  );
}
