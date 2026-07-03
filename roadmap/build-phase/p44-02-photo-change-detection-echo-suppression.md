# P44-02 — Photo change detection & echo suppression model

Status: Not started · Priority: P0 · Depends: [P44-01](p44-01-provider-photo-roundtrip-qa-harness.md)
Phase: [Phase 44](phase-44-photo-sync.md)

## Scope

Design ticket (ADR-style). Given P44-01's findings, define how we know a
photo *actually* changed:

- Per sync link, store a **photo shadow**: the hash of the provider's
  *canonical* copy (what the provider returned after our last push — not what
  we sent), plus the provider's photo identifier and a local photo version.
  **Storage is the shared snapshot/shadow mechanism** — reconcile with
  [P41-04](p41-04-pushed-snapshot-store-inbound-diff.md) and p34i-05 before
  building (one mechanism, three consumers; execution-sequence item 32).
- Decision table covering: local change only → push; remote change only →
  pull; provider recompressed our own push → **no-op** (echo suppressed);
  both changed → conflict ([P44-05](p44-05-photo-conflict-merge-surfaces.md));
  photo deleted on either side.
- Explicit no-loop guarantee: two full sync cycles with no user change
  produce zero photo writes on either side — this becomes a
  [P44-06](p44-06-photo-sync-qa-matrix.md) test.

## Acceptance

- The decision table is reviewed against every provider behaviour recorded in
  P44-01; no case falls through to "compare raw bytes of pushed vs pulled".
- ADR records the shared-storage design with the three consumers.
