# Kontax SEO assessment — 2026-09-25

Two read-only audits: **technical SEO** (Sonnet) and **content SEO** (Opus, with web research).
Verified against getkontax.com (prod, `main` b71a35f), kontax.vexon.co (staging) and the release
branch `docs/p49-homepage-brief`. Search-volume figures in the content plan are estimates from
SERP observation (no keyword tool) — validate in Google Keyword Planner / Search Console.

## 1. Live now: false or broken (fix before anything else)

| Issue | Live on prod | Fixed on release branch? |
|---|---|---|
| `/about`, `/contact` 307 → /login although listed in the sitemap | yes | **yes** (P49A-15) |
| Homepage "Trusted by…" band with 99.9% uptime, "4 sync sources" | yes | **yes** (P49) |
| "100 contacts" on pricing meta / features CTA | yes | **yes** (P49-01) |
| **Outlook** advertised (features, changelog, help guide; ~29 mentions) — not live in prod | yes | **no** |
| **Webhooks** ticked on pricing + mentioned in pricing FAQ — not built | yes | **no** (P49A-14) |
| `/security`: "Nightly backups are encrypted" — backup encryption deferred | yes | **no** |
| Changelog has entries dated before the project existed (v3.0–3.3, incl. Outlook) | yes | **no** |
| Sitemap lists `/login`, a QA public card (`/u/p47qa`) and every user's public card; `lastmod` = request time | yes | **no** |
| Staging `kontax.vexon.co` fully indexable (robots `Allow: /`, self-canonicals, no noindex) | — | **no** |
| Prices render in **USD** from Stripe while copy/designs/schema say pounds | yes | decision needed |

## 2. Technical findings

**High**
- T1 `/about`, `/contact` gated on prod — fixed on the release branch; ships with P49/P49A.
- T2 Staging indexable — branch `src/app/robots.ts` on `KONTAX_DEPLOY_ENV !== "production"` →
  `Disallow: /`, plus `X-Robots-Tag: noindex, nofollow` (middleware or Cloudflare) on staging. S.
- T3 Homepage fully dynamic (`auth()` in `(marketing)/page.tsx`): `cache-control: private,
  no-store`, TTFB ≈ 640–840 ms vs cached pricing/features. Move the signed-in hero variant to a
  client component (like the nav) so `/` is static/ISR. M — fold into P50-03.

**Medium**
- T4 No Product/Offer schema on `/pricing`; homepage SoftwareApplication has a hard-coded `£0`
  offer. Emit per-plan Offer from the same Stripe price source as the page. M — P50-04.
- T5 `/u/[username]` always `index: true`, even name-only cards (thin content at scale); also a
  privacy question for a privacy-first product. `noindex` cards without fields; make indexing
  opt-in. S.
- T6 `<html lang="en">` vs en-GB content → `lang="en-GB"`. S.
- T7 Fonts not loaded (Geist / Geist Mono referenced, never loaded) — being fixed in P50-01;
  `images.unoptimized` for avatars — consider optimisation for `/u/*`. M — P50.

**Passed:** http→https and www→apex 301s, trailing-slash 308, real 404s, HSTS preload, Brotli, CSP
not blocking crawlers, unique titles/descriptions/canonicals/OG across marketing pages, modest
homepage JS (~155 KB br).

## 3. Content findings and plan

**Assessment:** the homepage title targets a phrase nobody searches; the "Why not just use iCloud
or Google Contacts?" asset is unused in titles; `/features` lacks merge, history and "appears in
iPhone Contacts"; `/about` is thin; home/features/help overlap on the same questions; the help
centre is one ~5,300-word page (≈90 questions) that can only rank for "Kontax help". FAQ rich
results no longer show for most sites, so FAQPage markup adds little.

