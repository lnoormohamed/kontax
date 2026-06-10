# 08 — Import / Export

**Route:** `/import-export`
**Priority:** P1 — a primary data entry path, especially for new users onboarding from Google Contacts or Apple Contacts. The export path is used less frequently but must be frictionless.

> **Design decision locked (2026-06-10): light system.** This page uses the locked design language — ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, surface `#f2f4f0`, brand green `#17352e`, CTA blue `#4158f4`, Geist. The current build is on the old dark theme and needs replacing. **Two additions since original brief:** (1) **vCard export is Pro-gated** — Free users see an upgrade prompt for the vCard 4.0 format option. (2) **Bulk selection export** — the contacts list supports selecting contacts and exporting the selection as CSV; the export panel here should acknowledge that path and link to it.

---

## Purpose

The Import/Export page provides two top-level functions: importing contacts from a CSV file and exporting contacts to CSV or vCard 4.0. The import flow is a three-step wizard embedded in the page — it does not navigate away. The export flow is a single-action panel. A third section, Import History, lives below the fold.

The page is designed to be honest about limits. Free users see how many imports they have used and their cap. When they hit the cap, the import form is gated with an upgrade prompt — not hidden, just disabled with an explanation.

Primary action is **import**: the page opens at Step 1, ready to receive a file.

---

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER (sticky, shared global header)                       │
├──────────────────────────────────────────────────────────────┤
│  ← Back to contacts                                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  IMPORT CARD                                         │    │
│  │  Step indicator (1 → 2 → 3)                         │    │
│  │  ─────────────────────────────────────────────────── │    │
│  │  Step 1: Drop zone + source profile selector        │    │
│  │  Step 2: Preview table + confirmation               │    │
│  │  Step 3: Success summary                            │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  EXPORT CARD                                         │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  IMPORT HISTORY                                      │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**Page max-width:** 720px, centred. Horizontal padding: 24px desktop. Section cards: `border-radius: 14px`, `border: 1px solid #d8ddd6`, `background: #fff`. Vertical gap between cards: 16px. No tabs — all three sections visible, scrollable.

---

## Back link

`← Back to contacts` — `font-size: 14px`, `color: #5c655e`, `margin-bottom: 20px`.

---

## Key Components

### 1. Import Card

Contains a step indicator and a content zone that transitions between three steps.

**Step indicator:**

```
  ① Upload file  ────  ② Preview  ────  ③ Done
```

- Three labelled steps, 24px circles, thin connecting lines.
- **Active:** `background: #4158f4`, `color: #fff`, bold label below.
- **Complete:** `background: #1f8a5b`, `color: #fff`, checkmark icon. Connecting line to next step: `#1f8a5b`.
- **Future:** `background: #fff`, `border: 1px solid #d8ddd6`, `color: #8b938c`, muted label.
- Compact: ~40px tall total. Not navigable — no jumping ahead. Back button within each step.
- Divider below the indicator before step content: `1px solid #e9ece7`.

---

#### Step 1 — Upload & Profile Selection

```
┌──────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────┐  │
│  │                  ↑                                 │  │
│  │   Drag & drop your CSV file here                   │  │
│  │   or  [Browse files]                               │  │
│  │                                                    │  │
│  │   Supports CSV files up to 10 MB                   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Source format                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Generic  │ │  Google  │ │  Apple   │ │ Outlook  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  [Continue →]                                            │
└──────────────────────────────────────────────────────────┘
```

**Drop zone:**
- `border: 2px dashed #d8ddd6`, `border-radius: 12px`, `min-height: 160px`, `background: #f9faf8`.
- Drag-over: `border-color: #4158f4`, `background: #edf0fe`. "Release to upload" label appears.
- Content: upload icon (32px, `color: #d8ddd6` rest, `#8b938c` hover), headline `font-size: 15px`, `font-weight: 600`, `color: #5c655e`; "or" in muted; "Browse files" as `color: #4158f4` inline link.
- Helper: "Supports CSV files up to 10 MB" — `font-size: 12px`, `color: #8b938c`.
- After file selected: drop zone replaced by **file chip** — file icon + filename (`font-size: 14px`, `font-weight: 600`, `color: #1d2823`) + size (`color: #8b938c`) + × remove button.

