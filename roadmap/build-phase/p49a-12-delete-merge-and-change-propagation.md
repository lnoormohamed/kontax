# P49A-12 — Hard delete, merge/undo and non-web edits propagate correctly

**Phase:** 49A · **Priority:** P1 · **Depends on:** P49A-10 · **Effort:** M · **Status:** Done (2026-09-27, branch `p49a-12`; not yet deployed — needs the migration below)
**Audit IDs:** A-16, A-17, A-20

## Objective
Every way a contact is created, edited, merged, restored or deleted reaches every connected sync
target and device, and merges never lose data.

## Production verification (2026-09-25)
Code-verified against origin/main (identical to audited code); prod has 0 contacts / 0 sync
accounts, so no user impact yet.
- A-16: "Delete permanently" (`contacts/[id]/page.tsx:898`, `actions/contacts.ts:1293,1340`, v1
  DELETE `:138`) hard-deletes; the sync link cascades away → CardDAV re-imports it, Google/Outlook
  never delete it, device ctag doesn't move (ghost on phones).
- A-17: push selection uses `lastMutatedBy: "MANUAL"` only (`google-sync.ts:742,798`,
  `microsoft-sync.ts:759,814`, `sync-runner.ts:1364`); API/CSV/DAV edits never reach remotes.
- A-20: merge omits department, phonetic names, `isEmergency`, book/family/team memberships
  (`contact-merge.ts:2229-2268`); undo overwrites later edits; 30-day window checked in UI only
  (`:1705-1717`); undo/restore don't clear tombstoned links.

## Steps
1. Delete = archive + tombstone links + push remote deletes + bump book ctag; purge later.
2. Replace `lastMutatedBy === MANUAL` with a per-link "dirty since last sync" marker set by every
   non-sync writer (web, API, CSV, DAV, merge, restore).
3. Merge: carry every field and membership; undo restores the snapshot only for fields unchanged
   since the merge (else conflict); enforce 30 days server-side; restore/undo revive links.

## Acceptance
- Tests for each path: API edit → pushed to Google; hard delete → remote DELETE issued and device
  REPORT omits it; merge keeps department and memberships; undo after 31 days → rejected.

## Resolution (2026-09-27)

### Schema — migration `20260927120000_p49a_12_sync_dirty_and_deleted_at` (**must be applied before this ships**)
Additive only: `SyncContactLink.localDirtyAt TIMESTAMP(3) NULL`, `Contact.deletedAt TIMESTAMP(3)
NULL` + index on `Contact.deletedAt`. No backfill (the push keeps the old rule as a fallback, see
below). Production runs `KONTAX_SCHEMA_MODE=validate`, so apply it out of band (staging first)
together with P49A-10's pending backfill. A per-link marker needs a column; a hidden
"deleted, waiting for the providers" state needs one too — nothing existing could carry either.

### A-17 — every non-sync edit reaches the providers
- `src/server/dav/sync-propagation.mjs` (shared with `server.mjs`) + typed wrapper
  `src/server/sync-dirty.ts`: `markSyncLinksDirty`, `reviveSyncLinks`, `flagDeviceWriteForSync`,
  `DAV_DEVICE_MUTATION`, `LOCAL_MUTATION_SOURCE_TYPES` (everything but SYNC_*),
  `linkHasPendingLocalChange`, `pendingLocalChangeWhere`, `clearSyncLinkDirty`.
- Writers marking links dirty (same transaction as the write): web `updateContact`,
  `updateContactField`, `updateContactEntries`, bulk company edit, REST v1 PUT, Kontax CardDAV
  server PUT (personal / family / team — also stamps `lastMutatedBy = MANUAL`, detail
  "CardDAV device"; DELETE stamps it too), live-share propagation, merge, undo, restore, sync
  conflict manual merge. CSV / archive / API / card imports create contacts, which the create
  path now picks up.
- Google / Outlook push (`google-sync.ts`, `microsoft-sync.ts`): a link is pushed when dirty, or
  (the old rule, widened from MANUAL to every non-sync source) when its contact was last written
  by a non-sync source after the link last synced. Sync writes (SYNC_*) never mark, so the
  push → normalise → re-import loop stays closed. The marker is cleared after the push (only if
  set before the push read the contact) or a policy auto-resolve; a MANUAL conflict leaves it.
  Creates: `lastMutatedBy in LOCAL_MUTATION_SOURCE_TYPES` (was MANUAL only) — also in the CardDAV
  client (`sync-runner.ts`).
- Import engine (`sync-import-engine.ts`): the "don't anchor a pending push" check uses the same
  rule (was MANUAL only — an API / device edit was anchored away and later overwritten); a
  remote-wins apply clears the link's marker.

### A-16 — permanent delete
- `src/server/contact-deletion.ts` `deleteContactsPermanently` (web single + bulk, REST v1
  `DELETE ?permanent=true`): hard delete only when the contact is already in the trash and no
  live link remains; otherwise archive + sync-tombstone + `deletedAt` (bumps `updatedAt` → book
  CTag moves, `syncVersion` → device ETag; device REPORT/PROPFIND list only active rows). The next
  push deletes the remote copies (Google/Outlook step 3, CardDAV `localChanged && archived`).
