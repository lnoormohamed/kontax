# Design Brief: Public Landing Page

**Route:** `/` (logged-out state)
**Phase:** P0 core surface
**Last updated:** 2026-06-10

> **Freshness (2026-06-10) — DECISION NEEDED before sending.** The landing page is **built on the original dark theme** (cyan / `#020617` / `#08101c`), which **predates the locked light design system** used by the in-app surfaces. As a *marketing* surface, a distinct darker atmosphere can be a legitimate choice (unlike in-app auth) — but it should still feel like the same brand. **Decide before sending:** keep the dark marketing aesthetic (and refine it intentionally) or align it to the locked palette. Either way, the in-app mock shown on this page should reflect the **current** light contacts list (Phase 16), not the old dark dashboard.

---

## Purpose

The public landing page is Kontax's only marketing surface in v1. It serves two audiences: a stranger who has never heard of the product (needs to understand what it does in 5 seconds), and a returning user who wants to log back in (needs a clear path to authentication). The page must do three things simultaneously: communicate the product's value clearly, show rather than tell (a realistic product mockup is the best marketing copy), and get out of the way fast with a single prominent CTA. It is not a feature catalogue or a pricing page — those are future. It is a focused pitch: "here's what Kontax does, here's what it looks like, here's how to start."

The tone is calm, confident, and slightly premium — like a tool that serious people use, not a flashy startup. The dark background is intentional: it makes the clean white contacts list inside the product preview feel like a window into something valuable.

---

## Layout (Desktop ≥ 1280px)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NAV BAR                                                                    │
│  [Kontax logo]                              [Log in]  [Create account]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HERO SECTION                                                               │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐│
│  │                              │  │                                      ││
│  │  HEADLINE                    │  │   PRODUCT PREVIEW                    ││
│  │  Your contacts,              │  │                                      ││
│  │  synced everywhere.          │  │  ┌──────────────────────────────┐   ││
│  │                              │  │  │ 🔍 Search contacts          │   ││
│  │  SUBTEXT                     │  │  ├──────────────────────────────┤   ││
│  │  One address book,           │  │  │ A                            │   ││
│  │  always up to date — across  │  │  │   Alex Chen      ›           │   ││
│  │  all your devices, apps,     │  │  │   Alexandra Wong  ›          │   ││
│  │  and the people you share    │  │  │ B                            │   ││
│  │  with.                       │  │  │   Ben Nakamura   ›           │   ││
│  │                              │  │  │   Beth Okafor    ›           │   ││
│  │  [Create free account]       │  │  │ C                            │   ││
│  │  [Log in  →]                 │  │  │   Carlos Rivera  ›           │   ││
│  │                              │  │  │   Clara Dubois   ›           │   ││
│  │                              │  │  │ D                            │   ││
│  │                              │  │  │   David Park     ›           │   ││
│  └──────────────────────────────┘  │  │   Diana Osei     ›           │   ││
│                                    │  └──────────────────────────────┘   ││
│                                    └──────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FEATURE HIGHLIGHTS                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Sync to any │  │ Family & team│  │ Full history │  │ Import from  │  │
│  │  device      │  │ sharing      │  │ & activity   │  │ Google,Apple │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  FOOTER                                                                     │
│  © 2026 Kontax          Log in   Register   Pricing (coming soon)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

The page is divided into three clearly delineated sections: **Hero**, **Feature Highlights**, and **Footer**. The hero section is the dominant zone — it should fill at least the full initial viewport height (100vh). Feature highlights are a second scroll position but still above the fold on tall monitors.

---

## Navigation Bar

Thin, transparent-ish nav bar at the top. Height: 60px.

- **Left:** Kontax wordmark / logo in white (on the dark background). Same wordmark as elsewhere in the app, but rendered in white or very light green.
- **Right:** Two buttons.
  - "Log in" — a ghost/outlined button: `border border-white/30 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-white/10`.
  - "Create account" — filled primary: `bg-[#4158f4] text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-[#3347d8]`.
- The nav bar background: `rgba(15,26,23,0.6)` with `backdrop-filter: blur(12px)` — enough to be readable against the background without being opaque. `position: sticky` or `position: fixed` — it should stay visible as the user scrolls.
- No other nav links in v1.

