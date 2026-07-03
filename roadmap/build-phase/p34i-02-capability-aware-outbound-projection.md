# P34I-02 — Capability-Aware Outbound Projection

## Purpose

Ensure outbound sync only sends fields a provider can safely represent, instead
of blindly projecting the full Kontax contact model everywhere.

## Background

Today the dangerous assumption is "if it exists in Kontax, send it". That works
until one provider silently drops or normalizes fields in a way that creates
false deletion signals later.

## Scope

**In scope**
- Filter outbound contact payloads using the capability registry
- Apply filtering to CardDAV / Google / Microsoft projection layers
- Preserve canonical local data even when not sent remotely

**Out of scope**
- inbound merge behavior
- activity copy

## Design / Implementation Spec

### Outbound rule

For each sync account:
1. resolve provider capability profile
2. project only supported fields
3. omit unsupported fields entirely
4. never coerce unsupported fields into lossy fallbacks unless explicitly
   designed

### Example

Canonical contact:
- `birthday = 1992-11-06`
- `significantDates = [Anniversary, Lunar birthday]`

Outbound:
- to iCloud: send birthday + significant dates
- to Fastmail: send birthday only

### Important constraint

Do not "flatten" unsupported significant dates into notes or custom fields as a
hidden fallback in v1. Hidden lossy projection makes debugging harder and can
create false user expectations.

## Acceptance Criteria

- Outbound sync path resolves capability profile per account
- Unsupported fields are omitted from outbound payloads
- Significant dates beyond birthday are not sent to providers marked
  unsupported for that field family
- Existing supported-field behavior remains unchanged

## Risks / Open Questions

- Decide whether omitted fields should be counted in sync diagnostics so support
  can explain the result later.

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — outbound filtering rules documented here
- [ ] Internal · support/admin — none
