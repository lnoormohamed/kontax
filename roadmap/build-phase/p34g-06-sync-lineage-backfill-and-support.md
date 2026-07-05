# P34G-06 — Sync Lineage Backfill, Invariants & Support Tooling

## Purpose

Make rollout safe by backfilling lineage data for existing connections and
defining the invariants/support visibility needed to debug the new model.

## Background

Adding lineage and retirement semantics is not only a schema exercise. Existing
rows need a stable `connectionId`, and support tooling needs enough metadata to
tell whether a user resumed an old connection or intentionally replaced it.

## Scope

**In scope**
- Backfill strategy for `connectionId`
- Invariants for retired/replaced rows
- Minimal support/debug visibility requirements

**Out of scope**
- Full polished admin UI
- User-facing reconnect/replace flow

## Design / Implementation Spec

### Required invariants

- every sync-account row has a non-empty `connectionId`
- `RETIRED` rows are not used by reconnect logic
- replacement links are bidirectionally sane
- reconnecting an existing row does not generate a fresh `connectionId`

### Support/debug expectations

At minimum expose:
- row `id`
- `connectionId`
- lifecycle status
- `replacesSyncAccountId`
- `replacedBySyncAccountId`
- disconnected/retired timestamps

### Backfill

- run after schema deploy
- assign a fresh cuid as `connectionId` for all legacy rows
- no historical replacement links are required for pre-34G rows

## Acceptance Criteria

- backfill plan is defined and implementable
- invariants are written down and testable
- support/debug surfaces or logs expose enough lineage metadata

## Risks / Open Questions

- If support visibility is delayed, the model becomes hard to operate despite
  being technically correct.

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — rollout and invariants documented here
- [ ] Internal · support/admin — later
