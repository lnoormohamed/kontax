# 08 — Import / Export

**Route:** `/import-export`
**Priority:** P1 — a primary data entry path, especially for new users onboarding from Google Contacts or Apple Contacts. The export path is used less frequently but must be frictionless.

---

## Purpose

The Import/Export page provides two top-level functions: importing contacts from a CSV file (with source profile selection to handle different column-naming conventions) and exporting contacts to CSV or vCard 4.0. The import flow is a three-step wizard embedded in the page — it does not navigate away. The export flow is a single-action panel.

A third section, Import History, lives below the fold. It lets users review past imports and rollback recent ones within the allowed window.

The page is designed to be honest about limits. Free users see how many imports they have used and what their cap is. When they hit the cap, the import form is gated with an upgrade prompt — not hidden, just disabled with an explanation.

The primary action for this page is **import**: the page opens with the import section at the top, in step 1, ready to receive a file.

---

## Layout

### Overall structure

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER (sticky, shared global header)                       │
├──────────────────────────────────────────────────────────────┤
│  ← Back to contacts                                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  IMPORT CARD                                         │    │
│  │  Step indicator (1→2→3)                              │    │
│  │  ─────────────────────────────────────────────────── │    │
│  │  STEP 1: Drop zone + source profile selector         │    │
│  │  STEP 2: Preview table + confirmation                │    │
│  │  STEP 3: Success summary                             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  EXPORT CARD                                         │    │
│  │  Format selector + options + export button           │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  IMPORT HISTORY                                      │    │
│  │  Compact table of past imports                       │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

Page max-width: 720px, centred. Same column treatment as `/settings`. Horizontal padding 24px on desktop.

Cards use `rounded-[2rem] border border-[#d8ddd6] bg-white`. Vertical gap between cards: 16px.

The page does not use tabs. All three sections are visible on the page; the import section is the most prominent by being first and tallest. The user scrolls down to reach Export and History naturally.

---

## Back link

`← Back to contacts` — 14px slate-500, 20px below the header, above the first card.

---

## Key Components

### 1. Import Card

The import card contains a step indicator and a content zone that transitions between three steps.

**Step indicator**

```
  ① Upload file  ────  ② Preview  ────  ③ Done
```

