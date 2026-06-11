# P23-04 — Sync Direction Control

## Purpose

Allow users to set the sync direction per connection: two-way, import-only, or export-only. The direction determines whether the sync engine pulls from the remote, pushes to the remote, or both. This is already stored in `SyncAccountSettings.syncDirection` (P23-01) and surfaced in the P23-02 drawer — this ticket wires the direction setting into every phase of the sync job execution pipeline.

## Background

The Phase 7 sync engine was built for two-way sync. Direction enforcement was deferred with hardcoded defaults. This ticket updates the job runner, PROPFIND step, and the push/pull phases to respect the stored direction. The UI control lives in P23-02; this ticket is entirely backend.

## Scope

**In scope:**
- Direction enforcement in `runSyncJob`: skip the pull phase for `EXPORT_ONLY`, skip the push phase for `IMPORT_ONLY`
- Direction badge update on the sync connections page (reflects the stored direction, not a hardcoded label)
- Direction change triggers a full re-sync to ensure state is consistent

**Out of scope:**
- Direction UI (P23-02)
- Schema changes (P23-01)

---

## Design / Implementation Spec

### Sync job pipeline

The Phase 7 sync job pipeline has two main phases: **pull** (fetch from remote → merge into Kontax) and **push** (compute local changes since last sync → write to remote).

Update `runSyncJob` to read the direction before executing:

```typescript
const settings = await getOrCreateSettings(job.syncAccountId);
const direction = settings.syncDirection;

// Pull phase — fetch remote changes into Kontax
if (direction !== "EXPORT_ONLY") {
  await runPullPhase({ account, job, conflictPolicy: settings.conflictPolicy });
}

// Push phase — write Kontax changes to remote
if (direction !== "IMPORT_ONLY") {
  await runPushPhase({ account, job });
}
```

### Direction badge in sync connections page

The direction badge on the account detail panel currently reads from a hardcoded field. Update it to read `SyncAccountSettings.syncDirection`:

```typescript
// In the sync connections API response:
const settings = await db.syncAccountSettings.findUnique({
  where: { syncAccountId: account.id },
});
return {
  ...account,
  direction: settings?.syncDirection ?? "TWO_WAY",
};
```

Badge rendering (already in the design brief):
- `TWO_WAY`: "Two-way" — green pill
- `IMPORT_ONLY`: "Import only" — grey pill with ↓ icon
- `EXPORT_ONLY`: "Export only" — grey pill with ↑ icon

### Direction change → forced re-sync

When the direction changes from `IMPORT_ONLY` to `TWO_WAY` or `EXPORT_ONLY`, there may be remote contacts that Kontax has never imported (because the pull phase was skipped). Trigger a full re-sync job on direction change:

```typescript
// In updateSyncAccountSettings (P23-02), after the update:
if (prevDirection !== newDirection) {
  await queueSyncJob({
    syncAccountId: input.syncAccountId,
    trigger: "DIRECTION_CHANGE",
    fullResync: true,
  });
}
```

A full re-sync re-runs the bootstrap import logic from Phase 7 (P7-03) scoped to the new direction.

### `SyncJob.direction` recording

Add `direction SyncDirection?` to `SyncJob` so the sync history table can show the direction that was active during each job run:

```prisma
// On SyncJob:
direction SyncDirection?
```

Run: `prisma migrate dev --name add-sync-job-direction`

Set `direction` at job creation time from the settings at that moment.

---

## Acceptance Criteria

- `IMPORT_ONLY` connections: the push phase is skipped; remote changes are pulled into Kontax; local Kontax changes are not written to the remote.
- `EXPORT_ONLY` connections: the pull phase is skipped; local Kontax changes are pushed to the remote; remote changes are ignored.
- `TWO_WAY` connections: both phases run (existing behaviour).
- The direction badge on the sync connections detail panel reflects the stored `SyncDirection`.
- Changing direction from `IMPORT_ONLY` → `TWO_WAY` triggers a full re-sync to catch up on previously unimported contacts.
- The `SyncJob.direction` field records which direction was active for each job run.

---

## Risks and Open Questions

- **`EXPORT_ONLY` and remote deletes:** if a contact is deleted on the remote while the connection is `EXPORT_ONLY`, Kontax will never learn about it (pull phase is skipped). When the user switches back to `TWO_WAY`, the remote delete will be replayed and the contact may unexpectedly disappear from Kontax. Warn the user about this when switching from `EXPORT_ONLY` to `TWO_WAY`.
- **Push phase and contacts not yet linked:** the push phase identifies local contacts to push by their `syncLink` record (mapping between Kontax contact and remote vCard UID). A contact that has never been pulled from a remote has no `syncLink`. For `EXPORT_ONLY`, the push phase must handle unlinking gracefully and create remote VCARDs for contacts that exist only in Kontax (new contact creation on remote, not just updates).
