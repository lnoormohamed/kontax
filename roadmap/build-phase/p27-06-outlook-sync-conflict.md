# P27-06 — Outlook Sync Conflict Handling

## Purpose

Implement conflict detection and resolution for Outlook/Microsoft Graph sync using `@odata.etag` as the conflict detection token. The same infrastructure as P27-03 (Google) is used — the difference is how remote changes are detected (etag on PATCH response) and how deletions are represented (the `@removed` marker in delta responses).

## Background

Microsoft Graph uses `@odata.etag` on each contact as the concurrency token, exactly analogous to Google's `etag`. The conflict detection logic from P27-03 applies directly, with substitutions for the Microsoft-specific field names and API calls.

## Scope

**In scope:**
- ETag comparison in the pull phase: `contact["@odata.etag"] !== syncLink.remoteEtag` AND local contact modified → conflict
- Tombstone handling: `contact["@removed"]` in delta responses → archive or conflict per policy
- Push phase: `PATCH /me/contacts/{id}` with `If-Match: {etag}` header; 412 Precondition Failed → conflict
- `SyncConflict` row creation with snapshots from both sides

**Out of scope:**
- Conflict resolution UI (P23-05)
- Field mapping (P27-05)

---

## Design / Implementation Spec

### Conflict detection in pull phase

Same pattern as P27-03, substituting `@odata.etag` for Google's `etag`:

```typescript
async function processSingleGraphContact(
  contact: GraphContact,
  syncAccountId: string,
  conflictPolicy: ConflictPolicy,
): Promise<void> {
  const remoteId = contact.id!;

  const syncLink = await db.syncLink.findUnique({
    where: { syncAccountId_remoteId: { syncAccountId, remoteId } },
    include: { contact: true },
  });

  if (!syncLink) {
    await createContactFromGraphContact(contact, syncAccountId);
    return;
  }

  if (contact["@removed"]) {
    await handleGraphTombstone(syncLink, conflictPolicy);
    return;
  }

  const remoteEtag = contact["@odata.etag"];
  const remoteChanged = remoteEtag !== syncLink.remoteEtag;
  const localChanged = syncLink.contact.updatedAt > syncLink.lastSyncedAt;

  if (remoteChanged && localChanged) {
    await handleConflict({
      syncAccountId,
      contactId: syncLink.contactId,
      localVersion: contactToSnapshot(syncLink.contact),
      remoteVersion: contact,
      conflictPolicy,
    });
  } else if (remoteChanged) {
    await applyGraphContactToKontax(syncLink.contactId, contact);
    await db.syncLink.update({
      where: { id: syncLink.id },
      data: { remoteEtag, lastSyncedAt: new Date() },
    });
  }
}
```

### Push phase with `If-Match`

```typescript
async function pushContactToOutlook(
  contact: Contact,
  syncLink: SyncLink,
  graphClient: Client,
  conflictPolicy: ConflictPolicy,
): Promise<void> {
  try {
    const patchBody = mapKontaxContactToGraph(contact);

    await graphClient
      .api(`/me/contacts/${syncLink.remoteId}`)
      .header("If-Match", syncLink.remoteEtag!) // conditional update
      .patch(patchBody);

    // Update the etag after successful push
    const updated = await graphClient
      .api(`/me/contacts/${syncLink.remoteId}`)
      .select("@odata.etag")
      .get();

    await db.syncLink.update({
      where: { id: syncLink.id },
      data: { remoteEtag: updated["@odata.etag"], lastSyncedAt: new Date() },
    });
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode === 412) {
      // Precondition Failed — remote was modified since we last synced
      const latest = await graphClient
        .api(`/me/contacts/${syncLink.remoteId}`)
        .select(MICROSOFT_CONTACT_FIELDS)
        .get();

      await handleConflict({
        syncAccountId: syncLink.syncAccountId,
        contactId: syncLink.contactId,
        localVersion: contactToSnapshot(contact),
        remoteVersion: latest,
        conflictPolicy,
      });
    } else {
      throw err;
    }
  }
}
```

### Tombstone handling

```typescript
async function handleGraphTombstone(
  syncLink: SyncLinkWithContact,
  conflictPolicy: ConflictPolicy,
): Promise<void> {
  if (conflictPolicy === "SERVER_WINS") {
    await db.contact.update({
      where: { id: syncLink.contactId },
      data: { archivedAt: new Date() },
    });
    await emitEvent({ eventType: "CONTACT_DELETED", actor: "SYNC", payload: { source: "MICROSOFT" } });
  } else if (conflictPolicy === "MANUAL") {
    await db.syncConflict.create({
      data: {
        syncAccountId: syncLink.syncAccountId,
        contactId: syncLink.contactId,
        localSnapshot: contactToSnapshot(syncLink.contact),
        remoteSnapshot: { deleted: true, provider: "MICROSOFT" },
        status: "OPEN",
      },
    });
  }
  // DEVICE_WINS: do nothing — the contact stays in Kontax and will be re-pushed on the next sync
}
```

---

## Acceptance Criteria

- A contact modified in both Kontax and Outlook between syncs creates a `SyncConflict` row.
- `SERVER_WINS`: Outlook version applied; no conflict row created.
- `DEVICE_WINS`: Kontax version pushed to Outlook; no conflict row.
- `MANUAL`: `OPEN` conflict row created; neither version applied until resolved.
- 412 on PATCH triggers conflict creation using the freshly fetched remote contact.
- Tombstones (`@removed`) are handled correctly per the conflict policy.
- `SyncLink.remoteEtag` is updated after every successful pull and push.
