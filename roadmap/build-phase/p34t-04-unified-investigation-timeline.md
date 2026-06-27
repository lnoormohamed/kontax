# P34T-04 — Unified Investigation Timeline Across Notes, Cases, Audit, and Sync Events

## Purpose

Unify the main support/investigation artifacts into one coherent timeline so
admins can understand what happened without mentally stitching together
multiple cards and tabs.

## Background

The admin area now has several useful evidence sources:

- support notes
- support cases
- audit events
- sync diagnostics / conflict activity

They are individually helpful, but incident work still involves a lot of
cross-referencing.

## Scope

**In scope**
- combined investigation timeline on user and sync detail views
- timeline event grouping / labeling
- lightweight filtering by event source
- deep links back to the originating entity where useful

**Out of scope**
- full log explorer replacement
- arbitrary time-series analytics

## Dependencies

- admin support notes
- support cases
- audit events
- sync detail / conflict diagnostics

## Design / Implementation Spec

### Timeline event classes

- support note added
- support case created / reassigned / resolved
- destructive admin action
- sync failure / recovery / reconnect / replacement event
- relevant user lifecycle or billing exception event

### UX rules

- chronology should be obvious
- event labels should be support-friendly rather than raw internal codes
- source-specific noise should be collapsible or filterable

## Acceptance Criteria

- admins can investigate a user or sync issue from one primary timeline surface
- the combined timeline reduces context-switching between notes, cases, and
  audit cards
- event labels feel understandable without needing raw code names

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — investigation timeline scope documented here
- [x] Internal · support/admin — timeline-reading guidance required
