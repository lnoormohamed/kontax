# P34K-01 — Generic-Safe CardDAV Capability Profile and Field Matrix

## Purpose

Define the default capability profile for unknown CardDAV providers so Kontax
has an explicit, conservative contract for `CardDAV / Other`.

## Background

Today, generic CardDAV is too optimistic. That is risky because semantic field
fidelity cannot be inferred from protocol compliance alone.

We need a named profile such as `carddav-generic-safe` with a documented field
matrix.

## Scope

**In scope**
- add a new explicit generic-safe CardDAV capability profile
- define supported vs local-only field families
- define what "supported" means for sync semantics

**Out of scope**
- connection-level override behavior
- UI copy
- automatic probing

## Design / Implementation Spec

### Recommended default behavior

For unknown CardDAV providers, classify fields into:

### Two-way safe by default

- full name
- structured name parts
- phone numbers
- email addresses
- company
- department
- job title
- websites
- addresses
- notes
- birthday

### Local-only until verified

- significant dates beyond birthday
  - anniversary
  - lunar birthday
  - arbitrary custom date labels

### Support definition

A field family counts as "supported" only if we trust the provider to:

1. accept the outbound representation
2. preserve the meaning
3. round-trip it back without turning absence/loss into a deletion signal

## Acceptance Criteria

- `carddav-generic-safe` exists as a first-class capability profile
- the field-family matrix is explicit in code and docs
- significant dates beyond birthday are local-only by default for unknown
  CardDAV

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — field matrix documented here
- [ ] Internal · support/admin — none
