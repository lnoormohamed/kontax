# Phase 34C — Multi-Page Marketing Site Rebuild

## Overview

Phase 34C converts the existing single landing page at `/` into a complete
multi-page marketing site ready for go-live at `getkontax.com`. It introduces
a shared layout system (`(marketing)` route group), builds out 9 new pages,
adds SEO infrastructure (meta, OG images, sitemap, structured data), and
delivers the legal pages required by Stripe before payments can go live.

This phase supersedes the original single-page refresh plan from the Phase 34
detailed roadmap (`roadmap-20260614-p34-detailed.md`). The full context is in
`roadmap-20260614-p34-amendments.md`.

---

## Design Briefs

Three design briefs precede the implementation tickets. Engineering tickets
that depend on a brief are blocked until the brief is approved.

| Brief | File | Covers | Gates |
|---|---|---|---|
| P34C-DB01 | `design-briefs/p34c-db01-marketing-site-ia.md` | IA, nav, homepage hero, feature tiles, social proof, footer | P34C-01 through P34C-06 |
| P34C-DB02 | `design-briefs/p34c-db02-pricing-page.md` | Plan cards, billing toggle, feature matrix | P34C-08, P34C-09, P34C-10 |
| P34C-DB03 | `design-briefs/p34c-db03-feature-security-changelog.md` | Features page, security page, changelog | P34C-07, P34C-12, P34C-13 |

---

## Ticket Index

| Ticket | Title | Priority | Depends On | File |
|---|---|---|---|---|
| P34C-01 | Shared marketing nav component | P0 | P34C-DB01 | `p34c-01-marketing-nav.md` |
| P34C-02 | Shared marketing footer component | P0 | P34C-DB01 | `p34c-02-marketing-footer.md` |
| P34C-03 | Homepage hero section rebuild | P0 | P34C-DB01, P34C-01 | `p34c-03-homepage-hero.md` |
| P34C-04 | Homepage feature tiles (6 tiles) | P0 | P34C-DB01, P34C-01 | `p34c-04-homepage-feature-tiles.md` |
| P34C-05 | Homepage social proof section | P1 | P34C-DB01, P34C-01 | `p34c-05-homepage-social-proof.md` |
| P34C-06 | Homepage mobile layout polish | P0 | P34C-03, P34C-04, P34C-05 | `p34c-06-homepage-mobile-layout.md` |
| P34C-07 | /features page | P1 | P34C-DB03, P34C-01 | `p34c-07-features-page.md` |
| P34C-08 | /pricing page rebuild | P0 | P34C-DB02, P34C-01 | `p34c-08-pricing-page-rebuild.md` |
| P34C-09 | Monthly/annual billing toggle | P1 | P34C-08 | `p34c-09-pricing-billing-toggle.md` |
| P34C-10 | Feature comparison matrix | P0 | P34C-DB02, P34C-08 | `p34c-10-pricing-feature-matrix.md` |
| P34C-11 | Pricing page FAQ | P1 | P34C-08 | `p34c-11-pricing-faq.md` |
| P34C-12 | /security page | P1 | P34C-DB03, P34C-01 | `p34c-12-security-page.md` |
| P34C-13 | /changelog page | P1 | P34C-DB03, P34C-01 | `p34c-13-changelog-page.md` |
| P34C-14 | /contact page | P1 | P34C-01 | `p34c-14-contact-page.md` |
| P34C-15 | /privacy page (Stripe required) | P0 | — | `p34c-15-privacy-page.md` |
| P34C-16 | /terms page (Stripe required) | P0 | — | `p34c-16-terms-page.md` |
| P34C-17 | /about page (minimal) | P2 | P34C-01 | `p34c-17-about-page.md` |
| P34C-18 | OG images for all marketing pages | P1 | P34C-01 | `p34c-18-og-images.md` |
| P34C-19 | Meta titles and descriptions audit | P0 | P34C-01 | `p34c-19-meta-descriptions.md` |
| P34C-20 | JSON-LD structured data | P1 | P34C-01 | `p34c-20-structured-data.md` |
| P34C-21 | Sitemap update | P0 | P34C-01 | `p34c-21-sitemap-update.md` |

---

## New Page Inventory

