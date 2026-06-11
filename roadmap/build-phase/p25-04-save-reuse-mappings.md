# P25-04 — Save and Reuse Mapping Presets

## Purpose

After a successful import, offer to save the column-to-field mapping as a named preset. When the user starts a future import with a CSV whose column headers match a saved preset, auto-apply the preset and skip the mapping step. This makes repeat imports from the same source (e.g., weekly Salesforce exports) seamless.

## Background

Sales teams and frequent exporters re-import from the same source repeatedly. Each time, they must redo the same column mapping. Presets eliminate this. The preset is keyed by a hash of the normalised column headers, so it matches even if the CSV has different row counts, different data, or slightly different column ordering.

## Scope

**In scope:**
- `ImportMappingPreset` model — name, owner, header hash, column mappings JSON
- "Save as preset" prompt shown after a successful import (Step 4 success screen)
- Preset auto-detection: when a CSV is uploaded, compute the header hash and check for a matching preset; if found, offer to apply it
- Preset management in settings: `/settings/import-presets` — list, rename, delete
- Header hash: SHA-256 of the sorted, lowercase, trimmed column headers joined with `,`

**Out of scope:**
- Sharing presets between users (personal presets only)
- Exporting presets (v1)

---

## Design / Implementation Spec

### `ImportMappingPreset` model

```prisma
model ImportMappingPreset {
    id           String   @id @default(cuid())
    userId       String
    name         String   // user-given name, e.g. "Salesforce export"
    headerHash   String   // SHA-256 of sorted+normalised headers
    columnMappings Json   // Array<{ index, header, targetField, customFieldKey? }>
    sourceProfile String? // "google" | "apple" | "outlook" | "generic"
    usageCount   Int      @default(1)
    lastUsedAt   DateTime @default(now())
    createdAt    DateTime @default(now())

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@unique([userId, headerHash])
    @@index([userId, lastUsedAt])
}
```

Run: `prisma migrate dev --name add-import-mapping-preset`

### Header hash computation

```typescript
import { createHash } from "crypto";

export function computeHeaderHash(headers: string[]): string {
  const normalised = headers
    .map((h) => h.trim().toLowerCase())
    .sort()
    .join(",");
  return createHash("sha256").update(normalised).digest("hex");
}
```

The sort step ensures column order doesn't affect the hash — a CSV with the same fields in a different order matches the same preset.

### "Save as preset" prompt (Step 4 success screen)

After a successful import, below the success stats:

```
┌──────────────────────────────────────────────────────────┐
│  ✓  Import complete — 244 contacts imported              │
│                                                          │
│  💾 Save this column mapping for future imports?         │
│  Preset name: [Salesforce weekly export                ] │
│                                                          │
│  [Save preset]   [Skip]                                  │
└──────────────────────────────────────────────────────────┘
```

- Default preset name: the filename stem without extension (e.g., "contacts_export_2026-06").
- "Save preset" calls `createImportMappingPreset`. "Skip" dismisses without saving.
- If a preset with the same `headerHash` already exists, the prompt instead says "Update the existing preset '[name]'?" with options to overwrite or save as new.

### Preset auto-detection on upload

After parsing the CSV headers in the parse step:

```typescript
const headerHash = computeHeaderHash(parsedHeaders);

const existingPreset = await db.importMappingPreset.findUnique({
  where: { userId_headerHash: { userId, headerHash } },
});
```

If a matching preset is found, return it alongside the `columnMappings` in the parse API response. The mapping step UI then shows:

```
┌──────────────────────────────────────────────────────────┐
│  ✨ We found a saved mapping for this file format        │
│     "Salesforce weekly export" (last used 3 days ago)   │
│                                                          │
│  [Apply saved mapping]   [Map manually]                  │
└──────────────────────────────────────────────────────────┘
```

Clicking "Apply saved mapping" skips the mapping step entirely and advances to Step 3 (preview). The preset's column mappings are passed directly to the preview/commit step.

### `createImportMappingPreset` server action

```typescript
export async function createImportMappingPreset(input: {
  name: string;
  headerHash: string;
  columnMappings: ColumnMappingEntry[];
  sourceProfile?: string;
}): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  await db.importMappingPreset.upsert({
    where: {
      userId_headerHash: {
        userId: session.user.id,
        headerHash: input.headerHash,
      },
    },
    create: {
      userId: session.user.id,
      name: input.name,
      headerHash: input.headerHash,
      columnMappings: input.columnMappings,
      sourceProfile: input.sourceProfile,
    },
    update: {
      name: input.name,
      columnMappings: input.columnMappings,
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });
}
```

### Preset management at `/settings/import-presets`

A simple list page:

```
Import Presets

Salesforce weekly export  ·  Last used 3 days ago  ·  Used 8 times  [Rename] [Delete]
Google Contacts backup    ·  Last used 2 weeks ago ·  Used 2 times  [Rename] [Delete]
```

- Rename: inline text input, saved on blur.
- Delete: confirmation modal: "Delete preset 'Salesforce weekly export'? This cannot be undone." Deletes the row.

---

## Acceptance Criteria

- After a successful import, the "Save as preset" prompt appears on the success screen.
- Saving creates an `ImportMappingPreset` row with the correct `headerHash` and column mappings.
- On a subsequent import with matching headers, the preset auto-detection offer appears.
- Accepting the preset applies the saved mappings and skips the mapping step.
- The `/settings/import-presets` page lists all saved presets with rename and delete actions.
- Renaming updates the `name` field; deleting removes the row after confirmation.
- The `headerHash` is order-independent — reordering CSV columns does not prevent preset matching.

---

## Risks and Open Questions

- **Preset staleness:** if the source system (Salesforce) adds new columns to its export, the header hash changes and the preset no longer matches. The user sees the mapping step again (correct behaviour). However, if they had 20 preset columns and 2 new ones were added, it would be nice to partially apply the preset and only ask about the new columns. This is a v2 enhancement — v1 requires an exact hash match.
- **Shared source profiles and presets:** the system-provided source profiles (Google, Apple, Outlook) already handle well-known exports. If a user saves a preset for a Google Contacts export, the system profile already covers it. Consider hiding the "Save preset" prompt when the source profile covers all columns at HIGH confidence — the preset adds no value in that case.
