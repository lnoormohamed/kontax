# P9-08 Sync Conflict Handling for Server-Side Writes

## Purpose
When multiple devices sync against the same Kontax account, concurrent writes to the same contact are inevitable. A user who edits "Alice Johnson" on their iPhone while simultaneously editing the same contact in the Kontax web app will create a version conflict: the device's `PUT` request carries a stale ETag, meaning it is trying to overwrite a version of the contact that no longer exists on the server. Without explicit conflict handling, the server must choose between silently discarding one write (data loss) or blindly applying both (data corruption). This ticket defines the conflict detection, logging, and default resolution strategy for server-side writes that arrive with stale or conflicting version information.

## Background
The existing Prisma schema has the `SyncConflict` model with fields for `conflictType`, `status`, `resolutionStrategy`, `localSyncVersion`, `remoteETag`, `localSnapshot`, `remoteSnapshot`, and `resolvedAt`. The `SyncConflictType` enum already includes `VERSION_MISMATCH`. However, the existing `SyncConflict` model is designed for the outbound CardDAV client sync path (Kontax syncing with iCloud/Google), where conflicts arise between Kontax's local state and the remote server's state. This ticket extends the conflict model to also capture inbound conflicts — where the "remote" is a device sending a PUT to the Kontax CardDAV server.

The `Contact.syncVersion` integer is the server's authoritative version counter. `Contact.updatedAt` is the timestamp of the last write. ETag = `"v{syncVersion}"`. When a device sends `PUT` with `If-Match: "v5"` and the server's current `syncVersion` is `7`, that is a VERSION_MISMATCH conflict.

P9-04 already specifies that PUT requests with stale ETags return HTTP 412 Precondition Failed. This ticket provides the full specification for what the server must do beyond returning 412: logging, conflict record creation, resolution strategy, and the extension needed on the `SyncConflict` model.

## Scope

**In scope:**
- VERSION_MISMATCH conflict detection on PUT (stale ETag via `If-Match`)
- `SyncConflict` record creation on conflict detection
- Extension of `SyncConflict` to support inbound (device-write) conflicts: add `conflictSource` enum and `appPasswordId` nullable FK
- Default resolution strategy: last-write-wins (server version is authoritative, device must re-fetch)
- Add `lastErrorAt` and `lastErrorCode` to `SyncConflict` if not present
- Conflict log queryable for future activity log (Phase 10) integration
- Unit test coverage for the conflict detection path
- Documentation of all conflict types that can arise in Phase 9 device sync and how each is handled

**Out of scope:**
- Conflict review UI — deferred to Phase 10 (activity log)
- Three-way merge — the default resolution is last-write-wins; manual merge is Phase 10
- DELETE conflicts (addressed in the risk section, not implemented in v1)
- Full conflict resolution workflow for Pro users

---

## Design / Implementation Spec

### Conflict Types in the Phase 9 Context

| Conflict type | When it occurs | v1 handling |
|---|---|---|
| `VERSION_MISMATCH` | Device sends PUT with stale `If-Match` ETag | Return 412, log conflict, device must re-fetch |
| `DELETE_CONFLICT` | Device deletes a contact that was edited server-side after the device last synced | Return 412 on DELETE if `If-Match` is stale; log conflict |
| `LOCAL_REMOTE_MUTATION` | Two devices edit the same contact before either syncs | The second write gets a 412 (If-Match mismatch); log conflict |
| `MERGE_CONFLICT` | A contact is involved in a Kontax-side merge while a device is mid-sync | Rare; last-write-wins; log conflict |

The `VERSION_MISMATCH` type covers the majority of cases. `LOCAL_REMOTE_MUTATION` is semantically the same as `VERSION_MISMATCH` from the server's perspective (it receives a PUT with a stale ETag regardless of why the version advanced). Use `VERSION_MISMATCH` for all inbound ETag mismatch scenarios in v1.

### Prisma Schema Extensions

The existing `SyncConflict` model requires two additions:

**1. `conflictSource` enum and field:**

```prisma
enum SyncConflictSource {
    OUTBOUND_SYNC    // Conflict during Kontax syncing to an external CardDAV server
    INBOUND_DEVICE   // Conflict from a device writing to the Kontax CardDAV server
}
```

Add to `SyncConflict`:
```prisma
conflictSource     SyncConflictSource @default(OUTBOUND_SYNC)
appPasswordId      String?
appPassword        AppPassword?       @relation(fields: [appPasswordId], references: [id], onDelete: SetNull)
```

The `appPasswordId` field links the conflict to the specific app password (device) that caused it. This enables "which device had the most conflicts?" queries in a future activity log.

