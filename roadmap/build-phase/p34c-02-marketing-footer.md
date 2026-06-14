# P34C-02 — Shared Marketing Footer Component

## Purpose

Create a `<MarketingFooter>` component used across all marketing pages. Provides
consistent navigation to secondary pages, legal links, and branding — and ensures
every marketing page links to `/privacy` and `/terms` (required for Stripe
compliance before go-live).

## Background

The existing landing page footer (if any) is ad-hoc and missing the legal links
that Stripe's platform requires. Privacy and Terms pages are gated P0 items for
the Stripe account review. The footer must be in place before the compliance
review, so this ticket is P0 even though footer design is not complex.

Phase 34C creates at least 10 new marketing pages. A shared footer component
prevents diverging link lists and ensures the copyright year and legal links
are updated in one place.

## Scope

**In scope**
- `src/app/(marketing)/_components/marketing-footer.tsx`.
- Added to the `(marketing)` layout (`src/app/(marketing)/layout.tsx`) below
  the page content.
- Three-column desktop layout + bottom bar.
- Single-column mobile stack.

**Out of scope**
- Any analytics pixel or cookie consent (tracked separately).
- Blog or social feed embeds.
- The marketing nav (P34C-01).

## Design / Implementation Spec

### Layout — desktop (≥ 768px)

```
┌──────────────────────────────────────────────────────────────────┐
│  bg-[#17352e]  padding: pt-16 pb-10                              │
│                                                                  │
│  [K]  Kontax                                                     │
│  Your contacts, everywhere.                                      │
│                                                                  │
│  Product            Company          Legal                       │
│  Features           About            Privacy policy             │
│  Pricing            Contact          Terms of service           │
│  Changelog          Blog ¹           Cookie policy              │
│  Security           Developers                                   │
│                                                                  │
│  ──────────────────────────────────────────────────────────────  │
│  © 2026 Kontax · Built with ♥ by Vexon          [X]  [GH]       │
└──────────────────────────────────────────────────────────────────┘
¹ Blog link renders only if `/blog` exists; otherwise omit.
```

- **Background**: `bg-[#17352e]` (brand dark green).
- **Text**: all white; links `text-white/70 hover:text-white transition-colors`.
- **Column headings**: `text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 mb-4`.
- **Link font**: `text-[14px]`.
- **Logo + tagline** span the full width above the columns. Logo: K mark (white
  version) + "Kontax" wordmark white. Tagline: "Your contacts, everywhere." in
  `text-[15px] text-white/60 mt-1 mb-12`.
- **Divider**: `border-t border-white/10 mt-12 pt-8`.
- **Bottom bar**: flex `justify-between items-center`.
  - Left: `© 2026 Kontax · Built with ♥ by Vexon` in `text-[13px] text-white/40`.
  - Right: icon links — Twitter/X (`href="https://x.com/getkontax"`, target blank)
    and GitHub (`href="https://github.com/vexon"`, target blank). Icons 20×20.

### Column link maps

```ts
const FOOTER_LINKS = {
  Product: [
    { label: "Features",   href: "/features"  },
    { label: "Pricing",    href: "/pricing"   },
    { label: "Changelog",  href: "/changelog" },
    { label: "Security",   href: "/security"  },
  ],
  Company: [
    { label: "About",      href: "/about"   },
    { label: "Contact",    href: "/contact" },
    { label: "Developers", href: "/developers" },
  ],
  Legal: [
    { label: "Privacy policy",    href: "/privacy" },
    { label: "Terms of service",  href: "/terms"   },
    { label: "Cookie policy",     href: "/privacy#cookies" },
  ],
};
```

Define this as a constant at the top of the file so link lists are easy to update
without touching JSX. Render via `Object.entries(FOOTER_LINKS).map(...)`.

### Mobile (< 768px)

Columns stack vertically: Product → Company → Legal. Each column heading acts as
an expand/collapse toggle (optional — can also just stack open). Logo + tagline
above, bottom bar below. Padding: `px-6 py-12`.

### Accessibility

- `<footer role="contentinfo">`.
- Each column is a `<nav aria-label="{column name}">` with a `<ul>`.
- External links (`x.com`, `github.com`) have `target="_blank" rel="noopener noreferrer"`
  and a visually-hidden " (opens in new tab)" suffix.

## Acceptance Criteria

- [ ] Footer renders on every marketing page via the shared layout.
- [ ] All three column link groups render with correct `href` values.
- [ ] Bottom bar shows copyright year 2026 and social icon links.
- [ ] `/privacy` and `/terms` links are present and navigable.
- [ ] Desktop: three-column grid. Mobile (< 768px): single-column stack.
- [ ] `bg-[#17352e]` background with white text as specified.
- [ ] No TypeScript errors; no ESLint errors.
- [ ] The authenticated app layout is not affected.

## Risks / Open Questions

- **Blog link**: only include `/blog` if the page exists. If not shipped by
  launch, omit from the column rather than showing a 404 link.
- **Cookie policy**: if there is no separate cookie policy page, point the link
  to `/privacy#cookies` (a section anchor). Confirm with legal review (P34C-15).
- **Social links**: placeholder URLs until official accounts are confirmed.
  Use `href="#"` with a TODO comment rather than a wrong URL.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: document footer link constant location
      for non-technical link updates
