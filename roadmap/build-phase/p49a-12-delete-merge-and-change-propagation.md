# P49A-12 — Hard delete, merge/undo and non-web edits propagate correctly

**Phase:** 49A · **Priority:** P1 · **Depends on:** P49A-10 · **Effort:** M
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