**Source profile selector:**
- Label: `font-size: 11px`, `font-weight: 700`, `letter-spacing: 0.1em`, `text-transform: uppercase`, `color: #8b938c`.
- Four chips: Generic, Google Contacts, Apple Contacts, Outlook. Each 80×48px, icon (20px) + name (11px). `border: 1px solid #d8ddd6`, `border-radius: 10px`, `background: #fff`. Hover: `background: #f2f4f0`.
- Selected: `border: 2px solid #4158f4`, `background: #edf0fe`, `color: #4158f4`.
- Default: Generic (or remember last per session). Auto-detect heuristic: if filename contains "google" → auto-select Google. Show hint: "We detected this may be a Google Contacts export." — `font-size: 12px`, `color: #8b938c`.

**Continue button:** full-width, `background: #4158f4`, `color: #fff`, "Continue →", `height: 44px`, `border-radius: 10px`. Disabled (`opacity: 0.45`, `cursor: not-allowed`) until file selected. Parse error shown inline in red below the chip: `color: #b5472f`, `font-size: 13px`.

---

#### Step 2 — Preview

```
┌──────────────────────────────────────────────────────────┐
│  contacts_export.csv · Google Contacts                   │
│  247 contacts found · 3 with warnings · 0 will skip     │
│                                                          │
│  ┌──────┬──────────────────┬───────────────┬──────────┐  │
│  │ Name │ Email            │ Phone         │ Company  │  │
│  ├──────┼──────────────────┼───────────────┼──────────┤  │
│  │ Jane │ jane@example.com │ +1 555-0100   │ Acme     │  │
│  │ ⚠   │ John Doe         │ (no email)    │ —        │  │
│  └──────┴──────────────────┴───────────────┴──────────┘  │
│  Showing first 10 of 247                                 │
│                                                          │
│  ⚠ 3 warnings                                            │
│  Row 4: Missing email address                            │
│                                                          │
│  [← Back]          [Import 247 contacts →]              │
└──────────────────────────────────────────────────────────┘
```

**File context line:** `font-size: 13px`, `color: #5c655e`.

**Stats line:** `font-size: 14px`, `font-weight: 600`, `color: #1d2823`. Counts:
- "N contacts found" — `color: #1d2823`
- "N with warnings" — `color: #bf8526` if > 0, `color: #8b938c` if 0
- "N will skip" — `color: #b5472f` if > 0, `color: #8b938c` if 0

**Preview table:** first 10 rows only. No outer border. Rows: `border-bottom: 1px solid #e9ece7`. Header: `font-size: 11px`, `font-weight: 700`, `text-transform: uppercase`, `color: #8b938c`. Data: `font-size: 14px`, `color: #5c655e`. Warning rows: `⚠` icon in `color: #bf8526` + `border-left: 3px solid #bf8526`. Skip rows: `color: #d8ddd6`, italic.

**Warnings (collapsible):** `border-left: 3px solid #bf8526`, `padding-left: 12px`. Header: "⚠ N warnings", `color: #7a5a1a`, `font-size: 14px`, `font-weight: 600`. Entries: `font-size: 13px`, `color: #5c655e`. Expanded if ≤ 3 warnings; collapsed if > 3. Warnings are informational — they do not block import.

**Buttons:** "← Back" — `border: 1px solid #d8ddd6`, `color: #1d2823`. "Import N contacts →" — `background: #4158f4`, `color: #fff`.

---

#### Step 3 — Success

```
┌──────────────────────────────────────────────────────────┐
│  ✓  Import complete                                      │
│                                                          │
│  244 contacts imported                                   │
│  3 skipped (see below)                                   │
│                                                          │
│  [← View contacts]     [Undo import]                    │
│                                                          │
│  Skipped rows (collapsible):                             │
│  Row 4 — Name contains only special characters           │
└──────────────────────────────────────────────────────────┘
```

