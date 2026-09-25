import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "~/app/_components/json-ld";
import { isMicrosoftSyncEnabled } from "~/lib/microsoft-sync-flag";

import { ArrowIcon, Faq, IndexLabel } from "../../_components/mkt-ui";
import { HelpBreadcrumbs, StillStuck } from "../_components/help-chrome";
import { Rich } from "../_components/help-rich";
import {
  articleHref,
  categoryHref,
  getCategory,
  HELP_CATEGORIES,
  resolveRef,
  visibleShortAnswers,
} from "../_content";
import { helpBreadcrumbSchema, helpFaqSchema } from "../_content/schema";
import "../help.css";

type Params = { category: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return HELP_CATEGORIES.map((c) => ({ category: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category: id } = await params;
  const category = getCategory(id);
  if (!category) return {};
  const path = categoryHref(category.id);
  return {
    title: `${category.title} — Kontax Help`,
    description: category.description,
    alternates: { canonical: path },
    openGraph: { title: `${category.title} — Kontax Help`, description: category.description, url: path, siteName: "Kontax", type: "website" },
  };
}

// P50A-05 · Category page: its articles, then the short answers migrated from
// the old single-page FAQ (with FAQPage structured data built from the same
// items). Static: Outlook-only answers are filtered at build time, like the
// rest of the marketing site (see ~/lib/microsoft-sync-flag).
export default async function HelpCategoryPage({ params }: { params: Promise<Params> }) {
  const { category: id } = await params;
  const category = getCategory(id);
  if (!category) notFound();

  const answers = visibleShortAnswers(category, isMicrosoftSyncEnabled());
  const faq = helpFaqSchema(answers);
  const alsoSee = (category.alsoSee ?? []).flatMap((ref) => {
    const r = resolveRef(ref);
    return r ? [r] : [];
  });

  return (
    <>
      <JsonLd data={[helpBreadcrumbSchema(category), ...(faq ? [faq] : [])]} />
      <div className="hc-page">
        <div className="mkt-container">
          <HelpBreadcrumbs items={[{ label: "Help", href: "/help" }, { label: category.title }]} />
          <header className="hc-cat-head">
            <IndexLabel>Help centre</IndexLabel>
            <h1 className="hc-cat-head__title">{category.title}</h1>
            <p className="hc-cat-head__lede">{category.description}</p>
          </header>

          <section className="hc-block" aria-labelledby="hc-articles">
            <h2 id="hc-articles" className="hc-block__title">Articles</h2>
            <ul className="hc-rows">
              {category.articles.map((a) => (
                <li key={a.slug}>
                  <Link href={articleHref(a)} className="hc-row">
                    <span className="hc-row__text">
                      <span className="hc-row__title">{a.title}</span>
                      <span className="hc-row__sum">{resolveRef(`${a.category}/${a.slug}`)?.summary}</span>
                    </span>
                    <ArrowIcon size={16} />
                  </Link>
                </li>
              ))}
              {alsoSee.map((r) => (
                <li key={r.href}>
                  <Link href={r.href} className="hc-row">
                    <span className="hc-row__text">
                      <span className="hc-row__title">{r.title}</span>
                      <span className="hc-row__sum">{r.summary}</span>
                    </span>
                    <ArrowIcon size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {answers.length > 0 ? (
            <section className="hc-block" aria-labelledby="hc-quick">
              <h2 id="hc-quick" className="hc-block__title">Quick answers</h2>
              <Faq
                openFirst={false}
                items={answers.map((s) => {
                  const more = s.more ? resolveRef(s.more) : undefined;
                  return {
                    q: s.q,
                    a: (
                      <>
                        <p><Rich text={s.a} /></p>
                        {more ? (
                          <p>
                            <Link href={more.href}>Read: {more.title}</Link>
                          </p>
                        ) : null}
                      </>
                    ),
                  };
                })}
              />
            </section>
          ) : null}

          <StillStuck />
        </div>
      </div>
    </>
  );
}
