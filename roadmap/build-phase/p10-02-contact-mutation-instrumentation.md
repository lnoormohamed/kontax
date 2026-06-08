# P10-02 Contact Mutation Instrumentation

## Purpose
This ticket wires ActivityEvent creation into every code path that mutates a contact. Without instrumentation, the ActivityEvent schema from P10-01 sits empty and the History tab, source tracking, and global feed have nothing to display. The instrumentation must be comprehensive — every mutation path, including obscure ones like import rollback and conflict resolution, must emit a correctly shaped event. Gaps here mean silent mutations that users cannot trace, which undermines the reliability of the audit log.

## Background
Kontax has multiple distinct code paths that create or change contacts:

1. **Manual CRUD** — Server Actions in `src/app/actions/contacts.ts` handle create, update, archive, restore, and delete operations triggered by the user via the UI
2. **Import** — Import job commit writes N contacts in a batch after a CSV is parsed and confirmed; import rollback deletes those contacts
3. **Merge** — Merge accept writes field resolutions to the surviving contact and archives the absorbed contact; merge undo reverses this
4. **CardDAV sync** — Sync runner applies remote changes (SYNC_PULLED) and propagates local changes (SYNC_PUSHED); conflict detection and resolution are separate events
5. **Share** — Currently reserved for Phase 12 but the CONTACT_SHARED and CONTACT_SHARE_RECEIVED event types must have placeholder emit points stubbed

The existing `src/server/phonetics.ts` module is referenced by the duplicate detection engine and is not a mutation path. The git status shows `src/app/actions/contacts.ts` and `src/server/phonetics.ts` as modified, which means active work is in progress on these files — instrumentation must be applied without conflicting with those changes.

P10-01 established `emitEvent(tx, payload)` as the single write entry point. This ticket's job is to call that function from the right places with the right data.

## Scope

### In Scope
- Instrumenting `src/app/actions/contacts.ts` for manual create, update, archive, restore, delete
- Instrumenting the import commit path (batch insert of ActivityEvent rows)
- Instrumenting the import rollback path
- Instrumenting the merge accept path
- Instrumenting the merge undo path
- Instrumenting the sync pull path (remote change applied to local contact)
- Instrumenting the sync push path (local change propagated to remote)
- Instrumenting sync conflict detected
- Instrumenting sync conflict resolved
- Writing a diff computation utility `computeContactDiff()` for CONTACT_UPDATED events
- Ensuring all events are emitted within the same DB transaction as the mutation
- Batch insert for import commit events

### Out of Scope
- CONTACT_SHARED and CONTACT_SHARE_RECEIVED paths (Phase 12) — stubs are acceptable
- Per-contact History UI (P10-04)
- Global feed UI (P10-06)
- Source tracking field updates on Contact (P10-03 — though this ticket must be compatible with those fields being updated in the same transaction)
- Testing the UI display of events

## Design / Implementation Spec

### Core Diff Utility

The most critical utility for this ticket is `computeContactDiff()`, which computes the field-level diff for CONTACT_UPDATED events. This must be written and tested before any instrumentation begins, because every update path depends on it.

**Location**: `src/lib/activity/diff.ts`

```typescript
import type { Contact } from "@prisma/client";

export interface FieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

/**
 * Computes a field-level diff between two versions of a contact.
 * Returns only fields that changed. Returns empty array if nothing changed.
 * Ignores internal system fields: id, userId, createdAt, syncVersion, syncUid.
 */
export function computeContactDiff(
  before: Partial<Contact>,
  after: Partial<Contact>
): FieldDiff[] {
  const IGNORED_FIELDS = new Set([
    "id", "userId", "createdAt", "syncVersion", "syncUid",
    "updatedAt", // updatedAt changes on every write, not meaningful in diff
    "sourceType", "sourceDetail", // source tracking — separate concern
    "lastMutatedBy", "lastMutatedByDetail", // source tracking — separate concern
  ]);

  const diffs: FieldDiff[] = [];

  const allKeys = new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ]) as Set<keyof Contact>;

  for (const key of allKeys) {
    if (IGNORED_FIELDS.has(key)) continue;

    const beforeVal = before[key];
    const afterVal = after[key];

    if (!deepEqual(beforeVal, afterVal)) {
      diffs.push({ field: key, before: beforeVal, after: afterVal });
    }
  }

  return diffs;
}
```

