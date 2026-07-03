# P39-03 — Runner: field exclusions on read and write

Status: Not started · Priority: P1 · Depends: —
Phase: [Phase 39](phase-39.md)

## Problem

`excludedFields` (`NOTE`, `BDAY`, `ADR`, `X-CUSTOM`) is stored by the P36
panel but the runner syncs every field regardless.

## Change

- The runner strips excluded vCard properties from outbound writes and
  ignores them on inbound reads, in both OAuth and CardDAV paths.
- Existing remote data is left unchanged (no active scrubbing), matching the
  P36 brief's info note.
- **Forward-compatibility:** the enforcement seam must handle values outside
  the original four — Phase 44 adds `PHOTO` as an excludable family
  (see [phase-44](phase-44-photo-sync.md), P44-03). Treat the list as open.

## Acceptance

- With `NOTE` excluded: local note edits never reach the remote, and remote
  note changes never overwrite local notes; other fields sync normally.
- Same verified for `BDAY`, `ADR`, `X-CUSTOM` in the P39-08 matrix.
- An unknown value in `excludedFields` is ignored gracefully (no crash, no
  accidental exclusion of everything).
