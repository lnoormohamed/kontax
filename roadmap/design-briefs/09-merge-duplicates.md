# 09 — Merge Duplicates

**Routes:**
- `/merge-suggestions/[id]` — review a specific system-suggested merge
- `/merge/manual` — manually select two contacts to merge

**Priority:** P1 — merging is the quality-of-life feature that keeps the address book clean. A hesitant or confusing merge UI causes users to skip merges and accumulate duplicates, which degrades trust in the entire app.

---

## Purpose

The Merge Duplicates screens handle collapsing two contact records into one. The system generates merge suggestions based on matching signals (email address, phone number, name similarity). The user reviews a field-by-field comparison, selects which values to keep, and commits the merge.

The design principle for this page is **explicit choice at low cost**. Every decision should be legible at a glance. The user should never feel uncertain about what they are keeping or what they are discarding. At the same time, identical fields should not interrupt the user — they collapse silently, and the user's attention is focused only on the fields that actually differ.

The manual merge route (`/merge/manual`) is for cases where the user notices a duplicate themselves. It reuses the same field-comparison view, with a contact-picker step in front of it.

---

## Layout: `/merge-suggestions/[id]`

### Overall structure (desktop ≥ 1280px)

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER (sticky, shared global header)                              │
├─────────────────────────────────────────────────────────────────────┤
│  ← Back to suggestions                                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  MERGE HEADER CARD                                          │    │
│  │  Confidence badge · Reason chips                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  FIELD COMPARISON TABLE                                     │    │
│  │                                                             │    │
│  │  ┌───────────────┬───────────────────┬───────────────────┐  │    │
│  │  │  FIELD LABEL  │  CONTACT A        │  CONTACT B        │  │    │
│  │  ├───────────────┼───────────────────┼───────────────────┤  │    │
│  │  │  Name         │  ● John Appleseed │  ○ Jon Appleseed  │  │    │
│  │  │  Email        │  ● j@icloud.com   │  ○ jon@gmail.com  │  │    │
│  │  │  Phone        │  ─ (same) +1 555  │  ─ (same)        │  │    │
│  │  │  Company      │  ● Acme Corp      │  ○ (empty)        │  │    │
│  │  └───────────────┴───────────────────┴───────────────────┘  │    │
│  │                                                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  STICKY ACTION BAR (bottom of viewport)                     │    │
│  │  [Cancel]  [Dismiss suggestion]  [Merge contacts →]         │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

The page uses the standard max-width (960px on this page — slightly wider than Settings to accommodate the three-column comparison table) centred with `margin: 0 auto` and `padding: 0 32px`.

The action bar is sticky at the bottom of the viewport, separated from the page content by a 1px border-top `#d8ddd6` and a white/off-white background.

---

## Back link

`← Back to suggestions` — 14px slate-500, 20px padding-bottom. On `/merge/manual` this reads `← Back to contacts`.

---

## Key Components

### 1. Merge Header Card

```
┌─────────────────────────────────────────────────────────┐
│  Possible duplicate                                     │
│                                                         │
│  ● HIGH confidence                                      │
│                                                         │
│  Same email address    Similar name    Shared phone     │
└─────────────────────────────────────────────────────────┘
```

**Header label:** "Possible duplicate" — 11px uppercase tracking-widest slate-400. This anchors the page context.

