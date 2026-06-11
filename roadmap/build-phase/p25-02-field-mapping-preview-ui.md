# P25-02 — Field Mapping Preview UI

## Purpose

Show the user a table of detected CSV columns mapped to Kontax fields before they commit to an import. Each column has a dropdown to reassign the mapping. This replaces the current Step 2 preview (which shows data rows but not the column-to-field mapping), making it a two-step preview: first review the mapping, then confirm the data rows.

## Background

The current import Step 2 shows a data preview — rows from the CSV with auto-detected column headers. Users have no way to tell Kontax that "Mobile" should map to `phone` with a "Mobile" label, or that "Nom" is a last name. This ticket adds a pre-step between upload and the data preview: a mapping table where each CSV column is shown with its detected intent and a dropdown to change it.

## Scope

**In scope:**
- New import Step 1.5 ("Map fields") shown after file upload and before the data preview
- Mapping table: one row per CSV column — column header, sample value, detected field (editable dropdown), confidence indicator
- HIGH confidence mappings are pre-filled and collapsed; LOW confidence mappings are expanded and highlighted
- "Skip column" option — exclude a column from the import
- Updated step indicator: Upload → Map fields → Preview → Done
- Mapping is passed through to the import job; the existing parse step uses it

**Out of scope:**
- Saving mappings as presets (P25-04)
- Multi-value column splitting (P25-05)
- Export field selection (P25-06)

---

## Design / Implementation Spec

### Updated step indicator

```
① Upload file  ──  ② Map fields  ──  ③ Preview  ──  ④ Done
```

Step 2 is new. Steps 3 and 4 correspond to the existing Steps 2 and 3.

### Mapping table

After file upload, the API returns `columnMappings` (from P25-01). The mapping table renders one row per column:

```
┌──────────────────────────────────────────────────────────────┐
│  MAP YOUR COLUMNS                                            │
│                                                              │
│  Column          Sample value    Maps to           Conf.    │
│  ────────────── ─────────────── ──────────────── ────────── │
│  First Name     Jane            First name    ▾    ●●● HIGH │
│  Last Name      Smith           Last name     ▾    ●●● HIGH │
│  Email          jane@ex.com     Email address ▾    ●●● HIGH │
│  Tel            +1 555 0100     Phone         ▾    ●●  MED  │
│  ??Custom??     VP Sales        [Select…]     ▾    ○○○ LOW  │
│  Internal ID    C-00123         ⊘ Skip column ▾    ○○○ LOW  │
│                                                              │
│  [← Back]              [Continue →]                         │
└──────────────────────────────────────────────────────────────┘
```

**Confidence indicator:**
- HIGH: 3 filled dots, `color: #1f8a5b` (green)
- MEDIUM: 2 filled + 1 empty dot, `color: #bf8526` (amber)
- LOW: 3 empty dots, `color: #b5472f` (red) — row highlighted with `background: #fff5f5`

**Mapping dropdown options** (in order):
- First name, Last name, Full name
- Email address, Phone (generic), Phone (mobile), Phone (work), Phone (home)
- Company, Job title
- Street address, City, State/Province, Postal code, Country
- Birthday, Website, Notes
- — (separator) —
- Custom field (creates a new `customFields` entry with the column header as the key)
- ⊘ Skip this column (excludes from import)

**LOW confidence rows** are pre-expanded (the "Maps to" dropdown is open or visually highlighted). HIGH confidence rows are collapsed — the mapping is shown but the dropdown is closed.

### State management

```typescript
interface ColumnMapping {
  header: string;
  index: number;
  sampleValue: string;
  detectedField: KontaxField | "custom" | "skip";
  confidence: number;
  confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  userOverride: KontaxField | "custom" | "skip" | null; // null = use detectedField
}
```

The effective mapping for column `i` is `userOverride ?? detectedField`.

When the user changes a dropdown, set `userOverride` for that column. Revert is possible by selecting the original detected field.

### API integration

Pass the column mappings to the import commit API:

```typescript
// POST /api/import/commit
{
  jobId: string;
  columnMappings: Array<{
    index: number;
    targetField: KontaxField | "custom" | "skip";
    customFieldKey?: string; // if targetField === "custom"
  }>;
}
```

The import job reads these mappings instead of the source-profile defaults.

### "Continue →" button

Enabled when:
- At least one column maps to a non-skip field.
- No two columns map to the same non-null field (except for multi-value fields like phone, email — those can repeat).

Validation error shown inline: "Two columns are mapped to 'First name'. Please change one."

---

## Acceptance Criteria

- The mapping table appears as a new step between upload and data preview.
- Each CSV column is shown with its header, first sample value, detected field (pre-filled), and confidence indicator.
- HIGH confidence mappings are shown in green; LOW confidence rows are highlighted in red.
- Changing a dropdown updates the mapping immediately (optimistic, no round-trip).
- "Skip this column" excludes the column from the import; the sample value is shown with strikethrough.
- "Continue →" validates that at least one column is mapped and no non-multi-value fields are duplicated.
- The column mappings are passed to the import commit step and applied during contact creation.
- The step indicator shows 4 steps (Upload → Map fields → Preview → Done).

---

## Risks and Open Questions

- **Large CSVs with many columns (50+):** a 50-column mapping table is overwhelming. For CSVs with more than 20 columns, add a "Show all columns" toggle that hides columns with HIGH confidence, letting the user focus on LOW/MEDIUM ones first. Default to showing only LOW/MEDIUM columns.
- **Column ordering:** the import spec (P3-02) may have assumptions about column order for certain source profiles. Confirm that passing an explicit mapping overrides any order-based assumptions in the parse step.
- **Mapping persistence in session:** if the user navigates back to Step 1 and re-uploads a file with the same headers, their manual overrides should be retained. Store the mapping state in component state (survives re-upload if headers match); clear on file removal.
