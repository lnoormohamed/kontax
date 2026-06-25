# P34O-01 — Generic CardDAV Provider Identity, Host Capture, and Friendly Account Naming

## Purpose

Make generic CardDAV connections easier to understand by storing and displaying
provider identity in a structured way instead of relying on one freeform label
or a raw base URL.

## Background

Known providers such as iCloud and Fastmail are easy to recognize because they
have explicit product identity in Kontax. Generic CardDAV connections do not.

That creates a UX gap:

- users cannot easily tell one manual CardDAV account from another
- support cannot quickly see whether a connection is truly generic or tied to a
  recognizable provider host
- future provider promotion work has no clear place to store detection outcome

We need a normalized identity model that stays honest about confidence.
Today the product has enough sync complexity that a raw freeform label is no
longer sufficient as the only identity for a generic CardDAV account.

## Scope

**In scope**
- capture and normalize canonical provider host / base URL metadata for generic
  CardDAV accounts
- introduce a provider identity model for CardDAV connections
- support a layered display contract:
  - user label
  - detected provider display name
  - canonical host
  - verification state
- define when to show a verified provider name vs a neutral generic label
- wire the normalized identity into the sync connections rail and relevant
  support/admin surfaces

**Out of scope**
- full provider capability promotion logic
- deep brand asset system for every provider
- automatic protocol probing beyond existing connection metadata

## Design / Implementation Spec

### Identity model

For CardDAV connections, store or derive the following concepts:

- `accountLabel`
  - user-editable primary label
  - example: `Work CRM`, `ClickUp Contacts`, `Personal DAV`
- `providerDisplayName`
  - friendly provider/service name used when we have a trustworthy detection
  - example: `iCloud`, `Fastmail`, `ClickUp`
- `providerHost`
  - canonical normalized host derived from the connection base URL
  - example: `contacts.icloud.com`, `carddav.fastmail.com`, `dav.clickup.com`
- `providerVerificationState`
  - one of:
    - `VERIFIED`
    - `DETECTED_UNVERIFIED`
    - `GENERIC`
- `providerBrandKey`
  - optional stable key for icon/logo mapping when verified

### Data ownership rules

- `accountLabel` is always user-owned and editable.
- `providerHost` is derived from the saved connection URL and normalized by app
  code.
- `providerDisplayName` and `providerBrandKey` are system-derived unless a
  future support override explicitly changes them.
- `providerVerificationState` is system-controlled.

### Display rules

#### Primary line

Show the user label first.

Examples:

- `Fastmail Personal`
- `ClickUp Contacts`
- `Work CRM`

#### Secondary line

Show one of:

- verified provider name
- detected provider name with unverified framing
- canonical host

Examples:

- `Verified provider: Fastmail`
- `Detected from dav.clickup.com`
- `carddav.example.net`

### Detection rules

Detection should use a conservative registry / mapping layer, not arbitrary
marketing guesses.

Recommended behavior:

1. If the connection matches a known verified provider host mapping:
   - mark `providerVerificationState = VERIFIED`
   - set `providerDisplayName`
   - set `providerBrandKey`
2. If the host suggests a recognizable service but is not registry-verified:
   - mark `providerVerificationState = DETECTED_UNVERIFIED`
   - set a provisional display name if the mapping is explicit enough
3. Otherwise:
   - mark `providerVerificationState = GENERIC`
   - fall back to generic CardDAV presentation

### Migration / backfill expectations

- Existing sync accounts should receive a normalized `providerHost` where the
  current base URL allows it.
- Existing labels should remain untouched.
- Backfill should be best-effort and non-destructive.

### Admin/support usage

The admin/support surface should expose:

- current account label
- provider display name
- canonical host
- verification state
- source of the detection result if available

This will help support distinguish:

- truly generic manual DAV
- verified known provider
- likely provider on a custom or semi-known host

### Surfaces that should consume this model

- sync connections rail
- connection detail page
- account setup / reconnect UI
- admin sync detail view
- activity and audit references where connection identity is shown

## Acceptance Criteria

- Generic CardDAV accounts have a structured provider identity model.
- The sync connections UI no longer relies on raw labels alone for generic DAV
  accounts.
- The canonical host is preserved and visible in support/admin tooling.
- Verified provider branding is only shown when backed by explicit mapping.
- Unknown providers fall back safely without misleading branding.
- Existing generic connections can be backfilled without breaking user labels.

## Documentation

- [ ] External · users — none yet
- [ ] External · developers — none
- [x] Internal · engineering — detailed behavior documented here
- [ ] Internal · support/admin — add provider identity guidance after shipping