| Route | Status at Phase 34C start | Priority |
|---|---|---|
| `/` | Exists — hero and sections need rebuild | P0 |
| `/features` | Does not exist | P1 |
| `/pricing` | May exist — full rebuild | P0 |
| `/security` | Does not exist | P1 |
| `/changelog` | Does not exist | P1 |
| `/about` | Does not exist | P2 |
| `/contact` | Does not exist | P1 |
| `/privacy` | Does not exist (Stripe required) | P0 |
| `/terms` | Does not exist (Stripe required) | P0 |

---

## Architecture Notes

### Route group

All marketing pages live in `src/app/(marketing)/`. The `(marketing)` route
group does not affect URLs — it exists to share the marketing layout (nav +
footer) without including the authenticated app's providers or sidebar.

```
src/app/
  (marketing)/
    layout.tsx              ← MarketingNav + MarketingFooter wrapper
    page.tsx                ← /
    features/page.tsx       ← /features
    pricing/
      page.tsx              ← /pricing
      pricing-data.ts       ← plan + matrix constants
      billing-toggle.tsx    ← client island
      feature-matrix.tsx    ← matrix component
    security/page.tsx       ← /security
    changelog/
      page.tsx              ← /changelog
      entries.ts            ← changelog data
    about/page.tsx          ← /about
    contact/page.tsx        ← /contact
    privacy/page.tsx        ← /privacy
    terms/page.tsx          ← /terms
    _components/
      marketing-nav.tsx
      marketing-nav-mobile.tsx   ← "use client"
      marketing-footer.tsx
      json-ld.tsx
    _lib/
      marketing-meta.ts     ← centralised metadata constants
```

### Client islands

The `(marketing)` layout is a server component. Client components are isolated
islands:
- `marketing-nav-mobile.tsx` — hamburger toggle state.
- `billing-toggle.tsx` (pricing) — monthly/annual toggle state.
- Contact form (P34C-14) — form submission state.
- FAQ accordion (P34C-11) — open/closed state.

### Design system

Marketing pages use a different palette from the app:
- **Background**: `white` (not `#f4f6f2`).
- **Headings**: `#17352e` (brand green).
- **Body text**: `#5c655e` (secondary ink).
- **Muted**: `#8b938c`.
- **Accent / CTA**: `#4158f4` (blue) for links; `#17352e` (green) for primary buttons.
- **Section backgrounds alternate**: `white` and `#f4f6f2`.
- **Typography scale**: 48–56px hero, 36px page headings, 28–32px section
  headings, 17–18px body (larger than the app's 14px default).

---

## Start Order

**Immediate start (no design brief needed)**

These tickets have no design dependencies and can start the day Phase 34C is
kicked off:

- P34C-15 — `/privacy` (draft copy)
- P34C-16 — `/terms` (draft copy)
- P34C-14 — `/contact` (simple form, no brief)
- P34C-21 — sitemap update

**After P34C-DB01 is approved**

- P34C-01 → P34C-02 (layout foundation)
- P34C-03 → P34C-04 → P34C-05 (homepage sections)
- P34C-06 (mobile QA, runs last)
- P34C-19 (meta audit, after pages exist)
- P34C-18 (OG images, after pages exist)
- P34C-20 (structured data, after pages exist)

**After P34C-DB02 is approved**

- P34C-08 → P34C-09 → P34C-10 → P34C-11 (pricing page)

**After P34C-DB03 is approved**

- P34C-07 (features page)
- P34C-12 (security page)
- P34C-13 (changelog page)

---

## Go-Live Gates (P34C-specific)

The following must be true before any P34C page ships to `getkontax.com`:

- [ ] `/privacy` has passed legal review.
- [ ] `/terms` has passed legal review.
- [ ] `/privacy` and `/terms` URLs are set in Stripe Dashboard → Business settings.
- [ ] All plan prices in `pricing-data.ts` are verified against live Stripe config.
- [ ] `support@getkontax.com`, `privacy@getkontax.com`, and
      `security@getkontax.com` are live aliases.
- [ ] OG images verified with opengraph.xyz.
- [ ] No `[PLACEHOLDER]` or `[TBD]` text in any live page.
- [ ] Homepage LCP passes Core Web Vitals threshold (< 2.5s).

---

## Ticket Count

21 tickets. Priority breakdown:
- P0 (must-have for go-live): 8 tickets
- P1 (should-have): 10 tickets
- P2 (nice-to-have): 3 tickets

Total Phase 34 across all sub-phases: 85 tickets (see amendments doc for
full breakdown).