**Keyword clusters → owning URL** (estimates): switchers ("sync iCloud and Google contacts",
"Google Contacts vs iCloud"), duplicates ("merge duplicate contacts iPhone", "duplicates after
syncing"), families ("shared family address book iPhone" — no native Apple answer), small teams
("shared contacts small business iPhone"), privacy ("private contacts app / alternative to Google
Contacts"), developers ("what is CardDAV", "contact export format"). Skip "personal CRM" (Dex,
Clay, Covve) — different promise.

**Page plan (top 15, by priority):**
1. Help split: `/help/sync/{icloud,google,fastmail,carddav}` provider setup articles (content exists) — S each
2. `/guides/sync-icloud-and-google-contacts` — M
3. `/guides/merge-duplicate-contacts-iphone` (own the "why" and "undo" angles) — M
4. `/compare/kontax-vs-icloud-contacts` — M
5. `/compare/kontax-vs-google-contacts` — M
6. `/family` use-case page — M
7. `/teams` use-case page — M
8. `/guides/what-is-carddav` — S–M
9. `/features/duplicates`, `/features/history` — S each
10. `/guides/export-contacts` — M
11. `/compare/google-contacts-vs-icloud` (neutral; Kontax only at the end) — M
12. `/about` rewrite (≥400 words, real detail: UK, Vexon, principles, roadmap) — S
13. `/developers/export-format` (already written in /developers) — S
14. `/glossary` (CardDAV, vCard, JSContact, sync token, app password) — S
15. `/guides/share-contacts-with-family-iphone` — S–M

Rules for every page: claims checked against the P50-DB01 fact list, no Outlook, no social proof,
UK English; comparisons = what each does well, factual table, when you *don't* need Kontax.
Help article template: task-phrased H1, one-sentence answer, numbered steps, "what to expect",
"if it doesn't work", plan required, "last reviewed", 2–3 related links, HowTo/Article schema.

**On-page changes for Phase 50:** home title "Kontax — One address book for iCloud, Google and
Fastmail" with a matching description; link the comparison section to pages 4–5 and how-it-works to
page 1; features H1 "Contact sync, clean-up and sharing, in one private address book" + sections for
merge/undo, history, "appears in iPhone and Mac Contacts"; pricing title "Kontax pricing — Free,
Pro, Family and Teams"; security title "Security and privacy — how Kontax protects your contacts";
about ≥400 words; contact adds support email + response time; footer gains Guides / Compare / Help
groups once they exist; BreadcrumbList on new sections.

**Content ops:** two substantial pages a week pre-launch, then one guide a week plus help articles
from real support questions. Changelog = real, dated entries with anchors + RSS (placeholders do
more harm than an empty log). No blog before launch. Measure with Search Console (indexed vs
submitted, impressions/position per cluster, guide → /register conversions via cookieless
server-side counts, consistent with "no tracking").

## 4. Proposed delivery

- **SEO-0 quick-fix batch (ship with the P49/P49A release):** remove Outlook marketing claims
  (show only when `MICROSOFT_*` is configured, as the homepage already does; noindex/"coming soon"
  the Outlook help guide); remove webhooks (pricing row + FAQ); remove the backup-encryption
  sentence; replace placeholder changelog entries with real history (owner review); sitemap: drop
  `/login`, exclude `/u/*` unless opted in, real `lastmod`; staging noindex; `lang="en-GB"`;
  noindex empty public cards.
- **Phase 50 fold-ins:** T3 static homepage, T4 pricing Offer schema, T7 fonts/images, the on-page
  titles/H1s/sections above.
- **New content phase (after P50 chrome lands):** help-centre split + article template, then the
  page plan in order; Search Console setup and sitemap submission at launch.

## 5. Decisions for the owner
1. **Currency: decided 2026-09-25 — GBP.** The owner is switching Stripe prices to GBP (UK-focused);
   the site displays whatever currency Stripe returns.
2. **Public cards in search:** index only cards whose owner opts in (recommended), or none?
3. **Changelog history:** OK to rebuild it from the real release history (phases since June 2026)?


Tickets: [Phase 50A](../build-phase/phase-50a-seo.md) (P50A-01..08).
