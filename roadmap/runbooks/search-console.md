# Runbook — Search Console, Bing Webmaster Tools, sitemap submission (P50A-08)

Step-by-step guide to verify `getkontax.com` in Google Search Console and Bing
Webmaster Tools, submit the sitemap, and read the KPIs Phase 50A cares about.
Verification needs a DNS TXT record on the apex domain — **this is an owner
action**; nothing in this runbook can be done from inside the app or by an
agent without registrar access.

The site already exposes what both tools need without any code change:

- `https://getkontax.com/sitemap.xml` — [src/app/sitemap.ts](../../src/app/sitemap.ts)
- `https://getkontax.com/robots.txt` — [src/app/robots.ts](../../src/app/robots.ts)
  (points back at the sitemap and disallows the authenticated app surfaces)

---

## 1. Google Search Console

1. Sign in at [search.google.com/search-console](https://search.google.com/search-console)
   with the account that should own this property (the team's shared Google
   Workspace account, not a personal one).
2. **Add property → Domain** (not "URL prefix") — enter `getkontax.com`. The
   domain-level property covers `https://getkontax.com`, any `www.` variant,
   and both schemes in one verification, which the URL-prefix option does not.
3. Google shows a TXT record like:
   ```
   TXT  getkontax.com  "google-site-verification=<token>"
   ```
   **Owner action:** add this record to the `getkontax.com` zone (same place
   the SES DKIM/SPF records live — see
   [ses-setup.md](ses-setup.md)). DNS TXT records typically propagate within
   minutes but can take up to a few hours; Search Console's "Verify" button is
   safe to retry.
4. Once verified, go to **Sitemaps** (left nav) → enter `sitemap.xml` → **Submit**.
5. Check back in **Sitemaps** after a day or two: status should read
   "Success" with a discovered-URL count that roughly matches the number of
   public marketing/help/guide/compare/for pages. A "Couldn't fetch" or
   "Has errors" status means `/sitemap.xml` itself is broken — check it
   renders in a browser first.

## 2. Bing Webmaster Tools

Bing indexes a meaningful share of search traffic outside Google (and results
also power some Yahoo/DuckDuckGo results), so verify separately rather than
relying on Bing's "import from Search Console" shortcut, which requires
Google API access this project doesn't otherwise need.

1. Sign in at [bing.com/webmasters](https://www.bing.com/webmasters) with the
   same shared account used above.
2. **Add a site** → `https://getkontax.com`.
3. Choose the **DNS** verification method. Bing shows a TXT record like:
   ```
   TXT  getkontax.com  "MS=<token>"
   ```
   **Owner action:** add this record alongside the Google one. Both TXT
   records coexist on the same host name — DNS allows multiple TXT records
   per name.
4. Once verified, go to **Sitemaps** → submit
   `https://getkontax.com/sitemap.xml`.

## 3. Re-verify after any domain/DNS migration

If `getkontax.com`'s DNS ever moves registrars or nameservers, carry the TXT
records over first — losing verification doesn't lose indexing history, but
it does block re-submitting the sitemap or reading fresh data until it's
redone.

## 4. KPIs to review monthly (Phase 50A-08 acceptance)

Pull these from Search Console (**Performance** report, filter by page/query)
and the admin metrics page (`/admin/metrics`, gated behind the `sync.view`
admin capability — see
[src/app/admin/metrics/page.tsx](../../src/app/admin/metrics/page.tsx)):

| KPI | Source |
| --- | --- |
| Indexed vs submitted pages | Search Console → Indexing → Pages |
| Impressions & average position per keyword cluster | Search Console → Performance, filtered by query cluster (sync, duplicates, CardDAV, export, "vs iCloud/Google") |
| Clicks to guides/help | Search Console → Performance, filtered by page path (`/guides/`, `/compare/`, `/help/`) |
| Guide/help → register conversions | `/admin/metrics` — "Page views" section, "Register views (conversion proxy)" stat. This is a proxy: it counts `/register` page-views over the same cookieless beacon as the content pages (see P50A-08 code notes below), not a true referrer-attributed conversion, since the beacon captures no referrer or identifier. |
| Help-article views per support contact | `/admin/metrics` "Page views" (Help category total) against the support ticket count in `/admin/support` |
| Brand search trend | Search Console → Performance, filtered by query containing "kontax" |

### How the page-view counts work (for context, not owner action)

`POST /api/metrics/pv` ([src/app/api/metrics/pv/route.ts](../../src/app/api/metrics/pv/route.ts))
receives a `navigator.sendBeacon` ping with just a `path`, checks it against
an allow-list (`/guides/*`, `/compare/*`, `/help/*`, `/for/*`, `/features/*`,
`/register`), and increments a per-day Redis counter
(`src/server/page-view-metrics.ts`). No cookies, no per-visitor identifier,
and no IP address is stored — the request IP is used only as an ephemeral
rate-limit key, the same pattern as the existing public-card click counter.
Counts are read back on `/admin/metrics`.

**Known gap — integrator follow-up:** `/api/metrics/pv` must be added to
`src/server/public-paths.ts` (`PUBLIC_PREFIXES` or `EXACT_PUBLIC_PATHS`) so
the session-gating middleware doesn't redirect a signed-out visitor's beacon.
Not done in this change — that file is owned by a separate in-flight edit.

## 5. Cadence (from [phase-50a-seo.md](../build-phase/phase-50a-seo.md))

Two substantial pages a week before launch, then one guide a week plus help
articles written from real support questions; every release gets a real,
dated changelog entry (the `/changelog.xml` RSS feed). No blog before launch.
At 90 days, revisit titles/intros for any page ranking in positions 8–20 in
the Performance report.
