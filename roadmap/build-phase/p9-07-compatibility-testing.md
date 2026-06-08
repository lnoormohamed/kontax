# P9-07 Compatibility Testing: iOS, macOS, DAVx⁵

## Purpose
A CardDAV server that passes RFC 6352 compliance tests in isolation may still fail against real client implementations due to client-specific quirks, undocumented behaviours, and edge cases that only appear with real contact data. This ticket defines the test plan for verifying end-to-end bidirectional sync between Kontax and the three primary clients: iOS Contacts, macOS Contacts, and DAVx⁵ on Android. The goal is not just to confirm the happy path works, but to discover and document every client-specific deviation from the spec before the feature ships publicly.

## Background
P9-01 through P9-05 implement the Kontax CardDAV server. This ticket assumes all of those are complete and deployed to a staging environment accessible over HTTPS from a real device. The existing CardDAV client code in `src/server/carddav.ts` already interacts with external servers and can serve as a reference for expected behaviour — but it is the client side, and the server side introduces new edge cases.

Kontax already has CardDAV client sync (iCloud, Google, Nextcloud). The learnings from that implementation (XML namespace quirks, vCard encoding issues, CTag cache behaviour) are relevant context for anticipating where the server-side implementation may fail.

## Scope

**In scope:**
- Account setup and initial sync: iOS, macOS Contacts, DAVx⁵
- Bidirectional sync verification: create, edit, delete on each side
- Edge case contacts: no name, special characters, multi-value fields, large contact lists
- CTag and ETag correctness: verifying clients do not re-fetch unchanged data
- Client-specific quirk documentation
- Regression check: existing CardDAV client sync (iCloud, Nextcloud) still works

**Out of scope:**
- Performance load testing (50+ concurrent devices)
- Other CardDAV clients (Outlook, Thunderbird, Fastmail) — deferred to a future compatibility pass
- CalDAV (Kontax does not implement it)
- Automated test infrastructure — this is a manual test plan; automation is a separate engineering task

---

## Test Environment Setup

### Prerequisites

Before running any tests:

1. Deploy the Kontax CardDAV server (P9-01 through P9-05) to a staging environment accessible over HTTPS at `https://staging.kontax.app`.
2. Create at least two test user accounts with known credentials.
3. For each test user, create an app password with a descriptive label ("iOS test", "macOS test", "DAVx5 test").
4. Seed each test account with a known set of contacts (at minimum: 5 contacts with varied field richness — see seed set definition below).
5. Confirm that `/.well-known/carddav` resolves correctly from an external network (not localhost).
6. Have a second device available to verify "appears on the other side" steps.

### Test Contact Seed Set

Define a standard seed set of contacts that all clients must sync correctly. This set is created in Kontax before each client test run:

| # | Name | Fields present |
|---|---|---|
| C1 | Alice Johnson | Full name, first/last, email (work + personal), phone (mobile + home), company, job title |
| C2 | 张伟 (Zhang Wei) | Unicode name (simplified Chinese), single email, single phone |
| C3 | O'Brien & Associates | Company-only contact (no first/last name), website, phone |
| C4 | Bob <Test> "Special" | Name contains XML special characters: `<`, `>`, `"` |
| C5 | ‏علي (Ali) | RTL name, notes field with Arabic text |
| C6 | (empty name) | No name set, only email address |
| C7 | Carol Williams | All fields: name parts (prefix/suffix), multiple emails, multiple phones, addresses (work + home), birthday, anniversary, website, notes (multi-paragraph), photo URL |
| C8 | Dan Note | Notes field >4096 characters (stress test long text) |

---

## Test Plan

### Suite A: iOS (iPhone / iPad)

**Device:** iPhone running the most recent iOS release. Optionally also test on one iOS version behind.

**Test A-01: Account Setup**

Steps:
1. On iPhone: Settings > Contacts > Accounts > Add Account > Other > Add CardDAV Account
2. Enter: Server `https://staging.kontax.app/dav/`, Username `{testEmail}`, Password `{appPassword}`, Description "Kontax"
3. Tap Next

