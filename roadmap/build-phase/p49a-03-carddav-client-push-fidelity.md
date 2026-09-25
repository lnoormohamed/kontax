# P49A-03 — CardDAV client push: preserve remote-only data, If-Match, duplicate UIDs

**Phase:** 49A · **Priority:** P0 · **Depends on:** P49A-10 · **Effort:** M
**Audit IDs:** A-03 (high), A-21

## Objective
When Kontax pushes to an external CardDAV server (iCloud, Fastmail, Nextcloud), never delete
properties Kontax doesn't model and never overwrite a concurrent remote edit.

## Production verification (2026-09-25)
- Confirmed in origin/main:
  - `pushCardDavContact` (`carddav.ts:955-1004`) sends `PUT` with only Authorization,
    Content-Type, Content-Length, User-Agent — **no `If-Match`**.
  - The body is rebuilt by `buildCardDavContactBody` purely from Kontax fields; nothing merges
    the fetched remote card's unknown properties (X-ABDATE, IMPP, X-ABRELATEDNAMES, CATEGORIES…).
  - The push-path contact `select` in `sync-runner.ts:1227-1262` omits `significantDates`, so
    anniversaries are always pushed as none.
- No CardDAV sync accounts exist in prod yet → no data lost so far.
- A-21 (duplicate UIDs in one remote book abort the commit on the unique constraint) is
  code-read only; reproduce on staging with a Radicale fixture.

## Steps
1. Add `significantDates` (and any other mapped field missing) to the push select.
2. Keep the last fetched raw vCard per link (or refetch before PUT) and merge: Kontax-owned
   properties replaced, all others preserved verbatim (including groups and `X-` props).
3. Send `If-Match: <remoteETag>`; on 412 refetch and route through the existing conflict path.
4. Dedupe remote cards by UID before commit (keep the newest ETag, log the rest).

## Acceptance
- Fixture test: an iCloud card with X-ABDATE, IMPP, X-ABRELATEDNAMES and CATEGORIES, edited in
  Kontax (name change), is pushed with all four intact.
- 412 on PUT creates one conflict, no overwrite.
- A remote book with two cards sharing a UID syncs successfully.
