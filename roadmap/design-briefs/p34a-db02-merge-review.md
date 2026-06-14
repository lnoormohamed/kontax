# P34A-DB02 — Merge Review UX (Smarter Duplicates)

**Routes:**
- `/?tab=duplicates` — the duplicate suggestion list (cards with new P34A enhancements)
- `/merge-suggestions/[id]` — the full review page (existing, see brief 09)
- Contact detail ··· menu → "Merge with another contact" (new entry point)

**Priority:** P1 — duplicate management is a primary quality-of-life feature.
Confident, fast triage + reliable dismissals are table-stakes before launch.

**Status: SPECCING (2026-06-14).** This brief covers **only the new P34A
enhancements**. The base merge review page is fully specified in
**09-merge-duplicates.md** — do not re-design what is already built.

> **Design language:** locked Kontax system — page bg `#f4f6f2`, white cards,
> hairline `#d8ddd6` / `#edf0ea`, ink `#1d2823`, secondary `#5c655e`, muted
> `#8b938c`, brand green `#17352e`, blue `#4158f4`, amber `#bf8526`, red
> `#b5472f`. Diff highlight `#fff0bf`. Geist variable. No dark theme.

---

## Purpose

The existing duplicate list shows suggestion cards with a confidence badge and
a score, but provides no inline context about *why* two contacts were flagged
or how their fields actually differ. The result: users either click into every
card (slow) or accept/dismiss them blindly (risky). These enhancements close
that gap:

1. **Match reason chips** — immediately visible "Same email", "Same phone",
   "Similar name" signals on the card.
2. **Side-by-side comparison** — inline expandable field table; no page nav
   needed to compare.
3. **Reliable dismissal** — "Not a duplicate" persists across refresh runs.
4. **Updated confidence tiers** — HIGH/MEDIUM thresholds refined with smarter
   scoring (P34A-06).
5. **Manual merge entry** — ··· menu on contact detail as an alternative to
   waiting for the suggestion engine.

---

## Component 1: Duplicate Card in the List

### Collapsed (default) state

```
┌─────────────────────────────────────────────────────────────────┐
│  [HIGH]                                                Score 175 │
│                                                                  │
│  [JA]  John Appleseed                 [JA]  Jon Appleseed       │
│        j@x.com · +44 7700 900111            j@x.com             │
│                                                                  │
│  [Same email]  [Same phone]  [Same name]                        │
│                                                                  │
│  [Compare fields ↓]          [Review →]    [Not a duplicate]    │
└─────────────────────────────────────────────────────────────────┘
```

**Layout:** white card, `rounded-[14px] border border-[#d8ddd6]`, `p-4`,
full-width in the duplicates list column.

**Score + confidence row** (top):
- Confidence pill (left): HIGH = green wash `#eef5ef / #17352e`; MEDIUM =
  amber wash `#f6edd9 / #7a5a1a`. Both are `h-[22px] rounded-[6px] px-2
  text-[11.5px] font-bold`. (LOW is never surfaced.)
- Score pill (right): neutral white `bg-white border border-[#e9ece7]
  text-[#5c655e]`, same height. "Score 175".

**Contact pair** (middle): two mini-contact blocks side by side (desktop) or
stacked (mobile). Each block:
- 36px avatar (tinted initial, same palette as DB01).
- Name: 14px semibold ink.
- Secondary: 12px muted — email or phone (first available).
- Max width per block: 44% of card width (leaves gap for divider).

**Signal chips row:** horizontally scrollable on mobile, wrapping on desktop.
Chip style: `h-[20px] rounded-[5px] px-2 text-[11px] font-medium
bg-[#f2f4f0] text-[#5c655e]`. Max 3 chips. If no signals derivable, row
is omitted.

**Action row** (bottom): three items, flex, `justify-between`:
- "Compare fields ↓" — text link, 12.5px `text-[#4158f4]`. Expands the
  comparison panel.