The `deepEqual` function must handle JSON fields (stored as Prisma `Json` — may be objects or arrays) and scalar fields. Use a simple recursive equality check — do not use `JSON.stringify` comparison because key ordering is not guaranteed for objects.

**Zero-diff guard**: If `computeContactDiff` returns an empty array, no CONTACT_UPDATED event must be emitted. This prevents phantom events when code updates a contact record with identical values (e.g., a sync that re-applies a change already present locally).

### Manual CRUD Instrumentation (`src/app/actions/contacts.ts`)

All Server Actions already run in the same request context. The instrumentation pattern for each operation:

#### createContact
```
1. Begin transaction (or use existing tx)
2. INSERT contact → get created contact record
3. emitEvent(tx, {
     userId: contact.userId,
     contactId: contact.id,
     eventType: "CONTACT_CREATED",
     actor: "USER",
     actorDetail: null,
     payload: {}
   })
4. Commit
```

The CONTACT_CREATED event has an empty payload because the contact's fields are readable directly from the Contact record. There is no "before" state.

#### updateContact
```
1. Begin transaction
2. SELECT current contact state (before snapshot) — read within the transaction for consistency
3. UPDATE contact → get updated contact record
4. diffs = computeContactDiff(beforeSnapshot, updatedContact)
5. IF diffs.length === 0: skip event emission, commit
6. ELSE: emitEvent(tx, {
     userId: contact.userId,
     contactId: contact.id,
     eventType: "CONTACT_UPDATED",
     actor: "USER",
     actorDetail: null,
     payload: { diffs }
   })
7. Commit
```

The "before" snapshot must be read inside the same transaction using `SELECT FOR UPDATE` or equivalent to prevent a race condition where another concurrent update changes the contact between the read and the write. In PostgreSQL with Prisma, wrapping in `prisma.$transaction()` with serializable isolation or using `FOR UPDATE` achieves this.

#### archiveContact
```
emitEvent with CONTACT_ARCHIVED, actor USER, empty payload
```

#### restoreContact
```
emitEvent with CONTACT_RESTORED, actor USER, empty payload
```

#### deleteContact
```
1. Read contact name/email/phone BEFORE deletion (contact will be gone after)
2. DELETE contact (hard delete)
3. emitEvent(tx, {
     userId,
     contactId: null,  // contact is deleted — use null
     eventType: "CONTACT_DELETED",
     actor: "USER",
     actorDetail: null,
     payload: {
       fullName: contact.fullName ?? `${contact.firstName} ${contact.lastName}`.trim(),
       email: contact.emailAddresses?.[0]?.address,
       phone: contact.phoneNumbers?.[0]?.number,
     }
   })
```

Note: contactId is set to null here because by the time the event is read later, the contact record will not exist. Alternatively, the contact could be soft-deleted only (archived) and contactId retained. If hard-delete is used, the payload snapshot is the only trace. Confirm the delete path behavior before implementing.

### Import Instrumentation

Import commit can write hundreds of contacts in a single job. Writing individual `emitEvent()` calls in a loop is acceptable if each is awaited, but generates N round-trips to the database. Use `prisma.activityEvent.createMany()` for batch insert.

**Import commit path** (location: wherever `ImportJob` status is set to COMPLETED and contacts are written):

```typescript
// After all contacts are created in the transaction:
const importEvents = createdContacts.map(contact => ({
  userId: contact.userId,
  contactId: contact.id,
  eventType: "CONTACT_IMPORTED" as const,
  actor: "IMPORT" as const,
  actorDetail: importJob.sourceFileName ?? importJob.sourceProfile ?? null,
  payload: {
    importJobId: importJob.id,
    sourceFileName: importJob.sourceFileName,
  },
  createdAt: new Date(),
}));

await tx.activityEvent.createMany({ data: importEvents });
```

The `actorDetail` for import events must be the import file's original filename, not an internal ID. This is what appears in the History tab row as "Imported from contacts-export.csv". If `sourceFileName` is null (e.g., a programmatic import), fall back to `sourceProfile`.

**Import rollback path** (when an ImportJob is rolled back and its contacts are deleted):

