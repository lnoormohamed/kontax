# P25-06 — Export Field Selection

## Purpose

Let users choose which Kontax fields to include in a CSV export and optionally rename the column headers. This allows clean, targeted exports — a user exporting contacts to a mailing list tool needs only Name and Email; a user exporting to a CRM needs Phone, Company, and Job Title. Without this, every export includes all fields, producing wide CSV files with many empty columns.

## Background

The current export (Phase 3, P3-03) generates a fixed-schema CSV covering all supported fields. The design brief (`08-import-export.md`) notes a bulk-selection export path (select contacts in the list → export the selection) but leaves field selection for a future phase. This ticket adds field selection as an optional expansion of the existing export card.

## Scope

**In scope:**
- "Choose fields" toggle on the export card — off by default (exports all fields, preserving current behaviour)
- Field selection panel: checklist of all Kontax fields, grouped by category
- Column rename: user can override the header label for each selected field (optional)
- Export preset: save the current field selection as a named preset (reuses `ImportMappingPreset` model extended for export, or a separate `ExportPreset` model)
- The selection is applied to all export types (CSV — vCard always exports all fields by definition)

**Out of scope:**
- Export presets shared with other users
- Custom field ordering (fields are output in the display order — future enhancement)
- vCard field selection (vCard format is defined by the RFC and cannot be arbitrarily subsetted)

---

## Design / Implementation Spec

### Export card UI addition

Below the format selector in the export card, add an expandable "Choose fields" section:

```
┌──────────────────────────────────────────────────────────┐
│  Export contacts                                          │
│                                                          │
│  Format                                                   │
│  ● CSV   ○ vCard 4.0 [Pro]                               │
│                                                          │
│  ☐ Include archived contacts                             │
│                                                          │
│  Fields                                                  │
│  ● All fields  ○ Choose fields                           │
│                                                          │
│  [only shown when "Choose fields" is selected:]          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  BASIC                                           │    │
│  │  ☑ First name     Header: [First name       ]   │    │
│  │  ☑ Last name      Header: [Last name        ]   │    │
│  │  ☑ Email          Header: [Email            ]   │    │
│  │  ☐ Company        Header: [Company          ]   │    │
│  │  ☐ Job title      Header: [Job title        ]   │    │
│  │                                                  │    │
│  │  CONTACT INFO                                    │    │
│  │  ☐ Phone          Header: [Phone            ]   │    │
│  │  ☐ Address        Header: [Address          ]   │    │
│  │                                                  │    │
│  │  OTHER                                           │    │
│  │  ☐ Birthday       Header: [Birthday         ]   │    │
│  │  ☐ Notes          Header: [Notes            ]   │    │
│  │  ☐ Website        Header: [Website          ]   │    │
│  │                                                  │    │
│  │  [Select all]  [Clear all]                       │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  [Export and download]                                   │
└──────────────────────────────────────────────────────────┘
```

- **Header rename:** an optional text input next to each selected field, pre-populated with the Kontax field label. Empty = use default. Shown only for checked fields.
- **Select all / Clear all:** convenience buttons that check/uncheck all fields without changing header names.
- The "Choose fields" option is only available for CSV (vCard radio greys it out with a tooltip: "vCard always includes all fields").

### Field selection data structure

```typescript
interface ExportFieldSelection {
  field: string; // Kontax field name, e.g. "firstName", "email", "phones.mobile"
  included: boolean;
  headerOverride?: string; // custom column name; null = use default
}
```

Default selection: all standard fields included, no header overrides (matches current export behaviour).

### CSV export with field selection

In `src/server/export/generate-csv.ts`:

```typescript
export function generateCsv(
  contacts: Contact[],
  fieldSelection: ExportFieldSelection[],
): string {
  const selectedFields = fieldSelection.filter((f) => f.included);

  const headers = selectedFields.map(
    (f) => f.headerOverride ?? FIELD_LABELS[f.field] ?? f.field
  );

  const rows = contacts.map((contact) =>
    selectedFields.map((f) => extractFieldValue(contact, f.field))
  );

  return Papa.unparse([headers, ...rows]);
}
```

`extractFieldValue` handles nested fields (`phones.mobile` → first mobile phone), arrays (emails → first email; additional emails → separate columns if user selected multiple email fields), and structured fields (address → concatenated or split by sub-field).

### Export preset

Save the field selection as a preset (similar to P25-04 import presets):

```prisma
model ExportPreset {
    id             String   @id @default(cuid())
    userId         String
    name           String
    fieldSelection Json     // ExportFieldSelection[]
    createdAt      DateTime @default(now())

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId])
}
```

Run: `prisma migrate dev --name add-export-preset`

Below the field selection panel:
```
[Save as preset…]   [Load preset ▾]
```

Saved presets appear in the "Load preset" dropdown by name. Loading a preset populates the checkboxes and header overrides. The preset management page (`/settings/export-presets`) lists, renames, and deletes presets.

---

## Acceptance Criteria

- The export card shows a "Choose fields" radio option (default: "All fields").
- Selecting "Choose fields" expands a grouped checklist of all Kontax fields.
- Only checked fields are included in the exported CSV.
- Header rename inputs appear for checked fields; the renamed header appears in the CSV output.
- "Select all" / "Clear all" buttons work correctly.
- Saving an export preset stores the current selection; loading a preset restores it.
- With "All fields" selected, the export produces the same output as before this ticket (regression test).
- vCard export ignores the field selection entirely (vCard always exports all fields).

---

## Risks and Open Questions

- **Multi-value phone/email fields in a flat CSV:** contacts may have 3 phone numbers. How many "Phone" columns does the export produce? Options: (a) one column with the first phone only, (b) separate columns for each phone label (Mobile, Work, Home), (c) one column with values joined by "; ". Document the chosen approach in the UI ("Exports the first value of each type"). Option (b) is the most useful but requires dynamic column count — implement (a) for v1 with an option to switch to (b) in a follow-up.
- **Custom fields in export:** contacts may have arbitrary `customFields` keys that vary per contact. The field selection panel cannot list them statically. Add a special "Custom fields" checkbox that includes all `customFields` entries as additional columns (one column per unique key across all contacts). Implement this as a single checkbox, not individual custom field selection, to keep the UI manageable.