Add the inverse relation to `AppPassword`:
```prisma
syncConflicts SyncConflict[]
```

**2. `lastErrorAt` and `lastErrorCode` fields:**

Check whether these fields exist on `SyncConflict`. If not, add them:
```prisma
lastErrorAt        DateTime?
lastErrorCode      String?
```

These fields capture the most recent error that prevented the conflict from being resolved, supporting future retry and display logic.

**3. `remoteSnapshot` usage:**

The existing `remoteSnapshot Json?` field stores the incoming state from the "remote" source. For inbound device writes, populate this with the parsed vCard data from the PUT request body (serialized as JSON). This preserves the device's intended version of the contact for future manual review.

**Migration:**

Run `prisma migrate dev --name add-sync-conflict-source-and-app-password` after adding the enum, fields, and relation.

### Conflict Detection and Logging Function

Add to `src/server/dav/conflicts.ts`:

```typescript
export async function logDeviceWriteConflict({
  contactId,
  appPasswordId,
  clientEtag,
  serverSyncVersion,
  incomingVCardData,
}: {
  contactId: string;
  appPasswordId: string;
  clientEtag: string;
  serverSyncVersion: number;
  incomingVCardData: string; // Raw vCard text from the PUT body
}): Promise<string> // Returns the new SyncConflict.id
```

Implementation:

```typescript
export async function logDeviceWriteConflict(params): Promise<string> {
  const contact = await prisma.contact.findUnique({
    where: { id: params.contactId },
    select: {
      id: true,
      userId: true,
      syncVersion: true,
      fullName: true,
      email: true,
      phone: true,
      company: true,
      notes: true,
      updatedAt: true,
      // ... all contact fields for snapshot
    },
  });

  if (!contact) {
    throw new Error(`Contact ${params.contactId} not found for conflict logging`);
  }

  const conflict = await prisma.syncConflict.create({
    data: {
      // syncAccountId is required but there is no SyncAccount for inbound device writes.
      // Use a sentinel approach: create a virtual "device-write" SyncAccount per user,
      // or make syncAccountId nullable (see schema note below).
      conflictType: "VERSION_MISMATCH",
      conflictSource: "INBOUND_DEVICE",
      status: "OPEN",
      resolutionStrategy: "KEEP_LOCAL", // server wins by default
      contactId: params.contactId,
      appPasswordId: params.appPasswordId,
      localSyncVersion: params.serverSyncVersion,
      remoteETag: params.clientEtag,
      localSnapshot: contact as unknown as Prisma.InputJsonValue,
      remoteSnapshot: { rawVCard: params.incomingVCardData },
      detectedAt: new Date(),
    },
  });

  return conflict.id;
}
```

**Schema consideration:** The existing `SyncConflict.syncAccountId` is required (non-nullable). For inbound device write conflicts, there is no `SyncAccount` row. Two options:
1. Make `syncAccountId` nullable in the schema (requires a migration that touches all existing conflict rows — acceptable since existing conflicts can have `syncAccountId` set to null with a default migration)
2. Create a special "device-write sentinel" `SyncAccount` row per user with `provider = CARDDAV` and a known label like `__DEVICE_WRITES__`

**Recommended: Option 1 — make `syncAccountId` nullable.** This is cleaner and avoids polluting the `SyncAccount` table with sentinel rows. Migration:

```sql
ALTER TABLE "SyncConflict" ALTER COLUMN "syncAccountId" DROP NOT NULL;
```

Update the `SyncConflict` model in Prisma:
```prisma
syncAccountId  String?
syncAccount    SyncAccount? @relation(...)
```

### Integration with PUT Handler

In the PUT route handler (`src/app/dav/addressbooks/[userId]/default/[uid]/route.ts`), after detecting a stale ETag:

```typescript
// Existing code returns 412 here
if (ifMatchHeader && etagForContact(contact) !== ifMatchHeader) {
  // Log the conflict
  await logDeviceWriteConflict({
    contactId: contact.id,
    appPasswordId: authResult.appPasswordId,
    clientEtag: ifMatchHeader,
    serverSyncVersion: contact.syncVersion,
    incomingVCardData: await request.text(), // Already read earlier in the handler
  });

  return new Response(
    `<?xml version="1.0" encoding="utf-8"?>
<d:error xmlns:d="DAV:">
  <d:precondition-failed/>
</d:error>`,
    {
      status: 412,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "DAV": "1, addressbook",
        "ETag": etagForContact(contact), // Return current ETag so client knows what to re-fetch with
      },
    },
  );
}
```

