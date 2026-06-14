# P34C-DB01 — Marketing Site IA, Navigation & Homepage

**Phase:** 34C — Multi-Page Marketing Site Rebuild
**Status:** For designer review
**Gates:** P34C-01 (nav), P34C-02 (footer), P34C-03 (hero), P34C-04 (tiles),
           P34C-05 (social proof), P34C-06 (mobile QA)

---

## Purpose

Define the information architecture of the full marketing site, the global
navigation component, and the complete homepage layout from scroll-top to
footer. This brief is the visual and structural foundation for all Phase 34C
marketing pages.

The homepage must communicate in under 5 seconds:
1. What Kontax is.
2. What makes it different from iCloud Contacts / Google Contacts / other apps.
3. How to get started.

The overall tone is **calm confidence** — not aggressive SaaS, not corporate.
Personal-first, privacy-respecting, competently made.

---

## Information Architecture

### Sitemap

```
getkontax.com
├── /                    (homepage)
├── /features            (full feature breakdown)
├── /pricing             (plans + matrix + FAQ)
├── /security            (encryption, GDPR, 2FA)
├── /changelog           (release notes)
├── /about               (mission, team)
├── /contact             (support form)
├── /privacy             (privacy policy)
├── /terms               (terms of service)
├── /developers          (API docs — exists from Phase 29)
├── /help                (help centre — exists)
├── /login
├── /register
└── /u/[username]        (public contact card — exists from Phase 30)
```

Navigation surfaces exactly 4 pages: Features, Pricing, Security, Changelog.
These are the 4 pages most relevant to someone evaluating Kontax. The others
are discoverable via the footer.

---

## Navigation Bar

