# P49A-02 — CardDAV server PUT: grouped properties, full replace, ETag bumps

**Phase:** 49A · **Priority:** P0 · **Depends on:** — · **Effort:** S–M
**Audit IDs:** A-02 (high), A-18, A-23 (year-less birthdays), P2 DAV unescape order

## Objective
Make edits from iPhone/macOS/DAVx⁵ through Kontax's own CardDAV server land exactly as the device
sent them — nothing silently dropped, deletions honoured, and no device overwriting API edits.

## Production verification (2026-09-25)
- The DAV server is live in prod (`server.mjs`, same code as origin/main). No app passwords or
  device contacts exist in prod yet.
- **Reproduced with prod's parser** (`parseVCardToContactFields`, extracted from origin/main
  `server.mjs:964-1129`) on an iPhone-shaped vCard:
  - `item2.ADR…` → no address field returned (address lost).
  - `item3.URL…` → no website field returned (website lost).
  - `item1.TEL` with a custom `X-ABLabel` → dropped; only the ungrouped phone kept.
  - `BDAY;X-APPLE-OMIT-YEAR=1604:1604-03-14` → stored as `1604-03-14`.
  - Removing the EMAIL line → parser returns no email keys, and the PUT does
    `tx.contact.update({ data: { ...fields } })` (origin/main `server.mjs:~2210`), so the stored
    email survives and reappears on the next fetch.
- A-18: DAV ETag = `syncVersion`; the REST PATCH (`api/v1/contacts/[id]/route.ts:94`) and photo
  pass (`sync-photo-pass.ts:101`) don't bump it, so devices never refetch and later overwrite.

## Steps
1. In `parseVCardLines`, split `group.NAME` and match on `NAME` (as `carddav.ts:456` already does);
   carry `X-ABLabel` from the same group as the entry label.
2. Treat PUT as a full replacement of every field the DAV mapping owns: fields absent from the body
   become empty (keep fields the mapping does not own untouched).
3. Map `X-APPLE-OMIT-YEAR` / `--MM-DD` to a year-less birthday; serialize back the same way.
4. Fix unescape order (`\\` last) and stop double-unescaping N/ADR/ORG components.
5. Bump `syncVersion` in the v1 PATCH/POST handlers and the photo pass.
6. Longer term (tracked in P49A-18): move the DAV vCard code into the shared, typed
   `contact-portability` module so the three vCard implementations converge.

## Acceptance
- New `tests/node/dav-vcard.test.ts` with iOS, macOS and DAVx⁵ fixtures: address, URL,
  custom-labelled phones, year-less birthday all round-trip; removing a property removes it.
- API PATCH changes the DAV ETag; a stale-ETag PUT gets 412.
- Staging: edit a contact's address on an iPhone connected to staging; it shows in the web app.

## Known limitation (Fable review, 2026-09-25)
Core properties (N/FN, EMAIL, TEL, ADR, URL, NOTE, BDAY, ORG company, TITLE) are full-replace, so a
deletion on any device clears them. Extended properties (NICKNAME, X-PHONETIC-*, ORG department)
are only written when present, so clients that don't model them (Thunderbird, GNOME, older
Android) can't wipe them. Trade-off: iOS omits a cleared nickname/phonetic name/department instead
of sending it empty, so clearing one of those four on an iPhone does not clear it in Kontax —
edit it in the web app instead.