**Important:** The `request.text()` / `request.body` stream can only be read once. If the PUT handler reads the body for vCard parsing before the ETag check, the body is consumed. Use a pattern where the body is read once into a string variable at the start of the handler, and that string is used for both parsing and conflict logging.

### Resolution Strategy: Last-Write-Wins

The default resolution for inbound device conflicts is **server-is-authoritative** (equivalent to `KEEP_LOCAL` in the `SyncResolutionStrategy` enum). This means:

1. The server returns 412 to the device
2. The device is expected to re-fetch the current contact, merge its changes locally, and re-send a PUT with the correct (current) ETag
3. iOS and DAVx⁵ both implement this retry logic — they will re-fetch the current vCard, apply the user's change on top of the current server version, and send a new PUT. In practice, this "last-write-wins" behaviour resolves most conflicts transparently.
4. If the device sends a second PUT with the updated ETag and it still conflicts (because of another concurrent write), the cycle repeats.

**What "server authoritative" means in practice:** The server never silently accepts a stale write. It always returns the current state (via the 412 response including the current ETag in the header), allowing the client to re-base its change. This is safer than blindly accepting the device's version (which would lose the server's change).

### Conflict Record Lifecycle

| Event | Effect on SyncConflict |
|---|---|
| 412 returned to device | `status = OPEN`, `detectedAt = now()` |
| Device retries successfully (sends PUT with correct ETag) | No automatic update — the conflict record remains `OPEN` until reviewed |
| Pro user reviews conflict in activity log (Phase 10) | `status = RESOLVED` or `IGNORED`, `resolvedAt = now()` |
| Contact is deleted (tombstoned) | Conflict record's `contactId` reference becomes nullable via cascade |

Conflict records are never automatically resolved in v1. They accumulate and are surfaced to Pro users in Phase 10. Free and Plus users cannot review conflicts but their conflict records are still stored for potential future use.

### Conflict Queries for Phase 10 Integration

Ensure the following queries are supported by the data model (these will be used in Phase 10 but should be designed now):

```typescript
// Get open device-write conflicts for a user
prisma.syncConflict.findMany({
  where: {
    contact: { userId },
    conflictSource: "INBOUND_DEVICE",
    status: "OPEN",
  },
  orderBy: { detectedAt: "desc" },
  include: {
    contact: { select: { fullName: true, syncUid: true } },
    appPassword: { select: { label: true } },
  },
});

// Count open conflicts per device (for activity log summary)
prisma.syncConflict.groupBy({
  by: ["appPasswordId"],
  where: {
    contact: { userId },
    conflictSource: "INBOUND_DEVICE",
    status: "OPEN",
  },
  _count: { id: true },
});
```

Add an index to support these queries efficiently:

```prisma
@@index([conflictSource, status, detectedAt])
```

This index does not currently exist on `SyncConflict`. Add it in the migration.

### Conflict Rate Monitoring

Add a metric or log line for every conflict created:

```typescript
console.log(
  JSON.stringify({
    event: "carddav_write_conflict",
    userId,
    contactId: contact.id,
    appPasswordId: authResult.appPasswordId,
    clientEtag,
    serverSyncVersion: contact.syncVersion,
    conflictId: newConflictId,
  }),
);
```

This allows production monitoring (e.g. Datadog, Sentry, or log aggregation) to alert if conflict rates spike, which could indicate a client bug or a sync loop.

### Edge Cases

**DELETE with stale ETag:**

A device sends `DELETE /dav/addressbooks/{userId}/default/{uid}.vcf` with `If-Match: "v3"` but the server has `syncVersion = 5`. This is the `DELETE_CONFLICT` scenario. Handle it the same way as PUT conflicts:
1. Return 412
2. Log a `SyncConflict` with `conflictType = VERSION_MISMATCH` (or `DELETE_CONFLICT` — use `DELETE_CONFLICT` to distinguish from PUT conflicts in Phase 10 queries)
3. The device will re-fetch the current ETag and decide whether to resend the DELETE

**Conflict on a contact that is already tombstoned:**

A device sends PUT for a UID that has `syncTombstoneAt` set. This means the contact was deleted on the Kontax side while the device was mid-edit. Options:
- Revive the contact with the device's PUT body (treat as a re-creation — see P9-04)
- Return 404 and log a conflict

v1 recommendation: Revive the contact. The device's intent is clear (it wants the contact to exist). Log a conflict with `conflictType = DELETE_CONFLICT` to record that a resurrection occurred.

**No `If-Match` header on PUT:**

