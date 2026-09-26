import { type MetadataRoute } from "next";

import { SECTION_INDEXES, GUIDE_PAGES } from "~/app/(marketing)/guides/_content/pages";
import { HELP_CATEGORIES, allArticles, articleHref, categoryHref } from "~/app/(marketing)/help/_content";
import { SITE_URL } from "~/lib/site-url";

// P34C-21 — sitemap listing all public, indexable routes.
// Authenticated app surfaces (/contacts, /settings, /admin, /api, …) are
// excluded here and disallowed in robots.ts.
//
// P50A-01: dropped `/login` (never worth indexing) and public contact cards
// (`/u/*`) entirely — the owner hasn't decided whether card indexing should
// be opt-in, so for now none are listed (see
// roadmap/build-phase/p50a-01-honesty-and-indexing-quick-fixes.md). Every
// route below must also be reachable (200) for a logged-out visitor — see
// `isPublicPath` in ~/server/public-paths, which this list is checked
// against.
//
// To add a new public route: append to STATIC_ROUTES below.
const STATIC_ROUTES: {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}[] = [
  // Marketing pages
  { path: "/",          priority: 1.0, changeFrequency: "weekly"  },
  { path: "/features",  priority: 0.8, changeFrequency: "monthly" },
  { path: "/pricing",   priority: 0.9, changeFrequency: "monthly" },
  { path: "/security",  priority: 0.7, changeFrequency: "monthly" },
  { path: "/changelog", priority: 0.7, changeFrequency: "weekly"  },
  { path: "/about",     priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact",   priority: 0.6, changeFrequency: "monthly" },
  { path: "/privacy",   priority: 0.5, changeFrequency: "yearly"  },
  { path: "/terms",     priority: 0.5, changeFrequency: "yearly"  },
  // Auth pages — indexable as conversion-funnel entry points. `/login`
  // deliberately excluded (P50A-01): nothing to gain from indexing a sign-in
  // form, and it's a poor landing page for organic search.
  { path: "/register",  priority: 0.8, changeFrequency: "monthly" },
  // Developer and help pages
  { path: "/developers", priority: 0.7, changeFrequency: "monthly" },
  { path: "/developers/export-format", priority: 0.5, changeFrequency: "monthly" },
  { path: "/help",       priority: 0.6, changeFrequency: "monthly" },
  // P50A-07 · use-case, feature and reference pages
  { path: "/for/families",        priority: 0.7, changeFrequency: "monthly" },
  { path: "/for/teams",           priority: 0.7, changeFrequency: "monthly" },
  { path: "/features/duplicates", priority: 0.6, changeFrequency: "monthly" },
  { path: "/features/history",    priority: 0.6, changeFrequency: "monthly" },
  { path: "/glossary",            priority: 0.4, changeFrequency: "monthly" },
];

// P50A-05 / P50A-06 · generated from the same content registries the pages are
// built from, so a new guide, comparison or help article is listed
// automatically and a removed one disappears.
const CONTENT_ROUTES: typeof STATIC_ROUTES = [
  ...Object.values(SECTION_INDEXES).map((s) => ({ path: s.path, priority: 0.6, changeFrequency: "monthly" as const })),
  ...GUIDE_PAGES.map((g) => ({ path: g.path, priority: 0.7, changeFrequency: "monthly" as const })),
  ...HELP_CATEGORIES.map((c) => ({ path: categoryHref(c.id), priority: 0.5, changeFrequency: "monthly" as const })),
  ...allArticles().map((a) => ({ path: articleHref(a), priority: 0.5, changeFrequency: "monthly" as const })),
];

// P50A-01: a single stable timestamp for every static entry, captured once
// at module load (effectively the build/deploy time for this statically
// rendered route — see the sitemap() doc comment below), rather than
// `new Date()` evaluated on every request. A per-request timestamp told
// crawlers every static page changes on every crawl, which is false and
// wastes crawl budget.
const BUILD_TIME = new Date();

// No dynamic API is used here (no `db`, no `headers()`/`cookies()`), so this
// route is statically prerendered — it renders once and is served from cache,
// which is what makes BUILD_TIME above a genuinely stable value rather than a
// per-request one.
export default function sitemap(): MetadataRoute.Sitemap {
  return [...STATIC_ROUTES, ...CONTENT_ROUTES].map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: BUILD_TIME,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