**Success indicator:** circle 40px, `background: #e3efe7`, checkmark `color: #1f8a5b`. "Import complete" — `font-size: 20px`, `font-weight: 600`, `color: #1d2823`.

**Count line:** `font-size: 16px`, `color: #5c655e`. "N skipped" in `color: #bf8526` if any.

**"← View contacts":** `background: #4158f4`, `color: #fff`. Navigates to `/`.

**"Undo import":** `border: 1px solid #d8ddd6`, `color: #1d2823`. Only shown within rollback window. Confirmation dialog:
- "This will remove the N contacts added in this import. Are you sure?"
- "Yes, undo": `background: #b5472f`, `color: #fff`. "Cancel": `color: #5c655e`.
- After undo: card resets to Step 1, banner: "Import undone. N contacts removed." — `background: #e3efe7`, `color: #1c6b48`.

**Skipped rows:** collapsible, collapsed by default. Same row format as warnings.

---

### 2. Export Card

```
┌──────────────────────────────────────────────────────────┐
│  Export contacts                                          │
│                                                          │
│  Format                                                   │
│  ● CSV (all plans)                                        │
│    Compatible with Google Contacts, Outlook, and most    │
│    apps.                                                  │
│                                                          │
│  ○ vCard 4.0  [Pro]                                      │
│    Standard format for Apple Contacts, iOS, and Android. │
│                                                          │
│  ☐  Include archived contacts                            │
│                                                          │
│  Note: to export a specific selection, select contacts   │
│  in your list and use the bulk-export action.            │
│                                                          │
│  [Export and download]                                   │
└──────────────────────────────────────────────────────────┘
```

**Card header:** "Export contacts" — `font-size: 17px`, `font-weight: 600`, `color: #1d2823`.

**Format selector:** two radio options.
- Radio circle: 18px. Active fill: `#4158f4`. Label: `font-size: 14px`, `color: #1d2823`. Description: `font-size: 13px`, `color: #5c655e`, `margin-top: 3px`.
- **CSV** — always available.
- **vCard 4.0** — **Pro-gated.** Shows a `[Pro]` badge inline (`background: #f2f4f0`, `color: #5c655e`, `font-size: 10px`, `font-weight: 700`, `border-radius: 4px`, `padding: 1px 6px`). If user is on Free, the radio is non-selectable (`opacity: 0.5`, `cursor: not-allowed`). Selecting it as a Free user shows a popover: "vCard export is a Pro feature. [Upgrade →]". If Pro+, it works normally.
- Default selection: CSV.

**"Include archived contacts" checkbox:** `border: 1px solid #d8ddd6`, `border-radius: 4px`, checkmark `color: #4158f4`. Label: `font-size: 14px`, `color: #1d2823`. Unchecked by default.

**Bulk selection note:** `font-size: 13px`, `color: #8b938c`, italic. "To export specific contacts, select them in your contacts list and use the bulk export action." Link "contacts list" → `/`. This acknowledges the selection-export path without duplicating the UI.

**Export button:** full-width, `background: #4158f4`, `color: #fff`, "Export and download", `height: 44px`, `border-radius: 10px`. Triggers browser download directly. Large exports (> ~2000): "Preparing export…" + spinner, then download. No page navigation.

**No contacts:** button disabled, "Nothing to export". `font-size: 13px`, `color: #8b938c` below: "You have no contacts. Import or create some first."

---

### 3. Import History

Below the fold — informational.

```
┌──────────────────────────────────────────────────────────┐
│  IMPORT HISTORY                                          │
│                                                          │
│  ┌──────────────┬──────────────────┬────────┬──────┬───┐ │
│  │ Date         │ File             │ Source │  #   │   │ │
│  ├──────────────┼──────────────────┼────────┼──────┼───┤ │
│  │ Today 14:32  │ contacts.csv     │ Google │ 244  │ ↩ │ │
│  │ Jun 1        │ export_may.csv   │ Apple  │ 121  │   │ │
│  │ May 15       │ contacts_old.csv │ Generic│  88  │   │ │
│  └──────────────┴──────────────────┴────────┴──────┴───┘ │
└──────────────────────────────────────────────────────────┘
```