Expected:
- iOS validates the account without error
- Account appears in the Contacts accounts list

Pass criteria: Account setup completes within 30 seconds without an error dialog.

Failure modes to document:
- "Cannot connect using SSL" → TLS configuration issue
- "Server not found" → DNS or URL issue
- "Invalid username or password" → auth issue (check 401 WWW-Authenticate header)
- Spinner that never resolves → discovery sequence stall (check well-known redirect chain)

**Test A-02: Initial Sync — Kontax → iPhone**

Steps:
1. Wait up to 5 minutes for iOS to complete initial sync, or force sync via Settings > Contacts (pull to refresh in Contacts app)
2. Open the Contacts app on iPhone

Expected:
- All 8 seed contacts appear in the iPhone Contacts app
- Contact details match Kontax exactly: name, email, phone, company, notes
- C2 (Chinese characters) displays correctly
- C4 (XML special chars in name) displays correctly (name should show `<`, `>`, `"` not `&lt;`, `&gt;`, `&quot;`)
- C6 (no name) appears in Contacts as the email address or "(no name)"
- C7 (all fields) — all populated fields appear; verify birthday, notes, addresses

Record: Screenshot of the iPhone Contacts app showing the contacts list and one detail view.

**Test A-03: Create Contact on iPhone → Appears in Kontax**

Steps:
1. On iPhone, create a new contact: "iOS New Contact", email `ios-new@test.com`, phone `+1 555-0199`
2. Save the contact
3. Wait for iOS background sync (up to 5 minutes), or force via Settings > Contacts

Expected:
- A new `Contact` row exists in Kontax with `fullName = "iOS New Contact"`, `email = "ios-new@test.com"`, `phone = "+1 555-0199"`
- The contact has a `syncUid` matching the UID in the vCard iOS sent
- The contact does not appear as a duplicate

Record: Kontax database query or UI screenshot showing the new contact.

**Test A-04: Edit Contact in Kontax → Appears on iPhone**

Steps:
1. In Kontax (web UI), edit C1 (Alice Johnson): change email from original to `alice-updated@test.com`
2. Wait for iOS background sync or force sync

Expected:
- Alice's contact on iPhone shows the updated email
- No duplicate contacts for Alice
- ETag for Alice's vCard has changed (verify via server log or network inspection)

Record: Before/after screenshots or network trace.

**Test A-05: Delete Contact on iPhone → Archived in Kontax**

