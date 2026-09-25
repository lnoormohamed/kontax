# P50A-05 — Help centre: hub → categories → one URL per article

**Phase:** 50A · **Priority:** P1 · **Effort:** M–L · **Depends on:** P50-02 (chrome)

## Problem (verified 2026-09-25)
`/help` is one page of ~5,300 words and ~90 questions (`src/app/_components/help-faq-data.ts`) plus
five provider guides. It can only rank for "Kontax help"; how-to searches ("connect iCloud contacts
CardDAV") land on competitors. Some answers are outdated (Outlook presented as available).

## Structure
- `/help` hub: search, categories, top tasks.
- `/help/{category}` pages: short answers grouped, links to articles.
- `/help/{category}/{slug}` articles for anything substantial. First: provider setup
  `/help/sync/{icloud,google,fastmail,carddav}` (content exists).
- Article template: task-phrased H1, one-sentence answer, numbered steps, "What to expect",
  "If it doesn't work", plan badge, "Last reviewed {date}", 2–3 related links, Article/HowTo schema
  (P50A-03). UK English; no unverifiable claims.
- Keep old `#anchor` links working (map anchors to new URLs); add all articles to the sitemap.
- In-app contextual links from the screens that need them (sync errors, app passwords, limits).

## Content
The full category and article list, launch-critical articles and outlines come from the help-content
review (2026-09-25) — to be appended below when it lands.

## Acceptance
- Every current question is reachable (migrated or redirected); no 404s from old anchors.
- Provider setup articles live at their own URLs with HowTo schema.
- Outlook guide noindexed or "coming soon" until Outlook is enabled in production.
