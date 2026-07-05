# P34J-04 — Multi-Provider Capability QA Harness and Fixtures

## Purpose

Create a repeatable QA pass for mixed-capability sync scenarios so we can prove
field preservation across providers before production rollout.

## Background

We already have real fixtures and real provider testing momentum:
- English
- Arabic
- Mandarin
- rich date fixtures (`birthday`, `anniversary`, `lunar birthday`)

This ticket turns that ad hoc testing into an explicit harness/runbook.

## Scope

**In scope**
- define canonical multilingual fixtures
- define provider matrix checks
- define expected outcomes for iCloud + Fastmail mixed support
- capture resync / round-trip cases

**Out of scope**
- production support UI

## Design / Implementation Spec

### Minimum fixture set

- English full-contact fixture
- Arabic full-contact fixture
- Mandarin full-contact fixture

Each should cover:
- birthday
- one supported extra date (`Anniversary`)
- one custom/non-standard extra date (`Lunar birthday` or equivalent custom label)
- multiple phones/emails/websites/addresses with custom labels

### Required scenarios

1. iCloud -> Kontax -> Fastmail
2. Fastmail -> Kontax -> iCloud
3. edit in stronger provider, resync through weaker provider, ensure no data loss
4. edit supported field in weaker provider, ensure canonical and stronger provider update correctly

## Acceptance Criteria

- QA document exists with expected field-by-field outcomes
- Mixed-provider runs explicitly validate preservation of unsupported canonical
  fields
- Signoff can state which providers support which date families

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — QA fixture expectations documented here
- [ ] Internal · support/admin — optional runbook later
