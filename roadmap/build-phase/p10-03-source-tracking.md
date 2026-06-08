# P10-03 Source Tracking on Contacts

## Purpose
This ticket adds permanent origin attribution and current-actor tracking to every Contact record. Without source tracking, the UI has no structured way to show where a contact came from ("Added manually", "Synced from iCloud") or what last changed it ("Updated via Google CSV import"). These two pieces of information — origin and last mutation — are distinct: a contact imported from a CSV file in 2023 might be last-mutated by a manual edit in 2025. The source badge shows the origin; the "last updated by" line shows the most recent actor. Both require structured enum fields on the Contact model, not inference from ActivityEvent history.

## Background
The existing Contact model has `importJobId` as the only origin signal. It is non-null for contacts created by an import job and null for everything else. This is insufficient because:

1. It cannot distinguish "added manually" from "created via CardDAV sync" or "received via share"
2. It is a foreign key to ImportJob, not a human-readable label, so displaying it requires a join
3. It carries no information about the most recent actor — only the creation path
4. Future paths (CardDAV sync, API, sharing) have no corresponding field at all

The `SyncAccount` model has a `label` field that is the human-readable name of the sync integration (e.g., "iCloud", "Google Contacts"). The `ImportJob` model has `sourceFileName` and `sourceProfile`. These existing fields are the sources of `sourceDetail` for contacts created via those paths.

The ActivityEvent model from P10-01 provides a complete history of all mutations, but reading the most recent actor from the event log requires a database query on every contact page load. Having `lastMutatedBy` directly on the Contact record avoids this query for the "last updated by" display.

## Scope

### In Scope
- Adding `sourceType` and `sourceDetail` fields to the Contact Prisma model
- Adding `lastMutatedBy` and `lastMutatedByDetail` fields to the Contact Prisma model
- Defining the `SourceType` enum
- Writing the Prisma migration
- Writing the backfill migration for existing contacts
- Updating all mutation paths to write `lastMutatedBy` and `lastMutatedByDetail` (coordinated with P10-02)
- Setting `sourceType` and `sourceDetail` on all contact creation paths

### Out of Scope
- UI display of source badges and last-updated-by line (P10-04)
- ActivityEvent emission (P10-02, though the two tickets share the same transaction block)
- Phase 12 sharing source types (`SHARED_STATIC`, `SHARED_LIVE`) — enum values are added now, wiring happens in Phase 12
- API source type (`API`) — enum value added now, wiring happens when the API is built

## Design / Implementation Spec

### New Enum: `SourceType`

```prisma
enum SourceType {
  MANUAL
  IMPORT_CSV
  SYNC_CARDDAV
  SHARED_STATIC
  SHARED_LIVE
  API
}
```

**Enum value definitions:**

| Value | Description | When set |
|---|---|---|
| MANUAL | User created the contact directly in the UI | On manual contact creation |
| IMPORT_CSV | Contact was created by a CSV (or vCard) import job | On import commit |
| SYNC_CARDDAV | Contact was first pulled from a CardDAV sync account | On first sync pull that creates the contact |
| SHARED_STATIC | Contact was received as a static share (snapshot at share time) | Phase 12 |
| SHARED_LIVE | Contact was received as a live share (updates automatically) | Phase 12 |
| API | Contact was created via the Kontax REST API | When API is built |

`SHARED_STATIC`, `SHARED_LIVE`, and `API` are included in the enum now to avoid a migration later. They must not be used as `sourceType` values until those paths are built.

### Schema Changes to Contact

```prisma
model Contact {
  // ... existing fields ...

  // Origin — set at creation, never changed
  sourceType            SourceType  @default(MANUAL)
  sourceDetail          String?     // e.g. "contacts-export.csv", "iCloud", "Jane Smith"

  // Last mutation — updated on every change
  lastMutatedBy         SourceType  @default(MANUAL)
  lastMutatedByDetail   String?     // Same format as sourceDetail
}
```

**Design decisions:**

