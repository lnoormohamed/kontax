# P10-01 ActivityEvent Schema

## Purpose
This ticket establishes the foundational data model for a complete, auditable history of every meaningful change to a user's contacts. Without a structured event log, the app has no memory of how contacts arrived, who changed what, or when a sync conflict was resolved. The ActivityEvent table is the permanent, append-only record that powers the per-contact History tab, the global Activity feed, source attribution, and future plan-tier retention controls. Every other Phase 10 ticket depends on this model being correct and stable before instrumentation begins.

## Background
Contacts in Kontax can be mutated by several different actors: the user manually editing a contact, a CSV import job, a CardDAV sync pull or push, a merge operation, a share action, or eventually an API call. Prior to Phase 10, none of these mutation paths wrote a structured record of what changed or why. The Contact model carries `updatedAt` and `importJobId` which give weak origin signals, and MergeDecision carries outcome state, but there is no unified timeline. The Contact model also has `mergedIntoContactId` and `archivedAt` for soft-delete/merge state, but those fields only capture current state, not history of transitions.

The ActivityEvent model introduced in this ticket is designed to complement these existing fields without replacing them. It does not replace the Contact's own fields; it appends context-rich records on top of every state change so the contact's history is fully reconstructable. Phase 11 will add a pruning/retention job that enforces plan-tier event windows — this ticket must design the schema to make that job cheap (i.e. index-driven deletes by `createdAt`).

## Scope

### In Scope
- Defining the `ActivityEvent` Prisma model with all fields, types, and constraints
- Defining the `EventType` enum with all 14 event types
- Defining the `Actor` enum with all 6 actor values
- Adding composite indexes for the two primary query patterns: global feed and per-contact history
- Writing the Prisma migration file
- Documenting the expected payload shape for each event type
- Establishing the append-only invariant at the application layer (no update, no delete paths)

### Out of Scope
- Instrumenting any mutation path to actually write events (P10-02)
- Source tracking fields on Contact (P10-03)
- Any UI surface for displaying events (P10-04, P10-06)
- Retention/pruning logic (Phase 11)
- Backfilling synthetic events for mutations that happened before this phase (not planned — use empty-state messaging in UI instead)

## Design / Implementation Spec

### Data Model

#### New Prisma Model: `ActivityEvent`

```prisma
model ActivityEvent {
  id           String     @id @default(cuid())
  userId       String
  contactId    String?
  eventType    EventType
  actor        Actor
  actorDetail  String?
  payload      Json       @default("{}")
  createdAt    DateTime   @default(now())

  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  contact      Contact?   @relation(fields: [contactId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt(sort: Desc)])
  @@index([contactId, createdAt(sort: Desc)])
}
```

**Field-by-field rationale:**

- `id`: CUID for globally unique, lexicographically sortable identifiers without sequential leakage
- `userId`: Non-nullable. Every event belongs to a user. Required for the global feed query and for multi-tenant data isolation. Uses Cascade delete so if a user account is deleted, all their events are purged.
- `contactId`: Nullable. Most events are contact-scoped, but account-level events (e.g., a future ACCOUNT_EXPORT event) have no contact. When a contact is hard-deleted, this field is set to NULL via `onDelete: SetNull` so the event record survives with a null contact reference. The UI must handle this gracefully by showing "[deleted contact]" instead of a link.
- `eventType`: Non-nullable enum. See EventType enum below.
- `actor`: Non-nullable enum. See Actor enum below. Describes the category of actor, not the specific identity — `actorDetail` carries the specific label.
- `actorDetail`: Nullable string. Human-readable label for the specific actor instance: the sync account label, the import filename, the share sender name, or a system process name. Length should be capped at 255 characters at the application layer to avoid unbounded string storage.
- `payload`: JSON, defaults to empty object. Schema varies per event type — see payload spec below. Must not store full contact snapshots — diffs only for CONTACT_UPDATED. The application layer must validate payload shape before writing.
- `createdAt`: Server-set timestamp, not user-controlled. Uses DB default. Never updated.

#### New Enum: `EventType`

