# P50A-03 — Structured data

**Phase:** 50A · **Priority:** P1 · **Effort:** M · **Depends on:** P50-04 (pricing), P50A-05 (help)

## Current state (verified 2026-09-25)
Homepage emits SoftwareApplication with a hard-coded `£0` Offer (`src/app/_components/json-ld.tsx:44-59`)
plus FAQPage; `/pricing` emits only BreadcrumbList; public cards emit Person. FAQ rich results are no
longer shown for most sites, so FAQPage is low value (keep, don't expand).

## Steps
1. **/pricing:** SoftwareApplication (or Product) with one `Offer` per paid plan and interval, price
   and `priceCurrency` read from the same Stripe price source as the page (`pricing/_prices.ts`) —
   GBP once the owner switches Stripe prices. Never hard-code amounts.
2. **Homepage:** Organization (name, url, logo, sameAs if any) + WebSite; SoftwareApplication with
   `offers` from the same source (free plan £0 + lowest paid plan).
3. **Help / guides:** Article (headline, dateModified from "last reviewed") and HowTo for step-by-step
   articles; BreadcrumbList on help, guides, compare and feature sub-pages.
4. Validate with Google's Rich Results Test and schema.org validator; add a unit test that the
   pricing Offer values equal the rendered prices.

## Acceptance
- Rich Results Test passes for home, pricing, one help article, one guide.
- Changing a Stripe price changes both the page and the JSON-LD (test).
