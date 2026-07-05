# P40-04 — Schema: `SyncAccount.destinationBookId`

Status: Column landed (uncommitted, 2026-07-04) · Priority: P1 · Depends: [P40-01](p40-01-schema-contact-book-membership.md)
Phase: [Phase 40](phase-40.md) · Source spec: [phase-37/01 §3.5](../phase-37/01-data-model-build-now.md)

## Scope

Inbound sync targets a chosen book instead of the implicit default. Surfaced
in the P36 settings panel as a "Destination book" control — coordinate with
[Phase 39](phase-39.md) so the panel gains the section once the column
exists. Feeds [Phase 41](phase-41.md)'s per-connection projection scope
([P41-01](p41-01-projection-config.md)).

## Acceptance

- Column shipped (additive), default preserves current behaviour (the user's
  default book).
- Inbound contacts from an account with a destination set land in that book's
  membership.
- Settings section per the P39/P41 design briefs (or explicitly deferred to
  P41-01 if the panel work lands there — record which).
