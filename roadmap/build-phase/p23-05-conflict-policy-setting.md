# P23-05 — Conflict Policy Setting

## Purpose

Wire `SyncAccountSettings.conflictPolicy` into the sync conflict resolution step so that conflicts are handled automatically per the user's chosen policy (`SERVER_WINS`, `DEVICE_WINS`, or `MANUAL`). The `MANUAL` policy creates a conflict queue in the connection detail panel where users review each conflict side-by-side and choose the winning value.

## Background

The Phase 5 conflict model (P5-04) and Phase 7 implementation already log `SyncConflict` rows when both Kontax and the remote modify a contact after the last sync cursor. Currently the engine applies a hardcoded `SERVER_WINS` fallback. This ticket replaces that hardcode with the stored policy and implements the `MANUAL` review queue UI described in design brief `07-sync-connections.md`.

## Scope

**In scope:**
- `conflictPolicy` enforcement in the pull phase: `SERVER_WINS` applies remote change; `DEVICE_WINS` keeps Kontax change and pushes it to remote; `MANUAL` creates a `SyncConflict` row and leaves both versions in place
- `MANUAL` queue UI in the connection detail panel: side-by-side field comparison, Keep local / Keep remote / Manual merge actions
- `resolveSyncConflict(conflictId, resolution)` server action
- Auto-pause at 50 unresolved `MANUAL` conflicts — prevents queue flooding
- `SyncConflict.status` lifecycle: `OPEN` → `RESOLVED` | `AUTO_RESOLVED`

**Out of scope:**
- Conflict policy UI (P23-02)
- The full merge editor for Manual merge action — that reuses P10-05's field-level merge step

---

## Design / Implementation Spec

### Policy enforcement in the pull phase

```typescript
async function handleConflict(params: {
  syncAccountId: string;
  contactId: string;
  localVersion: ContactSnapshot;
  remoteVersion: ContactSnapshot;
  conflictPolicy: ConflictPolicy;
}): Promise<void> {
  const { contactId, localVersion, remoteVersion, conflictPolicy } = params;

  if (conflictPolicy === "SERVER_WINS") {
    // Apply remote changes — overwrite Kontax contact
    await applyRemoteContact(contactId, remoteVersion);
    await db.syncConflict.create({
      data: {
        syncAccountId: params.syncAccountId,
        contactId,
        localSnapshot: localVersion,
        remoteSnapshot: remoteVersion,
        resolution: "SERVER_WINS",
        status: "AUTO_RESOLVED",
        resolvedAt: new Date(),
      },
    });
    return;
  }

  if (conflictPolicy === "DEVICE_WINS") {
    // Keep Kontax version — it will be pushed to remote in the push phase
    await db.syncConflict.create({
      data: {
        syncAccountId: params.syncAccountId,
        contactId,
        localSnapshot: localVersion,
        remoteSnapshot: remoteVersion,
        resolution: "DEVICE_WINS",
        status: "AUTO_RESOLVED",
        resolvedAt: new Date(),
      },
    });
    return;
  }

  if (conflictPolicy === "MANUAL") {
    // Create an open conflict for user review
    const openCount = await db.syncConflict.count({
      where: { syncAccountId: params.syncAccountId, status: "OPEN" },
    });

    if (openCount >= 50) {
      // Auto-pause the connection to prevent queue flooding
      await db.syncAccount.update({
        where: { id: params.syncAccountId },
        data: { status: "PAUSED_SAFETY", pauseReason: "MANUAL_CONFLICT_QUEUE_FULL" },
      });
      return;
    }

    await db.syncConflict.create({
      data: {
        syncAccountId: params.syncAccountId,
        contactId,
        localSnapshot: localVersion,
        remoteSnapshot: remoteVersion,
        status: "OPEN",
      },
    });
  }
}
```

### `SyncConflict` schema additions

The existing `SyncConflict` model needs `status`, `resolution`, and `resolvedAt` fields if not already present:

