# P39-04 — Runner: export label filter

Status: Done — new-push gating in all three connectors (2026-07-03) · Priority: P1 · Depends: —
Phase: [Phase 39](phase-39.md)

## Problem

`exportLabelFilter` is stored by the P36 panel but every contact is pushed
regardless — "only push contacts with label X" does nothing.

## Change

- During outbound push, contacts not carrying a matching label are skipped
  for **new** pushes.
- Contacts already on the remote are **not** deleted for failing the filter —
  the filter affects new outbound changes only, per the P36 brief.
- Applies for `syncDirection` `TWO_WAY` and `EXPORT_ONLY`.

## Acceptance

- Only labelled contacts appear on a freshly connected remote.
- Removing the label from a contact does not delete it remotely.
- Verified against both an OAuth and a CardDAV account in the P39-08 matrix.