For each contact deleted as part of rollback, emit a CONTACT_DELETED event with the same snapshot approach as manual delete. However, import rollbacks may involve hundreds of contacts — use createMany here as well, capturing names before deletion.

```typescript
// Read contacts to delete BEFORE deleting them
const contactsToDelete = await tx.contact.findMany({
  where: { importJobId: importJob.id },
  select: { id: true, userId: true, fullName: true, firstName: true, lastName: true }
});

// Delete contacts
await tx.contact.deleteMany({ where: { importJobId: importJob.id } });

// Batch emit events
await tx.activityEvent.createMany({
  data: contactsToDelete.map(c => ({
    userId: c.userId,
    contactId: null,
    eventType: "CONTACT_DELETED",
    actor: "IMPORT",
    actorDetail: importJob.sourceFileName,
    payload: {
      fullName: c.fullName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
    },
    createdAt: new Date(),
  }))
});
```

### Merge Instrumentation

**Merge accept path** (location: merge resolution action):

Two events must fire when a merge is accepted:
1. CONTACT_MERGED on the surviving contact (with absorbed contact info in payload)
2. CONTACT_ARCHIVED on the absorbed contact (since it is archived, not deleted)

```typescript
await tx.activityEvent.create({
  data: {
    userId,
    contactId: survivingContactId,
    eventType: "CONTACT_MERGED",
    actor: "USER",
    actorDetail: null,
    payload: {
      absorbedContactId,
      absorbedContactName: absorbedContact.fullName ?? "",
      fieldResolutions,
    }
  }
});

await tx.activityEvent.create({
  data: {
    userId,
    contactId: absorbedContactId,
    eventType: "CONTACT_ARCHIVED",
    actor: "SYSTEM",
    actorDetail: "merged",
    payload: {}
  }
});
```

**Bulk merge accept**: When the user bulk-accepts multiple HIGH confidence suggestions, each pair fires its own pair of events independently. There must be no single "bulk merged N contacts" event — individual events per pair are required so each merge remains individually undoable.

**Merge undo path**:

```typescript
// The merge undo restores the absorbed contact and reverts fields on the surviving contact
await tx.activityEvent.create({
  data: {
    userId,
    contactId: survivingContactId,
    eventType: "CONTACT_MERGE_UNDONE",
    actor: "USER",
    payload: {
      restoredContactId: absorbedContactId,
      originalMergeEventId: mergeEventId,
    }
  }
});

// Also emit CONTACT_RESTORED on the previously-absorbed contact
await tx.activityEvent.create({
  data: {
    userId,
    contactId: absorbedContactId,
    eventType: "CONTACT_RESTORED",
    actor: "USER",
    payload: {}
  }
});

// Also emit CONTACT_UPDATED on the surviving contact if fields changed
const diffs = computeContactDiff(survivorAfterUndo, survivorBeforeUndo);
if (diffs.length > 0) {
  await tx.activityEvent.create({
    data: {
      userId,
      contactId: survivingContactId,
      eventType: "CONTACT_UPDATED",
      actor: "USER",
      payload: { diffs }
    }
  });
}
```

### Sync Instrumentation

The sync runner operates on contacts in batch. Each contact affected by a sync pull or push should emit its own event. For large syncs, this again warrants `createMany`.

**SYNC_PULLED** (remote change applied to local contact):

```typescript
// After applying remote changes to a contact:
const diffs = computeContactDiff(beforeContact, afterContact);

await tx.activityEvent.create({
  data: {
    userId,
    contactId: contact.id,
    eventType: "SYNC_PULLED",
    actor: "SYNC",
    actorDetail: syncAccount.label,
    payload: {
      syncAccountId: syncAccount.id,
      syncAccountLabel: syncAccount.label,
      diffs: diffs.length > 0 ? diffs : undefined,
    }
  }
});
```

