# P50A-08 — Search Console, sitemap submission, measurement, cadence

**Phase:** 50A · **Priority:** P1 · **Effort:** S · **Depends on:** P50A-01 (clean sitemap)

## Steps
1. Verify getkontax.com in Google Search Console and Bing Webmaster Tools (DNS TXT on the domain —
   owner action or with explicit go-ahead); submit `sitemap.xml`. Record access in a runbook.
2. Measurement consistent with "no ads, no tracking": server-side, cookieless page-view counts for
   guides/help and a guide → `/register` conversion count; no third-party analytics scripts.
3. KPIs: indexed vs submitted pages, impressions and average position per keyword cluster, clicks to
   guides/help, guide → register conversions, help-article views per support contact, brand search
   trend.
4. Cadence: two substantial pages a week before launch, then one guide a week plus help articles from
   real support questions; every release gets a real, dated changelog entry (RSS). No blog before
   launch.
5. At 90 days: rewrite titles/intros for pages ranking in positions 8–20.

## Acceptance
- Search Console shows the sitemap processed with no errors; the KPI list is reviewable monthly.