- Three labelled steps connected by thin horizontal lines.
- Each step: a circle (24px) with a number or checkmark, and a text label below.
- Circle states:
  - Active: `#4158f4` fill, white number, bold label below.
  - Complete: green (#16a34a) fill, white checkmark icon. The line between complete and active steps is green.
  - Future: white fill, slate-300 border, slate-400 number, slate-400 label.
- This indicator is compact: the full component is ~40px tall. Do not use a tall stepper with vertical descriptions.
- The indicator does not have navigation affordances — the user cannot click a step number to jump forward. They can only advance by completing the current step, or go back with a "Back" button within the step.
- Position: top of the import card, below the card's internal top padding. Divider below it before the step content.

---

#### Step 1 — Upload & Profile Selection

```
┌──────────────────────────────────────────────────────────┐
│  ① Upload file  ────  ② Preview  ────  ③ Done           │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │         ↑                                          │  │
│  │    Drag & drop your CSV file here                  │  │
│  │    or  [Browse files]                              │  │
│  │                                                    │  │
│  │    Supports CSV files up to 10 MB                  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Source format                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Generic  │ │  Google  │ │  Apple   │ │ Outlook  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  [Continue →]  (disabled until file selected)           │
└──────────────────────────────────────────────────────────┘
```

**Drop zone:**
- Dashed border: 2px dashed `#d8ddd6`, rounded-2xl, min-height 160px.
- Background: very light green-tinted white (#f9faf6) at rest.
- Drag-over state: border colour changes to `#4158f4` (blue), background light blue (#eff6ff). A brief "Release to upload" label appears.
- Center content: upload arrow icon (32px, slate-300 at rest, slate-500 on hover), headline "Drag & drop your CSV file here" (15px semibold, slate-600), sub-label "or" in slate-400, then "Browse files" as an inline button (text link, `#4158f4`).
- Below: helper text "Supports CSV files up to 10 MB" in 12px slate-400.
- After a file is selected/dropped:
  - The drop zone is replaced by a "file chip": a row showing a file icon (CSV icon, 24px), the filename (14px semibold slate-800), file size (13px slate-400), and a remove (×) button to clear.
  - The drop zone does not reappear until the chip is cleared.

**Source profile selector:**
- Label: "Source format" — 11px uppercase slate-400, same label style.
- Four option chips in a horizontal row (or 2×2 on narrow):
  - Generic, Google Contacts, Apple Contacts, Outlook.
  - Each chip: 80×48px, platform icon (20px) + name (11px slate-600) stacked. Border: `#d8ddd6`, rounded-xl, white bg.
  - Selected state: `#4158f4` border (2px), light blue fill (#eff6ff), blue text.
  - Default selected: "Generic" (or remember last choice per session).
- If the filename contains "google" or "contacts" (case-insensitive), auto-select Google. Same heuristic for Apple ("apple", "vcards" in name). Show a quiet hint: "We detected this may be a Google Contacts export." in 12px slate-400 below the chips.

**Continue button:**
- Full-width, `#4158f4` bg, white, "Continue →", 44px height, rounded-xl.
- Disabled (grey, cursor-not-allowed) until a file is selected.
- On click: parses the CSV (client-side preview parse), transitions to Step 2.
- If parsing fails: show an inline error in the drop zone area: "Couldn't parse this file. Make sure it is a CSV and try again." Red text, 13px.

---

#### Step 2 — Preview

```
┌──────────────────────────────────────────────────────────┐
│  ① Upload  ──── ② Preview  ────  ③ Done                 │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  contacts_export.csv · Google Contacts                   │
│  247 contacts found · 3 with warnings · 0 will skip     │
│                                                          │
│  ┌──────┬──────────────────┬───────────────┬──────────┐  │
│  │ Name │ Email            │ Phone         │ Company  │  │
│  ├──────┼──────────────────┼───────────────┼──────────┤  │
│  │ Jane │ jane@example.com │ +1 555-0100   │ Acme     │  │
│  │  ⚠  │ John Doe         │ (no email)    │ —        │  │
│  │ ...  │ ...              │ ...           │ ...      │  │
│  └──────┴──────────────────┴───────────────┴──────────┘  │
│  Showing first 10 of 247                                 │
│                                                          │
│  ▲ 3 warnings                                            │
│  Row 4: Missing email address                            │
│  Row 18: Phone number in unrecognised format             │
│  Row 91: Name contains only special characters           │
│                                                          │
│  [← Back]          [Import 247 contacts →]              │
└──────────────────────────────────────────────────────────┘
```

**File context line:**
- "contacts_export.csv · Google Contacts" — 13px slate-500. Filename and selected profile.

**Stats line:**
- "247 contacts found · 3 with warnings · 0 will skip" — 14px semibold slate-700.
- Counts use colour:
  - "247 contacts found" — slate-700
  - "3 with warnings" — amber-600 (if > 0), slate-400 (if 0)
  - "0 will skip" — slate-400 (if 0), red-600 (if > 0)

**Preview table:**
- Shows first 10 rows of parsed data (not the full import).
- Columns: Name, Email, Phone, Company. Other fields (address, notes, etc.) exist but are not shown in the preview — they will be imported.
- Table styling: no outer border, rows separated by 1px slate-100. Header row: 11px uppercase slate-400. Data rows: 14px regular slate-700.
- Rows with warnings: a yellow ⚠ icon in the first column (or a left-border amber accent).
- Rows that will be skipped: text muted to slate-300, italic.
- Below the table: "Showing first 10 of 247" — 12px slate-400.

**Warnings list (conditional):**
- Shown as an expandable/collapsible section. Collapsed by default if > 3 warnings; expanded by default if ≤ 3.
- Header: amber left-border accent, "⚠ 3 warnings" in amber-700, 14px semibold. Caret toggle on the right.
- Each warning: "Row [N]: [description]" — 13px regular slate-600.
- Warnings are informational — they do not block the import. The user proceeds knowingly.

**Action buttons:**
- "← Back" — ghost, slate-700. Returns to Step 1 (file and profile still remembered).
- "Import 247 contacts →" — `#4158f4` bg, white, full-width or right-aligned. Label uses the actual count.

---

#### Step 3 — Success

```
┌──────────────────────────────────────────────────────────┐
│  ① Upload  ──── ② Preview  ──── ③ Done ✓               │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  ✓  Import complete                                      │
│                                                          │
│  244 contacts imported                                   │
│  3 skipped (see details below)                           │
│                                                          │
│  [← View contacts]     [Undo import]                    │
│                                                          │
│  Skipped rows:                                           │
│  Row 4 — Name contains only special characters           │
│  Row 18 — Duplicate of existing contact (Jane Doe)      │
│  Row 91 — Missing required fields                        │
└──────────────────────────────────────────────────────────┘
```

**Success message:**
- Large checkmark icon (40px, green #16a34a) with "Import complete" to its right. 20px semibold, slate-800.
- Count: "244 contacts imported" — 16px regular, slate-700. Supplemented by "3 skipped" in amber-600 if any.

**Undo import button:**
- Ghost style, slate-700 border. Label: "Undo import". Only shown within the rollback window (e.g. 24 hours after import, or while this session is active).
- Clicking: confirmation dialog. "This will remove the 244 contacts added in this import. Are you sure?" — "Yes, undo" (red) and "Cancel".
- After undo: the import card resets to Step 1 with an informational banner: "Import undone. 244 contacts removed."

**"← View contacts" button:**
- `#4158f4` bg, white. Navigates to `/` (contacts list).

**Skipped rows (conditional):**
- Collapsible, collapsed by default.
- Same format as warnings in Step 2.

---

### 2. Export Card

```
┌──────────────────────────────────────────────────────────┐
│  Export contacts                                         │
│                                                          │
│  Format                                                  │
│  ● CSV   ○ vCard 4.0                                     │
│                                                          │
│  ☐  Include archived contacts                            │
│                                                          │
│  [Export and download]                                   │
└──────────────────────────────────────────────────────────┘
```

**Card header:** "Export contacts" — 17px semibold slate-800.

**Format selector:**
- Two radio options: "CSV" and "vCard 4.0".
- Radio buttons styled consistently: circle 18px, active state fills with `#4158f4`. Label: 14px regular slate-800.
- Default selection: CSV.
- Description lines below each option (13px slate-500):
  - CSV: "Compatible with Google Contacts, Outlook, and most apps."
  - vCard 4.0: "Standard format for Apple Contacts, iOS, and Android."

**Include archived contacts checkbox:**
- Checkbox 18px, tick in `#4158f4` when checked.
- Label: "Include archived contacts" — 14px regular slate-700.
- Unchecked by default.

**Export button:**
- Full-width, `#4158f4` bg, white, "Export and download", 44px height, rounded-xl.
- On click: triggers a file download directly (browser native download). No loading screen for small exports. For large exports (> ~2000 contacts), show a brief loading state: button becomes "Preparing export…" with a spinner, then triggers the download.
- The button does not navigate away from the page.

---

### 3. Import History

This section is below the fold — it is informational and not required for the primary flow.

```
┌──────────────────────────────────────────────────────────┐
│  Import history                                          │
│                                                          │
│  ┌──────────────┬──────────────────┬────────┬──────┬───┐ │
│  │ Date         │ File             │ Source │  #   │ R │ │
│  ├──────────────┼──────────────────┼────────┼──────┼───┤ │
│  │ Today 14:32  │ contacts.csv     │ Google │ 244  │ ↩ │ │
│  │ Jun 1 10:15  │ export_may.csv   │ Apple  │ 121  │   │ │
│  │ May 15       │ contacts_old.csv │ Generic│  88  │   │ │
│  └──────────────┴──────────────────┴────────┴──────┴───┘ │
└──────────────────────────────────────────────────────────┘
```

**Section label:** "Import history" — 11px uppercase slate-400.

**Table:**
- Columns: Date, File, Source, # (contacts imported), Rollback (↩ icon if within window).
- Date: 13px regular slate-600.
- File: 13px slate-700, truncated at 180px.
- Source: platform name, 13px slate-500.
- # (count): 13px slate-700, right-aligned.
- Rollback column: shows a ↩ icon button (16px, slate-400) if the import is within the rollback window. Hovering: tooltip "Undo this import". Clicking opens the same confirmation dialog as in Step 3.
- If the import was already rolled back: show a ~~strikethrough~~ style on the row and a "Undone" badge in slate-400.

**Empty state:**
- "No imports yet." — slate-400, 14px, centred in the card.

**Rollback window:**
- The ↩ button only appears for imports within 24 hours (or per the product's rollback window policy). Older imports do not have this option.

---

## Plan Gate (Free tier, import limit)

When a Free user has reached their monthly import limit:

```
┌──────────────────────────────────────────────────────────┐
│  ① Upload file  ────  ② Preview  ────  ③ Done           │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  You've used 3 of 3 imports this month.                  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │  [Upgrade to Pro to import more contacts]          │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Your import limit resets on July 1.                     │
└──────────────────────────────────────────────────────────┘
```

- The drop zone is replaced by an "upgrade required" state.
- The zone gets a light amber background, dashed amber border.
- Text: "You've used 3 of 3 imports this month." — 14px slate-700.
- A prominent CTA button inside the zone: "Upgrade to Pro to import more contacts" — `#4158f4` bg, white, rounded-xl, 44px.
- Below the zone: "Your import limit resets on [date]." — 13px slate-500.
- The source profile chips are greyed out and non-interactive.
- The Continue button is replaced by an empty space (do not show a disabled button alongside the upgrade CTA — too many calls to action).

**Near-limit warning (not yet at limit):**
- When the user has 1 import remaining, show a non-blocking amber banner above the drop zone: "⚠ 1 import remaining this month. Upgrade for unlimited imports." — amber-600, 13px. A dismiss (×) button on the right.

---

## States

**Loading (page load)**
- Import card: skeleton drop zone (dashed border, grey fill) + skeleton chips (4 grey rectangles) + skeleton button.
- Export card: skeleton radio options + skeleton button.
- History: skeleton table rows.

**Parsing error (after file selection)**
- Drop zone shows the error state below the file chip: red text "Couldn't read this file. Check the format and try again." with a retry link.
- Step 2 is never reached.

**Import in progress (Step 2 → Step 3 transition)**
- After clicking "Import N contacts", the card shows a loading state:
  - The preview table fades to 40% opacity.
  - A spinner overlays the card centred.
  - The step indicator shows step 2 still active but with a spinner.
  - "Importing contacts…" text below the spinner.
  - This transition should take < 2 seconds for typical imports. For large imports (> 1000 contacts), show a progress bar: "Importing… 312 of 1,247".

**Export in progress (large export)**
- Button: "Preparing export…" + spinner. Disabled.
- On completion: download starts automatically, button reverts to "Export and download".
- On error: inline error message below the button: "Export failed. Try again." with a retry link.

**No contacts to export**
- The export button shows "Nothing to export" and is disabled. Helper text: "You have no contacts. Import or create some first."

---

## Mobile Layout (< 768px)

- Single column, same as desktop (already single column). Cards go full width.
- **Drop zone becomes a "Choose file" button** — drag-and-drop does not work on mobile. The drop zone area shrinks to a 48px tall button: "Choose file" in `#4158f4` with a file icon. A file picker (native OS file picker) opens on tap.
- Source profile chips: 2×2 grid instead of 4-in-a-row.
- Preview table on Step 2: horizontal scroll allowed. Or reduce to 2 columns (Name, Email) with a "Show more" row expander.
- Action buttons (Back / Import): stacked vertically (Import button on top, Back below).
- Export card: same layout, no changes needed.
- History table: reduce to 3 columns: Date, File, # (count). Source column is hidden. Rollback icon stays.

---

## Future Additions

1. **Phase 12 — vCard share link:** After a successful import, a "Share a contact" prompt may appear in the Step 3 success screen. Reserve space below the "View contacts" button for a small contextual promo card. It does not block the current step.

2. **Phase 13 / 14 — Shared address book export:** The export form gains a new "Which contacts?" selector: "My contacts" / "Shared family contacts" / "Team contacts". This is an additional field above the format selector. The field only appears if the user is in a family group or team.

3. **Future — Google Contacts direct import (OAuth):** The source profile chips may be replaced by or supplemented with "Connect Google Contacts" flow. The chip area is designed to accommodate an additional "import from Google" large CTA tile above the file drop zone without restructuring the card.

4. **Future — Duplicate detection at import time:** Step 2 gets an additional column: "Duplicate?" — showing if a parsed contact matches an existing one. The stats line gains a "N duplicates detected" count. No structural change needed; it is additive to the existing table and stats line.