- `sourceType` defaults to `MANUAL` so existing records and records created without explicit source have a valid non-null value. This makes the field non-nullable without requiring a migration backfill to happen before the column is added.
- `sourceDetail` is nullable because manual contacts have no associated detail string — it is only meaningful for sync, import, and share sources.
- `lastMutatedBy` and `lastMutatedByDetail` use the same `SourceType` enum because the set of actors that can mutate a contact is the same as the set of origins. If these diverge in the future, a separate `MutationActor` enum can be introduced.
- Both `sourceDetail` and `lastMutatedByDetail` are capped at 255 characters at the application layer.

### Backfill Migration

The migration SQL adds the columns with defaults, making all existing rows immediately valid. The application then runs a separate backfill to populate `sourceType` more accurately for contacts that have `importJobId` set.

**Migration SQL** (generated by Prisma, annotated here for clarity):

```sql
ALTER TABLE "Contact"
  ADD COLUMN "sourceType" "SourceType" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "sourceDetail" TEXT,
  ADD COLUMN "lastMutatedBy" "SourceType" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "lastMutatedByDetail" TEXT;
```

This runs with zero downtime. All existing rows get `sourceType = MANUAL` and `lastMutatedBy = MANUAL`.

**Backfill script** (`scripts/backfill-source-type.ts` or a Prisma seed script):

```typescript
// For contacts with importJobId, set sourceType to IMPORT_CSV
// and sourceDetail to the import job's sourceFileName
const contactsWithImport = await prisma.contact.findMany({
  where: { importJobId: { not: null } },
  select: { id: true, importJobId: true },
});

for (const batch of chunk(contactsWithImport, 500)) {
  const jobIds = [...new Set(batch.map(c => c.importJobId!))];
  const jobs = await prisma.importJob.findMany({
    where: { id: { in: jobIds } },
    select: { id: true, sourceFileName: true, sourceProfile: true },
  });
  const jobMap = new Map(jobs.map(j => [j.id, j]));

  await Promise.all(batch.map(contact => {
    const job = jobMap.get(contact.importJobId!);
    return prisma.contact.update({
      where: { id: contact.id },
      data: {
        sourceType: "IMPORT_CSV",
        sourceDetail: job?.sourceFileName ?? job?.sourceProfile ?? null,
      },
    });
  }));
}

// Contacts with syncUid set but no importJobId are likely sync-created
// However, syncUid alone is not sufficient proof — a manually-created contact
// that was later synced will have a syncUid. Only set SYNC_CARDDAV if we can
// confirm the contact was created by a sync pull.
// For Phase 10, leave these as MANUAL and let P10-02 instrumentation handle
// new contacts created by sync going forward.
```

The backfill script is idempotent — re-running it will not change contacts already set to IMPORT_CSV, and will not accidentally overwrite contacts that were manually created after import.

The backfill is a one-time operation. It does not need to be part of the Prisma migration; it runs as a separate script after the schema migration is deployed. This prevents migration timeouts on large databases.

### Setting sourceType on Contact Creation Paths

Every path that creates a new contact must explicitly set `sourceType` and `sourceDetail`. If a path does not set these, the Prisma default (`MANUAL`) applies, which is correct for manual creation but must be overridden for other paths.

#### Manual creation
```typescript
await prisma.contact.create({
  data: {
    // ... fields ...
    sourceType: "MANUAL",
    sourceDetail: null,
    lastMutatedBy: "MANUAL",
    lastMutatedByDetail: null,
  }
});
```

#### Import commit
```typescript
// When creating each contact from the import:
{
  sourceType: "IMPORT_CSV",
  sourceDetail: importJob.sourceFileName ?? importJob.sourceProfile ?? null,
  lastMutatedBy: "IMPORT_CSV",
  lastMutatedByDetail: importJob.sourceFileName ?? importJob.sourceProfile ?? null,
}
```

