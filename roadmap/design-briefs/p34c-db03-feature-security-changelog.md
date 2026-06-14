# P34C-DB03 — Feature Pages, Security & Changelog

**Phase:** 34C — Multi-Page Marketing Site Rebuild
**Status:** For designer review
**Gates:** P34C-07 (/features), P34C-12 (/security), P34C-13 (/changelog)

---

## Purpose

Define the visual design for three content-heavy marketing pages:
- `/features` — deep feature breakdown with alternating screenshot sections.
- `/security` — trust and transparency page with icon-led sections.
- `/changelog` — manually maintained release notes in reverse chronological order.

These pages share the global marketing nav and footer (P34C-DB01) but each has
a distinct layout appropriate to its content type. They use the same typography
scale and colour palette as the homepage.

---

## Cross-Page: Shared Nav and Footer Integration

All three pages use `<MarketingNav>` and `<MarketingFooter>` from the
`(marketing)` layout. The nav links should show the active page:
- On `/features`: "Features" nav link is `font-semibold text-[#17352e]`.
- On `/security`: "Security" nav link is highlighted.
- On `/changelog`: "Changelog" nav link is highlighted.

The footer is identical on all pages. The bottom CTA band (`bg-[#17352e]`)
appears on `/features` but may be omitted on `/security` and `/changelog`
(less conversion-focused; footer itself has enough exit paths).

---

## Page 1 — /features

### Section map

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[MARKETING NAV]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[PAGE HERO]
bg-white · py-20 · text-center

