# P34C-01 — Shared Marketing Nav Component

## Purpose

Create a single `<MarketingNav>` server component consumed by every marketing
page. Provides logo, navigation links, auth CTAs, and a mobile hamburger overlay
so all pages share identical navigation without duplication.

## Background

The current landing page (`src/app/page.tsx` or `src/app/(marketing)/page.tsx`)
has ad-hoc nav markup embedded directly in the page. As Phase 34C adds
`/features`, `/pricing`, `/security`, `/changelog`, `/about`, `/contact`,
`/privacy`, and `/terms`, each page needs the same navigation. Extracting it
into a shared component now prevents eight diverging copies.

The new route group `(marketing)` isolates marketing layout from the
authenticated app layout. The existing app layout at `src/app/layout.tsx` must
not be used for marketing pages — it imports auth providers and sidebar chrome
that do not belong on the public site.

## Scope

**In scope**
- `src/app/(marketing)/_components/marketing-nav.tsx` — the nav component.
- `src/app/(marketing)/layout.tsx` — the marketing layout that renders
  `<MarketingNav>` and `<MarketingFooter>` around `{children}`.
- Moving the existing homepage to `src/app/(marketing)/page.tsx` if it is not
  already in the route group (keep the old path as a redirect if the file move
  changes behaviour).
- Mobile hamburger: a `<MarketingNavMobile>` client component island (the
  hamburger toggle needs `useState`; the outer nav stays a server component).

**Out of scope**
- The footer (P34C-02).
- Per-page hero or content sections.
- Authentication state awareness in the nav (log-in link is always visible;
  the app handles redirect if the user is already authenticated).

## Design / Implementation Spec

### Route group and layout

```
src/app/
  (marketing)/
    layout.tsx          ← imports MarketingNav + MarketingFooter
    page.tsx            ← homepage (move from src/app/page.tsx)
    features/page.tsx
    pricing/page.tsx
    …
    _components/
      marketing-nav.tsx
      marketing-nav-mobile.tsx   ← client component
      marketing-footer.tsx
```

The `(marketing)` group does **not** appear in the URL. The marketing layout
must be a plain HTML shell with no Tailwind dark-mode or app-specific providers.

### Desktop layout (≥ 768px)

```
┌──────────────────────────────────────────────────────────────┐
│  [K]  Kontax     Features · Pricing · Security · Changelog   │  Log in    [Get started]  │
└──────────────────────────────────────────────────────────────┘
```

- Container: `max-w-6xl mx-auto px-6`, `h-16`, `flex items-center`.
- **Logo left** — K mark SVG + "Kontax" wordmark in `#17352e` semibold. Wraps
  in `<Link href="/">`. Logo area width: fixed ~120px.
- **Nav links centre** — `flex gap-8 text-[15px] text-[#1d2823]`. Links:
  `Features → /features`, `Pricing → /pricing`, `Security → /security`,
  `Changelog → /changelog`. Active page gets `font-semibold text-[#17352e]`
  via `usePathname()` (make this a client component island if needed, or use
  a server-side approach checking the segment from layout).
- **Right side** — `flex items-center gap-4 ml-auto`:
  - `Log in` → `<Link href="/login">` in `text-[#1d2823] text-[15px]`.
  - `Get started` → `<Link href="/register">` as a filled pill button:
    `bg-[#17352e] text-white rounded-[10px] px-5 py-2 text-[15px] font-semibold
    hover:bg-[#0f2419] transition-colors`.

### Sticky + shadow on scroll

The nav wrapper gets `sticky top-0 z-50 bg-white`. A `scroll` listener
(small client island, or CSS `@supports` + scroll-driven animation) adds
`shadow-sm border-b border-[#edf0ea]` once `window.scrollY > 0`. Simplest
implementation: a `<MarketingNavScrollShadow>` client component that wraps
the nav and adds a class on scroll.

### Mobile (< 768px)

- Nav links and auth CTAs are hidden.
- A hamburger button (24×24 icon, `#1d2823`) renders in their place.
- Tap opens a full-screen overlay (`fixed inset-0 z-[60] bg-white`) with:
  - Close button (×) top-right.
  - Logo top-left.
  - Nav links stacked, `text-[20px] font-semibold py-4 border-b border-[#edf0ea]`.
  - `Log in` + `Get started` (full-width) buttons at the bottom of the overlay.
- Implemented in `marketing-nav-mobile.tsx` as a client component with
  `useState(false)` for open/closed.
- Body scroll is locked when the overlay is open (`overflow-hidden` on `<body>`).

### Accessibility

- Nav has `role="navigation" aria-label="Main"`.
- Hamburger button: `aria-label="Open menu"` / `aria-label="Close menu"` (toggled).
- Overlay has `role="dialog" aria-modal="true"`.
- Keyboard: `Escape` closes the overlay.

## Acceptance Criteria

- [ ] `<MarketingNav>` renders on all marketing pages via the shared layout.
- [ ] Logo links to `/`.
- [ ] All four nav links (`/features`, `/pricing`, `/security`, `/changelog`)
      render and navigate correctly.
- [ ] `Log in` links to `/login`; `Get started` links to `/register`.
- [ ] At ≥ 768px all links are visible; at < 768px they are hidden behind hamburger.
- [ ] Hamburger opens full-screen overlay; close button and `Escape` both close it.
- [ ] Nav becomes sticky and shows `shadow-sm` after scrolling past the top.
- [ ] The authenticated app layout is not affected.
- [ ] `tsc --noEmit` passes; no ESLint errors.

## Risks / Open Questions

- **Homepage file move**: if `src/app/page.tsx` is currently the homepage, moving
  it to `src/app/(marketing)/page.tsx` changes nothing in the URL — Next.js
  route groups are transparent. But verify no other file in `src/app/` would
  create a conflict.
- **Active link detection in server component**: if nav is server-only, active
  state requires a client island. Acceptable to make the whole nav a client
  component if the island approach is too complex.
- **Scroll shadow**: avoid layout shift. Use `will-change: box-shadow` and
  debounce the scroll listener if needed.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: note the `(marketing)` route group
      and how to add new marketing pages to the shared layout