#### Sync pull (contact creation — first pull of a remote contact)
```typescript
{
  sourceType: "SYNC_CARDDAV",
  sourceDetail: syncAccount.label,
  lastMutatedBy: "SYNC_CARDDAV",
  lastMutatedByDetail: syncAccount.label,
}
```

#### Share received (Phase 12 stub — do not wire yet)
```typescript
{
  sourceType: "SHARED_STATIC", // or SHARED_LIVE
  sourceDetail: senderName,
  lastMutatedBy: "SHARED_STATIC",
  lastMutatedByDetail: senderName,
}
```

### Updating lastMutatedBy on Every Mutation

Every path that updates an existing contact must also update `lastMutatedBy` and `lastMutatedByDetail`. These fields move with every mutation, regardless of the original `sourceType`.

This update happens in the same transaction as the contact mutation and the ActivityEvent emission. The three operations are coordinated:

```typescript
await prisma.$transaction(async (tx) => {
  const before = await tx.contact.findUniqueOrThrow({ where: { id } });
  
  const updated = await tx.contact.update({
    where: { id },
    data: {
      // ... the actual field changes ...
      lastMutatedBy: actorSourceType,
      lastMutatedByDetail: actorDetail,
    }
  });
  
  // P10-02: emit ActivityEvent
  const diffs = computeContactDiff(before, updated);
  if (diffs.length > 0) {
    await emitEvent(tx, { ..., eventType: "CONTACT_UPDATED", payload: { diffs } });
  }
});
```

**Actor-to-SourceType mapping** for `lastMutatedBy`:

| Triggering action | lastMutatedBy | lastMutatedByDetail |
|---|---|---|
| User edits via UI | MANUAL | null |
| Import commit | IMPORT_CSV | import filename |
| Sync pull updates contact | SYNC_CARDDAV | sync account label |
| Sync conflict resolved by user | MANUAL | null |
| Sync conflict resolved by system (local wins) | SYNC_CARDDAV | sync account label |
| Merge accept | MANUAL | null |
| Merge undo | MANUAL | null |
| Share-triggered update (Phase 12) | SHARED_STATIC or SHARED_LIVE | sender name |

### API Surface

Two new API query parameters are needed to support the source badge and "last updated by" UI in P10-04. These should be available on the contact detail endpoint:

**GET /api/contacts/:id** response additions:
```typescript
{
  // ... existing fields ...
  sourceType: "MANUAL" | "IMPORT_CSV" | "SYNC_CARDDAV" | "SHARED_STATIC" | "SHARED_LIVE" | "API",
  sourceDetail: string | null,
  lastMutatedBy: SourceType,
  lastMutatedByDetail: string | null,
  updatedAt: string, // ISO 8601 — already present, used for "last updated by" timestamp
}
```

No new endpoint is needed; these fields are additions to the existing contact response.

### Display Logic for Source Badges (data layer spec — rendering in P10-04)

The mapping from `sourceType` + `sourceDetail` to display strings:

| sourceType | sourceDetail | Display string |
|---|---|---|
| MANUAL | null | "Added manually" |
| IMPORT_CSV | "contacts.csv" | "Imported from contacts.csv" |
| IMPORT_CSV | null | "Imported from file" |
| SYNC_CARDDAV | "iCloud" | "Synced from iCloud" |
| SYNC_CARDDAV | null | "Synced via CardDAV" |
| SHARED_STATIC | "Jane Smith" | "Shared by Jane Smith" |
| SHARED_STATIC | null | "Received via share" |
| SHARED_LIVE | "Jane Smith" | "Live shared by Jane Smith" |
| API | null | "Added via API" |

This mapping lives in `src/lib/activity/formatters.ts` and is used by both the server-rendered contact detail page and any client components.

### Security Considerations

- `sourceDetail` may contain import filenames or sync account labels. These could contain PII if the user named their sync account something like "Mom's iPhone". These fields are user-owned and displayed only to that user, so this is acceptable.
- The backfill script must run with appropriate database credentials and should not be run in an unauthenticated context.
- When filtering contacts by `sourceType` in the API, ensure `userId` scope is always applied — never allow querying contacts by source type without user authentication.