---

## Hero Section

### Background

Full-viewport dark background. The treatment mirrors the login page background to create a cohesive brand environment:

- Base: `#0f1a17` (near-black, deep green-tinted).
- Radial gradient layered on top, centred slightly left (behind the headline): `radial-gradient(ellipse 120% 80% at 30% 50%, rgba(23,53,46,0.85) 0%, transparent 70%)`.
- Optionally a subtle grain/noise texture overlay at 3–4% opacity.
- A second, softer radial glow behind the product preview (right side): `radial-gradient(ellipse 60% 80% at 70% 50%, rgba(65,88,244,0.08) 0%, transparent 60%)` — a very faint blue tint around the preview to suggest the app is lit from within.
- No images required — CSS only.

### Layout Within Hero

Two columns, roughly 50/50 split, with the column divider at the horizontal centre of the viewport. Both columns are vertically centred within the 100vh hero zone.

**Left column** — max-width 520px.

**Right column** — max-width 560px.

Gap between columns: 64px minimum.

### Left Column — Headline, Subtext, CTAs

**Eyebrow text** (optional, above headline): `text-xs uppercase tracking-widest text-green-400/70 font-medium mb-4` — e.g. "Contact management, reimagined" or simply omitted for maximum focus.

**Headline:**
```
Your contacts,
synced everywhere.
```
- Font: 56–64px, `font-bold` or `font-extrabold`, line-height 1.1. Colour: `#ffffff`.
- Letter-spacing: `-0.02em` (tight tracking for display type).
- The comma after "contacts" creates a natural pause — the line break is intentional and should be preserved even at different viewport widths. Use a `<br>` or ensure the container width forces the break.

**Subtext:**
One or two sentences, max 180 characters total. Proposed copy: "One address book, always up to date — across all your devices, apps, and the people you share with."
- Font: 18–20px, `font-regular`, line-height 1.55. Colour: `rgba(255,255,255,0.65)`.
- Margin-top: 20px.

**CTA Buttons:**
- Arranged in a horizontal row (stacked vertically if < 380px wide).
- **Primary — "Create free account":** `bg-white text-[#17352e] font-semibold rounded-xl px-6 py-3 text-base hover:bg-slate-100`. White fill on dark background — high contrast, attention-grabbing. The dark green text grounds it in the brand.
- **Secondary — "Log in":** `border border-white/40 text-white font-medium rounded-xl px-6 py-3 text-base hover:bg-white/10 hover:border-white/60`. Ghost button. An arrow icon `→` after "Log in" adds forward motion.
- Gap between buttons: 12px.
- Margin-top from subtext: 32px.

**Social proof line (optional, future-ready):** Below the buttons, a tiny line of `text-xs text-white/40`: "Join thousands of people who've taken back their contacts." This placeholder line can be populated later with a real user count or testimonial.

### Right Column — Product Preview

This is the most important design decision on the landing page. Rather than abstract decorative elements, the preview should look like a screenshot of the actual contacts list: a realistic phone-book-style list with plausible placeholder data. Visitors should immediately recognise this as a real product.

**Preview Panel Anatomy:**

