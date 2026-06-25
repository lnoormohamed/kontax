# P34P-02 — Sync Fixture Harness and Provider Roundtrip Regression Suite

## Purpose

Create a provider-aware regression harness for the sync engine so field mapping,
capability rules, and merge semantics can be tested repeatedly against known
fixtures.

## Background

The sync engine now includes provider-specific behavior, unsupported-field
preservation, custom-label rules, and richer date handling. Manual smoke tests
alone are no longer enough to protect this surface.

## Scope

**In scope**
- fixture-backed sync tests for:
  - iCloud
  - Fastmail
  - generic CardDAV safe mode
- roundtrip checks for names, phones, emails, addresses, dates, notes, and
  custom labels where supported
- regression cases for unsupported-field preservation

**Out of scope**
- live network tests against third-party services in CI

## Dependencies

- P34P-01 — baseline test strategy
- P34I / P34J / P34K — provider capability semantics already defined

## Design / Implementation Spec

### Fixture categories

- provider-origin contact fixture
- Kontax-edited contact fixture
- unsupported-field shadow fixture
- multi-date fixture
- custom-label fixture

### Assertions

- outbound projection matches provider rules
- inbound merge preserves local-only fields correctly
- unsupported remote loss does not become a deletion signal in Kontax
- custom labels are preserved where supported and downgraded safely where not

### Test execution model

- no live provider credentials in CI
- fixture versioning lives in-repo
- provider-specific expectations are readable by engineering and QA

## Acceptance Criteria

- Fixture-based provider tests can catch regressions without a live account.
- Known sync compatibility rules are encoded into automated checks.
- Date-field preservation and unsupported-field behavior are covered.
- At least iCloud, Fastmail, and generic-safe CardDAV are represented by named
  fixtures.

## Documentation

- [x] Internal · engineering — fixture philosophy documented here
