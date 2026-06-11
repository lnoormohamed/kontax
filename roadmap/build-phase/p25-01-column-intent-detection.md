# P25-01 — Column Intent Detection

## Purpose

Automatically classify incoming CSV column headers into their likely Kontax field (first name, last name, phone, email, address, etc.) with a confidence score. The classification drives the field mapping suggestions shown to the user in P25-02. Without detection, every user must manually map every column — an unnecessary friction point for common export formats.

## Background

The import pipeline (Phase 3, P3-02) parses CSV files and applies a source profile (Generic, Google, Apple, Outlook) to help with column mapping. Source profiles handle the most predictable cases (Google's "Given Name" column, Apple's "First Name"). This ticket adds a heuristic classifier that handles non-standard column names and gives the user a confidence signal when automatic mapping is uncertain.

Detection runs server-side, synchronously, during the parse step — before the preview is shown to the user. It does not require network calls or ML inference; all detection is regex + value sampling.

## Scope

**In scope:**
- Column intent classifier: `classifyColumn(header, sampleValues)` → `{ field, confidence }`
- Confidence tiers: HIGH (> 0.85), MEDIUM (0.5–0.85), LOW (< 0.5)
- Detection signals: header string matching, sample value shape, column position heuristics
- Supported Kontax target fields: `firstName`, `lastName`, `fullName`, `email`, `phone`, `company`, `jobTitle`, `address.street`, `address.city`, `address.state`, `address.postalCode`, `address.country`, `birthday`, `website`, `notes`, `custom`
- Source profile still applied first; detection fills in the gaps for unmatched columns

**Out of scope:**
- ML-based detection (regex only for v1 per roadmap note)
- The field mapping UI (P25-02)
- Saving mapping presets (P25-04)

---

## Design / Implementation Spec

### Detection strategy

Three signals, combined into a confidence score:

1. **Header string match (weight: 0.6):** case-insensitive regex against known header patterns.
2. **Sample value shape (weight: 0.3):** format of the first 5 non-empty values in the column.
3. **Column position (weight: 0.1):** first column in a CSV is often first name; second is often last name or email.

### Header pattern registry

`src/server/import/column-classifier.ts`:

```typescript
interface ColumnPattern {
  field: KontaxField;
  patterns: RegExp[];
  valueValidator?: (v: string) => boolean;
}

const COLUMN_PATTERNS: ColumnPattern[] = [
  {
    field: "firstName",
    patterns: [/^(first\s*name|given\s*name|forename|prénom|vorname)$/i],
  },
  {
    field: "lastName",
    patterns: [/^(last\s*name|surname|family\s*name|nom|nachname)$/i],
  },
  {
    field: "fullName",
    patterns: [/^(name|full\s*name|display\s*name|contact\s*name)$/i],
  },
  {
    field: "email",
    patterns: [/^(e[\s-]?mail|email\s*(address)?|e\.mail|correo)$/i],
    valueValidator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
  {
    field: "phone",
    patterns: [/^(phone|tel(ephone)?|mobile|cell|number|fax|work\s+phone|home\s+phone)$/i],
    valueValidator: (v) => /^[\d\s()+\-\.]{7,20}$/.test(v),
  },
  {
    field: "company",
    patterns: [/^(company|organisation|organization|employer|firm|business)$/i],
  },
  {
    field: "jobTitle",
    patterns: [/^(title|job\s*title|position|role|occupation)$/i],
  },
  {
    field: "birthday",
    patterns: [/^(birth\s*day|date\s+of\s+birth|dob|born)$/i],
    valueValidator: (v) => /^\d{4}[-\/]\d{2}[-\/]\d{2}$/.test(v) || /^\d{1,2}[-\/]\d{1,2}([-\/]\d{2,4})?$/.test(v),
  },
  {
    field: "website",
    patterns: [/^(website|url|web|homepage|site)$/i],
    valueValidator: (v) => /^https?:\/\//.test(v),
  },
  {
    field: "notes",
    patterns: [/^(notes?|comments?|description|memo|remarks?)$/i],
  },
  {
    field: "address.street",
    patterns: [/^(street|address(\s+1)?|addr|street\s+address)$/i],
  },
  {
    field: "address.city",
    patterns: [/^(city|town|locality|suburb)$/i],
  },
  {
    field: "address.state",
    patterns: [/^(state|province|region|county)$/i],
  },
  {
    field: "address.postalCode",
    patterns: [/^(postal\s*(code)?|zip(\s*code)?|postcode)$/i],
    valueValidator: (v) => /^[\dA-Z\s\-]{3,10}$/i.test(v),
  },
  {
    field: "address.country",
    patterns: [/^(country|nation|land)$/i],
  },
];
```