Note: SYNC_PULLED is emitted even if no fields changed (e.g., sync checked the contact and confirmed it's up to date). This is different from CONTACT_UPDATED where we skip on zero diffs. The reason is that SYNC_PULLED communicates "a sync happened and looked at this contact", which is independently useful. However, this will create a lot of events for heavy sync users — reconsider whether to only emit SYNC_PULLED when fields actually changed. Lean towards emitting only when diffs.length > 0 to keep the log focused on meaningful changes.

**SYNC_PUSHED** (local change propagated to remote):

Same pattern as SYNC_PULLED, using SYNC_PUSHED event type.

**SYNC_CONFLICT_DETECTED**:

```typescript
await tx.activityEvent.create({
  data: {
    userId,
    contactId: contact.id,
    eventType: "SYNC_CONFLICT_DETECTED",
    actor: "SYNC",
    actorDetail: syncAccount.label,
    payload: {
      syncAccountId: syncAccount.id,
      syncAccountLabel: syncAccount.label,
      conflictingFields: conflictingFieldNames,
    }
  }
});
```

**SYNC_CONFLICT_RESOLVED**:

```typescript
await tx.activityEvent.create({
  data: {
    userId,
    contactId: contact.id,
    eventType: "SYNC_CONFLICT_RESOLVED",
    actor: resolution === "manual" ? "USER" : "SYSTEM",
    actorDetail: syncAccount.label,
    payload: {
      syncAccountId: syncAccount.id,
      syncAccountLabel: syncAccount.label,
      conflictingFields: conflictingFieldNames,
      resolution: resolution, // "local_wins" | "remote_wins" | "manual"
    }
  }
});
```

### Transaction Discipline

All `emitEvent()` calls must be made with a Prisma transaction client (`tx`), not the global `prisma` client. This ensures the event and the mutation are atomically committed or rolled back together.

The preferred pattern is:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Read before-state if needed
  // 2. Write mutation
  // 3. Emit event(s)
  // All three steps use `tx`
});
```

If an existing code path uses the global `prisma` client directly (not inside a transaction), it must be refactored to use a transaction before instrumentation is added. Do not add `emitEvent(prisma, ...)` — always use the transaction client.

### Payload Validation Before Write

Before each `emitEvent()` call, validate the payload against the appropriate Zod schema. If validation fails:

1. Log an error with the validation failure details
2. Write the event with an empty payload (`{}`) rather than the malformed payload, so the event type and actor are still recorded
3. Do not throw — the mutation must complete successfully

This prevents a payload serialization bug from breaking the entire contact save flow.

### emitEvent() Function Signature

`src/lib/activity/index.ts`:

```typescript
import { Prisma, EventType, Actor } from "@prisma/client";

interface EmitEventInput {
  userId: string;
  contactId?: string | null;
  eventType: EventType;
  actor: Actor;
  actorDetail?: string | null;
  payload?: Record<string, unknown>;
}

export async function emitEvent(
  tx: Prisma.TransactionClient,
  input: EmitEventInput
): Promise<void> {
  const validatedPayload = validatePayload(input.eventType, input.payload ?? {});
  await tx.activityEvent.create({
    data: {
      userId: input.userId,
      contactId: input.contactId ?? null,
      eventType: input.eventType,
      actor: input.actor,
      actorDetail: input.actorDetail
        ? input.actorDetail.slice(0, 255)
        : null,
      payload: validatedPayload,
    },
  });
}
```

### Instrumentation Checklist

The following paths must all be instrumented before this ticket is considered complete:

| Path | File | Event Type(s) |
|---|---|---|
| Manual contact create | `src/app/actions/contacts.ts` | CONTACT_CREATED |
| Manual contact update | `src/app/actions/contacts.ts` | CONTACT_UPDATED (if diffs) |
| Manual contact archive | `src/app/actions/contacts.ts` | CONTACT_ARCHIVED |
| Manual contact restore | `src/app/actions/contacts.ts` | CONTACT_RESTORED |
| Manual contact delete | `src/app/actions/contacts.ts` | CONTACT_DELETED |
| Import job commit | import commit path | CONTACT_IMPORTED (batch) |
| Import job rollback | import rollback path | CONTACT_DELETED (batch) |
| Merge accept (single) | merge action | CONTACT_MERGED + CONTACT_ARCHIVED |
| Merge accept (bulk) | merge action | CONTACT_MERGED + CONTACT_ARCHIVED per pair |
| Merge undo | merge undo action | CONTACT_MERGE_UNDONE + CONTACT_RESTORED + CONTACT_UPDATED (if diffs) |
| Sync pull applied | sync runner | SYNC_PULLED (if diffs) |
| Sync push propagated | sync runner | SYNC_PUSHED |
| Sync conflict detected | sync runner | SYNC_CONFLICT_DETECTED |
| Sync conflict resolved | sync runner | SYNC_CONFLICT_RESOLVED |

### Integration with P10-03 Source Tracking

P10-03 adds `lastMutatedBy` and `lastMutatedByDetail` to the Contact model. These fields must be updated in the same transaction as the mutation, alongside the ActivityEvent emission. The instrumentation in this ticket must be compatible with P10-03 field updates being added to the same transaction block. The recommended pattern:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Read before-state
  const before = await tx.contact.findUniqueOrThrow({ where: { id: contactId } });
  
  // 2. Write mutation
  const after = await tx.contact.update({ where: { id: contactId }, data: { ...fields } });
  
  // 3. Update source tracking (P10-03)
  await tx.contact.update({
    where: { id: contactId },
    data: { lastMutatedBy: actorEnum, lastMutatedByDetail: actorDetail }
  });
  
  // 4. Emit event (P10-02)
  const diffs = computeContactDiff(before, after);
  if (diffs.length > 0) {
    await emitEvent(tx, { ..., eventType: "CONTACT_UPDATED", payload: { diffs } });
  }
});
```