Many clients do not send `If-Match` on the first PUT (when creating a new contact). Some also omit it on updates if they do not track ETags. In this case, apply last-write-wins silently (no conflict logged). This is the correct behaviour for a put-without-conditions — the client is saying "I don't care about the current state, apply this".

Only log a conflict when `If-Match` is present and does not match. Without `If-Match`, there is no expressed conditional and no detectable conflict.

**Concurrent PUTs for the same UID from two devices:**

Device A and Device B both send PUT for `contact123.vcf` at the same time. One will commit first (within a transaction). The second will either:
- If it sent `If-Match`: receive 412 and log a conflict (correct)
- If it sent no `If-Match`: silently overwrite the first device's change (last-write-wins, no conflict logged)

This is acceptable in v1. Simultaneous edits without `If-Match` are a data race that CardDAV does not solve at the protocol level.

### Auto-Resolution Timer (Future — not v1)

Future consideration: automatically mark OPEN conflicts as IGNORED after 30 days if no Pro review has occurred. This keeps the conflict table from growing unbounded. Not implemented in v1 — conflicts accumulate indefinitely. Add a note to the Phase 10 activity log ticket to address this.

---

## Acceptance Criteria

- The `SyncConflict` model has `conflictSource`, `appPasswordId`, `lastErrorAt`, and `lastErrorCode` fields after migration.
- `syncAccountId` on `SyncConflict` is nullable (migration applied cleanly with no data loss).
- A PUT request with a stale `If-Match` ETag returns HTTP 412.
- A `SyncConflict` record with `conflictType = VERSION_MISMATCH` and `conflictSource = INBOUND_DEVICE` is created on every 412 response.
- The conflict record's `localSnapshot` contains the current server state of the contact (as JSON).
- The conflict record's `remoteSnapshot` contains the vCard body sent by the device (as JSON with a `rawVCard` key).
- The conflict record's `appPasswordId` references the app password used by the device that triggered the conflict.
- A PUT request without `If-Match` that conflicts with the server version is accepted (last-write-wins, no conflict logged).
- A PUT request with a matching `If-Match` ETag succeeds and increments `syncVersion`.
- The 412 response body is valid XML (`d:error` / `d:precondition-failed`).
- The 412 response includes the current `ETag:` header so clients know what version to re-fetch.
- Conflict records are queryable by `conflictSource = INBOUND_DEVICE` and `status = OPEN` filtered by user.
- Unit tests cover: correct 412 on stale ETag, conflict record created, correct success on matching ETag, no conflict on missing If-Match header.
- A conflict log line is emitted to structured logs on every conflict creation.

---

## Risks and Open Questions

- **`syncAccountId` nullability migration:** Existing `SyncConflict` rows have `syncAccountId` populated. Making the column nullable is a backward-compatible schema change (nullable is a superset of non-null). Confirm the migration does not require backfilling or rebuilding indexes.
- **Conflict record volume:** A user with 5 connected devices who frequently edits contacts could generate many conflict records. For a contact edited 10 times in a day across 3 devices, potentially 20 conflict records. Until Phase 10 provides a UI to resolve them, these accumulate. Add a maximum retention policy (e.g. auto-ignore after 90 days) in a future pass, or add a `conflict_count` limit warning to the Phase 10 ticket.
- **Conflict loop risk:** A naive client that retries a stale PUT in a loop (without re-fetching the current ETag first) will generate a conflict record on every attempt. This is a client bug, but the server must not enter an infinite error loop. Rate limiting on PUT attempts (similar to the auth rate limit) would prevent abuse, but is not strictly required in v1.
- **`remoteSnapshot` raw vCard size:** A full vCard can be several kilobytes. For a contact with a large PHOTO (base64-encoded), it could be 100+ KB. Storing this in `remoteSnapshot` (JSONB in Postgres) is acceptable for typical contacts but could be problematic for large photos. For v1, cap the `rawVCard` size in `remoteSnapshot` at 50 KB and truncate with a note if exceeded.
- **Conflict on contacts created by import:** If a contact was imported and then edited on a device, the device may send a PUT with an ETag that predates the import. This should be handled the same as any stale ETag — 412 with conflict log.
- **Phase 10 dependency:** The conflict records created in this ticket are designed to power the Phase 10 activity log UI. If Phase 10 changes the data model requirements, these records may need backfilling or schema adjustments. Ensure the Phase 10 ticket references this design.

---

## Outcome
This ticket is done when PUT requests with stale ETags reliably return HTTP 412, create a structured `SyncConflict` record linking the device (app password) and the conflicted contact, and the conflict records are queryable in a form that Phase 10 can build an activity log on top of.