```prisma
enum EventType {
  CONTACT_CREATED
  CONTACT_UPDATED
  CONTACT_ARCHIVED
  CONTACT_RESTORED
  CONTACT_DELETED
  CONTACT_MERGED
  CONTACT_MERGE_UNDONE
  CONTACT_IMPORTED
  CONTACT_SHARED
  CONTACT_SHARE_RECEIVED
  SYNC_PULLED
  SYNC_PUSHED
  SYNC_CONFLICT_DETECTED
  SYNC_CONFLICT_RESOLVED
}
```

**Event type definitions:**

| Event Type | Meaning | contactId | actor |
|---|---|---|---|
| CONTACT_CREATED | A new contact was created manually by the user | created contact | USER |
| CONTACT_UPDATED | One or more fields on a contact were changed | updated contact | USER / SYNC / IMPORT / API |
| CONTACT_ARCHIVED | Contact was soft-deleted (archivedAt set) | archived contact | USER |
| CONTACT_RESTORED | Contact was un-archived | restored contact | USER |
| CONTACT_DELETED | Contact was hard-deleted | null (contact gone) | USER |
| CONTACT_MERGED | Two contacts were merged into one | surviving contact | USER / SYSTEM |
| CONTACT_MERGE_UNDONE | A merge was reversed | surviving contact (now restored) | USER |
| CONTACT_IMPORTED | A contact was created via import job | created contact | IMPORT |
| CONTACT_SHARED | User shared a contact outbound | contact being shared | USER |
| CONTACT_SHARE_RECEIVED | User received a shared contact | created/updated contact | SHARE |
| SYNC_PULLED | A remote change was pulled and applied | affected contact | SYNC |
| SYNC_PUSHED | A local change was propagated to the remote | affected contact | SYNC |
| SYNC_CONFLICT_DETECTED | A sync conflict was detected on a contact | affected contact | SYNC |
| SYNC_CONFLICT_RESOLVED | A sync conflict was resolved | affected contact | USER / SYSTEM |

#### New Enum: `Actor`

```prisma
enum Actor {
  USER
  SYNC
  IMPORT
  SHARE
  FAMILY_MEMBER
  TEAM_MEMBER
  SYSTEM
}
```

**Actor definitions:**

- `USER`: The authenticated user acted directly via the UI or their own API token
- `SYNC`: A CardDAV sync operation (pull or push) was the actor
- `IMPORT`: A CSV or other file import was the actor
- `SHARE`: A share action from another user was the actor (for CONTACT_SHARE_RECEIVED events)
- `FAMILY_MEMBER`: Reserved for Phase 12 family sharing — a family member's action was the actor
- `TEAM_MEMBER`: Reserved for future workspace support — a team member's action was the actor
- `SYSTEM`: An automated internal process (merge suggestion auto-stale, scheduled cleanup, etc.) was the actor

#### Schema Changes to Existing Models

The `Contact` model gains a reverse relation:

```prisma
model Contact {
  // ... existing fields ...
  activityEvents ActivityEvent[]
}
```

The `User` model gains a reverse relation:

```prisma
model User {
  // ... existing fields ...
  activityEvents ActivityEvent[]
}
```

### Payload Schemas Per Event Type

All payloads are typed as `Json` in Prisma but must conform to these TypeScript interfaces at the application layer. A Zod schema should be defined for each in `src/lib/activity/payload-schemas.ts` and used to validate before any write.

#### CONTACT_CREATED
```typescript
interface ContactCreatedPayload {
  // Empty — the fact of creation is the event itself.
  // The contact's fields are readable from the Contact record.
}
```

#### CONTACT_UPDATED
```typescript
interface FieldDiff {
  field: string;      // Prisma field name, e.g. "firstName", "phoneNumbers"
  before: unknown;    // Previous value — scalar or JSON-serializable structure
  after: unknown;     // New value
}

interface ContactUpdatedPayload {
  diffs: FieldDiff[]; // Must be non-empty — if empty, do not emit the event
}
```

The `field` key must use the canonical Prisma field name, not a display label, so that future UI changes do not break diff rendering. The UI layer is responsible for mapping field names to human-readable labels. Arrays (phoneNumbers, emailAddresses, addresses) must serialize the before/after as the full array, not individual element diffs, unless the application layer implements a more granular array diff algorithm in Phase 11 or later.

