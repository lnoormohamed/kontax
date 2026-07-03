# P41-06 — Multi-connection QA matrix

Status: Not started · Priority: P1 · Depends: [P41-02](p41-02-outbound-projection-v1.md), [P41-05](p41-05-conflict-override-edit-matrix.md)
Phase: [Phase 41](phase-41.md) · Source spec: [phase-37/02 §7](../phase-37/02-carddav-projection.md)

## Scope

Staging pass per the source doc §7 rollout table: two iCloud accounts on one
device (the auto-link caveat), a Google account, and a generic CardDAV
client. Captures V1-only behaviour (inbound falls back to pre-projection
semantics) separately from V2. Real-device verification required for the iOS
scenarios (preview cannot emulate them).

## Acceptance

- Results recorded in this ticket file (p34h-07 sign-off format), V1 and V2
  passes separated.
- The §4.3 worked example and the §5.3 matrix both re-verified end-to-end on
  real devices before phase exit.