- "Review →" — outlined button, 13px semibold, `border border-[#d8ddd6]
  rounded-[9px] px-3 py-1.5`. Navigates to `/merge-suggestions/[id]`.
- "Not a duplicate" — ghost button, 13px `text-[#b5472f]`. Triggers
  optimistic dismiss (P34A-05).

On mobile, the action row stacks: "Compare fields" and "Review →" on one
line; "Not a duplicate" below as a less prominent text link.

---

## Component 2: Expanded Comparison Panel

Triggered by "Compare fields ↓". The card expands vertically. The toggle
becomes "Compare fields ↑".

### Desktop (≥ 768px) — two-column table

```
┌─────────────────────────────────────────────────────────────────┐
│  [HIGH]                                                Score 175 │
│                                                                  │
│  [JA]  John Appleseed                 [JA]  Jon Appleseed       │
│        j@x.com · +44 7700 900111            j@x.com             │
│                                                                  │
│  [Same email]  [Same phone]  [Same name]                        │
│  ─────────────────────────────────────────────────────────────  │
│  Field        │ John Appleseed            │ Jon Appleseed       │
│  ─────────────┼───────────────────────────┼────────────────     │
│  Name         │ John Appleseed            │ Jon Appleseed       │  ← #fff0bf
│  Email        │ j@x.com                   │ j@x.com             │  ← muted
│  Phone        │ +44 7700 900111           │ 07700 900111        │  ← #fff0bf
│               │   (same number)           │                     │
│  Company      │ —                         │ Acme Corp           │  ← #fff0bf
│  Notes        │ Met at HN conf…           │ —                   │  ← #fff0bf
│  ─────────────────────────────────────────────────────────────  │
│  [Compare fields ↑]          [Review →]    [Not a duplicate]    │
└─────────────────────────────────────────────────────────────────┘
```

**Table spec:**
- Table header row: `12px font-semibold text-[#8b938c]`, `border-b
  border-[#edf0ea]`, `py-1.5`.
- Data rows: `12.5px`, `py-1.5`, `border-b border-[#f2f4f0] last:border-b-0`.
- Differing row: full-row `background: #fff0bf` (light amber/yellow).
  Text colour stays `#1d2823`.
- Matching row: text `#8b938c` (muted).
- Null-on-both-sides rows: hidden entirely.
- "Field" column: `w-[80px] pr-3 text-[#8b938c]`.
- Phone: if the normalised digit keys match but display strings differ, show
  a "(same number)" note in 11px muted beneath Contact A's value.
- Notes: truncate to 80 chars with "…".

**Transition:** `max-height` animation (0 → auto via JS measurement),
`duration-200`, `ease-out`. Avoid layout shift — measure the natural height
before animating.

### Mobile (< 768px) — stacked definition list

```
┌─────────────────────────────────────────┐
│  Name          ← differs (amber bg)     │
│  ┌──────────────────────────────────┐   │
│  │  John Appleseed  (Contact A)     │   │
│  │  Jon Appleseed   (Contact B)     │   │
│  └──────────────────────────────────┘   │
│  Email         ← matches (muted)        │
│  ┌──────────────────────────────────┐   │
│  │  j@x.com                        │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

- Field name row: 11px uppercase semibold `#8b938c`, `py-1`.
- Each contact's value on its own line, 13px.
- Matching fields: single value row (no duplication needed), muted `#8b938c`.
- Differing fields: both values rendered, `background: #fff0bf` on the
  container block.

---

## Component 3: "Not a Duplicate" Dismiss

### Button placement

On the duplicate list card (action row, see Component 1). The label is "Not
a duplicate" — short, declarative. No icon. Text colour `#b5472f` (red tone,
mild — this is a permanent action but not a destructive one for data).

Not a full button with border — it reads as a less-weighted option next to
"Review →". This asymmetry guides users toward reviewing when unsure and
dismissing only when confident.