- `purgeDeletedContacts` (called by `/api/cron/sync` after the runs) hard-deletes once no live
  link remains (links on RETIRED connections don't hold it) and 7 days have passed (offline
  devices see the CTag move first). An import-only link never pushes a delete, so that row stays
  hidden rather than being re-imported as new.
- Hidden everywhere: trash list + counts (`contacts-workspace.ts`, contact pages), contact page,
  REST v1 GET / list / DELETE, vCard / CSV / Kontax-format / GDPR exports, print, restore, and the
  plan's contact count (`billing.ts`, `plan-entitlements.mjs`, billing action).
- CardDAV client: a link whose contact is archived and whose remote card is already gone is now
  tombstoned (it used to stay live forever), so the purge is not held back.
- REST v1 soft delete now also sets `syncTombstoneAt` (like the web archive).

### A-20 — merge, undo, restore
- Merge (`contact-merge.ts`) carries `department`, phonetic first/last name (following the chosen
  name), phonetic company (following the chosen company), `isEmergency` (either), personal book
  memberships (as extra memberships) and family/team book entries. Sync links: where only the
  absorbed contact is on a provider its link moves to the survivor (the provider record is updated
  in place, not deleted and re-created); where both are, the absorbed copy is deleted there. The
  survivor's links are marked dirty. The decision snapshot records the new fields and a
  `propagation` block (added books, moved links).
- Undo (`undoMergedContactsForUser`): 30 days enforced server-side (`MergeUndoError`, the UI shows
  the message); refused if either contact was deleted; each survivor field (the name parts as one
  group; each multi-value family on label/value/primacy) is restored only if still exactly as the
  merge wrote it — edited fields are kept and returned / logged as `keptFields`; the absorbed
  contact's own fields are left as they are (the merge never changed them), only its archive /
  merge state is reversed; added books are removed, moved links moved back; the absorbed contact's
  tombstoned links are revived (re-created on the provider) and both contacts' links marked dirty.
  Pre-P49A-12 snapshots (no new fields / propagation) undo as before for what they recorded.
- Restore from the trash (single + bulk) and a device PUT that brings back a deleted card revive
  tombstoned links (removed → the next push re-creates the contact) and mark live ones dirty.

### Tests
`tests/node/sync-change-propagation.test.ts` (12): API edit → pushed to Google, marker settled,
not re-pushed; iPhone (DAV PUT) edit → pushed; server.mjs uses the device mutation + flag on every
PUT/DELETE path; a failed push + unchanged pull does not anchor the edit away; permanent delete →
Google DELETE, device listing omits it, no resurrection on re-import, purge only after links settle
+ grace; trashed + unlinked → deleted at once; retired link doesn't hold the purge; restore →
re-created on Google; merge keeps department / phonetics / emergency / books and relinks + pushes
in place; both-linked merge deletes the absorbed copy; undo keeps later edits and moves links /
books back; undo after 31 days → rejected. `tests/node/_sync-fake-db.ts` gained the tables and
operators these need.

### Not done / to check on staging
- Real providers: Google `people.deleteContact` / Graph delete on a permanently deleted contact;
  a merged-away contact relinked to the survivor (Google etag / Graph change key on the moved
  link); iPhone edit via Kontax CardDAV → Google within one sync; restore → re-created remotely.
- Hard deletes when a family / team group is dissolved (`actions/family.ts`, `actions/teams.ts`
  `deleteMany`) still bypass this (team sync accounts) — follow-up.
- The CardDAV client does not read the marker (it diffs shadows every run), so a CardDAV link's
  marker is only cleared by conflict resolution; harmless, noted for P49A-03.
- Google / Outlook conflict resolution (keep local / manual merge) still pushes through the
  CardDAV client and fails for OAuth accounts — pre-existing, see P49A-19 item 2 note.
- Contact shares moved to the survivor by a merge are not moved back on undo (unchanged).

### Fable review (2026-09-27)
Nothing blocked staging; fixed before shipping:
- **M1:** a card missing from one CardDAV listing no longer retires the link of a contact that is
  only in the trash. Only a permanently deleted contact (`deletedAt`) is settled that way, and
  an empty listing while live links exist settles nothing. Tests are in
  `carddav-sync-runner-push.test.ts`.
- **M2:** creates on a provider are narrower than pushes of existing links
  (`PROVIDER_CREATE_SOURCE_TYPES` = MANUAL). Contacts shared with the user (SHARED_*) are never
  created on their own Google / Outlook / iCloud. Imports and API-created contacts are not
  mass-created either, as before P49A-12, until the user edits them. Updates to already-linked
  contacts still go out from every non-sync writer (A-17). Whether imports should be created
  remotely is an open product question.
- **L1:** DAV CTags are `max(updatedAt):count`, so the purge of a deleted row can't step a
  book's CTag back to a value a device has already seen.

Known, low, not fixed:
- **L2:** links on a DISCONNECTED account hold a purge.
- **L3:** a restore racing an in-flight delete can orphan a tombstoned link.
- **L4:** a device PUT without If-Match revives a permanently deleted row.
- **L5:** manual merge writes the local *snapshot*, not the current contact.
- **L6:** undo stamps MANUAL on both contacts.

Also pre-existing:
- Family/team dissolve hard-deletes.
- KEEP_LOCAL / manual-merge pushes fail for Google/Outlook conflicts.
- Shares moved by a merge are not moved back on undo.
