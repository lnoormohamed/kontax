// P50A-05 · Structured data for the help centre (P50A-03 shapes), defined
// locally so the shared json-ld.tsx stays untouched. Rendered with <JsonLd>.

import { SITE_URL } from "~/lib/site-url";

import { articleHref, categoryHref, HELP_ROOT } from "./index";
import { toPlainText } from "./text";
import type { HelpArticleContent, HelpCategoryContent, HelpShortAnswer } from "./types";

type Schema = Record<string, unknown>;

const abs = (path: string) => `${SITE_URL}${path}`;

export function helpBreadcrumbSchema(
  category?: Pick<HelpCategoryContent, "id" | "title">,
  article?: Pick<HelpArticleContent, "category" | "slug" | "title">,
): Schema {
  const items = [
    { name: "Help", path: HELP_ROOT },
    ...(category ? [{ name: category.title, path: categoryHref(category.id) }] : []),
    ...(article ? [{ name: article.title, path: articleHref(article) }] : []),
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

export function helpArticleSchema(article: HelpArticleContent): Schema {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: toPlainText(article.summary),
    dateModified: article.lastReviewed,
    mainEntityOfPage: abs(articleHref(article)),
    inLanguage: "en-GB",
    author: { "@type": "Organization", name: "Kontax", url: SITE_URL },
    publisher: { "@type": "Organization", name: "Kontax", url: SITE_URL },
  };
}

/** HowTo for articles with numbered steps; undefined for explainers. */
export function helpHowToSchema(article: HelpArticleContent): Schema | undefined {
  if (article.steps.length === 0) return undefined;
  const url = abs(articleHref(article));
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: article.title,
    description: toPlainText(article.summary),
    inLanguage: "en-GB",
    step: article.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      url: `${url}#step-${i + 1}`,
      text: [toPlainText(s.text), ...(s.details ?? []).map(toPlainText)].join(" "),
    })),
  };
}

/** FAQPage for a category's short answers — the one place Q&A structure still applies. */
export function helpFaqSchema(items: readonly HelpShortAnswer[]): Schema | undefined {
  if (items.length === 0) return undefined;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: toPlainText(it.a) },
    })),
  };
}