**Confidence badge:**
Displayed prominently as a coloured pill badge:
- HIGH — green bg (#dcfce7), green text (#166534), "● HIGH confidence"
- MEDIUM — amber bg (#fef3c7), amber text (#92400e), "● MEDIUM confidence"
- LOW — slate bg (#f1f5f9), slate text (#475569), "● LOW confidence"

Badge size: 13px semibold, 6px vertical / 12px horizontal padding, rounded-full.

**Reason chips:**
Below the confidence badge, a row of small chips — one per signal that contributed to the suggestion:
- "Same email address"
- "Similar name"
- "Shared phone number"
- "Same company"
- etc.

Each chip: 12px regular slate-600, border `#d8ddd6`, white bg, 4px/10px padding, rounded-full. Chips wrap to a second line if many.

These are display-only — not interactive in the current scope (see Future Additions for the expandable signal scores panel).

---

### 2. Field Comparison Table

This is the core of the page. Every field that exists on either contact is shown as a row. The table is inside a card with the standard `rounded-[2rem] border border-[#d8ddd6] bg-white` chrome.

**Column structure:**

```
┌─────────────────┬──────────────────────────┬──────────────────────────┐
│  Field label    │  Contact A               │  Contact B               │
├─────────────────┼──────────────────────────┼──────────────────────────┤
│  NAME           │  ● John Appleseed        │  ○ Jon Appleseed          │
│  EMAIL          │  ● j@example.com         │  ○ jon@gmail.com         │
│  PHONE          │  ══ +1 (555) 012-3456    │  ══ (identical)          │
│  COMPANY        │  ● Acme Corp             │  ○ —                     │
│  ADDRESS        │  ○ 123 Main St           │  ● 456 Oak Ave           │
└─────────────────┴──────────────────────────┴──────────────────────────┘
```

- Column 1 (field label): 120px, right-aligned, 11px uppercase slate-400. Labels: NAME, EMAIL, PHONE, COMPANY, ADDRESS, NOTES, BIRTHDAY, etc. Only rows for fields that exist on at least one contact are shown.
- Column 2 (Contact A): flexible width (equal to Column 3).
- Column 3 (Contact B): same flexible width.

**Row types:**

**Type A — Identical values (auto-merged, no decision needed):**
- Both cells show the value in slate-400 (greyed), 14px.
- A horizontal double-line separator (══) to the left of the value (or a subtle "equals" icon) signals "this is already decided."
- No radio/checkbox. No hover state.
- Label column shows the field label in slate-300 (lighter than usual).
- These rows have a slightly lighter background: slate-50.

**Type B — Differing single-value fields (one must win):**
This is the most common type for name, company, address, notes.

Each cell contains:
- A radio indicator (large, 24px) — a circle. Filled with `#4158f4` blue when selected, hollow white border `#d8ddd6` when not selected.
- The field value (14px regular, slate-800) to the right of the circle.
- If a cell is empty (the contact has no value for this field): show the radio circle, then "(none)" in italic slate-400.

Selection behaviour:
- Initially, Contact A is pre-selected on all rows (as the "primary" contact).
- Clicking anywhere in a Contact B cell (not just the radio): selects B for that row. Visual feedback is immediate.
- Clicking anywhere in Contact A cell: selects A.
- The entire cell acts as the click target, not just the radio. Cell minimum height: 52px.
- Selected cell: subtle blue-tinted background (#eff6ff), radio filled `#4158f4`, value text stays slate-800.
- Unselected cell: white bg, hollow radio, value text slate-600.
- Hover on unselected cell: background slate-50, radio border turns slate-400.

**Type C — Multi-value fields (emails, phones) — keep some from both:**
Fields that can have multiple values use a checkbox-per-value model instead of a radio.

```
  EMAILS
  ┌──────────────────────────────┐  ┌──────────────────────────────┐
  │  ☑ j@example.com (work)     │  │  ☑ jon@gmail.com (personal) │
  │  ☑ j@oldaddress.com         │  │  ○ (no other emails)         │
  └──────────────────────────────┘  └──────────────────────────────┘
```

- Each email/phone from Contact A and Contact B is listed as a separate checkbox.
- By default, all are checked (keep everything).
- The user can uncheck values they want to discard.
- Checkboxes: 18px, tick in `#4158f4` when checked, white+border when unchecked.
- Value label: 14px regular slate-800. Type label in parentheses: 12px slate-400.
- If a side has no values for this field (e.g. Contact B has no emails), show "(none)" in italic slate-400 with no checkbox.

**Type D — Fields where one side is empty:**
This is treated like Type B (radio), but the empty side shows "(none)" in italic. If Contact A has a company and Contact B does not, Contact A is pre-selected. The user can deliberately choose to "keep" the empty value (wiping the field), but this is visually discouraged — the empty option is shown last or greyed.

**Row dividers:** 1px slate-100 between rows.

**Section grouping (optional):**
If a contact has many fields (> 8 rows), group them with subtle section labels within the table:
- "Core" — Name, Email, Phone
- "Work" — Company, Job title, Work address
- "Personal" — Birthday, Notes, Personal address
These labels are 10px uppercase slate-300, centred within the table, acting as dividers between sections.

---

### 3. Contact Column Headers

Above the table, the two columns need headers so the user always knows which side is A and which is B:

```
┌─────────────────┬──────────────────────────┬──────────────────────────┐
│                 │  Contact A               │  Contact B               │
│                 │  [JA] John Appleseed     │  [JA] Jon Appleseed      │
│                 │  Created Jun 1, 2024     │  Created Mar 12, 2023    │
├─────────────────┴──────────────────────────┴──────────────────────────┤
```

- Avatar initials: 40px circle, brand green bg, white text.
- Name: 15px semibold slate-800.
- Created date: 12px slate-400.
- "Contact A" / "Contact B" labels: 11px uppercase slate-400 above each header.
- These headers are sticky (stick below the global header) as the user scrolls through a long comparison table, so the user always knows which side they are choosing from.

---

### 4. Sticky Action Bar

Fixed at the bottom of the viewport, always visible.

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Cancel]    [Dismiss suggestion]          [Merge contacts →]        │
└──────────────────────────────────────────────────────────────────────┘
```

**Background:** `rgba(249,250,246,0.96)` with `backdrop-filter: blur(8px)`. Border-top: 1px `#d8ddd6`. Height: 72px.

**"Cancel" button:**
- Text link style, slate-500, 14px. Left-aligned. No background.
- Navigates back to the suggestions list without making any changes.

**"Dismiss suggestion" button:**
- Ghost button, slate-700, border `#d8ddd6`. Centre or left of centre.
- Clicking: confirmation tooltip or inline: "Dismiss this suggestion? Kontax won't suggest these two contacts again." with "Yes, dismiss" and "Cancel" inline options (no full modal needed).
- After dismissal: navigates back to the suggestions list with a toast notification: "Suggestion dismissed."

**"Merge contacts →" button:**
- `#4158f4` bg, white, 15px semibold, 44px height, rounded-xl. Right-aligned.
- Disabled state (greyed) until at least the Name field has a decision (it starts pre-selected, so it is enabled immediately unless something goes wrong).
- Actually: the button is enabled from the moment the page loads (since Contact A is pre-selected). It only goes disabled if no fields have a decision — which shouldn't happen, but is a safety net.
- Label updates to "Merging…" with a spinner during the API call.

---

### 5. Post-Merge Success State

After a successful merge, the page transitions (fade or slide) to a success view. It does not navigate to a new URL.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back to suggestions                                               │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                                                              │    │
│  │  ✓  Contacts merged                                          │    │
│  │                                                              │    │
│  │  John Appleseed                                              │    │
│  │  j@example.com · jon@gmail.com · +1 (555) 012-3456          │    │
│  │                                                              │    │
│  │  [View contact →]          [Undo merge]                     │    │
│  │                                                              │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

**Success icon:** 40px green checkmark circle (#16a34a).

**"Contacts merged" headline:** 20px semibold slate-800.

**Merged contact preview:**
A compact contact card showing the resulting contact:
- Name (15px semibold slate-800)
- Key fields in a single line: email · phone (13px slate-500)
- Rounded card, border `#d8ddd6`, padding 16px.

**"View contact →" button:** `#4158f4` bg, white. Navigates to `/contacts/[merged-id]`.

**"Undo merge" button:**
- Ghost style, slate-700. Only shown within the undo window (30 days per product spec).
- Clicking: confirmation dialog. "This will restore both contacts to their state before the merge." — "Yes, undo" (red) and "Cancel".
- After undo: shows a success message: "Merge undone. Both contacts restored."
- After the undo window: the button is not shown. The user is not confronted with a disabled undo button.

---

## Layout: `/merge/manual`

### Step 1 — Contact Picker

The manual merge route starts with a two-picker step before the comparison view.

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER                                                              │
├──────────────────────────────────────────────────────────────────────┤
│  ← Back to contacts                                                  │
│                                                                      │
│  Merge two contacts                                                  │
│  Select two contacts to compare and merge.                           │
│                                                                      │
│  ┌────────────────────────────┐  ┌────────────────────────────┐      │
│  │  Contact A                │  │  Contact B                 │      │
│  │  ┌──────────────────────┐ │  │  ┌──────────────────────┐  │      │
│  │  │ 🔍 Search contacts…  │ │  │  │ 🔍 Search contacts…  │  │      │
│  │  └──────────────────────┘ │  │  └──────────────────────┘  │      │
│  │                           │  │                            │      │
│  │  [No contact selected]    │  │  [No contact selected]     │      │
│  └────────────────────────────┘  └────────────────────────────┘      │
│                                                                      │
│                    [Compare & merge →]  (disabled)                  │
└──────────────────────────────────────────────────────────────────────┘
```

**Page title:** "Merge two contacts" — 22px semibold, slate-900. Subtext: "Select two contacts to compare and merge." — 14px regular, slate-500.

**Contact picker cards:**
- Two equal-width cards side by side (on desktop). On mobile: stacked vertically.
- Each card: "Contact A" / "Contact B" label (11px uppercase slate-400), then a search input.
- Search input: 14px, border `#d8ddd6`, rounded-xl, 44px height, search icon (16px, slate-400) on the left.
- As the user types, a dropdown list appears below the input showing matching contacts:
  - Each result: avatar initials (28px circle), name (14px semibold slate-800), email (12px slate-500).
  - Keyboard navigable (up/down arrows, enter to select).
  - Max 8 results shown.
- After selection:
  - The search input is replaced by the selected contact's mini card:
    - Avatar (40px circle, brand green), name (15px semibold), email + phone (12px slate-500).
    - A clear (×) button to deselect.

**"Compare & merge →" button:**
- `#4158f4` bg, white, 44px. Disabled (greyed) until both contacts are selected.
- Once both selected: enabled. Clicking loads the same field comparison view used by `/merge-suggestions/[id]`, but without the confidence badge and reason chips section (since this is a user-initiated comparison, not a system suggestion).

---

## States

**Loading (suggestion load)**
- Header card: skeleton confidence badge + skeleton reason chips.
- Table: 5 skeleton rows (each row: grey bar for field label, grey bar for each value cell).
- Action bar: shown but all buttons are disabled with low opacity.

**Error (suggestion not found)**
- Full-page error state within the content area: "This suggestion was not found. It may have already been dismissed or merged." — slate-500, 14px, centred. A "← Back to suggestions" link.

**Merge in progress**
- The table fades to 40% opacity.
- The "Merge contacts →" button shows a spinner and "Merging…".
- The action bar buttons are all disabled.

**All fields identical (no decisions needed)**
- This case should not generate a suggestion, but if it occurs: the table shows all rows in the "identical" (greyed) style. A banner above the table: "These contacts appear identical. Merging will combine them with no data loss." — slate-500, 13px. The merge button is enabled immediately.

**One contact missing a field entirely**
- The cell shows "(none)" in italic slate-400 with no value. The radio for this cell is still present (the user can explicitly choose to keep "none" — discarding the other contact's value). This is a valid, if unusual, choice.

**Many fields (long table)**
- The column headers become sticky (below the global header) so the user always knows which column is A and which is B.
- No pagination or collapsing. The table shows all fields. The sticky action bar keeps the merge action always accessible.

**Contact has no fields other than name**
- The table shows one row (Name) plus any other populated fields. If literally only the name differs, the comparison is very simple and the table is short. This is fine — the design handles any table length gracefully.

---

## Mobile Layout (< 768px)

The side-by-side comparison collapses to a stacked layout per row.

### Header card
Same — full width. Confidence badge and reason chips wrap if needed.

### Column headers
Contact A header block appears above the table. Contact B header block is not separately shown at the top — instead, it is implied by the row structure. Alternatively: a horizontal swipe indicator ("← A | B →") at the top of the table, but this adds complexity and is not the preferred approach.

Preferred: show a compact "A vs B" subtitle: two small avatars + names side by side, below the back link, above the table card.

### Field comparison rows (mobile)

Each row stacks vertically rather than using three columns:

```
┌──────────────────────────────────────────────────────┐
│  NAME                                                │
│                                                      │
│  ● John Appleseed    (Contact A)                    │
│                                                      │
│  ○ Jon Appleseed     (Contact B)                    │
└──────────────────────────────────────────────────────┘
```

- Field label at the top of the row: 11px uppercase slate-400.
- Contact A value: radio + value, with "(Contact A)" label in 11px slate-400 to the right.
- Contact B value: below it, same style. A horizontal gap separates A from B within the row.
- Row border-bottom: 1px slate-100.
- Identical rows: same grey treatment, "Identical — keeping this value" in 12px slate-400 below the value.

**Multi-value rows (mobile):**
Same checkbox style, but both contacts' values are listed vertically in a single column, grouped with small A/B labels.

**Sticky action bar (mobile):**
Full-width at the bottom. Buttons:
- "Cancel" — text link, left.
- "Merge →" — full-width primary button (or near-full, with Cancel to its left).
- "Dismiss" — moved to a "…" menu (three-dot overflow) to reduce clutter. Or shown as a secondary text link below the merge button.

### Manual merge picker (mobile)
The two contact pickers stack vertically (Contact A picker, then Contact B picker). "Compare & merge →" button below both, full width.

---

## Future Additions

1. **"Why was this suggested?" expandable panel (Phase 10)**
   Below the reason chips in the header card, a collapsed panel:
   - Toggle: "Why was this suggested? ▾" — 13px slate-500, chevron right.
   - Expanded: a small table of signals and their point contributions:
     ```
     Same email address     +80 pts
     Similar name            +30 pts
     Confidence: HIGH (110 pts)
     ```
   - 13px regular, slate-600. Points in a monospace or tabular number column.
   - Reserve the space in the header card now (the collapsed toggle can be present as a placeholder that does nothing until Phase 10, or simply not shown until that phase — either is acceptable).

2. **Bulk merge (Phase 10/11)**
   A "Merge all HIGH confidence duplicates" action may be added to the suggestions list page (not this detail page). This page does not need structural changes for that feature.

3. **Merge reason scoring visualisation**
   A small bar chart or score breakdown could replace the chip list in the header card. Design the header card now with enough vertical space that a chart (60px tall) could be inserted between the confidence badge and the chips without reflow.

4. **Contact source badges on comparison columns**
   In Phase 10, each contact value cell may show the source of the value (e.g. "from iCloud sync", "from manual edit"). Reserve space for a 12px source badge below each value in the cells. The badge is an icon (cloud/edit icon) + short label in slate-400. It is additive to the existing cell layout and should not require row height changes since rows already have min-height 52px.