**Section label:** `font-size: 11px`, `font-weight: 700`, `letter-spacing: 0.1em`, `text-transform: uppercase`, `color: #8b938c`.

**Table:** no outer border. Row divider: `1px solid #e9ece7`. Header: `font-size: 11px`, `text-transform: uppercase`, `color: #8b938c`. Data: `font-size: 13px`, `color: #5c655e`. Filename: `color: #1d2823`.

- **↩ rollback icon:** `color: #8b938c`, 16px. Hover tooltip: "Undo this import". Only within rollback window. Clicking opens confirmation dialog (same as Step 3 undo).
- **Rolled-back rows:** line-through text, "Undone" badge — `color: #8b938c`, `font-size: 11px`, `background: #f2f4f0`, `border-radius: 4px`, `padding: 1px 6px`.

**Empty:** "No imports yet." — `color: #8b938c`, centred.

---

## Plan Gate (Free, import limit reached)

```
┌──────────────────────────────────────────────────────────┐
│  You've used 3 of 3 imports this month.                  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  [Upgrade to Pro to import more contacts]          │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Your import limit resets on 1 July.                     │
└──────────────────────────────────────────────────────────┘
```

- Drop zone replaced. Zone: `border: 2px dashed #bf8526`, `background: #f6edd9`, `border-radius: 12px`.
- "You've used N of N…": `font-size: 14px`, `color: #1d2823`.
- Upgrade CTA inside zone: `background: #4158f4`, `color: #fff`, full-width.
- "Resets on [date]": `font-size: 13px`, `color: #5c655e`.
- Source chips: `opacity: 0.45`, non-interactive. Continue button: not shown.

**Near-limit warning (1 import remaining):** amber banner above drop zone. `background: #f6edd9`, `border: 1px solid #e9ece7`, `color: #7a5a1a`, `font-size: 13px`. "⚠ 1 import remaining this month. Upgrade for unlimited imports." Dismiss (×) on right.

---

## States

**Loading:** Skeleton drop zone (dashed grey) + skeleton chips + skeleton button. `background: #f2f4f0` shimmer.

**Parse error:** Red inline below file chip. `color: #b5472f`, `font-size: 13px`. "Couldn't read this file. Check the format and try again." Never reaches Step 2.

**Import in progress:** Preview table at 40% opacity. Spinner overlay centred. Step indicator: step 2 active with spinner. "Importing contacts…" below spinner. Large imports: progress bar "Importing… 312 of 1,247".

**Export in progress:** Button: "Preparing export…" + spinner. Disabled. On complete: download starts, button resets. On error: `color: #b5472f`, `font-size: 13px` below button: "Export failed. Try again."

---

## Mobile Layout (< 768px)

- Single column (already single on desktop — no change structurally).
- **Drop zone → "Choose file" button:** `height: 48px`, `background: #4158f4`, `color: #fff`, file icon + "Choose file". Opens native OS file picker.
- **Source chips:** 2×2 grid.
- **Step 2 preview table:** horizontal scroll, or reduce to 2 columns (Name, Email) with "Show more" row expander.
- **Action buttons (Back / Import):** stacked vertically, Import on top.
- **History table:** 3 columns: Date, File, # (Source hidden). Rollback icon stays.

---

## Future Additions

1. **Phase 12 — vCard share prompt:** After Step 3 success, a contextual promo below "View contacts" for sharing a contact. Reserve space — does not block current step.

2. **Phase 13/14 — Shared address book export:** Export form gains "Which contacts?" selector above format: "My contacts" / "Shared family contacts" / "Team contacts". Only shown if user is in a family or team.

3. **Google Contacts direct import (OAuth):** Source chips supplemented by "Connect Google Contacts" flow — a large tile above the file drop zone. No structural change needed.

4. **Duplicate detection at import (future):** Step 2 table gains a "Duplicate?" column and stats line shows "N duplicates detected". Additive — no structural change.