#### CONTACT_ARCHIVED / CONTACT_RESTORED
```typescript
interface ContactArchivedPayload {
  // Empty — event type communicates state transition.
}
```

#### CONTACT_DELETED
```typescript
interface ContactDeletedPayload {
  // Snapshot of displayable fields captured at delete time,
  // since contactId will be null after deletion.
  fullName: string;
  email?: string;
  phone?: string;
}
```
This is the one exception to the "no snapshots" rule. Since the contact is hard-deleted and contactId will be set to null, the payload must carry enough identifying information for the activity feed to show a meaningful row ("Deleted John Smith").

#### CONTACT_MERGED
```typescript
interface ContactMergedPayload {
  absorbedContactId: string;    // The contact that was merged away
  absorbedContactName: string;  // Display name at time of merge (for history, since absorbed contact is archived)
  fieldResolutions: Array<{
    field: string;
    chosenFrom: "left" | "right" | "both"; // "both" for multi-value fields that were union-merged
  }>;
}
```

#### CONTACT_MERGE_UNDONE
```typescript
interface ContactMergeUndonePayload {
  restoredContactId: string;    // The contact that was restored from the absorbed state
  originalMergeEventId: string; // ID of the CONTACT_MERGED event this reverses
}
```

#### CONTACT_IMPORTED
```typescript
interface ContactImportedPayload {
  importJobId: string;
  sourceFileName: string;
  rowIndex?: number; // Row in the CSV for debugging
}
```

#### CONTACT_SHARED / CONTACT_SHARE_RECEIVED
```typescript
interface ContactSharedPayload {
  shareToken?: string;  // Redacted in UI but useful for debugging
  recipientHint?: string; // e.g. "shared via link" or "shared to user@email.com" (no PII of third parties)
}
```

#### SYNC_PULLED / SYNC_PUSHED
```typescript
interface SyncEventPayload {
  syncAccountId: string;
  syncAccountLabel: string;
  remoteEtag?: string;        // For debugging sync state
  diffs?: FieldDiff[];        // Populated for SYNC_PULLED when fields changed
}
```

#### SYNC_CONFLICT_DETECTED / SYNC_CONFLICT_RESOLVED
```typescript
interface SyncConflictPayload {
  syncAccountId: string;
  syncAccountLabel: string;
  conflictingFields?: string[]; // Field names that conflicted
  resolution?: "local_wins" | "remote_wins" | "manual"; // Populated on RESOLVED
}
```

### Indexes

```prisma
@@index([userId, createdAt(sort: Desc)])  // Global feed: WHERE userId = ? ORDER BY createdAt DESC
@@index([contactId, createdAt(sort: Desc)]) // Per-contact history: WHERE contactId = ? ORDER BY createdAt DESC
```

A third index on `(userId, eventType, createdAt DESC)` is not added yet but should be considered if the Phase 11 pruning job needs to delete events by type. The Phase 11 ticket should evaluate this.

### Append-Only Invariant

The application layer must never update or delete ActivityEvent rows except via the Phase 11 pruning job. To enforce this:

1. No Prisma `update` or `delete` call targeting ActivityEvent should exist outside of `src/lib/activity/pruning.ts`
2. A server-side linting rule or code comment should document this constraint in `src/lib/activity/index.ts`
3. The pruning job deletes by `createdAt < cutoff AND userId = ?` using index-driven deletes — it does not soft-delete

### File Structure

```
src/
  lib/
    activity/
      index.ts              # emitEvent() function — single write entry point
      payload-schemas.ts    # Zod schemas for each payload type
      event-types.ts        # Re-export of EventType and Actor enums
      formatters.ts         # Human-readable label functions for UI
  prisma/
    schema.prisma           # Updated with ActivityEvent, EventType, Actor
    migrations/
      <timestamp>_add_activity_event/
        migration.sql
```

### Migration Considerations

The migration adds two new enums and a new table. The migration is non-destructive — no existing tables are altered except to add the reverse relation, which is a Prisma-level concept only (no SQL column added to Contact or User). The migration can run against a live database with no downtime.