### `classifyColumn` function

```typescript
export function classifyColumn(
  header: string,
  sampleValues: string[], // first 5 non-empty values
  columnIndex: number,
): { field: KontaxField | "custom"; confidence: number; confidenceTier: "HIGH" | "MEDIUM" | "LOW" } {
  let bestField: KontaxField | "custom" = "custom";
  let bestScore = 0;

  for (const pattern of COLUMN_PATTERNS) {
    // Signal 1: header match
    const headerMatch = pattern.patterns.some((p) => p.test(header.trim()));
    const headerScore = headerMatch ? 0.6 : 0;

    // Signal 2: value shape validation
    let valueScore = 0;
    if (pattern.valueValidator && sampleValues.length > 0) {
      const validCount = sampleValues.filter(pattern.valueValidator).length;
      valueScore = (validCount / sampleValues.length) * 0.3;
    }

    // Signal 3: position heuristic
    const positionScore = getPositionScore(pattern.field, columnIndex) * 0.1;

    const total = headerScore + valueScore + positionScore;

    if (total > bestScore) {
      bestScore = total;
      bestField = pattern.field;
    }
  }

  const tier = bestScore > 0.85 ? "HIGH" : bestScore > 0.5 ? "MEDIUM" : "LOW";

  return {
    field: bestScore < 0.3 ? "custom" : bestField,
    confidence: bestScore,
    confidenceTier: tier,
  };
}

function getPositionScore(field: KontaxField | "custom", index: number): number {
  if (index === 0 && field === "firstName") return 1;
  if (index === 1 && (field === "lastName" || field === "email")) return 0.5;
  return 0;
}
```

### Integration with the parse step

In `src/server/import/parse-csv.ts`, after parsing headers:

```typescript
const columnMappings = headers.map((header, index) => {
  const sampleValues = rows.slice(0, 5).map((r) => r[index] ?? "").filter(Boolean);
  return {
    header,
    index,
    ...classifyColumn(header, sampleValues, index),
  };
});
```

Return `columnMappings` alongside the parsed rows. The import API response includes this so the UI (P25-02) can pre-populate the mapping dropdowns.

---

## Acceptance Criteria

- `classifyColumn` correctly classifies standard headers from Google Contacts, Apple Contacts, and Outlook exports with HIGH confidence.
- Custom or non-standard headers return LOW confidence and the `custom` field.
- Email columns are validated by value shape — a column with email-format values but an ambiguous header gets MEDIUM confidence instead of LOW.
- Position heuristics boost confidence for first-name-in-column-0 patterns.
- Classification is synchronous and completes in < 10ms per column (no network calls).
- The classification result is included in the parse API response and consumed by P25-02.

---

## Risks and Open Questions

- **Multi-language headers:** non-English CSVs (German "Vorname", French "Prénom") need patterns. The initial pattern registry covers the most common cases. Add patterns iteratively as they are reported. Consider a community-contributed pattern file (JSON, not code) for easy extension without a deploy.
- **Ambiguous multi-value columns:** a column named "Phone" may contain a mix of mobile and work numbers. The classifier maps it to `phone` (generic) — the label (mobile/work) is a separate, lower-priority signal. P25-05 handles multi-value splitting but not label detection.
- **Source profile conflict:** if the source profile (Google, Apple) has already mapped a column, the classifier should not override it — source profile mappings are higher confidence than heuristic classification. Ensure the integration in `parse-csv.ts` applies source profile first and only calls `classifyColumn` for unmapped columns.
