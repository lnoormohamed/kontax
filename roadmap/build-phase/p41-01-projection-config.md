# P41-01 — Per-connection projection config

Status: Not started · Priority: P0 · Depends: [P40-04](p40-04-schema-sync-destination-book.md), [P40-06](p40-06-read-write-cutover.md), [P41-DB01](p41-db01-design-brief-sync-projection-surfaces.md)
Phase: [Phase 41](phase-41.md) · Source spec: [phase-37/02 §4.1](../phase-37/02-carddav-projection.md)

## Scope

Each connection gets: destination-book scope (which memberships project),
private-field exclusion (always on, not configurable), and a same-type
precedence preference ("favour work" / "favour personal") for collisions when
one person appears in multiple in-scope books. Config surfaces in the sync
settings panel (extends the Phase 39/P36 panel), including resolving the
overlap with the existing CardDAV `bookAllowlist` section per the design
brief.

## Acceptance

- Config persists per connection; defaults preserve current behaviour.
- The P41-DB01 "what will this device see?" preview renders from this config.
- `bookAllowlist` overlap resolved one way (merged or distinct with copy),
  matching the brief's decision.
