import Link from "next/link";

import { JsonLd } from "~/app/_components/json-ld";

import { ArrowIcon } from "../../_components/mkt-ui";
import { articleHref, categoryHref, resolveRef } from "../_content";
import { helpArticleSchema, helpBreadcrumbSchema, helpHowToSchema } from "../_content/schema";
import type { HelpArticleContent, HelpCategoryContent } from "../_content/types";
import { formatReviewed, HelpBreadcrumbs, PlanBadges, StillStuck } from "./help-chrome";
import { Rich } from "./help-rich";

/**
 * P50A-05 · Shared help article template: task-phrased H1, one-sentence
 * answer, plan badges, numbered steps, reference sections, "What to expect",
 * "If it doesn't work", related links and "Last reviewed". Emits Article,
 * HowTo (step articles only) and BreadcrumbList structured data.
 */
export function HelpArticle({
  article,
  category,
}: {
  article: HelpArticleContent;
  category: HelpCategoryContent;
}) {
  const related = article.related.flatMap((ref) => {
    const r = resolveRef(ref);
    return r ? [r] : [];
  });
  const siblings = category.articles.filter((a) => a.slug !== article.slug);
  const howTo = helpHowToSchema(article);

  return (
    <>
      <JsonLd
        data={[
          helpArticleSchema(article),
          ...(howTo ? [howTo] : []),
          helpBreadcrumbSchema(category, article),
        ]}
      />
      <div className="hc-page">
        <div className="mkt-container">
          <HelpBreadcrumbs
            items={[
              { label: "Help", href: "/help" },
              { label: category.title, href: categoryHref(category.id) },
              { label: article.title },
            ]}
          />
          <div className="hc-article-grid">
            <article className="hc-article">
              <header className="hc-article__head">
                <h1 className="hc-article__title">{article.title}</h1>
                <p className="hc-article__answer">
                  <Rich text={article.summary} />
                </p>
                <div className="hc-article__meta">
                  <PlanBadges plans={article.plans} />
                  <p className="hc-article__who">
                    <span className="hc-article__who-k">For</span> {article.audience}
                  </p>
                </div>
              </header>

              {article.steps.length > 0 ? (
                <section className="hc-sec" aria-labelledby="hc-steps">
                  <h2 id="hc-steps" className="hc-sec__title">Steps</h2>
                  <ol className="hc-steps">
                    {article.steps.map((step, i) => (
                      <li key={i} id={`step-${i + 1}`} className="hc-step">
                        <span className="hc-step__n" aria-hidden="true">{i + 1}</span>
                        <div className="hc-step__body">
                          <p><Rich text={step.text} /></p>
                          {step.details?.length ? (
                            <ul className="hc-step__details">
                              {step.details.map((d, j) => (
                                <li key={j}><Rich text={d} /></li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {article.sections?.map((sec, i) => (
                <section key={i} className="hc-sec">
                  <h2 className="hc-sec__title">{sec.heading}</h2>
                  {sec.paragraphs?.map((p, j) => (
                    <p key={j} className="hc-p"><Rich text={p} /></p>
                  ))}
                  {sec.list ? (
                    <ul className="hc-list">
                      {sec.list.map((li, j) => (
                        <li key={j}><Rich text={li} /></li>
                      ))}
                    </ul>
                  ) : null}
                  {sec.table ? (
                    <div className="hc-table-wrap">
                      <table className="hc-table">
                        <thead>
                          <tr>
                            {sec.table.head.map((h, j) => (
                              <th key={j} scope="col">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sec.table.rows.map((row, j) => (
                            <tr key={j}>
                              {row.map((cell, k) =>
                                k === 0 ? (
                                  <th key={k} scope="row"><Rich text={cell} /></th>
                                ) : (
                                  <td key={k}><Rich text={cell} /></td>
                                ),
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              ))}

              <section className="hc-sec" aria-labelledby="hc-expect">
                <h2 id="hc-expect" className="hc-sec__title">What to expect</h2>
                <ul className="hc-list">
                  {article.whatToExpect.map((t, i) => (
                    <li key={i}><Rich text={t} /></li>
                  ))}
                </ul>
              </section>

              <section className="hc-sec" aria-labelledby="hc-fix">
                <h2 id="hc-fix" className="hc-sec__title">If it doesn&rsquo;t work</h2>
                <ul className="hc-list">
                  {article.ifItDoesntWork.map((t, i) => (
                    <li key={i}><Rich text={t} /></li>
                  ))}
                </ul>
              </section>

              <p className="hc-reviewed">
                Last reviewed <time dateTime={article.lastReviewed}>{formatReviewed(article.lastReviewed)}</time>
              </p>
            </article>

            <aside className="hc-aside" aria-label="Related help">
              {related.length > 0 ? (
                <div className="hc-aside__block">
                  <h2 className="hc-aside__title">Related</h2>
                  <ul className="hc-aside__list">
                    {related.map((r) => (
                      <li key={r.href}>
                        <Link href={r.href} className="hc-aside__link">
                          <span>{r.title}</span>
                          <ArrowIcon size={14} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {siblings.length > 0 ? (
                <div className="hc-aside__block">
                  <h2 className="hc-aside__title">More in {category.title}</h2>
                  <ul className="hc-aside__list hc-aside__list--plain">
                    {siblings.map((a) => (
                      <li key={a.slug}>
                        <Link href={articleHref(a)}>{a.title}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <StillStuck />
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