Steps 3 and 4 can be combined if P10-03 is merged before P10-02, or done in sequence within the same transaction if developed in parallel.

## Acceptance Criteria

- Every path in the instrumentation checklist emits its corresponding event type(s)
- `computeContactDiff()` returns an empty array when before and after states are identical, and a populated array when fields differ
- No CONTACT_UPDATED event is emitted when the diff is empty
- Import commit emits CONTACT_IMPORTED events via `createMany` batch insert
- Import rollback emits CONTACT_DELETED events via `createMany` batch insert
- Merge accept emits both CONTACT_MERGED and CONTACT_ARCHIVED in the same transaction
- Merge undo emits CONTACT_MERGE_UNDONE, CONTACT_RESTORED, and optionally CONTACT_UPDATED in the same transaction
- Sync pull emits SYNC_PULLED only when diffs are present
- All events are emitted using a transaction client, never the global Prisma client
- Payload validation failures result in an empty payload, not a thrown error and not a skipped mutation
- `actorDetail` is populated for SYNC events (sync account label) and IMPORT events (source filename)
- TypeScript compilation passes with no new type errors
- Unit tests cover `computeContactDiff()` with identical, partially changed, and fully changed contact states
- Integration tests confirm that a contact update followed by a fetch of ActivityEvent returns one event with correct diffs

## Risks and Open Questions

- **Transaction refactoring cost**: Some existing mutation paths may not be wrapped in Prisma transactions. Refactoring them to use transactions before adding event emission adds scope to this ticket. Audit the mutation paths first and document which ones require transaction wrapping.
- **Sync runner batch size**: If the sync runner processes hundreds of contacts per run, per-contact event emission inside the sync transaction may be slow. Consider batching the event inserts within the sync transaction even if the contact updates are individual.
- **Import rollback before-snapshot**: Import rollback deletes contacts that were just created by the import. The payload snapshot (name/email/phone) must be captured before deletion. Ensure the rollback path reads contacts before deleting them — if it currently uses `deleteMany` without a prior `findMany`, this must be refactored.
- **Race condition in updateContact**: The "read before, write after, diff" pattern has a window between the read and write. In a single-user app without concurrent edit sessions, this is acceptable. With future multi-device or team editing, this would need `SELECT FOR UPDATE`.
- **Merge undo field reversion**: When a merge is undone, the surviving contact's fields may need to be reverted to their pre-merge state. If the surviving contact was also updated after the merge, partial reversion is complex. For Phase 10, undo is only available within 30 days and reverts all fields to pre-merge state — subsequent edits after the merge are overwritten by the undo.
- **actorDetail for system-initiated merges**: If the duplicate detection engine ever auto-merges contacts without user confirmation (not planned), the actor would be SYSTEM. Ensure the merge accept path has a parameter for actor rather than hardcoding USER.

## Outcome

Every contact mutation path emits a correctly shaped, transactionally consistent ActivityEvent so that the per-contact history and global feed have complete, trustworthy data from the moment this ticket ships.
