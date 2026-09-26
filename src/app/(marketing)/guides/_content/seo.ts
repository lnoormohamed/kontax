/**
 * P50A-06 · Metadata and structured data for the guide and comparison pages.
 *
 * Article and BreadcrumbList are built here rather than in
 * ~/app/_components/json-ld.tsx (P50A-03 owns that file); they are rendered
 * with the shared <JsonLd> component, which does the script-safe escaping.
 */
import type { Metadata } from "next";

import { SITE_URL } from "~/lib/site-url";

import {
  FIRST_PUBLISHED_ISO,
  LAST_REVIEWED_ISO,
  SECTION_INDEXES,
  type GuidePage,
  type GuideSectionIndex,
} from "./pages";

export type Crumb = { name: string; path: string };

/** Home → section index → page (the index page itself stops at the section). */
export function crumbsFor(page: GuidePage | GuideSectionIndex): Crumb[] {
  const index = SECTION_INDEXES[page.section];
  const trail: Crumb[] = [
    { name: "Home", path: "/" },
    { name: index.crumb, path: index.path },
  ];
  if (page.path !== index.path) trail.push({ name: page.crumb, path: page.path });
  return trail;
}

export function breadcrumbListSchema(crumbs: readonly Crumb[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.path === "/" ? SITE_URL : `${SITE_URL}${c.path}`,
    })),
  };
}

export function articleSchema(page: GuidePage): Record<string, unknown> {
  const url = `${SITE_URL}${page.path}`;
  const kontax = { "@type": "Organization", name: "Kontax", url: SITE_URL };
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.h1,
    description: page.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: FIRST_PUBLISHED_ISO,
    dateModified: LAST_REVIEWED_ISO,
    inLanguage: "en-GB",
    author: kontax,
    publisher: { ...kontax, logo: { "@type": "ImageObject", url: `${SITE_URL}/opengraph-image.png` } },
  };
}

/** Absolute title (bypasses both layout templates), canonical, OG and Twitter. */
export function guideMetadata(page: GuidePage | GuideSectionIndex): Metadata {
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: {
      title: page.title,
      description: page.description,
      url: page.path,
      siteName: "Kontax",
      type: page.path === SECTION_INDEXES[page.section].path ? "website" : "article",
      locale: "en_GB",
      // A page-level openGraph replaces the layout's, so restate the image.
      images: [{ url: "/api/og?page=homepage", width: 1200, height: 630, alt: "Kontax" }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
    },
  };
}