```prisma
enum SyncConflictStatus { OPEN, RESOLVED, AUTO_RESOLVED }
enum SyncConflictResolution { SERVER_WINS, DEVICE_WINS, MANUAL_MERGE, MANUAL_SERVER, MANUAL_DEVICE }

// On SyncConflict:
status     SyncConflictStatus     @default(OPEN)
resolution SyncConflictResolution?
resolvedAt DateTime?
```

Run: `prisma migrate dev --name add-sync-conflict-status`

### `MANUAL` conflict review UI

In the account detail panel, the Conflicts section (already in design brief `07-sync-connections.md`) renders each open conflict:

```
OPEN CONFLICTS  (3)
────────────────────────────────────────────────────────────

Jane Smith · phone number · Jun 5               [▾ Review]
  Field          Kontax (local)         Remote
  Phone          +1 415 555 0100        +1 415 555 0199

  [ Keep local ]  [ Keep remote ]  [ Manual merge → ]
```

**Keep local:** applies `DEVICE_WINS` — keeps the Kontax value and queues a push to the remote.
**Keep remote:** applies `SERVER_WINS` — overwrites the Kontax contact with the remote version.
**Manual merge →:** opens the field-level merge editor (reuses P10-05 `MergeDecision` flow scoped to these two snapshots).

### `resolveSyncConflict` server action

```typescript
export async function resolveSyncConflict(input: {
  conflictId: string;
  resolution: "KEEP_LOCAL" | "KEEP_REMOTE" | "MANUAL_MERGE";
}): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  const conflict = await db.syncConflict.findUniqueOrThrow({
    where: { id: input.conflictId },
    include: { syncAccount: true },
  });

  if (conflict.syncAccount.userId !== session.user.id) throw new Error("FORBIDDEN");

  if (input.resolution === "KEEP_LOCAL") {
    // Kontax version wins — mark for push
    await db.syncConflict.update({
      where: { id: input.conflictId },
      data: {
        status: "RESOLVED",
        resolution: "MANUAL_DEVICE",
        resolvedAt: new Date(),
      },
    });
  } else if (input.resolution === "KEEP_REMOTE") {
    await applyRemoteContact(conflict.contactId, conflict.remoteSnapshot as ContactSnapshot);
    await db.syncConflict.update({
      where: { id: input.conflictId },
      data: {
        status: "RESOLVED",
        resolution: "MANUAL_SERVER",
        resolvedAt: new Date(),
      },
    });
  }
  // MANUAL_MERGE is handled by the merge editor — conflict stays OPEN until merge commits
}
```

---

## Acceptance Criteria

- `SERVER_WINS` policy: remote change is applied; an `AUTO_RESOLVED` conflict record is created.
- `DEVICE_WINS` policy: local change is kept and queued for push; an `AUTO_RESOLVED` conflict record is created.
- `MANUAL` policy: an `OPEN` conflict row is created; the contact is left unchanged until the user resolves it.
- The conflict count badge in the detail panel accurately reflects the number of `OPEN` conflicts.
- "Keep local" and "Keep remote" resolve the conflict immediately and collapse the row.
- At 50 open conflicts, the connection is auto-paused with `PAUSED_SAFETY` status and the user sees a banner explaining why.
- Resolved conflicts are not shown in the queue (only `OPEN` rows are rendered).

---

## Risks and Open Questions

- **Stale conflict snapshots:** if the user resolves a conflict days after it was created, the `remoteSnapshot` may be further out of date than the most recent remote version. On resolution, trigger a lightweight re-fetch of the remote contact to check if the remote has changed again before applying. If it has, re-open the conflict with the fresh remote snapshot.
- **`MANUAL` conflict and the push phase:** while a conflict is `OPEN`, the push phase must not push the Kontax version of the conflicted contact (that would silently overwrite the remote's change). Add a check: skip pushing contacts that have an `OPEN` `SyncConflict` row.
