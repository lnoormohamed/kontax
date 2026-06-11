# P25-05 — Multi-Value Column Handling

## Purpose

Detect CSV columns that contain multiple values in a single cell (e.g., "phone1; phone2" or "jane@work.com, jane@home.com") and offer to split them into separate structured fields on the contact. Without splitting, multi-value cells are imported as a single string, losing the individual values.

## Background

Many CRM and contacts exports pack multiple phone numbers or emails into a single cell using a delimiter (semicolon, comma, pipe). Google Takeout and Salesforce are common examples. The current import pipeline (Phase 3) imports the raw cell value as a single `phone` or `email` field, resulting in malformed data. This ticket adds a detection pass and a split offer in the mapping step (P25-02).

## Scope

**In scope:**
- Multi-value detection: scan sample values for common delimiters (`;`, `,`, `|`, `\n`) in fields mapped to multi-value Kontax fields (phone, email)
- Split offer in the mapping step: when detected, show a "Split into multiple values" toggle per column
- On import: split the cell value on the detected delimiter and create separate phone/email entries on the contact
- Label inference: if the split values have associated label hints (e.g., "Mobile: +1 555 0100; Work: +1 555 0200"), attempt to extract the label

**Out of scope:**
- Splitting address columns (address fields are structured by sub-field, not delimiter — a separate concern)
- Automatic splitting without user confirmation (always show the offer; never split silently)

---

## Design / Implementation Spec

### Multi-value detection

In `src/server/import/column-classifier.ts`, after classifying columns, run a second pass for multi-value detection on phone and email fields:

```typescript
export function detectMultiValue(
  sampleValues: string[],
  field: KontaxField,
): { detected: boolean; delimiter: string | null; exampleCount: number } {
  // Only relevant for multi-value fields
  if (!["phone", "email"].includes(field)) {
    return { detected: false, delimiter: null, exampleCount: 0 };
  }

  const DELIMITERS = [";", "|", "\n", " :: "];
  // Note: comma is excluded — it's ambiguous (part of an email or a separator?)

  for (const delimiter of DELIMITERS) {
    const multiValueCount = sampleValues.filter(
      (v) => v.includes(delimiter) && v.split(delimiter).length > 1,
    ).length;

    if (multiValueCount >= Math.ceil(sampleValues.length * 0.3)) {
      // > 30% of samples contain this delimiter → likely multi-value
      const maxCount = Math.max(
        ...sampleValues.map((v) => v.split(delimiter).length),
      );
      return { detected: true, delimiter, exampleCount: maxCount };
    }
  }

  return { detected: false, delimiter: null, exampleCount: 0 };
}
```

### Split offer in the mapping step

In the P25-02 mapping table, for columns where multi-value is detected, show a toggle below the field dropdown:

```
  Tel               +1 555 0100; +1 555 0200   Phone   ▾   ●●● HIGH
  ┌─────────────────────────────────────────────────────────────┐
  │  🔀 This column contains multiple phone numbers             │
  │  ☑  Split into separate phone entries (separated by "; ")   │
  │     Example: "+1 555 0100" and "+1 555 0200"                │
  └─────────────────────────────────────────────────────────────┘
```

- Toggle defaults to **on** when multi-value is detected.
- Turning the toggle off imports the raw cell value as a single field (existing behaviour).
- The example shows the split result for the first sample value.

### Label inference

If a value has a label prefix in the format `Label: value` (e.g., "Mobile: +1 555 0100"), extract the label:

```typescript
export function extractLabeledValues(
  rawValue: string,
  delimiter: string,
): Array<{ label: string | null; value: string }> {
  return rawValue.split(delimiter).map((part) => {
    const trimmed = part.trim();
    const labelMatch = trimmed.match(/^([A-Za-z\s]+):\s*(.+)$/);
    if (labelMatch) {
      return { label: labelMatch[1].trim(), value: labelMatch[2].trim() };
    }
    return { label: null, value: trimmed };
  });
}
```

Known label aliases are normalised:
```typescript
const PHONE_LABEL_ALIASES: Record<string, string> = {
  mobile: "Mobile", cell: "Mobile", cellular: "Mobile",
  work: "Work", office: "Work", business: "Work",
  home: "Home", personal: "Home",
  fax: "Fax",
};
```

### Import execution with splitting

In the import commit step, for columns with `splitMultiValue: true`:

```typescript
const parts = extractLabeledValues(rawCellValue, detectedDelimiter);
const phoneEntries = parts.map((p) => ({
  value: normalisePhone(p.value),
  label: normaliseLabelAlias(p.label),
}));
// Add all entries to the contact's `phones` array
contact.phones.push(...phoneEntries);
```

Single-value cells (no delimiter found) are handled normally — no split.

---

## Acceptance Criteria

- Columns with > 30% of sample values containing `;`, `|`, or `\n` are flagged as multi-value.
- The split offer appears in the mapping step for flagged phone and email columns.
- The split toggle defaults to on; the example shows the first split result.
- When the toggle is on, the import creates separate phone/email entries for each split value.
- When the toggle is off, the raw cell value is imported as a single entry (existing behaviour).
- Label inference extracts "Mobile:", "Work:", and "Home:" prefixes and maps them to Kontax phone labels.
- Split values with blank parts (e.g., from trailing delimiters) are filtered out.

---

## Risks and Open Questions

- **Comma ambiguity:** commas are excluded from the delimiter list because they are ambiguous — a comma-separated email list ("a@x.com, b@x.com") looks identical to a comma-separated name list ("Smith, John"). For email columns with commas in sample values, offer both interpretations: "Is this a list of emails or one email?" with radio buttons. This edge case can be a follow-up if it's rare in practice.
- **Maximum split count:** a cell with 20 phone numbers (unlikely but possible from large CRM exports) would create 20 phone entries on a single contact. Cap at 10 split values per cell. Any excess values are concatenated into a `notes` field with a comment: "Additional phone numbers from import: ..."
