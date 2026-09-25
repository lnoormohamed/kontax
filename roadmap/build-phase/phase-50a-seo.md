# Phase 50A — SEO: technical, on-page and content

## Phase status
Planned — tickets written 2026-09-25 from the SEO assessment
([kontax-seo-assessment-2026-09-25.md](../runbooks/kontax-seo-assessment-2026-09-25.md)). Runs
alongside Phase 50 (marketing redesign, Direction A); tickets that touch page structure are built
inside the matching P50 ticket so pages are only rebuilt once.

## Phase objective
Make every public claim true, make the site crawlable and fast on the pages that matter, and build
the content (help articles, guides, comparisons, use-case pages) that people actually search for —
for a new UK product with no social proof yet.

## Owner decisions
- **2026-09-25 — Currency: GBP.** Stripe prices move to GBP (the product is UK-focused). The site
  already formats whatever currency Stripe returns, so no code change is needed for display; the
  owner changes the Stripe prices, then P50A-03's Offer schema reads the same GBP values.
- **Open:** public contact cards in search — opt-in only (recommended) or never?
- **Open:** OK to rebuild the changelog from the real release history (June 2026 onwards)?

## Tickets

| Ticket | Title | Priority | Effort | Depends on / built with |
| --- | --- | --- | --- | --- |
| [P50A-01](p50a-01-honesty-and-indexing-quick-fixes.md) | Honesty & indexing quick fixes (ship with the P49/P49A release) | P0 | S | — |
| [P50A-02](p50a-02-static-homepage.md) | Static homepage (no per-request `auth()`), faster TTFB | P1 | M | built in P50-03 |
| [P50A-03](p50a-03-structured-data.md) | Structured data: pricing Offers (GBP), Organization/WebSite, breadcrumbs, articles | P1 | M | P50-04, P50A-05 |
| [P50A-04](p50a-04-on-page-titles-and-sections.md) | On-page: titles, descriptions, H1s, missing feature sections, internal links | P1 | S–M | built in P50-03/04/05 |
| [P50A-05](p50a-05-help-centre-split.md) | Help centre: hub → categories → one URL per article, template, migration | P1 | M–L | P50-02 |
| [P50A-06](p50a-06-guides-and-comparisons.md) | Guides and honest comparisons (sync, duplicates, CardDAV, export, vs iCloud/Google) | P2 | L | P50A-05 |
| [P50A-07](p50a-07-use-case-and-trust-pages.md) | Use-case and trust pages: /family, /teams, feature pages, glossary, about, export format | P2 | M–L | P50-02 |
| [P50A-08](p50a-08-search-console-and-measurement.md) | Search Console, sitemap submission, cookieless measurement, content cadence | P1 | S | P50A-01 |

## Order
P50A-01 now (with the pending release) → P50A-08 at launch → P50A-02/-04 inside P50-03..05 →
P50A-05 once the P50 chrome exists → P50A-03 → P50A-07 → P50A-06 (two substantial pages a week).

## Rules for all content
Every claim checked against the fact list in P50-DB01 (no Outlook until it's live, no testimonials,
user numbers, uptime or webhooks, no backup-encryption claim); UK English; comparisons state what
each tool does well and when you *don't* need Kontax.

## Documentation
- [ ] External · users — help centre, guides, comparisons
- [ ] Internal · ops — Search Console access and sitemap in `roadmap/runbooks/`
