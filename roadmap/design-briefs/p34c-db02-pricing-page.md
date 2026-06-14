# P34C-DB02 — Pricing Page & Feature Matrix

**Phase:** 34C — Multi-Page Marketing Site Rebuild
**Status:** For designer review
**Gates:** P34C-08 (plan cards), P34C-09 (billing toggle), P34C-10 (matrix),
           P34C-11 (FAQ)

---

## Purpose

Define the complete visual design of `/pricing` — the plan cards, billing
toggle, full feature comparison matrix, and FAQ accordion. This page is the
primary revenue driver for self-serve signups. Every design decision should
reduce friction and increase confidence.

**Design principles for the pricing page:**
- One clear recommendation (Pro, "Most popular") without being pushy.
- Prices are honest and complete — no hidden fees in the copy.
- The feature matrix answers "what do I get?" definitively.
- The FAQ removes the last hesitations before signing up.

---

## Section Map

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[MARKETING NAV]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1 — PAGE HERO]
bg-white · py-20

[2 — BILLING TOGGLE]
bg-white · centred above cards

[3 — PLAN CARDS]
bg-white · max-w-6xl

[4 — FEATURE MATRIX]
bg-[#f4f6f2] · py-20

[5 — FAQ ACCORDION]
bg-white · py-20 · max-w-3xl centred

[6 — BOTTOM CTA BAND]
bg-[#17352e] · py-20

[MARKETING FOOTER]
```

---

## Section 1 — Page Hero

```
bg-white · py-20 · text-center

  "Simple, honest pricing"
  42px bold #17352e

  "Start free. Upgrade when you're ready."
  18px #5c655e, mt-4
```

No hero image or screenshot. Clean and direct.

---

## Section 2 — Billing Toggle

```
centred, below hero, above plan cards · mb-10

  ┌─────────────────────────────────────┐
  │   Monthly     │    Annually         │
  │               │    [Save up to 20%] │
  └─────────────────────────────────────┘
  bg-[#f4f6f2] border border-[#d8ddd6] rounded-[12px] p-1
```

**Active segment:** `bg-[#17352e] text-white rounded-[9px] shadow-sm`.
**Inactive segment:** `text-[#5c655e]`.
**"Save up to 20%" badge:** `bg-[#4158f4] text-white rounded-full px-2 py-0.5
text-[11px] font-bold` — inline inside the "Annually" button.

The toggle is full-width at max ~320px, centred with `mx-auto`.

---

## Section 3 — Plan Cards

### Desktop (≥ 1024px) — 4 columns

```
max-w-6xl mx-auto px-6

┌─────────────┐  ┌─────────────┐  ┌═════════════╗  ┌─────────────┐
│    Free     │  │     Pro     │  ║   Family    ║  │    Teams    │
│             │  │             │  ║             ║  │             │
│  Free       │  │  £5 / mo   │  ║  £8 / mo   ║  │  £12 / mo   │
│             │  │             │  ║             ║  │             │
│  For        │  │  For power  │  ║  For        ║  │  For        │
│  personal   │  │  users      │  ║  households ║  │  orgs       │
│  use        │  │             │  ║             ║  │             │
│             │  │             │  ║ [Most       ║  │             │
│             │  │             │  ║  popular]   ║  │             │
│             │  │             │  ║             ║  │             │
│  ───────    │  │  ───────    │  ║  ───────    ║  │  ───────    │
│  ✓ Feature  │  │  ✓ Feature  │  ║  ✓ Feature  ║  │  ✓ Feature  │
│  ✓ Feature  │  │  ✓ Feature  │  ║  ✓ Feature  ║  │  ✓ Feature  │
│             │  │             │  ║             ║  │             │
│ [CTA btn]   │  │ [CTA btn]   │  ║ [CTA btn]  ║  │ [CTA btn]   │
└─────────────┘  └─────────────┘  └═════════════╝  └─────────────┘
```

The **Family card is the recommended plan** and carries the "Most popular" badge.

### Single plan card anatomy

```
┌──────────────────────────────────────┐  ← white card
│  Plan name (20px semibold #1d2823)   │     rounded-[16px]
│  Tagline (13px muted #8b938c)        │     border border-[#d8ddd6]
│                                      │     p-8
│  ┌─── Price block ───────────────┐   │
│  │  £5          /mo              │   │
│  │  (40px bold  (15px muted      │   │
│  │   #17352e)    mt-1 aligned)   │   │
│  │  billed monthly               │   │  ← 13px muted, sub-label
│  └───────────────────────────────┘   │
│                                      │
│  [CTA Button — full width]           │
│  h-11 rounded-[10px] text-[15px]     │
│  font-semibold                       │
│                                      │
│  ─────────────────────────────────   │  ← divider border-[#edf0ea]
│                                      │
│  ✓  Feature one                      │  ← 14px #1d2823, Check icon #17352e
│  ✓  Feature two                      │
│  ✓  Feature three                    │
│  ✓  …                                │
│                                      │
└──────────────────────────────────────┘
```

### Free plan card

- Price slot: "Free" in `40px bold #17352e`. No `/mo` suffix. No sub-label.
- CTA: `bg-[#17352e] text-white` — "Get started free".

### Paid plan cards (non-recommended)

- CTA: `border border-[#d8ddd6] text-[#1d2823] bg-white hover:bg-[#f4f6f2]`.
- Sub-label: "billed monthly" / "billed annually · save X%".

### Recommended plan card (Family)

```
┌══════════════════════════════════════╗  ← border-2 border-[#17352e]
│                           [Most      ║  ← position: absolute, top-4, right-4
│                           popular]   ║     bg-[#17352e] text-white
│                           badge      ║     rounded-full px-3 py-1 text-[11px]
│                                      ║     font-bold
│  (same anatomy as other cards)       ║
│                                      ║
│  [CTA Button — bg-[#17352e] filled]  ║  ← green filled for recommended
║                                      ║
└══════════════════════════════════════╝
```

### Billing toggle → price update

When "Annually" is selected:
- Price slot: `£4/mo` (annual ÷ 12, rounded).
- Sub-label: "billed annually · save 20%".
- A green badge appears inline: `Save 20%` — `bg-[#eef5ef] text-[#17352e]
  rounded-full px-2 py-0.5 text-[11px] font-bold`.

### Plan feature lists (from pricing-data.ts)

| Plan | Key features shown on card (abbreviated) |
|---|---|
| Free | 100 contacts, labels + search, 1 CardDAV account, public card, export |
| Pro | Unlimited contacts, unlimited CardDAV, Google + Outlook, sharing, API |
| Family | Everything in Pro + family shared book, up to 6 members |
| Teams | Everything in Pro + team book, unlimited members, roles, audit log |

### Mobile (< 1024px)

- 1 column stack: Free → Pro → Family → Teams.
- Each card full width.
- Recommended card gets extra margin-top or a horizontal rule above it to
  visually distinguish in the stack.

---

## Section 4 — Feature Comparison Matrix

### Desktop

```
bg-[#f4f6f2] · py-20

"Compare all features"
28px bold #17352e, mb-8

┌───────────────────────────────────────────────────────────────┐
│  Feature              │  Free   │   Pro   │ Family  │  Teams  │
│  (sticky header row)  │         │         │         │         │
├───────────────────────┼─────────┼─────────┼─────────┼─────────┤
│  CORE                  ← category header — bg-[#edf0ea], col-span-5  │
├───────────────────────┼─────────┼─────────┼─────────┼─────────┤
│  Contacts             │  100    │  Unltd  │  Unltd  │  Unltd  │
│  Advanced search      │   ✓     │   ✓     │   ✓     │   ✓     │
│  Labels               │   ✓     │   ✓     │   ✓     │   ✓     │
│  Import               │   ✓     │   ✓     │   ✓     │   ✓     │
│  Export (GDPR)        │   ✓     │   ✓     │   ✓     │   ✓     │
│  Activity history     │ 30 days │  Unltd  │  Unltd  │  Unltd  │
├───────────────────────┼─────────┼─────────┼─────────┼─────────┤
│  SYNC                  ← category                               │
├───────────────────────┼─────────┼─────────┼─────────┼─────────┤
│  CardDAV              │1 account│  Unltd  │  Unltd  │  Unltd  │
│  Google Contacts      │   —     │   ✓     │   ✓     │   ✓     │
│  Outlook              │   —     │   ✓     │   ✓     │   ✓     │
│  iCloud               │ CardDAV │ CardDAV │ CardDAV │ CardDAV │
│  …                    │         │         │         │         │
└───────────────────────┴─────────┴─────────┴─────────┴─────────┘
```

**Table header row (sticky)**
- `position: sticky; top: 64px` (below nav).
- `bg-[#f4f6f2]` so it blends with the section bg.
- Column headers: `text-[13px] font-semibold text-[#1d2823] py-3 px-4`.
- Feature column header has no plan name.

**Category rows**
- `<tr>` spanning all 5 columns.
- `bg-[#edf0ea]`, `text-[11px] font-bold uppercase tracking-[0.1em] text-[#8b938c]`.
- `py-2 px-4`.

**Data rows**
- Alternating: `bg-white` / `bg-[#f4f6f2]/40`.
- Row height: 44px.
- Feature name: `text-[14px] text-[#1d2823]`, `px-4`.
- Plan cells: centred, `px-4`.
  - `✓` (true): `Check` icon 18px, `text-[#17352e]`.
  - `—` (false): `text-[#8b938c]`.
  - String values (e.g. "100", "1 account", "30 days"): `text-[14px] text-[#1d2823]`.

**Feature column width:** `min-w-[200px]`.
**Plan column widths:** `min-w-[100px]` each, centred.

### Mobile (< 768px)

Wrap the table in `overflow-x-auto` container. Add a fade-gradient on the right
edge (`after: pseudo-element`) to indicate horizontal scroll:

```
position: relative;
overflow-x: auto;
```

```css
.matrix-wrapper::after {
  content: '';
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 40px;
  background: linear-gradient(to right, transparent, #f4f6f2);
  pointer-events: none;
}
```

The table itself is unchanged — it simply scrolls horizontally.

---

## Section 5 — FAQ Accordion

```
bg-white · py-20 · max-w-3xl mx-auto px-6

"Frequently asked questions"
28px bold #17352e, mb-8, text-center

┌─────────────────────────────────────────────┐
│  Can I try Kontax before I buy?          [+]  │  border-b border-[#edf0ea]
│  What happens to my contacts if I …      [+]  │  py-5 px-6
│  Can I cancel anytime?                   [+]  │  text-[15px] semibold #1d2823
│  Is my data safe?                        [+]  │
│  Do you offer refunds?                   [+]  │
│  What payment methods do you accept?     [+]  │
│  Is there a family discount?             [+]  │
│  Can I use the API on the Free plan?     [+]  │
└─────────────────────────────────────────────┘
  border border-[#d8ddd6] rounded-[14px] overflow-hidden
```

**Expanded item:**
```
┌─────────────────────────────────────────────┐
│  Can I try Kontax before I buy?          [−]  │
│  ─────────────────────────────────────────   │
│  Yes — the Free plan is free forever …       │
│  text-[14.5px] #5c655e line-height 1.7       │
│  px-6 pb-5                                   │
└─────────────────────────────────────────────┘
```

- Only one item open at a time.
- `+` / `−` symbols, `text-[#8b938c]`, right-aligned.
- No animation required for launch.

**"Still have questions?" footer below accordion:**
```
mt-8 text-center text-[14px] text-[#8b938c]
"Still have questions? Get in touch."
"Get in touch" → link text-[#4158f4] hover:underline → /contact
```

---

## Section 6 — Bottom CTA Band

Same as homepage (DB01):
```
bg-[#17352e] · py-20 · text-center
"Ready to get started?" — 36px bold white
"Free plan, no credit card required." — 17px white/60
[Get started free →] — bg-white text-[#17352e] button
```

---

## States

### CTA buttons per plan

| State | Styling |
|---|---|
| Default (non-recommended) | `border border-[#d8ddd6] text-[#1d2823] bg-white` |
| Recommended plan | `bg-[#17352e] text-white` (always filled) |
| Free plan | `bg-[#17352e] text-white` (same as recommended) |
| Current plan (if logged in) | `bg-[#f4f6f2] text-[#8b938c] cursor-default` (grayed) |

For the marketing page (unauthenticated), use Default or Recommended states only.
The "current plan" state is only relevant if the marketing page has auth awareness
(out of scope for Phase 34C).

### Billing toggle states

| State | Visual |
|---|---|
| Monthly (default) | Monthly segment has green bg; prices show monthly |
| Annual | Annual segment has green bg; prices update; Save X% badges appear |

### Price display during toggle

```
Monthly:  £5      /mo
          "billed monthly"

Annual:   £4      /mo   [Save 20%]
          "billed annually"
```

The number change is instant (no counter animation).

---

## Spacing and Typography Spec

| Element | Size | Weight | Colour |
|---|---|---|---|
| Page heading | 42px | 700 | `#17352e` |
| Plan name | 20px | 600 | `#1d2823` |
| Plan tagline | 13px | 400 | `#8b938c` |
| Price value | 40px | 700 | `#17352e` |
| Price per-month label | 15px | 400 | `#8b938c` |
| Price sub-label | 13px | 400 | `#8b938c` |
| Feature list items | 14px | 400 | `#1d2823` |
| CTA button | 15px | 600 | — |
| Section heading (matrix/FAQ) | 28px | 700 | `#17352e` |
| Table feature name | 14px | 400 | `#1d2823` |
| Category row | 11px | 700 | `#8b938c` |
| FAQ question | 15px | 600 | `#1d2823` |
| FAQ answer | 14.5px | 400 | `#5c655e` |

Section padding: `py-20` (80px) standard. Plan cards section: `py-16` (64px).

---

## Notes for the Designer

- The pricing page is the conversion bottleneck — every element should reduce
  doubt, not add noise. Four plan cards is already on the edge of too many
  choices; keep the cards visually calm.
- The "Most popular" badge on the recommended plan must be the single strongest
  visual accent on the card grid. Make it clear but not garish — the brand green
  badge on a border-highlighted card is the right level.
- The feature matrix is dense by nature. Use row striping (alternating white /
  `#f4f6f2`) and generous row height (44px) to keep it scannable. Category
  headers in `#edf0ea` create visible structure without overwhelming.
- The billing toggle should feel solid and native — not like a web widget. The
  segmented control pattern from the app UI is the reference.
- On mobile, the plan cards stack. Decide whether to show the recommended card
  first or in position order (2nd). Showing it first on mobile improves
  visibility but breaks the logical Free → Pro → Family → Teams order. Provide
  both options and let the team decide based on testing.
- The FAQ section max-width (`max-w-3xl`) keeps it comfortable to read at full
  desktop width. Do not stretch it full-width.
