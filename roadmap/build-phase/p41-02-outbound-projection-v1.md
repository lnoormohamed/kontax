# P41-02 — Outbound projection build in the runner (V1)

Status: Not started · Priority: P0 · Depends: [P41-01](p41-01-projection-config.md)
Phase: [Phase 41](phase-41.md) · Source spec: [phase-37/02 §4.2–4.3](../phase-37/02-carddav-projection.md)

## Scope

The runner assembles the outbound vCard from the projection instead of the
full contact: in-scope book fields, minus private fields (via the P40-02
read-path helper), collisions resolved by the precedence rule. Composes with
the Phase 39 enforcement work (`excludedFields`, `exportLabelFilter` apply
**after** projection). CardDAV-safe: no protocol extensions.

## Acceptance

- The source doc §4.3 worked example passes: one "John", two iCloud
  connections — work connection pushes name/work email/work mobile/job title
  only; personal connection pushes name/personal email/personal mobile/
  birthday/home address only; private notes on neither.
- Phase 39 filters verified to apply post-projection (an excluded field never
  reappears via projection).
