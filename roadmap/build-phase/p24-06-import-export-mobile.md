# P24-06 — Import/Export on Mobile

## Purpose

Make the import and export flows functional and comfortable on mobile. The primary changes are: replace the drop zone with a native file picker button, make the Step 2 preview table horizontally scrollable, and ensure export downloads land in the correct place on iOS (Files app) and Android (Downloads folder) with a clear confirmation.

## Background

The import/export page (`/import-export`, design brief `08-import-export.md`) was designed as a desktop-first page. On mobile, the drag-and-drop zone is non-functional (no drag support), the Step 2 preview table overflows the viewport, and the CSV paste textarea is difficult to use. The page renders and the flows work, but the experience is frustrating. This ticket makes mobile a first-class path.

## Scope

**In scope:**
- Mobile Step 1: "Choose file" button replacing the drop zone; paste textarea remains (but collapsible)
- Mobile Step 2: preview table with horizontal scroll, reduced to 2 visible columns with "Show more" row expander
- Source profile chips: 2×2 grid on mobile
- Export: download confirmation toast ("File saved to Downloads")
- Import limit gate: same as desktop — full-width amber/orange gate when limit reached

**Out of scope:**
- Desktop layout (unchanged)
- vCard import (not yet in scope per P11-01)

---

## Design / Implementation Spec

### Step 1 — File picker button (mobile)

Replace the drag-and-drop zone on mobile with a large button that opens the native file picker:

```tsx
// In ImportCard, conditional rendering:
const isMobile = useMediaQuery("(max-width: 767px)");

{isMobile ? (
  <label style={{
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 10, height: 56, borderRadius: 14,
    backgroundColor: "#4158f4", color: "#ffffff",
    fontSize: 15, fontWeight: 600, cursor: "pointer",
    width: "100%",
  }}>
    <FolderOpen size={20} />
    Choose CSV file
    <input
      type="file"
      accept=".csv,text/csv"
      style={{ display: "none" }}
      onChange={handleFileChange}
    />
  </label>
) : (
  <DropZone ... /> // existing desktop drop zone
)}
```

After file selection, show the file chip (same as desktop): file icon + name + size + × remove.

**Paste CSV:** retained but collapsed by default on mobile. The "Or paste CSV directly" disclosure opens a compact textarea (`min-height: 80px`).

### Step 2 — Preview table (mobile)

```tsx
// Two-column primary view, rest in "Show more" expander
```

The preview table on mobile shows only **Name** and **Email** columns by default. A "Show more" tap at the end of each row expands to show all other columns inline:

```
┌────────────────────────────────────┐  ← horizontal scroll container
│ Name         │ Email               │
├──────────────┼─────────────────────┤
│ Jane Smith   │ jane@example.com    │  [+]  ← expand to see all fields
│ ⚠ John Doe  │ (none)              │  [+]
└──────────────┴─────────────────────┘
```

The table container has `overflow-x: auto; -webkit-overflow-scrolling: touch` so users can scroll horizontally if they prefer. The Name column is sticky-left (`position: sticky; left: 0; background: #fff`).

Warning rows: `border-left: 3px solid #bf8526` on the Name cell.

**Stats line:** same as desktop — "247 contacts found · 3 with warnings · 0 will skip".

**Action buttons:** stacked vertically. "Import N contacts →" on top (primary, full-width). "← Back" below (secondary, full-width, `border: 1px solid #d8ddd6`).

### Step 3 — Success (mobile)

Unchanged structure. Both action buttons stacked vertically.

**Export download confirmation:**

iOS Safari triggers a download → the file appears in the browser's Downloads or in Files app. Show a toast immediately after the download begins:

```typescript
// After triggering the download:
toast({
  message: "Your file has been saved. Check your Downloads or Files app.",
  duration: 5000,
  icon: "CheckCircle",
});
```

On Android/Chrome, the download notification appears in the system tray. The toast confirms it started.

### Source profile chips — 2×2 grid

```css
.source-chips-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

@media (min-width: 768px) {
  .source-chips-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

Chip height: 56px on mobile (was 48px). Each chip: icon (22px) above label (11px), `border-radius: 12px`.

### Import limit gate (mobile)

Same content as desktop. The drop zone is replaced with the gate UI on mobile:

```
┌──────────────────────────────────────┐
│  You've used 3 of 3 imports this     │
│  month.                              │
│                                      │
│  [Upgrade to Pro]                    │
│                                      │
│  Resets on July 1.                   │
└──────────────────────────────────────┘
```

Full-width amber zone, `border: 2px dashed #bf8526`, `background: #f6edd9`, `border-radius: 14px`, `padding: 24px 16px`.

---

## Acceptance Criteria

- On mobile (≤ 767px), Step 1 shows a "Choose CSV file" button that opens the native file picker.
- After file selection, the file chip appears with the file name, size, and a remove button.
- Source profile chips render in a 2×2 grid on mobile.
- The Step 2 preview table is horizontally scrollable; the Name column is sticky-left.
- The "Show more" row expander reveals all additional columns for a single row.
- Warning rows show a left border on the Name cell.
- Export triggers a browser download and shows a toast confirming where the file was saved.
- The import limit gate renders correctly on mobile with a full-width upgrade CTA.
- Import history table on mobile is horizontally scrollable (Date, File, # visible; Source hidden by default).

---

## Risks and Open Questions

- **iOS file picker `.csv` filter:** `accept=".csv,text/csv"` may not correctly filter in iOS Files picker if the CSV was saved with a different MIME type. Test with a file from Google Takeout and Apple Contacts export. If filtering fails, remove the filter entirely (accept all files) and validate the file type after selection.
- **iOS download behaviour:** files downloaded in iOS Safari appear in the Safari Downloads sheet, not immediately in Files. This is iOS-controlled behaviour and cannot be changed. The toast copy ("Check your Downloads or Files app") should set the right expectation.
