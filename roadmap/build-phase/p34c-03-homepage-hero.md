# P34C-03 — Homepage Hero Section Rebuild

## Purpose

Replace the existing homepage hero with a version that reflects the current
product and the approved P34C-DB01 copy. The hero is the primary conversion
surface for getkontax.com — it must communicate what Kontax is in under 5
seconds and push visitors to `/register`.

## Background

The current landing page hero was written before labels (P31B), grouped search
(P33), and the public card (Phase 30) existed. The copy and screenshot do not
reflect the product's current capability. P34C-DB01 specifies the visual
treatment; this ticket implements it.

The hero section only is in scope here. Other homepage sections (feature tiles
P34C-04, social proof P34C-05) are separate tickets so they can be reviewed
and merged independently.

## Scope

**In scope**
- Hero section of `src/app/(marketing)/page.tsx`.
- Headline, sub-copy, primary CTA, secondary CTA.
- Product screenshot / illustration in the hero (right side on desktop,
  below copy on mobile).
- Replacing any stale copy or placeholder images in the current hero.

**Out of scope**
- Other homepage sections (feature tiles, social proof, CTA band at bottom).
- The marketing nav (P34C-01) and footer (P34C-02).
- Copy finalisation — headline comes from P34C-DB01 approved brief. Use the
  placeholder specified below if the brief is not yet approved; do **not** ship
  placeholder copy to production.

## Design / Implementation Spec

### Layout — desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────┐
│  [MarketingNav]                                              │
│                                                              │
│  max-w-6xl mx-auto px-6 pt-24 pb-20                         │
│  ┌──────────────────────┐   ┌──────────────────────────┐    │
│  │  Headline (48px)     │   │                          │    │
│  │                      │   │   Product screenshot     │    │
│  │  Sub-copy (18px)     │   │   (contacts list with    │    │
│  │                      │   │   search + labels)       │    │
│  │  [Get started free]  │   │   max-w: 540px           │    │
│  │  [See how it works↓] │   │   rounded-2xl shadow-xl  │    │
│  └──────────────────────┘   └──────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

- Left column: `flex-1`, `max-w-[520px]`.
- Right column: `flex-1`, screenshot constrained to `max-w-[560px]`.
- Vertical alignment: `items-center`.
- Left/right gap: `gap-16`.

### Copy (placeholder until DB01 approved)

```
Headline:  "Your contacts. Organised, synced, and always with you."
Sub-copy:  "Kontax keeps your address book in sync across every device —
            without giving your data to a platform."
```

Do not ship these placeholder strings to production. Gate the PR on approved
copy from P34C-DB01.

### Typography

- Headline: `text-[48px] lg:text-[56px] font-bold leading-[1.1] text-[#17352e]
  tracking-[-0.02em]`.
- Sub-copy: `text-[18px] leading-[1.6] text-[#5c655e] mt-6 max-w-[460px]`.
- Geist font family (already loaded globally).

### CTAs

```tsx
<div className="flex flex-col sm:flex-row gap-4 mt-10">
  <Link
    href="/register"
    className="inline-flex items-center justify-center h-12 px-8
               bg-[#17352e] text-white rounded-[12px] text-[16px]
               font-semibold hover:bg-[#0f2419] transition-colors"
  >
    Get started free
  </Link>
  <button
    onClick={() => featuresSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
    className="inline-flex items-center justify-center h-12 px-8
               border border-[#d8ddd6] text-[#1d2823] rounded-[12px]
               text-[16px] font-medium hover:bg-[#f4f6f2] transition-colors"
  >
    See how it works
  </button>
</div>
```

The secondary CTA scrolls to the features section (P34C-04 adds the ref target).
If P34C-04 is not yet merged, the secondary CTA can link to `#features` anchor
instead.

### Product screenshot

- Source: a production screenshot of the contacts list with the search dropdown
  open and at least two labels visible on contact rows.
- File: `public/images/marketing/hero-screenshot.webp` (WebP, optimise to
  < 200 KB for initial load).
- Render via Next.js `<Image>` with `priority` (LCP candidate):
  ```tsx
  <Image
    src="/images/marketing/hero-screenshot.webp"
    alt="Kontax contacts list showing grouped search results and label filters"
    width={1080}
    height={720}
    priority
    className="rounded-2xl shadow-xl border border-[#edf0ea] w-full h-auto"
  />
  ```
- The screenshot must be a real product screenshot, not a mockup or
  stock image.

### Background

Hero section: `bg-white`. A subtle radial gradient can be applied
(`radial-gradient(ellipse at 70% 50%, #eef5ef 0%, transparent 60%)`) to give
warmth without full-bleed colour.

### Mobile (< 768px) — handled in P34C-06

On mobile: text stack above screenshot. Headline `text-[36px]`. CTAs
full-width. See P34C-06 for detailed mobile QA.

## Acceptance Criteria

- [ ] Hero headline, sub-copy, and two CTAs render on the homepage.
- [ ] `Get started free` links to `/register`.
- [ ] `See how it works` scrolls to the features section (or `#features` anchor
      if P34C-04 is not yet merged).
- [ ] Product screenshot renders as `<Image priority>` with `alt` text.
- [ ] Screenshot file is WebP, < 200 KB, stored in `public/images/marketing/`.
- [ ] Desktop: two-column layout with copy left, screenshot right.
- [ ] No placeholder copy ships to production (headline from DB01 required).
- [ ] Lighthouse LCP for the hero image is < 2.5s on a 3G fast connection
      (verify in PageSpeed Insights before merging to main).
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- **Copy dependency**: this ticket should not merge to `main` until approved
  copy is available from P34C-DB01. Merge to a `feature/34c-hero` branch and
  hold.
- **Screenshot freshness**: the screenshot will go stale as the UI evolves.
  Document the process for replacing it (take screenshot at 1440×900, crop to
  the contacts list, export as WebP).
- **LCP optimisation**: `priority` on `<Image>` adds a `<link rel="preload">`.
  Confirm the image is not also lazy-loaded via other wrapper components.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: note the screenshot replacement process
      and the `public/images/marketing/` convention
