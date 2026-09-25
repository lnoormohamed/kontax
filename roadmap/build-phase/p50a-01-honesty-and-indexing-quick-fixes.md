# P50A-01 — Honesty & indexing quick fixes

**Phase:** 50A · **Priority:** P0 · **Effort:** S · **Ships with:** the P49/P49A production release

## Objective
Remove every false public claim and stop search engines seeing the wrong URLs before the site is
submitted to Search Console.

## Verified on 2026-09-25 (live on getkontax.com, still on the release branch)
- **Outlook** advertised ~29 times: `features/page.tsx:191-203` (mockup + copy),
  `changelog/_entries.ts:102-108`, `changelog/page.tsx:55-72`, and an Outlook guide in the help
  centre. Outlook is not configured in production.
- **Webhooks:** `pricing/page.tsx:147` row and `pricing/_faq.tsx:37`. Not built.
- **Backups:** `security/page.tsx:188` "Nightly backups are encrypted" — deferred.
- **Developer API on Family:** `/developers` says the API is on Pro, Family and Teams; Family has
  had no API access since the P49 decision (2026-09-25). Say Pro and Teams.
- **Changelog:** v3.0–v3.3 entries dated April–May 2026, before the first commit (6 June 2026).
- **Sitemap** (`src/app/sitemap.ts`): lists `/login` (:30); every user's public card (:47) incl.
  a QA card `/u/p47qa`; `lastModified = new Date()` for static pages (:62).
- **Staging** `kontax.vexon.co` is indexable: `robots.ts` has no environment branch, pages
  self-canonicalise, no noindex.
- `<html lang="en">` while content is en-GB; name-only public cards are `index: true`.

## Steps
1. Outlook: show Outlook in marketing/help only when `MICROSOFT_*` is configured (the homepage's
   `worksWith()` already does this); otherwise remove the mentions and mockup rows, and noindex
   or mark "coming soon" the Outlook help guide.
2. Remove the webhooks row and FAQ mention (or fold into P49A-14 if that ships first).
3. Remove the backup-encryption sentence from /security.
4. Changelog: replace placeholder entries with real, dated history (owner decision pending; until
   then, remove the fabricated entries).
5. Sitemap: drop `/login`; exclude `/u/*` unless the owner opted in (decision pending — default
   exclude); remove the QA card; static pages get a fixed `lastModified` (build/content date).
6. Staging: `robots()` returns `Disallow: /` when `KONTAX_DEPLOY_ENV !== "production"`, and
   middleware adds `X-Robots-Tag: noindex, nofollow` on non-production deploys.
7. `lang="en-GB"` in the root layout; `robots: { index: false }` for public cards with no fields
   beyond the name.

## Acceptance
- `curl` of staging robots.txt → `Disallow: /`; staging responses carry `X-Robots-Tag: noindex`.
- `grep -ri outlook` over marketing/help copy returns only env-gated code paths.
- Prod sitemap after release: no `/login`, no `/u/*` (unless opted in), stable `lastmod`.
- No public page mentions webhooks, backup encryption or pre-June-2026 releases.