```
┌──────────────────────────────────────────────────────────┐
│  BROWSER CHROME (subtle)                                 │
│  ● ● ●                     kontax.app  [padlock]        │
├──────────────────────────────────────────────────────────┤
│  APP HEADER                                              │
│  Contacts                      [+]  [⋯]                 │
│  [🔍 Search contacts...                              ]   │
├──────────────────────────────────────────────────────────┤
│  A                                                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  [AV]  Alex Chen          alex@acme.com          │   │
│  │  [AW]  Alexandra Wong     +1 415 555 0192        │   │
│  └──────────────────────────────────────────────────┘   │
│  B                                                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  [BN]  Ben Nakamura       Acme Corp              │   │
│  │  [BO]  Beth Okafor        beth@studiob.co        │   │
│  └──────────────────────────────────────────────────┘   │
│  C                                                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  [CR]  Carlos Rivera      +44 7911 555 021       │   │
│  │  [CD]  Clara Dubois       clara@design.fr        │   │
│  └──────────────────────────────────────────────────┘   │
│  D                                                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  [DP]  David Park         CTO at Helion          │   │
│  │  [DO]  Diana Osei         diana@osei.law         │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

- The panel has a **browser chrome** header: three traffic-light dots (red/amber/green), a URL bar showing "kontax.app" with a padlock icon. This frames the content as a real app in a real browser window. The chrome bar is `bg-[#e5e7e0]` (light grey, warm-tinted), height 28px.
- Below the chrome: the app itself. Background `#f9faf6` (app off-white). This should look exactly like the real contacts list.
- **App header strip:** "Contacts" heading in `text-[#17352e] font-semibold`, `[+]` and `[⋯]` icon buttons on the right. Below: a search bar, full-width, `bg-white border border-[#d8ddd6] rounded-xl`.
- **Contact rows** match the actual app card style: `bg-white rounded-2xl border border-[#d8ddd6]`, avatar circle on the left, name + secondary info.
- **Avatar circles** use the initials-hash colour system — each person has a different muted colour. "AV" = sage green, "AW" = dusty blue, "BN" = terracotta, etc. The avatars are purely CSS-rendered (no images needed).
- **Section headers** (A, B, C, D) in `text-xs uppercase tracking-widest text-slate-400`, matching the real app.
- The panel is visually cropped at the bottom (fades out) to imply the list continues, using a `linear-gradient` from `transparent` to the preview panel background colour.

**Panel styling:**
- Border-radius: `1.25rem` (20px) on the overall panel.
- Box shadow: `0 24px 80px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.25)` — a deep shadow to lift it off the dark background dramatically.
- Very subtle `border: 1px solid rgba(255,255,255,0.08)` — makes the panel edge visible on dark background.
- The panel is slightly tilted: `transform: perspective(1200px) rotateY(-4deg) rotateX(2deg)` — a subtle 3D tilt adds dimensionality without looking gimmicky. This is optional and should be disabled if it causes reflow jank on scroll.
- Width: fills the right column, approximately 480–520px.

---

## Feature Highlights Section

Sits below the hero, with a `padding-top: 80px padding-bottom: 80px` buffer. Background: same dark `#0f1a17` or slightly lighter `#12201c` to create a visual section break without jarring contrast.

Four callout cards arranged in a 4-column grid (2-column on tablet, stacked 2-up on mobile).

```
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  [icon]              │  │  [icon]              │  │  [icon]              │  │  [icon]              │
│                      │  │                      │  │                      │  │                      │
│  Sync to any device  │  │  Family & team       │  │  Activity history    │  │  Import from         │
│                      │  │  sharing             │  │                      │  │  Google, Apple,      │
│  CardDAV keeps your  │  │                      │  │  See every change,   │  │  Outlook             │
│  contacts live in    │  │  A shared address    │  │  merge, and import   │  │                      │
│  Apple Contacts,     │  │  book for your       │  │  across all your     │  │  One-click import    │
│  Google, and any     │  │  household or small  │  │  contacts, forever.  │  │  from CSV or vCard — │
│  CalDAV client.      │  │  team.               │  │                      │  │  no data left behind.│
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

**Card styling:**
- Background: `rgba(255,255,255,0.04)` — barely-there white fill on the dark background. `border: 1px solid rgba(255,255,255,0.08)`.
- Border-radius: `1rem` (16px).
- Padding: 24px.
- Icon: 28×28px, rendered in a muted green accent `rgba(134,196,160,0.8)` or a simple outline icon in the brand green. Icons should be simple SVG strokes — no filled emoji-style icons.
- Title: `text-white font-semibold text-base`, margin-top 12px.
- Body: `text-white/55 text-sm leading-relaxed`, margin-top 8px.

**Icon suggestions:**
1. Sync to any device → two arrows circling (sync icon)
2. Family & team sharing → two overlapping people (group icon)
3. Activity history → clock with an arrow (history icon)
4. Import from Google/Apple/Outlook → arrow entering a box (import icon)

No CTA buttons on the feature cards — they are informational only. The primary CTAs remain in the hero.

---

## Footer

Minimal. Height: 60px. Background: `rgba(0,0,0,0.3)` over the dark base.

- Left: "© 2026 Kontax" in `text-white/40 text-xs`.
- Right: text links: "Log in", "Register", "Pricing" (with "(coming soon)" in a lighter weight or a `opacity-50` badge). Links in `text-white/50 text-xs hover:text-white/80`.
- A top border: `border-t border-white/10`.

No social media links, no extensive sitemap — keep it minimal in v1.

---

## States

### Logged-In Redirect

If a user is already authenticated and visits `/`, they should be redirected to `/contacts` server-side. The landing page is never shown to authenticated users.

### Loading

The public landing page has no async data — it is fully static. No loading state needed. Aim for a First Contentful Paint under 1.5s.

### Prefers-Reduced-Motion

If the user's OS preference is `prefers-reduced-motion: reduce`:
- The panel tilt transform should be removed (set to `transform: none`).
- Any scroll-triggered fade-in animations should be skipped (elements rendered fully visible from the start).

---

## Mobile Layout (< 768px)

On mobile, the two-column hero collapses to a single column. The product preview moves below the text and CTAs.

```
┌──────────────────────────────┐
│  [Logo]          [Log in]   │  ← compact nav, no "Create account" button
│                              │
│                              │
│  Your contacts,              │
│  synced everywhere.          │
│                              │
│  One address book, always    │
│  up to date across all your  │
│  devices and the people      │
│  you share with.             │
│                              │
│  [  Create free account  ]   │  ← full-width primary CTA
│  [       Log in  →       ]   │  ← full-width secondary CTA
│                              │
│  ┌──────────────────────┐    │
│  │  PRODUCT PREVIEW     │    │  ← shown below CTAs, full-width
│  │  (contacts list)     │    │     no tilt transform on mobile
│  └──────────────────────┘    │
│                              │
│  Sync to any device          │
│  [icon + title + body]       │
│                              │
│  Family & team sharing       │
│  [icon + title + body]       │
│                              │
│  Activity history            │
│  [icon + title + body]       │
│                              │
│  Import from Google/Apple    │
│  [icon + title + body]       │
│                              │
│  © 2026 Kontax · Log in      │
│  Register · Pricing          │
└──────────────────────────────┘
```

- Nav bar: logo on the left, "Log in" ghost button on the right only. "Create account" button is removed from the nav (the hero CTAs are more prominent and a duplicate nav button crowds the bar on small screens).
- Headline: 36–40px on mobile (from 56–64px on desktop). Still two-line.
- CTAs: stacked vertically, full-width.
- Product preview: full-width panel, `border-radius: 1rem`, no perspective tilt. Box shadow reduced: `0 12px 40px rgba(0,0,0,0.35)`.
- Preview panel is cropped at ~300px height (showing ~5–6 contact rows) with a gradient fade at the bottom.
- Feature cards: 1-column stack. Each card full-width, `padding: 20px`.

---

## Animation Guidelines

Subtle entrance animations on scroll — applied to the feature highlight cards only (the hero is visible on load, no animation needed there).

- **Feature cards:** fade-in + translate-y (8px → 0) on scroll-enter. Staggered: card 1 at 0ms, card 2 at 80ms, card 3 at 160ms, card 4 at 240ms. Use `IntersectionObserver`. Duration: 400ms, easing: `cubic-bezier(0.2, 0, 0.1, 1)`.
- **Product preview:** a very subtle scale-in on load: `scale(0.97) → scale(1)`, duration 600ms, easing `ease-out`. This draws the eye to the preview as the page loads.
- No parallax, no continuous animation, no scroll-jacking.

---

## Future Additions

### Pricing Section (Phase 11)

A "Pricing" link in the nav and footer is reserved from day one. When Phase 11 (plans/subscriptions) lands, a third page section between Feature Highlights and Footer will be inserted: a two-column pricing card layout (Free / Pro). No layout changes are needed above it.

### Testimonials / Social Proof

A short testimonial strip can be inserted between the hero and feature highlights sections. Leave a natural section boundary at this junction.

### Animated Demo (Later)

The product preview panel may eventually contain a looping animation: a contact being added, a sync happening, a duplicate being merged. The panel's fixed dimensions and styling will accommodate this without layout change — only the inner content changes.

### Second Language / Localisation (Later)

The hero copy and feature text should be in externalisable strings from the start. Avoid hardcoding copy in deeply nested JSX.
