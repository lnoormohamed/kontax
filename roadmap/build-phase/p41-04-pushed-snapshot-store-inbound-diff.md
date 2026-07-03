# P41-04 — Per-link pushed-snapshot store & inbound diff engine (V2)

Status: Not started · Priority: P0 · Depends: [P41-02](p41-02-outbound-projection-v1.md)
Phase: [Phase 41](phase-41.md) · Source spec: [phase-37/02 §5.1](../phase-37/02-carddav-projection.md)

## Scope

Store the last-pushed vCard per (connection, contact); when a card comes
back, diff against the snapshot to infer *which fields changed*, since
inbound vCards carry no layer/book attribution. This is the engineering cost
the source doc calls out — budget accordingly.

**Shared-storage prerequisite:** the snapshot store must be reconciled with
p34i-05's remote shadow and [P44-02](phase-44-photo-sync.md)'s photo shadow
**before build** — one mechanism, three consumers (execution-sequence item
32). Do not build a projection-only store.

## Acceptance

- Round-trip: push projection, mutate one field remotely, pull — the diff
  names exactly that field.
- No-op pull (nothing changed remotely) produces an empty diff — no phantom
  updates.
- Storage design doc/ADR shows the three consumers and their field families.
