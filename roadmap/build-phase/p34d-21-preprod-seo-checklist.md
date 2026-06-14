# P34D-21 — Pre-Production SEO Checklist

## Purpose

Verify that all SEO fundamentals are in place on `getkontax.com` before go-live:
sitemap, robots.txt, OG tags, canonical tags, page titles, meta descriptions, and
Google Search Console setup.

## Background

SEO takes weeks to months to show results, but the technical foundation must be
correct from day one. Common go-live mistakes include a `robots.txt` that blocks all
indexing (left from a staging "Disallow: /" config), missing canonical tags on user
profile pages, or duplicate OG titles across marketing pages.

Kontax's primary indexable surface is the marketing pages (/, /pricing, /features,
etc.) and public user cards (/u/{username}). The authenticated app (/contacts,
/settings, etc.) should be blocked from indexing.

## Scope

**In scope**
- sitemap.xml: existence, validity, correct URLs
- robots.txt: blocks private routes, allows public marketing pages
- OG tags: title, description, image, url on homepage and key pages
- OG tags on /u/{username} (public card — indexable, should have correct user-specific
  OG data)
- Unique page titles and meta descriptions on all marketing pages
- JSON-LD structured data on homepage
- Google Search Console: property setup, sitemap submission, ownership verification
- Canonical tags on /u/{username}
- 404 page returns HTTP 404 (not 200 with error content)

**Out of scope**
- Keyword optimisation strategy
- Backlink building
- International/hreflang tags (future phase if multi-language support is added)

## Design / Implementation Spec

Run all checks from a non-logged-in browser or curl. Google Search Console setup
requires access to the getkontax.com Google Search Console property.

Record results in `roadmap/runbooks/smoke-test-results-v1.md` → SEO section.

## Checklist

| # | Check | Method | Expected Result | Actual Result | Pass/Fail |
|---|-------|--------|-----------------|---------------|-----------|
| SEO-01 | sitemap.xml exists | `curl -I https://getkontax.com/sitemap.xml` | 200 OK | | |
| SEO-02 | sitemap.xml is valid XML | `curl -s https://getkontax.com/sitemap.xml \| xmllint --noout -` | No XML parse errors | | |
| SEO-03 | sitemap.xml contains marketing pages | `curl -s https://getkontax.com/sitemap.xml \| grep -c "<loc>"` | At least 5 URLs (/, /pricing, /features, /about, /contact or similar) | | |
| SEO-04 | sitemap.xml does not contain private routes | `curl -s https://getkontax.com/sitemap.xml \| grep -E "contacts\|settings\|admin\|sync"` | No matches (private routes excluded) | | |
| SEO-05 | robots.txt exists | `curl -I https://getkontax.com/robots.txt` | 200 OK | | |
| SEO-06 | robots.txt blocks private routes | `curl -s https://getkontax.com/robots.txt` | Contains `Disallow: /contacts`, `Disallow: /settings`, `Disallow: /admin`, `Disallow: /api`, `Disallow: /sync` | | |
| SEO-07 | robots.txt allows marketing pages | `curl -s https://getkontax.com/robots.txt` | `Allow: /` is present (or no Disallow: / rule) | | |
| SEO-08 | robots.txt points to sitemap | `curl -s https://getkontax.com/robots.txt \| grep -i sitemap` | `Sitemap: https://getkontax.com/sitemap.xml` | | |
| SEO-09 | OG title on homepage | Inspect `<meta property="og:title">` in `curl -s https://getkontax.com \| grep og:title` | Contains the product name (Kontax) and a brief descriptor | | |
| SEO-10 | OG description on homepage | `curl -s https://getkontax.com \| grep og:description` | Under 160 chars, describes the product | | |
| SEO-11 | OG image on homepage | `curl -s https://getkontax.com \| grep og:image` | A full absolute URL to an image (1200×630 for Twitter/OG) | | |
| SEO-12 | OG url on homepage | `curl -s https://getkontax.com \| grep og:url` | `https://getkontax.com` (not the staging URL) | | |
| SEO-13 | OG tags on /pricing | Same checks as SEO-09 through SEO-12 on /pricing | Correct pricing-page-specific title and description | | |
| SEO-14 | OG tags on /u/{username} | Visit a claimed public card URL. Inspect OG tags. | `og:title` shows the user's name. `og:url` is the canonical public card URL. | | |
| SEO-15 | Unique page titles — marketing pages | Open /, /pricing, /features in separate tabs. Check `<title>` tag in each. | No two pages share the exact same `<title>` string. | | |
| SEO-16 | Meta descriptions on marketing pages | `curl -s https://getkontax.com \| grep "name=\"description\""` | Description is present and under 160 characters. | | |
| SEO-17 | JSON-LD on homepage | `curl -s https://getkontax.com \| grep "application/ld+json"` | At least one `<script type="application/ld+json">` block present. | | |
| SEO-18 | JSON-LD validates | Copy the JSON-LD block. Test at https://search.google.com/test/rich-results | No errors. May show as "No rich results detected" if using SoftwareApplication schema — that is acceptable. | | |
| SEO-19 | Canonical on /u/{username} | `curl -s https://getkontax.com/u/smoketest42 \| grep canonical` | `<link rel="canonical" href="https://getkontax.com/u/smoketest42">` present | | |
| SEO-20 | 404 returns HTTP 404 | `curl -I https://getkontax.com/this-does-not-exist` | `HTTP/2 404` (not 200) | | |
| SEO-21 | Google Search Console — property added | Log in to Google Search Console. Verify `getkontax.com` is listed as a property. | Property exists and ownership is verified. | | |
| SEO-22 | Sitemap submitted to Search Console | In Search Console → Sitemaps. | `https://getkontax.com/sitemap.xml` is submitted and showing as "Success". | | |

## Acceptance Criteria

- SEO-06 (robots.txt blocks /contacts, /settings, /admin, /api, /sync) is P0 —
  if private user data is indexable, it is a privacy failure.
- SEO-12 (OG url uses getkontax.com, not staging URL) is P0 — social sharing would
  point to staging.
- SEO-19 (canonical on public card) is P1 — without it, duplicate content issues
  may arise if public cards are linked from multiple sources.
- All other items are P1 or P2.
- Results recorded in `roadmap/runbooks/smoke-test-results-v1.md` → SEO section.

## Risks / Open Questions

- **robots.txt generated vs static**: if robots.txt is a static file at
  `public/robots.txt`, it may contain `Disallow: /` from when it was set up for
  staging (to prevent staging from being indexed). Verify and update before go-live.
- **Sitemap generation**: Next.js App Router can generate `sitemap.ts` dynamically.
  Verify the sitemap includes all intended marketing routes and excludes dynamic
  authenticated routes.
- **OG image**: the OG image URL must be an absolute URL (https://). If it uses a
  relative path, social sharing previews will not load the image.
- **Search Console ownership verification**: the HTML tag method or DNS TXT record
  method both work. The DNS TXT method is more reliable (not dependent on the page
  being up). Use whichever is easiest given registrar access.

## Documentation

- [ ] External · users — no changes needed
- [x] External · developers — /developers: not directly relevant but the public API
      docs page should have a canonical tag
- [x] Internal · ops — `roadmap/runbooks/smoke-test-results-v1.md`: SEO section
- [ ] Internal · engineering — docs/: note the robots.txt and sitemap generation
      strategy
