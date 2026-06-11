# P26-09 — Structured Data (JSON-LD)

## Purpose

Add JSON-LD structured data to public pages so search engines can display rich results — site name in search, breadcrumbs, and software application details. This is a low-cost SEO signal that improves click-through rate and brand recognition in search results.

## Background

Google uses structured data to generate rich snippets. For a SaaS product, the most relevant schemas are `Organization` (brand recognition), `SoftwareApplication` (product listing in app-specific results), `WebSite` (enables the sitelinks search box), and `BreadcrumbList` (shows breadcrumbs in search results for multi-level pages like `/pricing` and `/help`). JSON-LD is the recommended format — it is injected as a `<script type="application/ld+json">` in the `<head>` and has no visual rendering.

## Scope

**In scope:**
- `Organization` + `WebSite` + `SoftwareApplication` schemas on `/` (landing page)
- `BreadcrumbList` schema on `/pricing` and `/help`
- A `JsonLd` React component that injects structured data safely

**Out of scope:**
- `FAQPage` schema for help articles (deferred until help articles are individually routed)
- `Person` schema on public contact card pages (Phase 30)
- `Product` or `Offer` schemas for pricing tiers (deferred)

---

## Design / Implementation Spec

### `JsonLd` component

`src/app/_components/json-ld.tsx`:

```tsx
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

Used in server components (safe — data is not user-controlled).

### Landing page schemas

```typescript
// src/app/(public)/page.tsx
const BASE_URL = "https://kontax.app";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Kontax",
  url: BASE_URL,
  logo: `${BASE_URL}/icons/icon-512.png`,
  sameAs: [], // add social profiles when available
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Kontax",
  url: BASE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/contacts?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Kontax",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "GBP",
    description: "Free plan available with 500 contacts",
  },
  description: "One address book, always up to date — across all your devices, apps, and the people you share with.",
  url: BASE_URL,
};
```

```tsx
// In LandingPage:
<>
  <JsonLd data={organizationSchema} />
  <JsonLd data={websiteSchema} />
  <JsonLd data={softwareSchema} />
  {/* ... rest of page */}
</>
```

### Pricing page breadcrumb

```typescript
// src/app/(public)/pricing/page.tsx
const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Kontax", item: "https://kontax.app" },
    { "@type": "ListItem", position: 2, name: "Pricing", item: "https://kontax.app/pricing" },
  ],
};
```

### Help page breadcrumb

```typescript
const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Kontax", item: "https://kontax.app" },
    { "@type": "ListItem", position: 2, name: "Help", item: "https://kontax.app/help" },
  ],
};
```

---

## Acceptance Criteria

- The landing page includes `Organization`, `WebSite`, and `SoftwareApplication` JSON-LD blocks.
- The `/pricing` and `/help` pages include `BreadcrumbList` JSON-LD.
- Google's Rich Results Test validates all schemas without errors.
- The `JsonLd` component does not XSS — data is never derived from user input.
- Structured data uses absolute URLs throughout (`https://kontax.app/...`).
