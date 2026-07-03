# P34N-01 — Audit Log Deep Filters, Pivots, and Export

## Purpose

Make the admin audit log significantly more useful for investigations and
support work.

## Background

The current audit page is a good start, but it still makes admins do too much
manual narrowing. Investigations need faster pivots.

## Scope

**In scope**
- richer filters
- entity pivots
- admin pivots
- export support

**Out of scope**
- full SIEM integration
- immutable external archive pipelines

## Design / Implementation Spec

### Proposed filter dimensions

- action type
- admin actor
- target user
- target connection / entity id
- date range
- severity / destructive actions only

### Export

- CSV export for filtered results
- stable serialized details format

## Acceptance Criteria

- audit log supports common investigative pivots without manual page-walking
- filtered export is available
- admins can pivot from related views directly into pre-filtered audit results

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — filter/export behavior documented here
- [ ] Internal · support/admin — audit investigation examples later
