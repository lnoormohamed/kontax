# P34C-20 — JSON-LD Structured Data on Marketing Pages

## Purpose

Add JSON-LD structured data to the marketing pages that benefit most from it.
Structured data helps search engines understand the site and can unlock rich
results (sitelinks, breadcrumbs, product info). It is also a best-practice
signal for domain authority.

## Background

The homepage may already have a `SoftwareApplication` JSON-LD block from P26-10.
This ticket audits and updates the existing block and adds `Organization`,
`WebSite` (with `SearchAction`), and `BreadcrumbList` to the relevant pages.
New pages from Phase 34C need their own structured data.

## Scope

**In scope**
- `/`: `Organization`, `SoftwareApplication`, `WebSite`.
- `/features`: `BreadcrumbList`.
- `/pricing`: `BreadcrumbList`, `Offer` per plan.
- `/about`: `Organization` (same as homepage).
- A `<JsonLd>` utility component for clean injection.

**Out of scope**
- `/changelog`: no applicable schema type.
- `/security`, `/contact`, `/privacy`, `/terms`: not typically structured data
  candidates.
- `FAQPage` schema (technically applicable to the pricing FAQ, but adds
  complexity — post-launch).

## Design / Implementation Spec

### JsonLd component

```tsx
// src/app/(marketing)/_components/json-ld.tsx

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

Place `<JsonLd>` inside the page's JSX (it renders into `<head>` automatically
in Next.js App Router if placed in a layout or page, or manually inject via
`next/head` / metadata API). The cleanest Next.js App Router approach: render
the `<script>` tag directly in the page body — Google's crawler handles it
correctly whether it's in `<head>` or `<body>`.

### Homepage (`/`) — three schemas

#### Organization

```ts
const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Kontax",
  url: "https://getkontax.com",
  logo: "https://getkontax.com/images/logo.png",
  sameAs: [
    "https://x.com/getkontax",
    "https://github.com/vexon",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    email: "support@getkontax.com",
    contactType: "customer support",
  },
};
```

#### SoftwareApplication

```ts
const softwareApp = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Kontax",
  url: "https://getkontax.com",
  description:
    "A contact management app with sync, labels, sharing, and a developer API.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "GBP",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "5.00",       // TODO: verify against Stripe before shipping
      priceCurrency: "GBP",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "5.00",
        priceCurrency: "GBP",
        unitCode: "MON",
      },
    },
  ],
};
```

#### WebSite

```ts
const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Kontax",
  url: "https://getkontax.com",
  // SearchAction: only add if a public site search exists.
  // Omit for launch — internal search is authenticated.
};
```

### Features page — BreadcrumbList

```ts
const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",     item: "https://getkontax.com" },
    { "@type": "ListItem", position: 2, name: "Features", item: "https://getkontax.com/features" },
  ],
};
```

### Pricing page — BreadcrumbList + Offer per plan

```ts
const pricingBreadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",    item: "https://getkontax.com" },
    { "@type": "ListItem", position: 2, name: "Pricing", item: "https://getkontax.com/pricing" },
  ],
};
```

The `Offer` entities are already included in the homepage `SoftwareApplication`
block. Do not duplicate them on the pricing page — a `BreadcrumbList` is
sufficient.

### About page

Render the same `Organization` schema as the homepage. No additional schemas.

### Verification

After deploying to staging:
1. Open [Google's Rich Results Test](https://search.google.com/test/rich-results).
2. Test `https://staging.getkontax.com/` — should show `SoftwareApplication`
   and `Organization`.
3. Test `https://staging.getkontax.com/features` — should show `BreadcrumbList`.
4. Fix any warnings before merging to `main`.

Also check for errors in the Google Search Console after deploying to production.

### Price accuracy

Same warning as P34C-08: the price in `SoftwareApplication.offers` must match
the live Stripe config before going to production. Verify as part of the P34C-08
Stripe price check. These are not auto-updated from Stripe — they must be manually
kept in sync when prices change.

## Acceptance Criteria

- [ ] `Organization` and `SoftwareApplication` JSON-LD render on `/`.
- [ ] `WebSite` JSON-LD renders on `/`.
- [ ] `BreadcrumbList` renders on `/features` and `/pricing`.
- [ ] `Organization` renders on `/about`.
- [ ] All prices in the structured data match the live Stripe config.
- [ ] Verified with Google's Rich Results Test — no errors on `/` and `/features`.
- [ ] `<JsonLd>` utility component is used consistently (no inline `<script>`
      tags scattered across pages).
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- **Price staleness**: structured data prices are not auto-synced from Stripe.
  Document in the runbooks that prices in `p34c-20-structured-data.md` must
  be updated manually whenever Stripe prices change.
- **sameAs social links**: `x.com/getkontax` and `github.com/vexon` must be
  real, live accounts before being added to the `Organization` schema.
- **Logo image**: `logo` in the `Organization` schema must be a direct URL to
  a publicly accessible image (e.g. `https://getkontax.com/images/logo.png`).
  Verify this file exists in `public/images/`.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/: document that structured data
      prices must be manually updated when Stripe prices change
- [x] Internal · engineering — docs/: document the JsonLd component and which
      pages carry which schema types
