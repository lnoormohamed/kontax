# P41-03 — Sync page projection grouping + honest-limitations copy

Status: Not started · Priority: P1 · Depends: [P41-01](p41-01-projection-config.md), [P41-DB01](p41-db01-design-brief-sync-projection-surfaces.md)
Phase: [Phase 41](phase-41.md) · Source spec: [phase-37/02 §3, §6](../phase-37/02-carddav-projection.md)

## Scope

Sync connections adopt the primary grouping P41-DB01 decides
(destination-book grouping is the working proposal, reconciled against the
shipped P35 provider grouping); each connection row shows its projection
scope ("Pushes: Work · favours work fields"). Limitation copy is explicit,
not buried: "private" means not shown to other members, *not* "can never
leave a device"; iOS may visually merge cards across accounts.

## Acceptance

- Grouping matches the brief's decision for single-book and multi-book
  accounts.
- Every §3 limitation has visible copy in the specified location; the iOS
  auto-link caveat appears for a second same-provider account.
- Mobile layout per the brief (bottom-sheet settings inherited from P39-07).
