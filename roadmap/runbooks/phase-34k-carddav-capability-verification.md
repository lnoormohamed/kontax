# Phase 34K CardDAV Capability Verification

## Goal

Verify that unknown CardDAV providers default to conservative field handling and
that a per-connection override can promote a connection to a verified profile
without losing unsupported data in Kontax.

## Fixtures

- One unknown/manual CardDAV connection
- One Fastmail CardDAV connection
- One iCloud CardDAV connection
- One contact with:
  - birthday
  - anniversary
  - lunar birthday
  - multiple email labels
  - multiple phone labels

## Checks

1. Connect an unknown CardDAV provider through `Manual`.
2. Open the connection settings and confirm:
   - the provider capability section shows `Auto-detect from provider`
   - the current resolved mode reads `Generic safe`
3. Sync a contact containing birthday + additional significant dates.
4. Confirm the remote provider receives the birthday only.
5. Confirm additional significant dates remain present in Kontax.
6. Confirm the sync detail note says safe compatibility mode is active.
7. In connection settings, switch the provider compatibility override to
   `Verified iCloud profile` or `Verified Fastmail profile`.
8. Re-run sync.
9. Confirm the connection now uses the selected override and outbound payloads
   follow that provider's supported-field behavior.
10. Switch the override back to `Auto-detect from provider`.
11. Confirm the connection reverts to the fingerprinted mode.

## Expected outcomes

- Unknown CardDAV providers do not export unsupported significant dates by
  default.
- Unsupported values remain in Kontax and are not deleted locally on re-sync.
- Verified overrides are sticky per connection until the user switches back to
  auto-detect.
- Fastmail-compatible overrides continue suppressing significant dates.
- iCloud-compatible overrides allow significant dates through.
