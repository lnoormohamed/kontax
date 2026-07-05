# P34M-02 — Sync Connection Detail, Lineage, and Capability Inspector

## Purpose

Give admins a proper connection-level deep dive for sync support.

## Background

We now have connection identity, replacement lineage, and capability-profile
behavior, but there is no admin surface that shows them together in one place.

## Scope

**In scope**
- admin connection detail view
- lineage chain display
- capability profile / override display
- recent sync job summary
- recent errors and reauth state

**Out of scope**
- raw vCard editors
- automatic provider probing

## Design / Implementation Spec

### Must-show fields

- connection id
- provider
- connection label
- status
- last success / last error
- capability profile
- capability override
- replaces / replaced by chain
- credential validation status

### Supporting context

- recent job history
- recent conflict counts
- whether generic-safe mode is active

## Acceptance Criteria

- admins can open a connection and understand its current state and history
- connection lineage is visible and linkable
- provider capability mode is visible and understandable

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — connection inspector defined here
- [ ] Internal · support/admin — connection-debug checklist later
