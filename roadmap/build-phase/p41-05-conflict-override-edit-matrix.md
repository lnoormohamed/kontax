# P41-05 — Conflict override & edit-context matrix (V2)

Status: Not started · Priority: P1 · Depends: [P41-04](p41-04-pushed-snapshot-store-inbound-diff.md), [P40-07](p40-07-edit-context-resolution.md)
Phase: [Phase 41](phase-41.md) · Source spec: [phase-37/02 §5.2–5.3](../phase-37/02-carddav-projection.md)

## Scope

Per-connection conflict-override rule; implement the full edit matrix
(private personal / private work / same-person collision / new contact /
shared-book edit) for both work-scoped and personal-scoped connections.
Routes through Phase 40's edit-context resolution function
([P40-07](p40-07-edit-context-resolution.md)) — sync becomes its third
caller. Unattributable inbound changes queue for manual review via the
existing P23 conflict surface (fallback state per
[P41-DB01](p41-db01-design-brief-sync-projection-surfaces.md)).

## Acceptance

- Every cell of the source doc §5.3 matrix verified against a staging pair of
  connections (work-scoped + personal-scoped).
- An engineered ambiguous diff lands in the conflict queue with the brief's
  copy, not silently guessed.