[FEATURE SECTION 1 — Search]    bg-white
[FEATURE SECTION 2 — Labels]    bg-[#f4f6f2]
[FEATURE SECTION 3 — Sync]      bg-white
[FEATURE SECTION 4 — Sharing]   bg-[#f4f6f2]
[FEATURE SECTION 5 — Public card] bg-white
[FEATURE SECTION 6 — API]       bg-[#f4f6f2]

[BOTTOM CTA BAND]
bg-[#17352e] · py-24

[MARKETING FOOTER]
```

### Page hero

```
bg-white · py-20 · text-center
max-w-2xl mx-auto px-6

  "Everything your contacts need"
  42px bold #17352e

  "From search to sync to sharing — Kontax keeps your address
   book organised, backed up, and always up to date."
  18px #5c655e mt-4 leading-[1.7]
```

No screenshot in the hero — the feature sections carry the visuals.

### Feature section anatomy

```
[SECTION — alternates bg-white / bg-[#f4f6f2]] · py-20
max-w-6xl mx-auto px-6

Desktop (≥ 1024px):
┌────────────────────────────┬────────────────────────────┐
│                            │                            │
│   Product screenshot       │   Headline (32px bold)     │
│   max-w: 560px             │   #17352e                  │
│   rounded-2xl              │                            │
│   shadow-lg                │   Body (17px #5c655e)      │
│   border border-[#edf0ea] │   leading-[1.7]            │
│                            │   ~3–4 sentences           │
│                            │                            │
│                            │   [Optional: "Learn more"  │
│                            │    → /pricing or /docs     │
│                            │    text-[#4158f4] →]       │
│                            │                            │
└────────────────────────────┴────────────────────────────┘
  Sections 1, 3, 5: screenshot LEFT  / copy RIGHT
  Sections 2, 4, 6: screenshot RIGHT / copy LEFT  (flip)
```

On mobile (`< 1024px`): always stack vertically — copy above, screenshot below.
Never flip the mobile order — it is always copy-then-screenshot.

### Screenshot treatment

The screenshot "card" has:
- `rounded-2xl` (border-radius: 16px).
- `shadow-lg` (medium shadow: `0 10px 40px rgba(0,0,0,0.10)`).
- `border border-[#edf0ea]` (hairline border).
- **No browser chrome mockup** — the screenshot fills a rounded card directly.
  Avoid adding a fake browser address bar; it dates the design and adds visual
  noise. The card shape and shadow are sufficient context.
- Width: `w-full` inside a `flex-1` container (adapts to column layout).
- Aspect ratio: approximately 4:3 for list/desktop views, 9:16 equivalent for
  mobile overlay views.

### Six feature sections

| # | Headline | Screenshot description | Section bg |
|---|---|---|---|
| 1 | "Search that actually works" | Search dropdown open, grouped results visible (name group + email group), match text highlighted | `bg-white` |
| 2 | "Labels that organise, not just tag" | Contacts list with label filter chips at top, 2–3 label badges on contact rows | `bg-[#f4f6f2]` |
| 3 | "One address book, every device" | Sync connections page showing Google, CardDAV, and Outlook accounts with status indicators | `bg-white` |
| 4 | "Share with family or your team" | Contact detail → Sharing tab, showing SharedBookCard with 3 member rows and role badges | `bg-[#f4f6f2]` |
| 5 | "Your public contact card" | The /u/username public page on mobile: photo, name, contact details, "Add to contacts" button | `bg-white` |
| 6 | "A developer API built for automation" | Syntax-highlighted code block (not a screenshot): `curl -H "Authorization: Bearer kt_live_xxx" https://api.getkontax.com/v1/contacts` | `bg-[#f4f6f2]` |

**Section 6 — API**: instead of a product screenshot, render a syntax-
highlighted `<pre>` block inside the image slot. Treat it like a screenshot
card (same border-radius, shadow, border) but with a dark code background:
`bg-[#1d2823] rounded-2xl border border-[#0a1008] shadow-lg`. White or
light-green text inside.

### Section body copy guidance

Each section body is 3–4 sentences (~50–80 words). It should:
1. State the capability plainly.
2. Explain what makes it useful (the user benefit, not the feature list).
3. Optionally: hint at depth or add a "Learn more" link.

Example for Search (approved placeholder):
```
Type a name, phone number, email, company, label, or note — Kontax finds it
instantly. Results are grouped by match type so you see exactly why a contact
appeared. No more scrolling past irrelevant results or wondering if you spelled
the name right.
```

### "Learn more" links

Optional — include on sections where there is a deeper page to link to:
- Section 6 (API): "Read the API docs →" → `/developers`.
- Section 5 (Public card): "See an example →" → `/u/demo`.
- Others: no link by default. Do not link to `/features` from itself.

### Feature section spacings

- Section vertical padding: `py-20` (80px).
- Copy/screenshot gap: `gap-16` (64px).
- Copy max-width: `max-w-[500px]` per column.
- Headline to body gap: `mt-5`.
- Body to CTA gap: `mt-8`.

---

## Page 2 — /security

### Section map

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[MARKETING NAV]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[PAGE HERO]

[SECURITY SECTIONS 1–6]
  — Encryption at rest
  — Encryption in transit
  — Authentication security
  — Sync credential security
  — GDPR and data handling
  — Responsible disclosure

[MARKETING FOOTER]
```

No bottom CTA band on the security page — the purpose is information and trust,
not conversion. The nav's "Get started" button is the conversion path.

### Page hero

```
bg-white · py-20 · max-w-2xl mx-auto px-6 · text-center

  "Security you can trust"
  42px bold #17352e

  "Kontax is built around the principle that your contacts are yours.
   Here's how we keep them safe."
  18px #5c655e mt-4 leading-[1.7]
```

### Security section anatomy

```
max-w-3xl mx-auto px-6

[Section]
  border-b border-[#edf0ea] · py-16 · last:border-none

  ┌────────────────────────────────────────────────────────┐
  │  ┌──────┐   Heading (22px bold #17352e)                │
  │  │ icon │                                              │
  │  │ 22px │   Body text (16px #5c655e line-height 1.8)  │
  │  └──────┘   paragraph 1                               │
  │  48px tile                                            │
  │  bg-[#eef5ef]   paragraph 2 (if applicable)          │
  │  rounded-[12px]                                       │
  │  text-[#17352e]                                       │
  └────────────────────────────────────────────────────────┘
```

The icon tile is `48×48px`, `rounded-[12px]`, `bg-[#eef5ef]`,
`text-[#17352e]`, icon `22px`. It aligns to the top of the text block.

Desktop: icon and text side by side, `gap-6`. On mobile: icon above text.

### Six sections

| # | Icon | Heading | Icon colour |
|---|---|---|---|
| 1 | Lock / Database | "Your data is encrypted at rest" | `#17352e` on `#eef5ef` |
| 2 | ShieldCheck | "TLS-only connections" | same |
| 3 | Key | "Secure by default" (auth) | same |
| 4 | RefreshCw / Cloud | "Sync credentials are treated differently" | same |
| 5 | FileText / Flag | "Your data, your rights" (GDPR) | same |
| 6 | Mail / Bug | "Responsible disclosure" | same |

All icon tiles use the same `bg-[#eef5ef] text-[#17352e]` treatment —
consistent and calm, not alarming.

### Trust signals (optional)

If there are any verifiable trust signals available for launch, add them as
a simple row below the sections:

```
┌──────────────────────────────────────────────────────────┐
│  [🔒] TLS 1.2+    [🛡] HSTS    [⚡] GDPR ready           │
│  pill badges, bg-[#eef5ef] text-[#17352e] 12px font-bold │
└──────────────────────────────────────────────────────────┘
```

Do **not** include "SOC 2", "ISO 27001", or any certification badge unless
the certification is actually complete. Do not claim certifications in progress.

### Body copy length

Each security section: 2–3 paragraphs, ~60–100 words each. The tone should be:
- Factual and specific (name the technology: bcrypt, TLS 1.2, HSTS, TOTP).
- Not defensive ("we take security very seriously…" is a cliché — avoid).
- Written for a technical-enough audience (the Kontax user knows what bcrypt is).

---

## Page 3 — /changelog

### Section map

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[MARKETING NAV]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[PAGE HERO]

[CHANGELOG ENTRIES — reverse chronological]
  entry 1 (most recent)
  entry 2
  entry 3
  entry 4

[MARKETING FOOTER]
```

No bottom CTA band on the changelog — developer-adjacent audience; the footer
link to `/pricing` is sufficient.

### Page hero

```
bg-white · py-16 · max-w-4xl mx-auto px-6

  "What's new in Kontax"    (left-aligned, not centred)
  38px bold #17352e

  "Every update, in order."
  17px #8b938c mt-3
```

Changelog is left-aligned (not centred) — it reads like a document, not a
marketing splash page. This is intentional and different from the other pages.

### Entry layout — desktop (≥ 768px)

Two-column: date left, content right.

```
max-w-4xl mx-auto px-6

┌──────────┬─────────────────────────────────────────────┐
│  date    │                                             │
│ (fixed   │  Version badge + Entry title                │
│  w-40,   │  (20px semibold #1d2823)                    │
│  text-   │                                             │
│  right,  │  [Added]  ← category badge                  │
│  pr-8)   │  • Item one                                 │
│          │  • Item two                                 │
│          │  • Item three                               │
│          │                                             │
│          │  [Improved]                                 │
│          │  • Item                                     │
│          │                                             │
│          │  [Fixed]                                    │
│          │  • Item                                     │
└──────────┴─────────────────────────────────────────────┘
  border-b border-[#edf0ea] · py-14 · last:border-none
```

**Date column:**
- `<time>` element, `text-[14px] font-mono text-[#8b938c]`.
- Format: "20 May 2026".
- `text-right`, `pr-8`.
- Hidden on mobile.

**Version badge:**
```
[Phase 33]
bg-[#f4f6f2] text-[#5c655e] text-[12px] font-semibold
rounded-full px-3 py-1 inline-block mr-3
```

**Entry title:** `text-[20px] font-semibold text-[#1d2823]` inline after badge.

**Date (mobile):** shown above the version badge, `text-[13px] text-[#8b938c]
mb-2`. The left column is hidden.

### Category badges

```
const CATEGORY_STYLES = {
  Added:    { bg: "#eef5ef",  text: "#17352e" },  // green wash
  Improved: { bg: "#edf2ff",  text: "#4158f4" },  // blue wash
  Fixed:    { bg: "#fef3e2",  text: "#8a5f0a" },  // amber wash
  Security: { bg: "#fde8e8",  text: "#b5472f" },  // red wash
};
```

Badge: `text-[11px] font-bold uppercase tracking-[0.1em] rounded-[6px]
px-2 py-1 inline-block mb-2`.

**Category heading + items layout:**

```
[Added]                                    ← category badge
• Item one text at 15px #5c655e           ← list-disc ml-4 mt-1 space-y-1.5
• Item two
• Item three

[Improved]
• Item
```

Gap between category groups: `mt-5 mb-2`.

### Entry separators

`border-b border-[#edf0ea]` on the outer entry container. The `last-of-type`
entry has `border-none`. No horizontal rule between category groups within an
entry — whitespace is sufficient.

### Changelog entry mobile (< 768px)

Single column. Date appears as `text-[13px] text-[#8b938c]` above the version
badge. Entry full-width with `px-6`. The two-column layout collapses entirely.

```
[Mobile entry]
─────────────────────────
20 May 2026               ← 13px muted
[Phase 33] Search experience upgrade  ← badge + title

[Added]
• Item one
• Item two

[Improved]
• Item
─────────────────────────
```

### Spacing

- Entry padding: `py-14` (56px).
- Between category badge and its items: `mt-2`.
- Between category groups: `mt-5`.
- Between entries: the divider provides separation.

---

## Cross-Page Typography and Spacing Spec

Consistent with P34C-DB01, applied to all three pages:

| Element | Size | Weight | Colour |
|---|---|---|---|
| Page H1 | 38–42px | 700 | `#17352e` |
| Section H2 | 22–32px | 700 | `#17352e` |
| Body (features, security) | 16–17px | 400 | `#5c655e` |
| Body (changelog items) | 15px | 400 | `#5c655e` |
| Dates, labels | 13–14px | 400 | `#8b938c` |
| Version badges | 12px | 600 | `#5c655e` on `#f4f6f2` |
| Category badges | 11px | 700 | Category-specific |

Section padding:
- Feature sections: `py-20` (80px) each.
- Security sections: `py-16` (64px) each.
- Changelog entries: `py-14` (56px) each.
- Page heroes: `py-16 to py-20`.

---

## Notes for the Designer

**Features page:**
- The alternating image-left / image-right pattern is classic and works, but
  the screenshots must be high quality. Low-res, cropped awkwardly, or outdated
  screenshots undermine the page more than no screenshots. Coordinate with
  engineering to get clean production screenshots at 1280×800 minimum, cropped
  to the relevant UI area.
- Section 6 (API) is unique — the code block fills the image slot. The dark
  `bg-[#1d2823]` code background against the section's light `bg-[#f4f6f2]`
  creates a nice visual contrast. Consider adding a subtle tab bar or prompt
  indicator to make the code block feel more "terminal-like".
- The bottom CTA band (`bg-[#17352e]`) is a strong close to the page. Keep it.

**Security page:**
- The icon system should be consistent across all 6 sections. Use one icon set
  (Lucide is already in the app) and do not mix styles.
- Do not make this page look alarming. Security pages that over-emphasise
  "protection" with red shields and lock icons create anxiety, not trust. The
  green `#eef5ef` icon tiles and calm prose are deliberate.
- The page max-width is `max-w-3xl` (narrower than other pages). This is
  intentional — security copy is dense and reads better at a narrower measure.

**Changelog page:**
- This is the most "document-like" of the three pages. Resist the urge to add
  decorative elements. The information is the design.
- Left-align the page heading (not centred) — it signals "this is an article,
  not a marketing splash".
- The category badges (`Added / Improved / Fixed`) are the main visual elements.
  They provide scannability — a user can skim for "Fixed" entries at a glance.
- Consider a sticky "Jump to release" sidebar on desktop if the changelog grows
  beyond 6–8 entries. For launch (4 entries), it is not needed.
- The font-mono date column on desktop is a subtle developer-friendly touch.
  Keep it — it reinforces the technical credibility of the page.
