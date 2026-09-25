# P49A-01 — Google sync: push mask, paging, false conflicts, per-contact errors

**Phase:** 49A · **Priority:** P0 · **Depends on:** — · **Effort:** M (several S fixes)
**Audit IDs:** A-01 (critical), A-04, A-05, A-07, A-22 (needs-verification), A-23 (nicknames)

## Objective
Stop Google two-way sync from deleting data on Google, stalling on large change sets, raising
false conflicts, and dying permanently on one bad contact.

## Production verification (2026-09-25)
- Google sync is configured in prod (`GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` set on the prod
  container). No Google accounts are connected yet (0 sync accounts), so no data has been lost.
- **A-01 reproduced with prod's code:** `mapContactToGooglePerson` on a contact with an address,
  a website and a job title (no company) returns a body with only
  `names,emailAddresses,phoneNumbers,birthdays`, while `GOOGLE_UPDATE_PERSON_FIELDS` is
  `names,emailAddresses,phoneNumbers,organizations,addresses,birthdays,urls,biographies`.
  People API clears every masked field absent from the body → addresses, URLs and org/title are
  wiped on Google on every push.
- A-04: `google-sync.ts` incremental `connections.list({ syncToken })` has no `pageToken` loop and
  falls back to the old cursor when `nextSyncToken` is missing (origin/main).
- A-05: `importRemoteContactBatch` captures `now` at batch start and writes it as
  `lastSyncedAt`; the contact update then sets a later `updatedAt`, so `isLocalChanged()` is true
  for every pulled contact (origin/main `sync-import-engine.ts:585, 284, 515`).
- A-07: the Google push loop (`google-sync.ts:753-854`) has no per-contact `try` — one provider
  rejection throws the whole run, and push runs before import.

## Steps
1. **Mask = body (A-01).** Map `addressEntries → addresses`, `websiteEntries → urls`, and always
   emit `organizations` when company *or* title/department is set. Build `updatePersonFields`
   from the keys actually present, plus explicit clears only for fields the user emptied in
   Kontax (compare with the link's `supportedFieldShadow`). Fetch `nicknames` in the read mask
   and map it both ways (A-23).
2. **Paging (A-04).** Loop `pageToken` until exhausted; persist `nextSyncToken` only after the last
   page; never fall back to the previous cursor mid-stream.
3. **lastSyncedAt (A-05).** Set `lastSyncedAt` from the updated contact's `updatedAt` inside the same
   transaction (mirrors `sync-runner.ts:1916` for CardDAV). Add a one-off repair for existing
   links (safe no-op in prod today).
4. **Per-contact isolation (A-07).** Wrap each push in `try/catch`; record `lastErrorCode/Message`
   on the `SyncContactLink`; continue; surface a count on the job. Same for Microsoft
   (`microsoft-sync.ts:770-868`) even though Outlook is not configured in prod yet.
5. **400 FAILED_PRECONDITION (A-22).** Verify with a real expired token on staging; treat as
   "expired sync token → full resync" and "stale etag → refetch + conflict".

## Acceptance
- Unit tests (new, `tests/node/google-sync-*.test.ts`): mapper round-trip keeps addresses, URLs,
  title-without-company, nicknames; mask never names a field missing from the body unless it is
  an intentional clear.
- Paging test with a mocked 3-page incremental response advances the cursor once, at the end.
- Import then immediate re-run produces zero conflicts and zero pushes.
- One mocked 400 on contact N leaves contacts N+1… pushed and the import phase still runs.
- Staging: connect a test Google account, edit a contact with an address in Kontax, confirm the
  address survives on Google.
