# P34D-03 — Smoke Test: Sync

## Purpose

Verify that all four sync providers (iCloud CardDAV, Fastmail CardDAV, Google
Contacts OAuth, Outlook OAuth) can be connected, perform an initial import, and
reflect bidirectional edits. Verify disconnect, error state, and sync direction
settings.

## Background

Kontax syncs contacts via CardDAV (iCloud, Fastmail) and OAuth-based APIs (Google
People API, Microsoft Graph). The sync runner is a background job. Google and Azure
OAuth apps for sync are separate from any login OAuth; they share the same
GOOGLE_CLIENT_ID configured in the environment.

This test requires real accounts for each provider — a one-time setup. Use dedicated
test accounts, not personal accounts, so that test contacts can be freely created and
deleted without affecting real data.

## Scope

**In scope**
- Add and verify each of the four sync providers
- Initial import of contacts from provider into Kontax
- Edit in Kontax → reflects in provider (export direction)
- Edit in provider → reflects in Kontax (import direction)
- Disconnect a sync account
- Error state when credentials are invalid
- Sync direction setting (import-only vs bidirectional)

**Out of scope**
- Conflict resolution edge cases (deferred to a dedicated sync QA phase)
- Sync performance with >1000 contacts (load testing is separate)
- Scheduling / frequency settings UI (tested in settings smoke test)

## Design / Implementation Spec

Each CardDAV test requires a known server URL and app-specific password. Prepare
these in advance:
- **iCloud**: server `https://contacts.icloud.com`, Apple ID email, app-specific
  password generated at appleid.apple.com
- **Fastmail**: server `https://carddav.fastmail.com`, Fastmail email, app password
  generated in Fastmail Security settings

For bidirectional tests (TC-07, TC-08), a contact named "SyncTestContact" should be
created in advance in the provider. After the test, delete it from both sides.

Record results in `roadmap/runbooks/smoke-test-results-v1.md` → Sync section.

## Test Cases

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| TC-01 | Add iCloud CardDAV | Go to Settings → Sync → Add Account. Select CardDAV. Enter server URL, Apple ID, app-specific password. Save. | Connection status shows "Active". No error message. | |
| TC-02 | iCloud initial import | After TC-01, trigger a sync or wait for the runner. | Contacts from the iCloud test account appear in Kontax contact list. Count roughly matches source. | |
| TC-03 | Add Fastmail CardDAV | Add another sync account. Select CardDAV. Enter Fastmail server URL, email, app password. Save. | Connection status shows "Active". | |
| TC-04 | Fastmail initial import | After TC-03, trigger sync. | Contacts from the Fastmail test account appear in Kontax. | |
| TC-05 | Add Google Contacts OAuth | Go to Sync → Add Account. Select Google Contacts. Click "Connect Google". | OAuth consent screen opens in a popup or redirect. Authorise Kontax to access contacts (People API scope). Redirected back to Kontax. Connection shows "Active". | |
| TC-06 | Google initial import | After TC-05, trigger sync. | Google contacts from the test Google account appear in Kontax. | |
| TC-07 | Add Outlook OAuth | Go to Sync → Add Account. Select Outlook. Click "Connect Outlook". | Microsoft login + consent screen. Authorise. Redirected back. Connection shows "Active". | |
| TC-08 | Outlook initial import | After TC-07, trigger sync. | Outlook contacts appear in Kontax. | |
| TC-09 | Edit in Kontax → appears in source | Find a synced contact (from any provider). Edit the notes field in Kontax. Trigger sync. | Open the source provider's contacts app/web — the edited note is present on the same contact. | |
| TC-10 | Edit in source → appears in Kontax | In the iCloud Contacts app (or Google Contacts web), edit the phone number of the "SyncTestContact". Trigger sync in Kontax. | The changed phone number appears in Kontax on that contact's detail page. | |
| TC-11 | Disconnect a sync account | Go to Settings → Sync. Click the kebab on the iCloud account. Select "Disconnect". Confirm. | The iCloud sync account is removed from the list. A spinner or confirmation message appears. | |
| TC-12 | Contacts remain after disconnect | After TC-11, check the contact list. | Contacts imported from iCloud are still present in Kontax. The sync source badge is removed (or shown as "disconnected"). No mass deletion. | |
| TC-13 | Sync icon after disconnect | Look at contacts that came from iCloud. | No active sync icon / indicator on those contacts. The sync account no longer appears in Settings → Sync. | |
| TC-14 | Error state: invalid credentials | Add a new CardDAV account with a deliberately wrong password. Save. | The connection shows an error state ("Connection failed" or similar). A "Reconnect" or "Edit credentials" CTA is visible. No unhandled exception or blank screen. | |
| TC-15 | Sync direction: import-only | Open settings for the Google sync account. Change sync direction to "Import only". Save. Edit a contact in Kontax that came from Google. Trigger sync. | The edit does NOT appear in Google Contacts. (The export leg is skipped.) | |
| TC-16 | Sync direction restore | Change Google sync direction back to "Bidirectional". Edit the same contact. Trigger sync. | The edit appears in Google Contacts. | |

## Acceptance Criteria

- All 16 test cases pass.
- No 500 errors in Coolify logs during sync trigger.
- Bidirectional sync round-trip (TC-09, TC-10) completes within 2 minutes of trigger.
- Results recorded in `roadmap/runbooks/smoke-test-results-v1.md`.

## Risks / Open Questions

- OAuth tokens for Google and Azure expire; the test should be run in one session to
  avoid re-auth mid-run.
- Apple requires app-specific passwords for CardDAV; standard Apple ID passwords are
  rejected. Prepare the app password before the test session.
- TC-15 (import-only) relies on the sync direction setting actually suppressing the
  export mutation call in the runner — this should be verified in code if TC-15
  fails, as it may be a P0 (data integrity risk).
- Google People API scopes: the OAuth consent must include
  `https://www.googleapis.com/auth/contacts` for write access. If TC-09 fails but
  TC-06 passed, the likely cause is a missing write scope on the OAuth app.

## Documentation

- [ ] External · users — in-app Help: if sync direction label is unclear, flag for
      copy update in P34 UI polish phase
- [ ] External · developers — /developers: no changes needed
- [x] Internal · ops — `roadmap/runbooks/smoke-test-results-v1.md`: record results here
- [ ] Internal · engineering — docs/: no code changes in this ticket
