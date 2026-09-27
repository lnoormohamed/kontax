# P49A-03 — CardDAV client push: preserve remote-only data, If-Match, duplicate UIDs

**Phase:** 49A · **Priority:** P0 · **Depends on:** P49A-10 · **Effort:** M · **Status:** Done (2026-09-27, branch `p49a-03`; not yet deployed)
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

## Resolution (2026-09-27)

### Preserve remote-only data (A-03)
- **Merge module:** `src/server/carddav-vcard-merge.ts` (pure, no I/O). `mergeRemoteVCardForPush`
  takes the Kontax-built card and the raw remote card it replaces: every Kontax line, then every
  remote line Kontax does not own, verbatim (parameters, value, `itemN.` group), then `END:VCARD`.
- **Kontax-owned** (`CARDDAV_KONTAX_OWNED_PROPERTIES` + `cardDavOwnedProperties`): VERSION, UID,
  FN, N, NICKNAME, EMAIL, TEL, ADR, URL, X-CYRUS-ONLINESERVICE (Fastmail's labelled website), ORG,
  TITLE, BDAY, NOTE, plus REV/PRODID (dropped: they describe the old producer/revision);
  X-ABDATE only when the capability profile round-trips significant dates (iCloud; generic and
  Fastmail keep the remote's X-ABDATE); PHOTO only when the push sets or removes it; and anything
  else the Kontax body itself emits. EMAIL/TEL/ADR/URL therefore always come from the P49A-10
  entries (`contactToPortable` → `readMultiValueFields`) and are replaced, never duplicated.
- **Groups:** a remote group is owned when any non-`X-ABLABEL` member is owned (`item1.EMAIL` +
  its label go together); other groups (`item3.X-ABRELATEDNAMES` + label) are kept whole and
  renamed only if the name collides with a group Kontax emitted.
- Everything else survives: IMPP, X-ABRELATEDNAMES, CATEGORIES, X-SOCIALPROFILE, X-ABShowAs,
  ANNIVERSARY, RELATED, LOGO, GEO, KEY, unknown X- props, and the PHOTO on a field push.
- **Push select:** the linked-contact select in the CardDAV run (`sync-runner.ts` link query)
  gains `significantDates` — iCloud anniversaries were pushed as none on every linked update.

### Conditional PUTs, 412 → conflict path
- `carddav.ts`: `pushCardDavContact` takes `remote: { vcard, etag } | null`. With a remote card
  the body is merged and the PUT carries `If-Match` (`toIfMatchValue`: entity-decoded, quoted;
  weak ETags send no condition since they can never match); `null` = create with
  `If-None-Match: *`; omitted = the card is GET first (`fetchCardDavContact`) — so the other
  callers (conflict KEEP_LOCAL / manual merge in `actions/sync.ts`, QA scripts) also preserve
  remote data and never overwrite blindly, without being edited. A 412 throws
  `CARDDAV_PUSH_PRECONDITION_FAILED`; nothing is written. New: `putCardDavVCard`,
  `fetchCardDavContact`, `fetchCardDavAddressBookCardsWithRaw` (raw card kept out of
  `CardDavContactCard`, which is stored as a conflict snapshot).
- `sync-runner.ts` (CardDAV branch):
  - one REPORT per run (was two identical ones); the href/ETag/UID index is derived from the
    fetched cards, so the ETag a push is conditioned on and the raw card it preserves come from
    the same read. `remoteStateByUid` holds the latest known raw card + ETag per UID and is
    replaced by what a successful PUT sent.
  - the policy routing for "both sides changed" is one closure, `routeBothSidesChanged`, used by
    the classification and by `rerouteAfterLostPushRace`: after a 412 the card is re-read —
    gone → DELETE_CONFLICT; now equal to Kontax → link refresh only; otherwise the connection's
    policy (MANUAL → one OPEN conflict, refreshed not duplicated on later runs; Server-wins →
    the re-read card is applied locally + AUTO_RESOLVED row; Kontax-wins → deferred as today).
  - creates: a local contact whose UID is already in the remote book is skipped (it is linked by
    `matchedEntries` in the same run — it used to be PUT as a second card with the same UID, or
    over the existing one); creates carry `If-None-Match: *`.
  - `sameCardDavETag`: the stored PUT-response ETag (`"abc"`) and the next REPORT's copy
    (`&quot;abc&quot;`, SabreDAV/Nextcloud) are the same version. Compared raw, every pushed card
    looked remotely changed next run, and a second Kontax edit in between was silently reverted
    by the default Server-wins policy (or opened a false conflict under MANUAL).
- **Photos:** a field push now keeps the remote PHOTO line verbatim (it used to wipe the remote
  photo whenever photo sync was off); with photo sync on, a URI photo (iCloud) is still
  re-embedded as bytes as P44-04 verified, falling back to the URI line if the bytes can't be
  fetched. The photo pass PUTs the latest known remote card with only PHOTO swapped
  (`replaceVCardPhoto`), with If-Match — it no longer re-projects Kontax fields, which could undo
  a remote edit applied or deferred in the same run. Links left with an open field conflict are
  not photo-synced in that run (a photo PUT would move the stored ETag past the remote edit
  awaiting review and the next run would push local fields over it).

### Duplicate UIDs (A-21)
`dedupeCardDavCardsByUid` keeps one card per UID — the already-linked href, else the newest `REV`,
else the first href (deterministic) — before anything is classified or committed. The others are
never pushed to or deleted; the run logs a count and the job summary says
"skipped N remote card(s) with a duplicate UID". Two such cards used to reach the contact/link
creates and abort the whole commit on the unique constraint, every run.

### Tests
- `tests/node/carddav-push-fidelity.test.ts` (16): merge rules on an iOS-shaped card, group
  renames, photo ownership, UTF-8-safe folding, REV parsing, ETag helpers, UID dedupe order, and
  the real client against `tests/node/_fake-carddav-server.ts` (in-memory CardDAV book behind a
  mocked `safeFetch`: REPORT with escaped ETags, GET, conditional PUT → 412, DELETE).
- `tests/node/carddav-sync-runner-push.test.ts` (6): `runQueuedSyncJobs` end to end on the fake
  DB (link `select` honoured): the acceptance fixture (name edit keeps X-ABDATE, IMPP,
  X-ABRELATEDNAMES + label, CATEGORIES; EMAIL/TEL once; If-Match sent; a follow-up edit pushes
  instead of conflicting); a lost If-Match race → exactly one OPEN conflict, remote untouched, no
  retry (MANUAL); Server-wins applies the re-read card; a card deleted before the PUT → delete
  conflict, not recreated; two cards sharing a UID sync, stable on re-run; creates skip remote
  UIDs and send If-None-Match.
- Each new behaviour was mutation-checked (removing it fails at least one test).

### Migration
None — no schema change.

### Not verifiable here — check on staging with real accounts
- **iCloud:** that `If-Match` with the REPORT ETag is honoured on PUT (Apple's own clients use
  it; not observed from Kontax yet), that a merged card with Apple's preserved grouped props
  round-trips unchanged, and that a PUT response carries an `ETag` (if not, the photo pass
  re-reads the card before its PUT). Kontax still writes its own labels as plain `X-ABLABEL:Other`
  rather than Apple's `_$!<Other>!$_` form (pre-existing serializer behaviour).
- **Nextcloud/Radicale:** vCard 4.0 remote cards are merged under Kontax's `VERSION:3.0` body
  (as before, the body was always 3.0) — check the server accepts preserved 4.0-only properties
  (ANNIVERSARY, RELATED, KIND) inside it. The A-21 Radicale duplicate-UID fixture from the ticket.
- **Fastmail:** X-CYRUS-ONLINESERVICE round trip.
- A server that returns weak ETags gets unconditional PUTs (strong If-Match can't match them).

### Found, not fixed here
- Kontax-wins (`DEVICE_WINS`) conflicts never push: the classification defers the local change
  without advancing the link, so every later run re-detects the same both-changed state, defers
  again and adds another AUTO_RESOLVED audit row (pre-existing; the 412 path routes the same way
  for consistency).
- `actions/sync.ts` KEEP_LOCAL / manual-merge pushes pass no `hrefOverride` or capability
  profile, so they PUT to `<uid>.vcf` (a second card when the real href differs) with the default
  profile. They now read the card first and send If-Match / If-None-Match, but the href should
  come from the link (P49A-12 owns that file).

### Fable review (2026-09-27)
- Fixed: the Kontax phonetic properties (`X-KONTAX-PINYIN-*`) are Kontax-owned, and `SORT-STRING`
  is owned when the remote card carries Kontax's pinyin name, so a phonetic name cleared in Kontax
  also leaves the remote card; a `SORT-STRING` from another client is kept.
- Follow-ups (low, not blocking):
  - A create that gets 412 because a *different* card sits at `<uid>.vcf` is re-deferred every
    run. It should GET the href and create under a fresh href.
  - Weak ETags still mean unconditional PUTs.
  - Apple's `itemN.X-ABADR` country hint is dropped with the owned ADR group; this is cosmetic,
    iOS re-derives it.
  - Found earlier, pre-existing: `DEVICE_WINS` conflicts never push.
  - Found earlier, pre-existing: KEEP_LOCAL / manual-merge pushes in `actions/sync.ts` assume the
    `<uid>.vcf` href.