### Error Handling

- If a mutation path fails to set `lastMutatedBy` due to a bug (e.g., the code path was missed), the field retains its previous value. This is a data quality issue, not a data loss issue. The ActivityEvent log still captures the correct actor.
- If the backfill script fails partway through, re-running it is safe because it only updates contacts with `importJobId != null` and `sourceType == MANUAL`.
- Do not throw if `sourceType` or `lastMutatedBy` cannot be mapped from an actor — default to MANUAL with a logged warning.

## Acceptance Criteria

- `sourceType`, `sourceDetail`, `lastMutatedBy`, and `lastMutatedByDetail` fields are present on the Contact model in `prisma/schema.prisma`
- `SourceType` enum is defined with all 6 values
- Prisma migration runs successfully without errors on both a fresh and an existing database
- All existing contacts with `importJobId != null` have `sourceType = IMPORT_CSV` after the backfill script runs
- All other pre-existing contacts have `sourceType = MANUAL`
- A manually created contact has `sourceType = MANUAL` and `lastMutatedBy = MANUAL`
- A contact created via import has `sourceType = IMPORT_CSV` and `sourceDetail` matching the import filename
- A contact created via sync has `sourceType = SYNC_CARDDAV` and `sourceDetail` matching the sync account label
- After a manually-created contact is updated via sync pull, `lastMutatedBy = SYNC_CARDDAV` and `sourceType` remains `MANUAL`
- After a synced contact is manually edited, `lastMutatedBy = MANUAL` and `sourceType` remains `SYNC_CARDDAV`
- The contact detail API endpoint includes `sourceType`, `sourceDetail`, `lastMutatedBy`, and `lastMutatedByDetail`
- TypeScript compilation passes with no new type errors
- Backfill script is idempotent (safe to run multiple times)
- `src/lib/activity/formatters.ts` exports a `formatSourceBadge(sourceType, sourceDetail)` function returning the correct display string for all enum values

## Risks and Open Questions

- **`SHARED_STATIC` vs `SHARED_LIVE` disambiguation**: Phase 12 sharing has not been fully designed. If the sharing model changes, the enum values may need to be renamed. However, since PostgreSQL enums can only have values added, not renamed, choose names that are stable. `SHARED_STATIC` and `SHARED_LIVE` are descriptive and unlikely to need renaming.
- **Sync-created vs manually-created contacts with syncUid**: Some contacts may have a `syncUid` because they were created manually and then synced outbound, not because they arrived via an inbound sync. The backfill cannot distinguish these from genuinely sync-created contacts based on syncUid alone. Leave them as MANUAL in the backfill — only new contacts created via the sync runner after Phase 10 ships will correctly receive `sourceType = SYNC_CARDDAV`.
- **Import format variety**: Currently the `ImportJob.format` field distinguishes CSV from vCard. The `SourceType` enum uses `IMPORT_CSV` as a single value covering both. Consider whether vCard imports should have their own enum value (`IMPORT_VCARD`) for more precise attribution. For Phase 10, `IMPORT_CSV` covers all file-based imports regardless of format; the `sourceDetail` (filename) provides the specificity.
- **lastMutatedBy on archive/restore**: When a contact is archived or restored, should `lastMutatedBy` be updated? The archive/restore operations are mutations in the lifecycle sense. Yes — update `lastMutatedBy` to MANUAL for user-triggered archive/restore.
- **Database migration zero-downtime**: Adding nullable columns with defaults to a large Contact table should be fast in PostgreSQL (instant for nullable columns, near-instant for columns with constant defaults). Verify on staging before running on production.

## Outcome

Every Contact record carries a `sourceType` that permanently records its origin and a `lastMutatedBy` that always reflects the most recent actor, giving the UI all the data it needs to render source badges and last-updated-by attribution without querying ActivityEvent history.
