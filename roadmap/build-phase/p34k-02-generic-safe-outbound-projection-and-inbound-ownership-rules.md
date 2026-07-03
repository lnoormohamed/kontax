# P34K-02 — Generic-Safe Outbound Projection and Inbound Ownership Rules

## Purpose

Apply the generic-safe profile to real sync behavior so unknown CardDAV
providers receive only the trusted subset, and unsupported families remain
canonical in Kontax.

## Background

The profile alone is not enough. Projection, merge, conflict detection, and
remote shadow logic all need to respect the generic-safe rules.

## Scope

**In scope**
- outbound projection for unknown CardDAV providers
- inbound merge ownership for unsupported families
- capability-scoped remote shadow behavior
- conflict suppression for unsupported-field absence

**Out of scope**
- provider promotion / override
- end-user UI copy

## Design / Implementation Spec

### Outbound

For `carddav-generic-safe`, only send the safe subset.

Do **not** send:
- anniversary
- lunar birthday
- other extra significant dates

### Inbound

For `carddav-generic-safe`, inbound payloads may update only supported
families.

Unsupported families must:
- remain canonical in Kontax
- not be cleared from the contact because the remote omitted them
- not be treated as deletions

### Conflict semantics

Unsupported-field differences must not open mutation conflicts on their own.

## Acceptance Criteria

- unknown CardDAV outbound writes use the safe projection
- unknown CardDAV inbound sync cannot erase unsupported canonical fields
- unsupported-field absence from unknown CardDAV does not open conflicts

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — semantic rules documented here
- [ ] Internal · support/admin — none
