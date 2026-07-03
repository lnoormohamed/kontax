# P44-06 — End-to-end photo sync QA matrix

Status: Not started · Priority: P1 · Depends: [P44-03](p44-03-inbound-photo-sync.md), [P44-04](p44-04-outbound-photo-push-normalization.md)
Phase: [Phase 44](phase-44-photo-sync.md)

## Scope

Staging pass across Google + iCloud + Nextcloud with a seeded photo set:

- Add / change / delete on each side.
- **The no-op double-cycle echo test: two full sync cycles with no user
  change produce zero photo writes on either side** (the P44-02 guarantee —
  the single most important row in the matrix).
- Excluded-fields off-switch ("Photos" exclusion honoured both directions).
- A 5,000-contact account for storage/runtime cost.
- Real-device verification that iOS/Android contact apps display the synced
  photos.

## Acceptance

- Results recorded in this ticket file (P37-12 sign-off format).
- Echo test passes on every provider; any failure blocks phase exit.
