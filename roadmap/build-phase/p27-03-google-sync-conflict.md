# P27-03 — Google Sync Conflict Handling

## Purpose

Implement conflict detection and resolution for Google Contacts sync: detect when both Kontax and Google have changed a contact since the last sync, log a `SyncConflict` row, and apply the account's conflict policy (`SERVER_WINS`, `DEVICE_WINS`, or `MANUAL`). Google uses `etag` values on each contact as the ETag equivalent for optimistic concurrency.

## Background

The Phase 5 conflict model (P5-04) defines conflict detection semantics and `SyncConflict` rows. Phase 23's P23-05 implements conflict resolution UI and the `conflictPolicy` enforcement. This ticket wires Google-specific conflict detection into that infrastructure. Google's `etag` on each `Person` object changes whenever the contact is modified on Google's side — comparing the stored `SyncLink.remoteEtag` against the current `etag` detects remote modifications.

## Scope

**In scope:**
- ETag comparison in the pull phase: if `person.etag !== syncLink.remoteEtag` AND the Kontax contact was modified since last sync → conflict
- Tombstone handling: Google marks deleted contacts with `metadata.deleted: true` in incremental sync responses; apply the `SyncConflict` or direct delete based on the conflict policy
- Push phase: use `people.updateContact` with `updatePersonFields` to only push changed fields; Google returns 409 if the remote was modified (handle as a conflict)
- `SyncConflict` row creation with `localSnapshot` (Kontax state) and `remoteSnapshot` (Google `Person` object)
- `ActivityEvent` emission for `CONTACT_DELETED` when a Google-side delete is applied

**Out of scope:**
- Conflict resolution UI (P23-05)
- Incremental sync implementation (P27-01)

---

## Design / Implementation Spec

### Conflict detection in pull phase

```typescript
async function processSingleGoogleContact(
  person: GooglePerson,
  syncAccountId: string,
  conflictPolicy: ConflictPolicy,
): Promise<void> {
  const remoteId = person.resourceName!;

  const syncLink = await db.syncLink.findUnique({
    where: { syncAccountId_remoteId: { syncAccountId, remoteId } },
    include: { contact: true },
  });

  // New contact (not in Kontax yet) — create via P27-02 mapping
  if (!syncLink) {
    await createContactFromGooglePerson(person, syncAccountId);
    return;
  }

  // Deleted on Google side
  if (person.metadata?.deleted) {
    await handleGoogleTombstone(syncLink, conflictPolicy);
    return;
  }

  const remoteChanged = person.etag !== syncLink.remoteEtag;
  const localChanged = syncLink.contact.updatedAt > syncLink.lastSyncedAt;

  if (remoteChanged && localChanged) {
    // Both sides changed — conflict!
    await handleConflict({
      syncAccountId,
      contactId: syncLink.contactId,
      localVersion: contactToSnapshot(syncLink.contact),
      remoteVersion: person,
      conflictPolicy,
    });
  } else if (remoteChanged) {
    // Only remote changed — apply remote
    await applyGooglePersonToContact(syncLink.contactId, person);
    await db.syncLink.update({
      where: { id: syncLink.id },
      data: { remoteEtag: person.etag, lastSyncedAt: new Date() },
    });
  }
  // If only local changed — the push phase will write it to Google
}
```

### Tombstone handling

```typescript
async function handleGoogleTombstone(
  syncLink: SyncLinkWithContact,
  conflictPolicy: ConflictPolicy,
): Promise<void> {
  if (conflictPolicy === "SERVER_WINS" || conflictPolicy === "DEVICE_WINS") {
    // SERVER_WINS: apply the delete
    await db.contact.update({
      where: { id: syncLink.contactId },
      data: { archivedAt: new Date() },
    });
    await emitEvent({ eventType: "CONTACT_DELETED", actor: "SYNC", payload: { source: "GOOGLE" } });
  } else if (conflictPolicy === "MANUAL") {
    // Create a conflict for the user to review
    await db.syncConflict.create({
      data: {
        syncAccountId: syncLink.syncAccountId,
        contactId: syncLink.contactId,
        localSnapshot: contactToSnapshot(syncLink.contact),
        remoteSnapshot: { deleted: true },
        status: "OPEN",
      },
    });
  }
}
```

### Push phase — handling Google 409

When pushing a Kontax contact to Google, if Google returns a 409 (contact was modified remotely):

```typescript
try {
  await people.people.updateContact({
    resourceName: syncLink.remoteId,
    updatePersonFields: GOOGLE_PERSON_FIELDS,
    requestBody: mapContactToGooglePerson(contact),
  });
} catch (err: unknown) {
  if ((err as { code?: number }).code === 409) {
    // Remote was modified — fetch the latest and create a conflict
    const latest = await people.people.get({
      resourceName: syncLink.remoteId,
      personFields: GOOGLE_PERSON_FIELDS,
    });
    await handleConflict({
      syncAccountId: syncLink.syncAccountId,
      contactId: syncLink.contactId,
      localVersion: contactToSnapshot(contact),
      remoteVersion: latest.data,
      conflictPolicy,
    });
  } else {
    throw err;
  }
}
```

---

## Acceptance Criteria

- A contact modified in both Kontax and Google between syncs creates a `SyncConflict` row with both snapshots.
- With `SERVER_WINS` policy: Google's version is applied to Kontax; no conflict row.
- With `DEVICE_WINS` policy: Kontax's version is pushed to Google; no conflict row.
- With `MANUAL` policy: an `OPEN` conflict row is created; neither version is applied until the user resolves it.
- Google-side deletes (tombstones) are applied to Kontax as archives (not hard deletes) under `SERVER_WINS`.
- A Google 409 on push triggers conflict creation using the freshly fetched remote version.
- `SyncLink.remoteEtag` is updated after every successful pull.

---

## Risks and Open Questions

- **Incremental sync 410 and conflict history:** when a `syncToken` expires (410), the full re-sync doesn't know which contacts changed on the Kontax side since the last sync. This means all conflicts during the 410 window are silently resolved using the conflict policy with no `SyncConflict` record. Document this limitation: `syncToken` expiry clears the conflict detection window. Mitigate by keeping the incremental sync interval short (< 24 hours) to reduce `syncToken` expiry frequency.
