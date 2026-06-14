# P34C-18 — OG Images for All Marketing Pages

## Purpose

Generate and deploy social preview images for all marketing pages using the
existing `@vercel/og` pipeline. Ensures that when any marketing URL is shared
on social platforms, Slack, or messaging apps, it shows a professional branded
card rather than the default no-image fallback.

## Background

P26-10 and P30-05 established the `@vercel/og` pipeline in the codebase.
This ticket extends that pipeline to cover all new marketing pages from Phase
34C. Each image is 1200×630px, generated at request time and cached at the
edge by Vercel (or the CDN in front of Coolify).

## Scope

**In scope**
- OG images for: `/` (homepage), `/features`, `/pricing`, `/security`,
  `/changelog`, `/contact`, `/about`.
- OG image route(s) in `src/app/api/og/`.
- `og:image` metadata on each marketing page.
- Verification with opengraph.xyz before shipping.

**Out of scope**
- OG images for `/privacy`, `/terms` (not typically shared on social).
- OG images for authenticated routes.
- Twitter Card metadata (Twitter uses `og:image` as a fallback; optionally
  add `twitter:card: summary_large_image` as a quick add-on).

## Design / Implementation Spec

### Image design

All marketing OG images share a consistent template:

```
┌──────────────────────────────────────────────────────────────┐ 1200px
│  bg: #17352e (brand dark green)                              │
│                                                              │
│  [K mark logo — white, top-left, 48px]  Kontax              │
│                                                              │
│  Page title (48px, white, bold)                              │
│                                                              │
│  Page description (22px, white/70, max 2 lines)              │
│                                                              │
│  getkontax.com          (bottom-right, 16px, white/40)       │
└──────────────────────────────────────────────────────────────┘ 630px
```

Design rationale: dark green background with white text is bold and immediately
recognisable as Kontax. Readable at thumbnail size. No product screenshots in
OG images (they're too small to read and add complexity).

### Route structure

**Option A (shared route with slug param):**

```
src/app/api/og/route.tsx
```

Accept `?page=homepage`, `?page=features`, etc. Look up title and description
from a map. This is simpler to maintain.

**Option B (per-page routes):**

```
src/app/api/og/homepage/route.tsx
src/app/api/og/features/route.tsx
…
```

More files but more explicit. Choose Option A for Phase 34C.

### Implementation

```tsx
// src/app/api/og/route.tsx
import { ImageResponse } from "next/og";

const OG_PAGES: Record<string, { title: string; description: string }> = {
  homepage: {
    title: "Your contacts. Organised, synced, and always with you.",
    description: "The address book for how you actually live.",
  },
  features: {
    title: "Everything your contacts need",
    description: "Search, labels, sync, sharing, public card, and a developer API.",
  },
  pricing: {
    title: "Simple, honest pricing",
    description: "Free forever, or upgrade for unlimited contacts and sync.",
  },
  security: {
    title: "Security you can trust",
    description: "Encrypted at rest, TLS in transit, GDPR compliant.",
  },
  changelog: {
    title: "What's new in Kontax",
    description: "Every update, in order.",
  },
  contact: {
    title: "Get in touch",
    description: "We read every message and respond within 1 business day.",
  },
  about: {
    title: "About Kontax",
    description: "Built because address books haven't kept up with how we live.",
  },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") ?? "homepage";
  const data = OG_PAGES[page] ?? OG_PAGES.homepage;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#17352e",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "64px",
          fontFamily: "Geist, sans-serif",
        }}
      >
        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* K mark — inline SVG or img */}
          <span style={{ color: "white", fontSize: 28, fontWeight: 700 }}>
            Kontax
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            color: "white",
            fontSize: 48,
            fontWeight: 700,
            lineHeight: 1.15,
            marginTop: 48,
            maxWidth: 900,
          }}
        >
          {data.title}
        </div>

        {/* Description */}
        <div
          style={{
            color: "rgba(255,255,255,0.65)",
            fontSize: 22,
            marginTop: 20,
            maxWidth: 750,
            lineHeight: 1.5,
          }}
        >
          {data.description}
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 64,
            right: 64,
            color: "rgba(255,255,255,0.35)",
            fontSize: 16,
          }}
        >
          getkontax.com
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
```

### Metadata on each marketing page

```tsx
// In each page.tsx:
export const metadata: Metadata = {
  openGraph: {
    images: [
      {
        url: "/api/og?page=features",  // update per page
        width: 1200,
        height: 630,
        alt: "Kontax — Everything your contacts need",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
};
```

The homepage (`page=homepage`) is the default fallback — also set this in the
root `layout.tsx` `metadata.openGraph` so any unspecified page gets the
homepage image rather than no image.

### Fonts in @vercel/og

`@vercel/og` requires fonts to be loaded via the `fonts` option. Load Geist or
fall back to Inter (which is often pre-cached):

```tsx
const geist = await fetch(
  new URL("../../../public/fonts/Geist-Regular.woff", import.meta.url)
).then(res => res.arrayBuffer());
// Pass as fonts: [{ name: "Geist", data: geist, weight: 400 }]
```

If Geist is not in `public/fonts/`, use Inter from Google Fonts as a fallback
for the OG image only. The app uses Geist from `next/font`; the OG route is
separate.

### Verification

Before merging to `main`:
1. Deploy to staging or Coolify preview.
2. Open `https://opengraph.xyz/url/https://staging.getkontax.com/features`.
3. Confirm: image renders, title shows, description shows, no broken card.
4. Check all 7 pages (or at least `/`, `/features`, `/pricing`).

## Acceptance Criteria

- [ ] `GET /api/og?page=homepage` returns a 1200×630 PNG with the Kontax OG
      design.
- [ ] All 7 pages listed above have a valid `?page=` variant in `OG_PAGES`.
- [ ] Each marketing page's `metadata.openGraph.images` points to the correct
      `?page=` param.
- [ ] Verified with opengraph.xyz for at least `/`, `/features`, `/pricing`.
- [ ] No broken fallback image on any of the 7 pages.
- [ ] Background is `#17352e`; text is white; domain is present.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- **Font loading in ImageResponse**: fonts must be fetched at request time.
  Cache the font buffer at module scope to avoid re-fetching on every request.
- **Vercel vs Coolify**: `ImageResponse` from `next/og` works on Vercel Edge
  Functions natively. On Coolify (Node.js runtime), it uses the `@resvg/resvg-js`
  or similar polyfill path. Verify the OG route works in the Coolify deployment
  environment before declaring complete.
- **K mark SVG**: the K mark logo needs to be embeddable as an inline SVG or
  a base64 data URL within the `ImageResponse` JSX. Test this approach early —
  external image URLs in ImageResponse can fail in some environments.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/: document the OG image
      pipeline and how to add a new page's OG variant
- [x] Internal · engineering — docs/: document the OG_PAGES map location and
      the font-loading approach