Steps:
1. On iPhone, open C3 (O'Brien & Associates) and delete the contact
2. Wait for iOS to sync (it sends DELETE to the CardDAV server)

Expected:
- C3's `Contact` row in Kontax has `syncTombstoneAt` set (not hard-deleted)
- C3 is no longer visible in the Kontax active contacts list
- C3 does not reappear on next iOS sync (the tombstone prevents re-sync)

Record: Prisma Studio or database screenshot showing the tombstoned contact.

**Test A-06: Edit Contact on iPhone → Appears in Kontax (PUT from iOS)**

Steps:
1. On iPhone, open C2 (Zhang Wei) and add a second phone number: `+86 10 1234 5678`
2. Save and wait for sync

Expected:
- Kontax C2 has the new phone number in `phoneEntries`
- The phone entry label is correct (matches what iOS sends for Chinese phone entries)
- `syncVersion` is incremented

**Test A-07: CTag Caching — No Redundant Fetches**

Steps:
1. Ensure Kontax has not changed since the last iOS sync (no contact edits)
2. Force an iOS sync
3. Check server access logs

Expected:
- iOS sends PROPFIND to check the CTag
- CTag has not changed, so iOS does NOT send a REPORT request
- No individual vCard GET requests are made

This verifies the CTag short-circuit works correctly. Record: server access log showing PROPFIND but no REPORT.

**Test A-08: Reconnect After Revoke**

Steps:
1. Revoke the iOS app password from the Kontax settings UI
2. Force an iOS sync

Expected:
- iOS receives HTTP 401
- iOS shows an error notification or the account shows as "offline" in Settings > Contacts

3. Create a new app password for iOS
4. Update the password in iPhone Settings > Contacts account settings
5. Force sync

Expected:
- iOS reconnects and syncs normally
- No duplicate contacts are created

**Test A-09: Large Contact List (500+ contacts)**

Steps:
1. Create a test account with 500 seeded contacts (use a script to generate them)
2. Set up the iOS account on a fresh device (no existing Kontax sync)
3. Trigger initial sync

Expected:
- All 500 contacts sync within 3 minutes
- No iOS "server error" or timeout
- No duplicate contacts
- Memory and CPU on the Kontax server remain within acceptable bounds during the sync

---

### Suite B: macOS Contacts

**Device:** Mac running the most recent macOS release.

**Test B-01: Account Setup**

Steps:
1. System Settings > Internet Accounts > Add Account > Add a CardDAV account
2. Choose "Advanced" account type
3. Enter: Username `{testEmail}`, Password `{appPassword}`, Server Address `https://staging.kontax.app/dav/`
4. Click Sign In

Expected:
- Account validates and a "Kontax" account appears in the macOS Contacts app

**Test B-02: Initial Sync — Kontax → macOS Contacts**

Same as A-02 but on macOS. Verify all 8 seed contacts appear with correct Unicode rendering and field values.

**Test B-03: Create in macOS → Appears in Kontax**

Create a new contact "macOS New Contact" in the macOS Contacts app. Verify it appears in Kontax within 5 minutes.

**Test B-04: Edit in Kontax → Appears in macOS Contacts**

Edit a contact in Kontax. Force a sync via macOS Contacts > Accounts > Kontax (right-click > Refresh). Verify the change propagates.

**Test B-05: Delete in macOS → Archived in Kontax**

Delete a contact in macOS Contacts. Verify it is tombstoned in Kontax (not hard-deleted).

**Test B-06: macOS-Specific Field Handling**

macOS Contacts supports fields that some other clients do not:
- Related names (spouse, parent, child)
- Instant messaging handles
- Phonetic first/last name

Test:
1. Create a contact in macOS Contacts with a phonetic first name set
2. Verify the phonetic name appears in Kontax (`phoneticFirstName` field)
3. The server should store `X-PHONETIC-FIRST-NAME` from the vCard in the `phoneticFirstName` field

**Test B-07: Conflict — Edit on Both Sides Simultaneously**

1. Edit C1 (Alice Johnson) in Kontax (web UI) — change job title
2. Within 60 seconds, also edit C1 in macOS Contacts — change company name
3. Wait for macOS to sync

Expected:
- No contact data is corrupted
- One of the changes wins (last-write-wins policy)
- A `SyncConflict` record is created if the stale ETag scenario is detected
- The contact is not duplicated

---

### Suite C: DAVx⁵ (Android)

**Device:** Android phone running DAVx⁵ version 4.x (Play Store current release).

**Test C-01: Account Setup**

Steps:
1. Open DAVx⁵ > + > Login with URL and user name
2. Base URL: `https://staging.kontax.app/dav/`
3. Username: `{testEmail}`, Password: `{appPassword}`
4. Tap Login
5. On the address books screen, enable "Kontax" (or whatever the address book display name is)
6. Tap Synchronize

Expected:
- DAVx⁵ discovers the address book at `/dav/addressbooks/{userId}/default/`
- Sync runs without error

**Test C-02: Initial Sync — Kontax → Android**

Verify all seed contacts appear in the Android Contacts app (may require opening the Contacts app and selecting the Kontax account as a visible group).

**Test C-03: Auto-Discovery**

DAVx⁵ supports auto-discovery: if the user enters just `https://staging.kontax.app` as the base URL, DAVx⁵ will follow the `/.well-known/carddav` redirect automatically.

Steps:
1. Create a second DAVx⁵ account
2. Enter base URL `https://staging.kontax.app` (without `/dav/`)
3. Complete setup

Expected:
- DAVx⁵ discovers the correct address book via well-known redirect
- Sync works identically to C-01

**Test C-04: Bidirectional Sync**

Same scenarios as A-03 through A-06 but on Android/DAVx⁵.

**Test C-05: DAVx⁵-Specific Features**

DAVx⁵ supports:
- `addressbook-multiget` REPORT (requesting specific UIDs) — Kontax v1 does not implement this. Verify DAVx⁵ falls back gracefully to `addressbook-query`.
- `sync-collection` REPORT (WebDAV sync protocol) — Kontax v1 does not implement this. Verify DAVx⁵ falls back gracefully.
- vCard 4.0 — Kontax serves vCard 3.0. Verify DAVx⁵ accepts vCard 3.0 without error.

**Test C-06: Offline / Reconnect Behaviour**

1. Put the Android device in airplane mode
2. Make a change in Kontax (edit a contact)
3. Re-enable network
4. Trigger a DAVx⁵ sync

Expected: The change propagates correctly without data corruption.

---

### Suite D: Edge Case Contacts

These tests use deliberately tricky contact data and must be run against all three client types.

**Test D-01: Contact with No Name**

Seed contact C6 (no name, only email). Verify:
- Client displays it without crashing
- vCard serialized with just `FN:` empty or omitted (test both behaviours)
- Client does not skip it during sync (some clients filter out nameless contacts)

**Test D-02: Special Characters in Name**

Seed contact C4 (name contains `<`, `>`, `"`). Verify:
- vCard `FN:` line contains the literal characters, not XML-escaped entities
- Client displays the name correctly
- Round-tripping (Kontax → device → Kontax) preserves the characters

**Test D-03: Multi-Value Fields**

Use seed contact C7 (multiple emails, phones, addresses). Verify:
- All values are transmitted in the vCard (not truncated to one value per type)
- Labels (work, home, mobile) are preserved
- The primary email/phone matches Kontax's `email`/`phone` fields

**Test D-04: Long Notes Field**

Use seed contact C8 (notes >4096 characters). Verify:
- Notes are not truncated in the vCard
- vCard line folding is applied correctly for the long notes value
- The client accepts the contact without error

**Test D-05: Birthday and Anniversary Formats**

Verify:
- `BDAY:1990-06-15` (ISO format) round-trips correctly
- `BDAY:--06-15` (no year format) round-trips correctly (some vCard 3.0 clients use this format)
- `X-ANNIVERSARY:2015-09-20` (custom property) is preserved in Kontax's `customFields` JSON if present

**Test D-06: Unicode and Emoji in Notes**

Create a contact with emoji in the notes field (`🎉 Birthday next week`). Verify the emoji survives the vCard encoding round-trip and appears correctly on both sides.

---

### Suite E: Regression — Existing CardDAV Client Sync

After Phase 9 changes are deployed, verify that the existing CardDAV client sync (Kontax connecting *to* iCloud, Google, Nextcloud) still works:

1. Trigger an outbound sync for a test account connected to iCloud
2. Verify contacts sync in both directions
3. Verify no errors in sync job logs
4. Verify `SyncAccount`, `SyncContactLink`, and `SyncJob` records are correctly updated

This suite exists because P9-01 through P9-04 add new routes and middleware exclusions. Confirm these do not interfere with the existing sync runner or credential paths.

---

## Quirk Documentation Template

For each client-specific quirk discovered during testing, document in the format:

```
## Quirk: {short title}
- Client: iOS / macOS / DAVx⁵
- Discovered in test: {test ID}
- Observed behaviour: {what actually happened}
- Expected behaviour: {what RFC 6352 specifies}
- Server-side workaround: {if needed, describe the change made to the Kontax server}
- Status: Worked around / Accepted / Deferred
```

Known quirks to anticipate (from RFC errata and community experience):

- **iOS may send PROPFIND with `Depth: infinity`** — the server should treat this as `Depth: 0` and return the resource itself without error
- **iOS may not send `Content-Type` on PUT requests** — the server should assume `text/vcard` if absent
- **macOS Contacts requires the `addressbook-home-set` property on the principal response** — missing this property causes account setup to fail silently
- **DAVx⁵ requests `supported-address-data` property** — if not returned, DAVx⁵ may fall back to vCard 4.0 assumptions
- **iOS caches the `/.well-known/carddav` redirect** — if the redirect target changes, the device may need to be removed and re-added
- **Some iOS versions send `If-Match: *` on initial PUT** — this means "create only if not existing"; the server must handle this correctly (see P9-04)

---

## Pass / Fail Criteria

| Requirement | Pass condition |
|---|---|
| iOS account setup | Completes in < 60 seconds without error |
| iOS initial sync | All seed contacts appear on device |
| iOS bidirectional sync | Create/edit/delete on each side propagates correctly |
| macOS initial sync | All seed contacts appear in macOS Contacts |
| macOS bidirectional sync | Create/edit/delete on each side propagates correctly |
| DAVx⁵ initial sync | All seed contacts appear on Android |
| DAVx⁵ bidirectional sync | Create/edit/delete on each side propagates correctly |
| No duplicates | Zero duplicate contacts created by any sync cycle |
| CTag short-circuit | Clients do not re-fetch unchanged contacts |
| Special characters | C4 and C2 survive round-trip without encoding corruption |
| Revoke + reconnect | Device stops syncing after revoke; resumes after new password |
| Existing sync regression | Outbound iCloud/Google sync still works |

---

## Acceptance Criteria

- All tests in Suites A, B, and C pass without workarounds for the happy path (account setup, initial sync, bidirectional sync).
- All tests in Suite D pass for all three clients (special characters, empty name, multi-value, long notes).
- Suite E (regression) passes with no changes to outbound sync behaviour.
- All client-specific quirks encountered are documented using the quirk template.
- Any server-side workarounds applied during testing are tracked as code changes and merged before Phase 9 ships.
- The compatibility matrix is updated in the Phase 9 release notes: "Tested with iOS {version}, macOS {version}, DAVx⁵ {version}."

---

## Risks and Open Questions

- **iOS background sync frequency is not user-controllable.** iOS decides when to sync (typically every 15 minutes or on demand). Tests that require observing "the change propagated" may need to wait or use manual account refresh. Plan for up to 5 minutes per bidirectional propagation test.
- **Certificate trust on staging:** Real iOS devices require a valid TLS certificate on the CardDAV server. Self-signed certificates will not work. Confirm staging has a valid certificate from a trusted CA (Let's Encrypt is acceptable).
- **DAVx⁵ version differences:** DAVx⁵ 4.x behaviour may differ from 3.x. Test against the Play Store current release. Note the version in the quirk documentation.
- **ContactsUI differences across Android manufacturers:** Samsung One UI, Pixel stock Android, and other overlays may display synced contacts differently. Document manufacturer-specific issues but do not block release on them.
- **Multiple devices syncing simultaneously:** If two devices are both syncing against the same user account at the same time, race conditions may surface. Test this by setting up both iOS and macOS against the same account and editing the same contact from both simultaneously.
- **Contact photo sync:** Photos embedded in vCards are large. If iOS or DAVx⁵ sends a `PHOTO;ENCODING=BASE64` in a PUT request, the server must handle large PUT bodies without timing out. Verify the request body size limit is set appropriately (minimum 2 MB for a single vCard with a photo).
- **`addressbook-multiget` fallback:** DAVx⁵ prefers `addressbook-multiget` for incremental sync (fetching only changed cards by UID). Kontax v1 does not implement this. Verify DAVx⁵ falls back to `addressbook-query` REPORT without error. If it does not, this becomes a P0 blocker for DAVx⁵ compatibility.

---

## Outcome
This ticket is done when all three clients (iOS, macOS Contacts, DAVx⁵) pass the full test suite with bidirectional sync working end-to-end, all encountered quirks are documented, and any required server-side workarounds are merged into the codebase.