### Desktop (≥ 768px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  [K] Kontax    Features · Pricing · Security · Changelog    Log in  [Get started]  │
└──────────────────────────────────────────────────────────────────────┘
  ↑ sticky, bg-white, h-16, border-b border-[#edf0ea] appears on scroll
```

**Logo area (left)**
- K mark SVG (24×24) + "Kontax" wordmark.
- `text-[18px] font-bold text-[#17352e]`.
- Letter-spacing: `tracking-[-0.01em]`.
- Links to `/`.

**Nav links (centre)**
- `Features · Pricing · Security · Changelog`.
- `text-[15px] text-[#5c655e]`.
- Active page: `font-semibold text-[#17352e]`.
- Gaps: `gap-8` (32px).
- No underline by default; `hover:text-[#17352e]` transition.

**Right side (auth CTAs)**
- `Log in` — `text-[15px] text-[#5c655e] hover:text-[#1d2823]`.
- `Get started` — pill button: `bg-[#17352e] text-white rounded-[10px]
  px-5 h-9 text-[15px] font-semibold hover:bg-[#0f2419]`.
- Gap between them: 16px.

**Scroll behaviour**
- At `scrollY = 0`: no border, no shadow.
- At `scrollY > 0`: `border-b border-[#edf0ea]` + `shadow-[0_1px_4px_rgba(0,0,0,0.06)]`.
- Transition: instant (no animation on shadow appearance).

### Mobile (< 768px)

```
┌──────────────────────────────────────┐
│  [K] Kontax              [≡] (24px)  │  h-14, bg-white, border-b
└──────────────────────────────────────┘
```

Tap hamburger (≡) → full-screen overlay:

```
┌──────────────────────────────────────┐
│  [K] Kontax              [×] (close) │  bg-white, fixed inset-0, z-[60]
├──────────────────────────────────────┤
│                                      │
│  Features                   (20px)   │  border-b border-[#edf0ea], py-5 px-6
│  Pricing                    (20px)   │
│  Security                   (20px)   │
│  Changelog                  (20px)   │
│                                      │
│  ────────────────────────────────    │
│                                      │
│  Log in                     (16px)   │  py-4 text-[#5c655e]
│  [Get started — full-width button]   │  bg-[#17352e] text-white h-12 rounded-[12px]
│                                      │
└──────────────────────────────────────┘
```

- Body scroll locked when overlay is open.
- Nav links: `font-semibold text-[#1d2823]`.
- Close button: top-right, 44×44px tap target.

---

## Homepage Layout

### Full scroll wireframe

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[MARKETING NAV — sticky]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1 — HERO]
bg-white · pt-24 pb-20

[2 — FEATURE TILES]
bg-[#f4f6f2] · py-24

[3 — SOCIAL PROOF / STAT BAR]
bg-white · py-20

[4 — BOTTOM CTA BAND]
bg-[#17352e] · py-24

[MARKETING FOOTER]
bg-[#17352e]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Section 1 — Hero

**Desktop (≥ 1024px) — two-column**

```
max-w-6xl mx-auto px-6
┌──────────────────────────┬──────────────────────────────┐
│                          │                              │
│  [Eyebrow label]         │                              │
│  optional small text     │   Product screenshot         │
│                          │   max-w: 560px               │
│  Headline                │   rounded-2xl                │
│  48–56px bold            │   shadow-xl                  │
│  #17352e                 │   border border-[#edf0ea]    │
│  2–3 lines               │                              │
│                          │   (contacts list, search     │
│  Sub-copy                │    dropdown open, labels     │
│  18px, #5c655e           │    visible on rows)          │
│  max 2 lines             │                              │
│                          │                              │
│  [Get started free]  ←   │                              │
│  [See how it works ↓]    │                              │
│                          │                              │
└──────────────────────────┴──────────────────────────────┘
```

**Headline hierarchy**
- Font: Geist, 52px desktop / 36px mobile.
- Weight: 700.
- Line height: 1.1.
- Colour: `#17352e`.
- Tracking: `−0.02em`.
- Max 3 lines. Should not wrap awkwardly — confirm with real copy.
- Approved placeholder (to be replaced): "Your contacts. Organised, synced,
  and always with you."

**Sub-copy**
- 18px, `#5c655e`, line-height 1.6, max-width 460px.
- Maximum 2 sentences / 30 words.
- Approved placeholder: "Kontax keeps your address book in sync across every
  device — without giving your data to a platform."

**CTA buttons**
- Primary: `bg-[#17352e] text-white rounded-[12px] h-12 px-8 text-[16px]
  font-semibold` — "Get started free".
- Secondary: `border border-[#d8ddd6] text-[#1d2823] rounded-[12px] h-12 px-8
  text-[16px] font-medium hover:bg-[#f4f6f2]` — "See how it works".
- `flex gap-4` wrapper, `flex-col sm:flex-row`.
- On mobile: both buttons full-width.

**Product screenshot**
- Real screenshot of the contacts list: search dropdown open (showing grouped
  results), at least 2 label chips visible, ≥ 5 contact rows.
- Rendered as `<Image priority>` (LCP candidate).
- File: `public/images/marketing/hero-screenshot.webp`.
- Subtle background radial gradient behind screenshot: `radial-gradient(ellipse
  at 65% 50%, #eef5ef 0%, transparent 55%)`.
- On mobile: screenshot appears below the copy at full width.

---

### Section 2 — Feature Tiles

**Heading area (centred)**
```
"Everything your contacts need"
36px bold #17352e

"From first sync to last export, Kontax handles it."
18px #5c655e
```

**Tile grid**
```
bg-[#f4f6f2] · py-24

max-w-6xl mx-auto px-6

  grid-cols-3 gap-6  (desktop)
  grid-cols-2        (tablet 640–1023px)
  grid-cols-1        (mobile)

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ [icon tile]  │  │ [icon tile]  │  │ [icon tile]  │
│              │  │              │  │              │
│ Headline     │  │ Headline     │  │ Headline     │
│              │  │              │  │              │
│ Description  │  │ Description  │  │ Description  │
│ (2 lines)    │  │ (2 lines)    │  │ (2 lines)    │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Single tile anatomy**
```
┌──────────────────────────────────────┐
│  p-8                                 │
│  ┌──────┐                            │
│  │ icon │  48px tile bg-[#eef5ef]    │
│  │ 24px │  rounded-[12px]            │
│  └──────┘  text-[#17352e]            │
│                                      │
│  Headline — 17px semibold #1d2823    │
│  (1–2 lines, no truncation)          │
│                                      │
│  Description — 14.5px #5c655e        │
│  line-height 1.6, 2 sentences        │
└──────────────────────────────────────┘
```
Card: `bg-white rounded-[16px] border border-[#d8ddd6]`.

**Six tiles (copy placeholder — confirm with brand)**

| # | Icon | Headline | Description summary |
|---|---|---|---|
| 1 | Search | "Search that actually works" | Grouped results, match highlighting |
| 2 | Tag | "Labels that organise" | Registry, filter, sync |
| 3 | Sync | "Sync everywhere" | CardDAV, Google, Outlook, iCloud |
| 4 | Users | "Share with family or team" | Shared books, live edits |
| 5 | ID card | "Your public card" | /u/username, one-tap vCard |
| 6 | Code | "Developer API" | api.getkontax.com, REST |

---

### Section 3 — Social Proof / Stat Bar

```
bg-white · py-20

"Trusted by people who care about their contacts."
30px bold #17352e, centred

  ┌──────────────┬──────────────┬──────────────┐
  │   10,000+    │      3       │   London     │
  │ contacts     │  sync        │   built      │
  │ managed      │  providers   │   with care  │
  └──────────────┴──────────────┴──────────────┘

Stat value: 48px bold #17352e
Stat label: 15px #8b938c, mt-2

Dividers: border-r border-[#edf0ea] between blocks
```

**Note on accuracy**: the `10,000+` figure must be verified before launch.
If the number is not accurate, use a softer copy (e.g. "Thousands of contacts
managed" or replace with a different stat). The designer should flag if a
testimonial treatment is preferred once real quotes are available.

Optional: if testimonials become available, replace the stat bar with 3
testimonial cards in a `grid-cols-3` layout on desktop. Card design: light
`#f4f6f2` bg, quote text in 16px italic, author name + role below.

---

### Section 4 — Bottom CTA Band

```
bg-[#17352e] · py-24 · text-center

  "Ready to get started?"
  36px bold white

  "Free plan, no credit card required."
  17px white/60, mt-4

  [Get started free →]
  bg-white text-[#17352e] rounded-[12px] h-12 px-10 text-[16px] font-semibold mt-10
  hover: bg-[#eef5ef]
```

This section immediately precedes the footer. The `bg-[#17352e]` background
bleeds into the footer, which is also `bg-[#17352e]` — visually they merge.
Add a subtle divider between them: `border-t border-white/10`.

---

## Footer Layout

See P34C-DB01 implementation ticket P34C-02 for the full footer spec.
In summary:
- `bg-[#17352e]` continuing from the CTA band.
- Logo + tagline at top.
- Three columns: Product, Company, Legal.
- Bottom bar: © + social icons.

---

## Visual Direction

### Marketing palette (differs from app)

| Token | Value | Usage |
|---|---|---|
| Page background | `white` | Default section bg |
| Alternate section | `#f4f6f2` | Feature tiles, stat bar bg |
| Brand heading | `#17352e` | H1, H2, section headings |
| Body text | `#5c655e` | Sub-copy, descriptions |
| Muted text | `#8b938c` | Labels, stat labels |
| CTA / accent | `#4158f4` | Text links |
| Primary button | `#17352e` | Get started CTA |
| Hairline | `#edf0ea` | Dividers, card borders |
| Card border | `#d8ddd6` | Feature tile borders |

### Typography scale (marketing, larger than app)

| Use | Size | Weight | Line-height |
|---|---|---|---|
| Hero headline | 52px (mobile: 36px) | 700 | 1.1 |
| Page heading (H1) | 42px | 700 | 1.15 |
| Section heading (H2) | 32–36px | 700 | 1.2 |
| Sub-section heading (H3) | 22–24px | 600 | 1.3 |
| Body copy | 17–18px | 400 | 1.7–1.8 |
| Tile description | 14.5px | 400 | 1.6 |
| Label / eyebrow | 11–12px | 700 | — |

Font: Geist (already loaded in the app). Use the same variable font.

### What to avoid

- **Do not make it look like a generic SaaS template.** No stock photography,
  no team photos in hero sections, no "10x your productivity" language.
- **Kontax is personal-first.** The copy and design should feel like a
  thoughtful tool built by a small team — not a VC-funded enterprise product.
- **No dark theme on marketing pages.** The app has no dark mode; the
  marketing site should be consistently light.
- **No excessive animation.** Subtle hover states on cards and buttons are fine.
  No scroll-triggered animations, parallax effects, or number counters.
- **No fake social proof.** If testimonials aren't available, use honest stats.

---

## Mobile Behaviour (per section)

| Section | Mobile treatment |
|---|---|
| Nav | Hamburger → full-screen overlay |
| Hero | Text stacks above screenshot; headline 36px; CTAs full-width |
| Feature tiles | 1 column; full-width tiles |
| Social proof | Stat blocks stack vertically; no dividers |
| Bottom CTA | Button full-width; headline wraps to 2 lines |
| Footer | Columns stack; bottom bar wraps |

---

## Notes for the Designer

- The hero product screenshot is the most important visual asset. It must be
  a real screenshot — not an illustration or mockup. Coordinate with engineering
  to get a clean screenshot of the contacts list with search + labels visible.
- The K mark logo needs both a dark version (`#17352e` on white) for the nav,
  and a light version (white on `#17352e`) for the footer and bottom CTA band.
  Ensure both versions are in the asset library.
- The feature tiles section is `bg-[#f4f6f2]` — this creates a natural
  visual break from the white hero without being jarring. The alternating
  white/light-grey pattern continues across all marketing pages.
- The bottom CTA band deliberately matches the footer background to create a
  unified dark "footer zone" at the bottom of the page. This is intentional —
  do not add a gap or divider between the CTA band and footer.
- For the social proof section: if the team secures real testimonials before
  launch, the three-stat bar can be replaced with a three-quote card layout.
  Both designs are described above — provide both to the developer if possible.
- Spacing unit: use multiples of 4px (standard Tailwind). All section padding
  is at 16px granularity (e.g. `py-20` = 80px, `py-24` = 96px).