### Optimistic removal animation

On click:
1. Set the card state to `dismissed: true` immediately.
2. CSS transition: `opacity 0 + max-height 0` over 200ms.
3. Once fully collapsed, remove from the DOM.
4. In parallel, fire the server action (P34A-04/05).
5. On server error: restore the card (`dismissed: false`), show a toast
   "Couldn't dismiss — try again".

No confirmation dialog — the dismissal is treated as low-risk (the contact
pair still exists; only the suggestion is gone). If the user merges manually
later, the mechanism exists.

### Dismissed state feedback

After collapse, the list reflows. No toast for success — the disappearance of
the card is the confirmation. The suggestion count in the tab label
(`Duplicates · 5`) decrements immediately (optimistic).

---

## Component 4: Updated Confidence Tiers

| Score | Tier | Badge style |
|---|---|---|
| ≥ 80 | HIGH | `bg-[#eef5ef] text-[#17352e]` green wash |
| 50–79 | MEDIUM | `bg-[#f6edd9] text-[#7a5a1a]` amber wash |
| < 50 | Not surfaced | — |

Previously HIGH was ≥ 90. Now it's ≥ 80 (exact name match = 80 pts → HIGH).
Previously MEDIUM threshold was ≥ 45. Now ≥ 50 (cuts phonetic-only pairs).

The "Score N" neutral pill (`bg-white border border-[#e9ece7] text-[#5c655e]`)
still appears alongside the tier pill for transparency.

---

## Component 5: Manual "Merge With" Flow

### Entry point

On the contact detail page, the ··· more menu (the three-dot menu in the
desktop header actions area and the mobile action sheet):

```
···
  Edit contact
  Export as .vcf
  ──────────────────────
  Merge with another contact    ← new option
  ──────────────────────
  Delete contact
```

Shown only for: contacts the user owns (not live-received copies). Hidden
for shared-book-only contacts where the user has CAN_VIEW role.

### Contact picker: Desktop modal

```
┌────────────────────────────────────────────────────────┐
│  ✕                                                     │
│  Merge with another contact                            │
│  ──────────────────────────────────────────────────    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  🔍  Search contacts…                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  [MP]  Maya Patel                                │  │
│  │        maya@example.com                          │  │
│  ├──────────────────────────────────────────────────┤  │
│  │  [MP]  M. Patel                                  │  │
│  │        maya.p@work.com                           │  │
│  ├──────────────────────────────────────────────────┤  │
│  │  [JP]  John Patel                                │  │
│  │        jp@x.com                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Search your contacts (current contact excluded)       │
└────────────────────────────────────────────────────────┘
```

- Modal: `max-w-[540px]`, centred on a `bg-black/20 backdrop-blur-sm`
  backdrop. `rounded-[16px] bg-white`.
- Title: 17px semibold, `px-5 pt-5`.
- Close button: ✕ icon top-right, 20px, `text-[#5c655e]`.
- Search input: `border border-[#d8ddd6] rounded-[10px] px-3 py-2.5 mx-4 mt-3`
  with magnifier icon prefix.
- Result rows: 52px height, `flex items-center gap-3 px-5`. Avatar 36px +
  name 14px semibold + email/phone 12px muted. `hover:bg-[#f6f7f4]`.
- Divider between rows: `border-b border-[#f2f4f0]`.
- Empty search: "No contacts found" in muted 13px, centred.
- Footer note: `px-5 pb-4`, 11px muted, "Search your contacts".

### Contact picker: Mobile (full-screen sheet)

```
┌─────────────────────────────────────────┐
│  ← Merge with another contact           │
│  ─────────────────────────────────────  │
│  [🔍 Search contacts…               ]   │
│  ─────────────────────────────────────  │
│  [MP]  Maya Patel                       │
│        maya@example.com                 │
│  ─────────────────────────────────────  │
│  [MP]  M. Patel                         │
│        maya.p@work.com                  │
└─────────────────────────────────────────┘
```

