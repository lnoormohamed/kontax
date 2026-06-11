# P25-03 — Mapping Suggestions ("Did you mean X?")

## Purpose

Surface inline "did you mean?" suggestions when column intent detection (P25-01) returns LOW confidence, and allow users to create free-text custom fields for columns that don't match any Kontax field. This reduces the cognitive load of the mapping step — the user sees an actionable suggestion, not just an empty dropdown.

## Background

The P25-02 mapping table shows a dropdown for each column. For LOW confidence columns, the dropdown opens to `[Select…]` — the user must scroll through all options to find the right field. This ticket adds a suggestion chip beneath the dropdown for LOW confidence columns ("Did you mean: Phone (mobile)?") and a "Create custom field" inline option for truly novel columns.

## Scope

**In scope:**
- "Did you mean X?" suggestion chip shown for LOW/MEDIUM confidence columns — one-tap to apply
- Multiple suggestions ranked by confidence (up to 3 shown)
- Inline "Create as custom field" option: the column header becomes the custom field key, and the column's values are stored in `Contact.customFields`
- Confirmation when the user accepts a LOW confidence suggestion (brief green flash on the row)
- "Suggest better mapping" feedback button — records rejected suggestion pairs for future classifier improvement (stored in `ImportMappingSuggestionFeedback` table)

**Out of scope:**
- Updating the classifier model based on feedback (done offline, manually — feedback is just data collection in v1)
- ML-based suggestions (regex only)

---

## Design / Implementation Spec

### Suggestion chip UI

For columns with confidence < 0.85, show a suggestion chip below the dropdown:

```
  ??Custom??     VP Sales      [Select…      ▾]   ○○○ LOW
  ┌─────────────────────────────────────────────────┐
  │  💡 Did you mean:  [Job title]  [Company]  ›    │
  └─────────────────────────────────────────────────┘
```

Chip style: `background: #f2f4f0`, `border: 1px solid #d8ddd6`, `border-radius: 999px`, `font-size: 13px`, `padding: 4px 12px`, `color: #5c655e`. Hover: `background: #e3efe7`, `color: #17352e`.

Clicking a suggestion chip:
1. Sets the dropdown to the suggested field (same as selecting it from the dropdown).
2. Flashes the row green briefly (`background: #e3efe7`, 800ms transition back to white).
3. Hides the suggestion chips for that row.

**Multiple suggestions:** ranked by confidence, shown as adjacent chips (up to 3). The "›" at the end opens a popover with all suggestions ranked by confidence.

### `generateSuggestions` function

In `src/server/import/column-classifier.ts`:

```typescript
export function generateSuggestions(
  header: string,
  sampleValues: string[],
  columnIndex: number,
): Array<{ field: KontaxField | "custom"; confidence: number; label: string }> {
  const allScores = COLUMN_PATTERNS.map((pattern) => {
    const headerScore = pattern.patterns.some((p) => p.test(header.trim())) ? 0.6 : 0;
    const validCount = pattern.valueValidator
      ? sampleValues.filter(pattern.valueValidator).length
      : 0;
    const valueScore = sampleValues.length > 0 ? (validCount / sampleValues.length) * 0.3 : 0;
    const positionScore = getPositionScore(pattern.field, columnIndex) * 0.1;
    return {
      field: pattern.field,
      confidence: headerScore + valueScore + positionScore,
      label: FIELD_LABELS[pattern.field],
    };
  });

  return allScores
    .filter((s) => s.confidence > 0.1) // filter out zero-confidence matches
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5); // return top 5; UI shows top 3
}
```

Include suggestions in the `columnMappings` API response alongside the best single classification from P25-01.

### "Create as custom field" option

If the user selects "Custom field" from the dropdown or clicks a dedicated "Create custom field" link:

```
┌─────────────────────────────────────────────────────┐
│  Custom field name:  [VP Sales Category           ] │
│  (Values will be stored in "VP Sales Category"    ) │
└─────────────────────────────────────────────────────┘
```

The `customFieldKey` defaults to the column header, trimmed to 50 characters. The user can edit it. On import commit, these values go into `Contact.customFields` as `{ "VP Sales Category": "Tier 1" }`.

If two columns are assigned the same custom field key, show a validation error: "Custom field name must be unique."

### Suggestion feedback collection

```prisma
model ImportMappingSuggestionFeedback {
    id              String   @id @default(cuid())
    userId          String
    columnHeader    String
    suggestedField  String
    chosenField     String   // what the user actually mapped it to
    sampleValue     String?
    createdAt       DateTime @default(now())

    @@index([columnHeader])
}
```

Run: `prisma migrate dev --name add-import-mapping-feedback`

When the user accepts a suggestion that differs from the top suggestion, record:
- `columnHeader` and `suggestedField` (what was offered)
- `chosenField` (what the user actually picked)

When the user rejects a suggestion by clicking "✗ Not helpful" on the chip, record the same. This data is used offline to improve the classifier patterns.

---

## Acceptance Criteria

- LOW confidence columns show "Did you mean X?" suggestion chips below the dropdown.
- Clicking a chip sets the dropdown to that field and shows a green confirmation flash on the row.
- Up to 3 suggestions are shown as chips; the "›" button shows all (up to 5) in a popover.
- "Create custom field" is available as a dropdown option or a link; the user can set the custom field name.
- Two columns cannot share the same custom field name — a validation error is shown.
- Suggestion feedback is recorded when a user accepts a non-top suggestion or rejects a chip.

---

## Risks and Open Questions

- **Suggestion quality for completely novel headers:** a column named "CRM_ID_legacy" will have zero pattern matches and produce no useful suggestions. In this case, show only "Create custom field" — no suggestion chips. This is expected and acceptable.
- **Custom field name collisions with existing custom fields on contacts:** if a user has existing contacts with `customFields.crm_id`, and they import a new CSV with a "crm_id" column mapped to custom field "crm_id", the values will be appended to the existing field on merge. Confirm this is the desired behaviour (it is) and document it in the UI: "Values will be added to the existing 'crm_id' custom field on matching contacts."
