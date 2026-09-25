import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HelpArticle } from "../../_components/help-article";
import { allArticles, articleHref, getArticle, getCategory } from "../../_content";
import { toPlainText } from "../../_content/text";
import "../../help.css";

type Params = { category: string; slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return allArticles().map((a) => ({ category: a.category, slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category, slug } = await params;
  const article = getArticle(category, slug);
  if (!article) return {};
  const path = articleHref(article);
  const description = toPlainText(article.summary);
  return {
    title: `${article.title} — Kontax Help`,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: article.title,
      description,
      url: path,
      siteName: "Kontax",
      type: "article",
      modifiedTime: article.lastReviewed,
    },
  };
}

// P50A-05 · One URL per help article, statically generated.
export default async function HelpArticlePage({ params }: { params: Promise<Params> }) {
  const { category: categoryId, slug } = await params;
  const category = getCategory(categoryId);
  const article = getArticle(categoryId, slug);
  if (!category || !article) notFound();

  return <HelpArticle article={article} category={category} />;
}