If deploying to a production database that already has data, the migration runs cleanly with no backfill needed. Empty per-contact history tabs and no global feed entries is the expected state immediately after deploy.

### Security Considerations

- ActivityEvent rows are user-scoped. All queries must include `WHERE userId = <authenticated user id>`. The API layer must never allow cross-user event access.
- The `actorDetail` field may contain sync account labels or import filenames that could contain PII (e.g., a filename like "Mom's contacts.csv"). These are stored but should not be logged to application logs or error reporting tools.
- The `payload` field for CONTACT_DELETED contains a contact name and possibly email/phone snapshot. These must be handled with the same data-at-rest protections as the Contact record itself.
- No payload field should contain authentication tokens, passwords, or third-party OAuth tokens.

### Error Handling

- If the Zod payload validation fails at write time, the event must not be written and the calling code must log an error and continue. A failed event write must never roll back the underlying contact mutation — the mutation is more important than the audit log.
- However, since events are written in the same transaction as the mutation, a failed event write will naturally cause the transaction to roll back. The application code should validate payload shape before beginning the transaction to avoid this scenario.
- Out-of-range `actorDetail` strings should be truncated to 255 characters before write, not rejected.

## Acceptance Criteria

- `ActivityEvent` model is present in `prisma/schema.prisma` with all specified fields, types, and relations
- `EventType` enum contains all 14 event type values
- `Actor` enum contains all 6 actor values
- Both composite indexes are present in the schema and migration SQL
- Prisma migration runs successfully against a fresh database
- Prisma migration runs successfully against an existing database with Contact and User rows
- Zod payload schemas are defined for all 14 event types in `src/lib/activity/payload-schemas.ts`
- `emitEvent()` function exists in `src/lib/activity/index.ts` and validates payload before writing
- `emitEvent()` accepts a `PrismaClient` or `PrismaTransaction` parameter so callers can pass their active transaction
- No `update` or `delete` call against ActivityEvent exists outside of the pruning module
- TypeScript compilation passes with no new errors
- The per-contact history query `SELECT * FROM ActivityEvent WHERE contactId = ? ORDER BY createdAt DESC LIMIT 50` uses the index (verified via EXPLAIN)
- The global feed query `SELECT * FROM ActivityEvent WHERE userId = ? ORDER BY createdAt DESC LIMIT 50` uses the index (verified via EXPLAIN)

## Risks and Open Questions

- **Payload size bounds**: The CONTACT_UPDATED payload stores field diffs including `before` and `after` values. For contacts with large multi-value fields (many phone numbers, many addresses), the diff payload could be several KB. Consider a soft cap of 64 KB per payload — if exceeded, store a truncated diff with a flag indicating truncation.
- **Array diff granularity**: Should the CONTACT_UPDATED diff store the full `before`/`after` array for phoneNumbers, or individual element additions/removals? Full-array diffs are simpler to implement but harder to display. A more granular array diff is better UX but harder to implement. Phase 10 starts with full-array diffs; a more granular approach can follow in Phase 11.
- **Enum extensibility**: PostgreSQL enums cannot have values removed, only added. Adding FAMILY_MEMBER and TEAM_MEMBER to Actor now (even if unused) prevents a migration later, but it also adds noise to the schema. Decision: include them now with a comment noting they are reserved.
- **Retention before Phase 11**: Events will accumulate indefinitely until the Phase 11 pruning job is built. For early beta users, this is acceptable. For production launch, Phase 11 should be considered a hard dependency of making the global Activity feed available to Pro users.
- **Clock skew**: `createdAt` is set by the database server. If the application server clock and database server clock differ significantly, event ordering may not match wall-clock mutation order. This is acceptable for an audit log — use database server time consistently.
- **Soft-delete vs hard-delete of contacts**: When a contact is archived (soft-deleted), `contactId` in existing ActivityEvent rows remains valid. When a contact is hard-deleted, `onDelete: SetNull` fires. The CONTACT_DELETED event's payload snapshot is the only record of who was deleted. Confirm that hard-delete is still the intended behavior for contacts, or reconsider to soft-delete-only.

## Outcome

The ActivityEvent Prisma model is migrated, indexed, and validated so that every other Phase 10 ticket has a stable write target for contact mutation events.
