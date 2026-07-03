# P34K-05 — Generic-vs-Verified CardDAV QA Harness

## Purpose

Create a repeatable QA pass that proves the difference between generic-safe and
verified CardDAV behavior, especially around richer date families.

## Background

This phase changes the product strategy for unknown CardDAV providers. We need
QA coverage that shows:

- safe mode preserves canonical data
- verified mode expands projection intentionally
- promotion does not create destructive resync behavior

## Scope

**In scope**
- QA scenarios for generic-safe CardDAV
- QA scenarios for verified CardDAV
- promotion / override regression checks
- mixed-provider date-family preservation checks

**Out of scope**
- automated live server probing

## Design / Implementation Spec

### Required scenarios

1. **Generic-safe outbound projection**
   - create contact with birthday + anniversary + lunar birthday
   - sync to unknown CardDAV
   - verify remote gets birthday only
   - verify Kontax keeps all dates

2. **Generic-safe inbound roundtrip**
   - edit supported field remotely
   - sync back into Kontax
   - verify supported field updates
   - verify extra dates remain intact

3. **Verified promotion**
   - move connection from generic-safe to verified
   - resync
   - verify richer supported families now project as expected

4. **No destructive downgrade**
   - ensure a generic-safe resync after rich canonical data exists does not
     erase unsupported fields

### Fixture expectation

Reuse multilingual fixtures from the capability QA work:
- English
- Arabic
- Mandarin
- date-rich variants with birthday, anniversary, and lunar birthday

## Acceptance Criteria

- QA runbook exists for generic-safe and verified behaviors
- signoff can state exactly what unknown CardDAV does by default
- promotion / override path has explicit regression coverage

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — QA expectations documented here
- [ ] Internal · support/admin — optional later runbook
