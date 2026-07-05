# P34I-03 — Capability-Aware Inbound Merge Semantics

## Purpose

Teach inbound sync to ignore unsupported-field absence from weaker providers so
those providers cannot erase stronger-provider or local canonical data.

## Background

Outbound filtering alone is not enough. If Fastmail pulls back a contact with
only `birthday`, Kontax must not infer that `anniversary` and `lunar birthday`
were deleted.

## Scope

**In scope**
- Gate inbound field application by provider capabilities
- Preserve canonical values for unsupported-field families
- Handle partial support safely

**Out of scope**
- conflict UI
- support copy

## Design / Implementation Spec

### Core merge rule

For each inbound provider snapshot:
- only fields supported by that provider may overwrite canonical contact data
- missing unsupported fields are ignored
- missing supported fields may still represent deletion / removal

### Example

Canonical contact:
- birthday
- anniversary
- lunar birthday

Inbound from Fastmail:
- birthday only

Expected merge result:
- birthday may update
- anniversary unchanged
- lunar birthday unchanged

### Field ownership nuance

This is not "one provider owns a whole contact". Ownership is per field family.
One provider may safely update:
- birthday
- phones
- emails

while being unable to touch:
- significant dates beyond birthday

## Acceptance Criteria

- Inbound merge path checks capability support before clearing or overwriting a
  field family
- Unsupported-field absence no longer causes canonical data loss
- Supported-field deletions still work where the provider truly owns the field

## Risks / Open Questions

- Decide whether provider-limited field families should remain completely
  immutable from that provider or allow additive-only behavior in some cases.

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — merge semantics documented here
- [ ] Internal · support/admin — none