Full-screen overlay. Back arrow ← (not ✕) in the mobile header pattern.
Search input sticky at the top (below header). Results scroll below.

### After selection — confirmation step

Both picker sizes transition to a confirmation view within the same overlay:

```
Desktop modal (same size):
┌────────────────────────────────────────────────────────┐
│  ← Change contact                                      │
│  Merge these two contacts?                             │
│  You'll choose which fields to keep on the next page.  │
│  ──────────────────────────────────────────────────    │
│  [Comparison table — read-only, diffs highlighted]     │
│  ──────────────────────────────────────────────────    │
│  [Cancel]                    [Compare & merge →]       │
└────────────────────────────────────────────────────────┘
```

- "← Change contact": navigates back to the search step.
- Sub-copy: 13px muted — sets expectations about what's next.
- Comparison table: same component as Component 2 (P34A-08), read-only mode,
  no action row. Shows the two contacts and their field diffs.
- "Cancel" outlined, "Compare & merge →" primary filled green `#17352e`.
- On "Compare & merge →": create a MANUAL `MergeSuggestion` (P34A-10 action)
  then navigate to `/merge-suggestions/[id]`. The review page hides the
  "Why this was suggested?" panel for MANUAL source.

---

## Mobile States Summary

| Component | Mobile behaviour |
|---|---|
| Duplicate card (collapsed) | Full-width, contact pair stacked vertically |
| Signal chips | Horizontally scrollable, no wrap |
| Compare fields toggle | Below contact pair, full-width tap target |
| Comparison panel | `<dl>` stacked layout per field, no table |
| Dismiss button | Text link below Review button, `min-h-[44px]` tap area |
| Contact picker | Full-screen sheet, ← back arrow |
| Confirmation step | Full-screen, comparison table scrollable |

---

## Design Tokens Quick Reference

| Token | Value |
|---|---|
| Diff row highlight | `#fff0bf` |
| HIGH confidence bg | `#eef5ef` |
| HIGH confidence text | `#17352e` |
| MEDIUM confidence bg | `#f6edd9` |
| MEDIUM confidence text | `#7a5a1a` |
| Signal chip bg | `#f2f4f0` |
| Signal chip text | `#5c655e` |
| Dismiss button text | `#b5472f` |
| Card border | `#d8ddd6` |
| Row divider | `#edf0ea` / `#f2f4f0` |

---

## Notes for the Designer

- **The card must triage in 3 seconds.** Confidence pill (HIGH/MEDIUM) +
  signal chips should answer "why" without reading any copy. Field comparison
  answers "what". The Review button is for when the user needs the full
  resolution flow.
- **Diff highlight colour `#fff0bf`** is a light amber-yellow. This is
  distinct from the amber used for warnings (`#f6edd9`) and from the amber
  merge-conflict cards on the review page — it's a pure neutral "this differs"
  highlight, not a warning tone. Do not make it red.
- **"Not a duplicate" is muted red**, not full red. It's a permanent action
  but it's not deleting data — the contacts remain, just the suggestion is
  gone. Keep the tone mild to avoid unnecessary alarm.
- **Manual merge picker** must feel like a search dialog, not an import
  wizard. It's two steps: pick, confirm. No progress indicator, no fancy
  animation. Fast and direct.
- **Comparison in the confirmation step** is informational — the user already
  chose the target contact. Show it to let them sanity-check, not to ask them
  to make decisions (those happen on the review page). Keep the table compact
  (2–5 rows visible without scrolling).
- **Existing review page (brief 09) is unchanged** by this brief. These
  enhancements are list-level and entry-point additions only. The full
  conflict resolution UX is already specced and built.
- **Score pill** stays visible even on the updated tiers. Some users will
  develop intuition for what a score of 80 vs 175 means. Don't remove it just
  because the tier label is cleaner.
