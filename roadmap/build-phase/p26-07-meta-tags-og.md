# P26-07 — Meta Tags and Open Graph

## Purpose

Add correct `<title>`, `<meta description>`, and full Open Graph / Twitter Card tags to all public routes so that when Kontax links are shared on social platforms, they show a branded preview — title, description, and image — rather than a blank card.

## Background

Without OG tags, links to Kontax shared on WhatsApp, iMessage, Slack, or Twitter render as bare URLs with no preview. This is both a missed acquisition opportunity (every shared link is a potential new user) and a professionalism signal. OG tags take 30 minutes to implement and have an outsized impact on perceived product quality.

The OG image for most pages is a static branded card (`/og-default.png`). Dynamic OG images for share pages are covered in P26-10.

## Scope

**In scope:**
- `/` (landing page): title, description, og:title, og:description, og:image, og:type, og:url, twitter:card
- `/pricing`: same tags with pricing-specific copy
- `/login` and `/register`: minimal tags (noindex — auth pages should not be indexed)
- `/developers` (P29-07): developer-specific tags (implemented when that page ships)
- Static OG image: `/public/og-default.png` — 1200×630px branded card (Kontax wordmark + tagline on white background)
- `generateMetadata()` helper for consistent tag generation

**Out of scope:**
- Dynamic OG images (P26-10)
- Per-contact OG images (P26-10)
- Sitemap (P26-08)

---

## Design / Implementation Spec

### Static OG image

`/public/og-default.png`: 1200×630px. Design: white background, Kontax wordmark centred (same K tile + wordmark from the landing page nav), tagline "Your contacts, synced everywhere." below in `#5c655e`, subtle green radial gradient background matching the auth page background. Brand green border at the bottom edge.

This image is static — created once as a PNG asset and committed to `/public`.

### `generateMetadata` helper

`src/lib/metadata.ts`:

```typescript
import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://kontax.app";

export function generatePageMetadata(page: {
  title: string;
  description: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const ogImage = page.image ?? `${BASE_URL}/og-default.png`;

  return {
    title: page.title,
    description: page.description,
    ...(page.noIndex && { robots: { index: false, follow: false } }),
    openGraph: {
      title: page.title,
      description: page.description,
      type: "website",
      url: BASE_URL,
      siteName: "Kontax",
      images: [{ url: ogImage, width: 1200, height: 630, alt: page.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [ogImage],
      site: "@kontaxapp", // update when account is created
    },
  };
}
```

### Per-route metadata

**Landing page (`/`):**
```typescript
export const metadata = generatePageMetadata({
  title: "Kontax — Your contacts, synced everywhere",
  description: "One address book, always up to date — across all your devices, apps, and the people you share with. Free to start.",
});
```

**Pricing page (`/pricing`):**
```typescript
export const metadata = generatePageMetadata({
  title: "Kontax Pricing — Free, Pro, Family & Teams",
  description: "Start free with 500 contacts. Upgrade to Pro for unlimited contacts, CardDAV sync, and contact sharing.",
});
```

**Login page (`/login`):**
```typescript
export const metadata = generatePageMetadata({
  title: "Log in — Kontax",
  description: "Log in to your Kontax account.",
  noIndex: true,
});
```

**Register page (`/register`):**
```typescript
export const metadata = generatePageMetadata({
  title: "Create your account — Kontax",
  description: "Create your free Kontax account. Unlimited contacts on the free plan.",
  noIndex: true,
});
```

### `<head>` additions in root layout

In `src/app/layout.tsx`, add global meta tags:

```tsx
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://kontax.app"),
  applicationName: "Kontax",
  keywords: ["contacts", "CardDAV", "address book", "sync", "contact management"],
  authors: [{ name: "Kontax" }],
  creator: "Kontax",
};
```

---

## Acceptance Criteria

- All public pages have `<title>`, `<meta name="description">`, `og:title`, `og:description`, `og:image`, `og:type`, `og:url`, `twitter:card`, `twitter:image`.
- `/login` and `/register` have `<meta name="robots" content="noindex">`.
- The OG image (`/og-default.png`) is a well-designed 1200×630px branded card.
- Sharing the landing page URL on WhatsApp, Slack, or Twitter shows a branded preview with the OG image.
- The `generatePageMetadata` helper is used consistently — no per-page manual tag duplication.
- All OG tags use absolute URLs (`https://kontax.app/og-default.png`), not relative paths.

---

## Risks and Open Questions

- **`metadataBase`:** Next.js App Router requires `metadataBase` to be set in the root layout for relative OG image URLs to resolve correctly. Confirm the environment variable `NEXT_PUBLIC_APP_URL` is set in all environments (development, staging, production). Without it, OG image URLs will be malformed on staging.
- **Twitter/X account:** `twitter:site` requires a Twitter handle. Use a placeholder until the @kontaxapp account is created, or omit the tag rather than using an incorrect handle.
