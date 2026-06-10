# Design Brief: Public Landing Page

**Route:** `/` (logged-out state)
**Phase:** P0 core surface
**Last updated:** 2026-06-10

> **Design decision locked (2026-06-10): light system.** The landing page uses the same locked light design system as the rest of the app — ink `#1d2823`, green `#17352e`, blue `#4158f4`, hairline `#d8ddd6`, white surfaces, Geist. There is no separate "dark marketing" aesthetic. This means visitors see the same visual language before and after they log in — no jarring contrast shift, and the product preview immediately looks like the real product.

---

## Purpose

The public landing page is Kontax's only marketing surface in v1. It serves two audiences: a stranger who has never heard of the product (needs to understand what it does in 5 seconds), and a returning user who wants to log back in (needs a clear path to authentication). The page must do three things simultaneously: communicate the product's value clearly, show rather than tell (a realistic product mockup is the best marketing copy), and get out of the way fast with a single prominent CTA.

The tone is calm, clean, and confident — the same tone as the product itself. The light background makes the product preview look immediately familiar and approachable rather than mysterious.

---

## Layout (Desktop ≥ 1280px)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NAV BAR (white, sticky)                                                    │
│  [K] Kontax                                         [Log in]  [Get started] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HERO SECTION  (white/off-white bg)                                        │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │  Eyebrow text           │  │                                         │  │
│  │                         │  │   PRODUCT PREVIEW                       │  │
│  │  Your contacts,         │  │   (contacts list, elevated panel)       │  │
│  │  synced everywhere.     │  │                                         │  │
│  │                         │  │                                         │  │
│  │  Subtext…               │  │                                         │  │
│  │                         │  │                                         │  │
│  │  [Get started free]     │  │                                         │  │
│  │  [Log in  →]            │  │                                         │  │
│  └─────────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  FEATURE HIGHLIGHTS (surface bg #f4f6f2)                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Sync to any │  │ Family & team│  │ Full history │  │ Import from  │   │
│  │  device      │  │ sharing      │  │ & activity   │  │ Google,Apple │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  FOOTER (white, hairline top border)                                        │
│  © 2026 Kontax          Log in   Register   Pricing (coming soon)           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tablet Layout (768–1279px)

The two-column hero **stays two-column** down to 768px but the proportions shift:
- Left column narrows; right column (preview) shrinks proportionally.
- Preview panel: reduce width to ~380px and allow it to clip at the right edge if needed, rather than shrinking to illegibility.
- Below ~960px, the hero **stacks**: text+CTAs on top, preview panel below (full-width, no tilt). Same as mobile but with more breathing room — `padding: 48px 32px` and the preview height caps at 480px.
- Nav stays the same (both buttons visible).
- Feature cards: 2-column grid at all tablet widths.
- Footer: same as desktop.

---

## Navigation Bar

Sticky, white, `border-bottom: 1px solid #d8ddd6`. Height: 60px. Matches the in-app header visual weight.

- **Left:** Kontax brand mark — "K" tile (`34×34px`, `border-radius: 10px`, `background: #17352e`, `color: #dff0e7`, `font-size: 19px`, `font-weight: 700`) + wordmark (`font-size: 20px`, `font-weight: 600`, `letter-spacing: -0.018em`, `color: #17352e`). Same as the auth card brand mark, same proportions.
- **Right:** Two buttons:
  - **"Log in"** — text link style: `color: #5c655e`, `font-size: 14px`, `font-weight: 500`, hover `color: #1d2823`. Links to `/login`.
  - **"Get started free"** — filled primary: `height: 34px`, `padding: 0 14px`, `border-radius: 8px`, `background: #4158f4`, `color: #fff`, `font-size: 13px`, `font-weight: 600`. Hover: `background: #3347d8`. Links to `/register`.
- Horizontal padding: 24px each side on desktop.
- `z-index` high enough to sit above the hero on scroll (`z-index: 10`).

---

## Hero Section

### Background

- **Desktop:** Clean white `#ffffff` with a very subtle radial gradient for depth: `radial-gradient(ellipse 80% 60% at 60% 50%, rgba(23,53,46,0.04) 0%, transparent 70%)` — barely perceptible warm green tint behind the preview panel.
- The hero section height: `min-height: calc(100vh - 60px)` — fills the viewport below the nav.
- No grain, no noise, no photography. CSS only.

### Layout Within Hero

Two columns, 50/50 split, both vertically centred. Gap: 64px. `padding: 64px 48px`.

**Left column** — `max-width: 520px`.
**Right column** — `max-width: 560px`.

### Left Column — Headline, Subtext, CTAs

**Eyebrow** (above headline, optional):
`font-size: 12px`, `font-weight: 600`, `letter-spacing: 0.1em`, `text-transform: uppercase`, `color: #5c655e`. E.g. *"Contact management, reimagined"*.

**Headline (locked copy):**
```
Your contacts,
synced everywhere.
```
- `font-size: 56–64px`, `font-weight: 700`, `line-height: 1.1`, `letter-spacing: -0.02em`, `color: #1d2823`.
- The line break after "contacts," is intentional — preserve it with `<br>` or constrained container width. Do not reflow into a single line.

**Subtext (locked copy):**
*"One address book, always up to date — across all your devices, apps, and the people you share with."*
- `font-size: 18–20px`, `font-weight: 400`, `line-height: 1.55`, `color: #5c655e`, `margin-top: 20px`.

**CTA Buttons:** horizontal row (stacked on mobile).
- **Primary — "Get started free":** `height: 48px`, `padding: 0 24px`, `border-radius: 12px`, `background: #4158f4`, `color: #fff`, `font-size: 15px`, `font-weight: 600`. Hover: `background: #3347d8`. Same label as the nav button — consistent throughout the page.
- **Secondary — "Log in":** `height: 48px`, `padding: 0 24px`, `border-radius: 12px`, `border: 1px solid #d8ddd6`, `background: transparent`, `color: #1d2823`, `font-size: 15px`, `font-weight: 500`. Hover: `background: #f2f4f0`. Arrow icon `→` after label.
- Gap: 12px. `margin-top: 32px` from subtext.

**Social proof line (future-ready):** Below buttons, `font-size: 12px`, `color: #8b938c`. E.g. *"Join thousands of people who've taken back their contacts."*

### Right Column — Product Preview Panel

The panel looks like a real screenshot of the Kontax contacts list — the same light design system — elevated off the white background with a shadow.

**Panel anatomy:**
```
┌──────────────────────────────────────────────────────────┐
│  BROWSER CHROME                                          │
│  ● ● ●                     kontax.app  🔒               │
├──────────────────────────────────────────────────────────┤
│  APP HEADER                                              │
│  [K] Kontax          [+ Create contact]  [🔔]  [L]      │
├──────────────────────────────────────────────────────────┤
│  🔍 Search by name, email, phone…                        │
├──────────────────────────────────────────────────────────┤
│  ★ FAVOURITES                                            │
│  [AO]  Amara Okafor       Orbit Health                   │
│                                                          │
│  A                                                       │
│  [AC]  Alex Chen          alex@acme.com                  │
│  [AW]  Alexandra Wong     +1 415 555 0192                │
│  B                                                       │
│  [BN]  Ben Nakamura       Acme Corp                      │
│  [BO]  Beth Okafor        beth@studiob.co                │
│  C                                                       │
│  [CR]  Carlos Rivera      +44 7911 555 021               │
│  [CD]  Clara Dubois       clara@design.fr                │
└──────────────────────────────────────────────────────────┘
```

- **Browser chrome bar:** `background: #e5e7e0`, height 28px. Traffic-light dots (red/amber/green, 10px each), URL bar showing `kontax.app` with padlock. Matches the browser chrome used elsewhere in the design system.
- **App content:** white background `#ffffff`, exactly matching the real app. App header: `background: #fff`, `border-bottom: 1px solid #d8ddd6`. Search bar: white, rounded, `border: 1px solid #d8ddd6`.
- **Contact rows:** same style as the real contacts list rows. Avatar colours are computed from the name-hash tint system — use the exact values below so the preview matches the live app:

| Contact | Initials | Avatar bg | Avatar text |
|---|---|---|---|
| Amara Okafor | AO | `#efe9df` | `#85703f` |
| Alex Chen | AC | `#e9e7f4` | `#5a55a6` |
| Alexandra Wong | AW | `#f2e6ea` | `#9a4a63` |
| Ben Nakamura | BN | `#e6ece4` | `#3f6b53` |
| Beth Okafor | BO | `#e8efe0` | `#5f7a3a` |
| Carlos Rivera | CR | `#e3eef0` | `#3f7d7a` |
| Clara Dubois | CD | `#f3e7df` | `#9a623a` |

- **Section headers** (A, B, C): `font-size: 11px`, `font-weight: 700`, `letter-spacing: 0.1em`, `text-transform: uppercase`, `color: #8b938c`.
- **Bottom fade:** `linear-gradient(to bottom, transparent, #ffffff)` over the last ~60px of the panel — implies the list continues.

**Panel styling:**
- `border-radius: 16px` overall.
- `border: 1px solid #d8ddd6`.
- `box-shadow: 0 24px 60px rgba(29,40,35,0.10), 0 4px 16px rgba(29,40,35,0.06)` — elevated but not dramatic; shadow uses the brand ink colour, not pure black.
- Optional subtle tilt: `transform: perspective(1200px) rotateY(-3deg) rotateX(1deg)`. Disabled via `prefers-reduced-motion`.
- Width fills the right column (~480–520px).

---

## Feature Highlights Section

`background: #f4f6f2` (app surface colour) — a gentle tonal shift from the white hero to signal a new section without a harsh break. `padding: 80px 48px`.

Four cards in a 4-column grid (2-col tablet, 1-col mobile).

**Card styling:**
- `background: #ffffff`, `border: 1px solid #d8ddd6`, `border-radius: 14px`, `padding: 24px`.
- Same SectionCard spec as the in-app detail page — completely consistent.
- Hover: `background: #f9faf8` (barely perceptible lift).

**Card content:**
- **Icon:** 32×32px tile, `background: #f2f4f0`, `border: 1px solid #e9ece7`, `border-radius: 9px`, icon stroke `#5c655e`, `stroke-width: 1.6`.
- **Title:** `font-size: 15px`, `font-weight: 600`, `color: #1d2823`, `margin-top: 14px`.
- **Body:** `font-size: 13.5px`, `color: #5c655e`, `line-height: 1.55`, `margin-top: 6px`.

**Four cards:**

| Icon | Title | Body | Status |
|---|---|---|---|
| sync | Sync to any device | CardDAV keeps your contacts live in Apple Contacts, Google, and any CalDAV client. | Live |
| clock | Activity history | See every change, merge, and import across all your contacts, forever. | Live |
| download | Import from anywhere | One-click import from CSV or vCard — Google, Apple, Outlook. No data left behind. | Live |
| users | Family & team sharing | A shared address book for your household or small team — everyone stays current. | Coming soon |

**"Coming soon" treatment for Family & team sharing:** this feature ships in Phase 13 and is not yet live. The card renders in full (same layout, same icon) but with:
- A small `[Coming soon]` chip in the card header area — `background: #f2f4f0`, `color: #8b938c`, `font-size: 10px`, `font-weight: 700`, `border-radius: 4px`, `padding: 2px 7px`.
- Card opacity: `0.75` and `cursor: default` (not hoverable).
- Body copy adjusted: *"A shared address book for your household or small team — arriving soon."*

No CTA buttons on the feature cards. Primary CTAs remain in the hero.

---

## Footer

`background: #ffffff`, `border-top: 1px solid #d8ddd6`. Height: 56px. `padding: 0 48px`.

- **Left:** "© 2026 Kontax" — `font-size: 12px`, `color: #8b938c`.
- **Right:** text links — "Log in", "Register", "Pricing (coming soon)" — `font-size: 12px`, `color: #8b938c`, hover `color: #5c655e`. "coming soon" in `opacity: 0.6`.
- No social media links in v1.

---

## States

### Logged-In Redirect
If a user is authenticated and visits `/`, redirect server-side to `/contacts`. The landing page is never shown to logged-in users.

### Loading
Fully static page — no async data. Target First Contentful Paint < 1.5s.

### Prefers-Reduced-Motion
Remove the panel tilt transform (`transform: none`). Skip scroll-triggered animations — render elements fully visible from the start.

---

## Mobile Layout (< 768px)

Single column. Hero text then preview panel then feature cards.

```
┌──────────────────────────────┐
│  [K] Kontax      [Log in]   │  ← compact nav
│                              │
│  Your contacts,              │
│  synced everywhere.          │
│                              │
│  One address book, always…   │
│                              │
│  [   Get started free    ]   │  ← full-width
│  [       Log in  →       ]   │  ← full-width, outlined
│                              │
│  ┌──────────────────────┐    │
│  │  PRODUCT PREVIEW     │    │  ← full-width, no tilt
│  └──────────────────────┘    │
│                              │
│  (feature cards stacked)     │
│                              │
│  © 2026 Kontax               │
└──────────────────────────────┘
```

- Nav: logo left, "Log in" text link right only — no "Get started" in the nav on mobile (hero CTAs are sufficient).
- Headline: `font-size: 36–42px` (from 56–64px desktop). Still two lines.
- CTAs: stacked vertically, full-width.
- Preview panel: full-width, `border-radius: 12px`, no perspective tilt. Shadow softened: `0 12px 40px rgba(29,40,35,0.10)`.
- Feature cards: 1-column stack, `padding: 20px`.

---

## Animation Guidelines

Subtle, purposeful. All motion respects `prefers-reduced-motion: reduce`.

- **Feature cards:** fade-in + translate-y (8px → 0) on scroll-enter via `IntersectionObserver`. Staggered 80ms per card. Duration: 400ms, `cubic-bezier(0.2, 0, 0.1, 1)`.
- **Product preview:** subtle scale on load `scale(0.97) → scale(1)`, 600ms `ease-out`. Draws the eye on arrival.
- No parallax, no continuous animation, no scroll-jacking.

---

## Future Additions

### Pricing Section (Phase 11)
A "Pricing" link in nav and footer is reserved. When Phase 11 lands, a pricing section inserts between Feature Highlights and Footer — a tier comparison card layout. No layout changes needed above it.

### Testimonials / Social Proof
A testimonial strip can insert between the hero and feature highlights. Leave a natural section break at this junction.

### Animated Demo (Later)
The product preview panel may eventually show a looping animation (contact added, sync, merge). Panel dimensions and styling accommodate this — only inner content changes.

### Localisation
Keep hero copy and feature text in externalisable strings from the start.
