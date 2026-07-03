# P34G-02 — Sync Connection Lifecycle Status

## Purpose

Introduce a dedicated `RETIRED` sync-account lifecycle state and formalize the
meaning of each status so reconnectable connections and intentionally replaced
connections are no longer conflated.

## Background

`DISCONNECTED` currently carries too much meaning. The product now needs two
separate ideas:

- a connection that can be restored later
- a connection that was intentionally replaced and should remain historical only

This ticket makes that difference explicit in the status model.

## Scope

**In scope**
- Add `RETIRED` to `SyncAccountStatus`
- Review codepaths that branch on status
- Document intended meaning of each lifecycle state

**Out of scope**
- User-facing copy
- Reconnect/replace chooser UI

## Design / Implementation Spec

### Target meanings

- `ACTIVE` — healthy and usable
- `PAUSED` — temporarily stopped, still consumes a slot
- `NEEDS_REAUTH` — credentials/token broken, still consumes a slot
- `ERROR` — operational failure, still consumes a slot
- `DISCONNECTED` — intentionally disconnected, eligible for reconnect
- `RETIRED` — intentionally replaced by a newer connection, preserved for audit

### Review targets

- sync list queries
- job runner queries
- reconnect detection
- plan-cap accounting
- history/detail loaders

## Acceptance Criteria

- `RETIRED` exists in the schema and generated types
- status-dependent queries are reviewed and updated
- `RETIRED` rows are treated as non-active
- `RETIRED` rows are not eligible for reconnect

## Risks / Open Questions

- Existing queries may quietly assume "not active" only means `DISCONNECTED`.

## Documentation

- [ ] External · users — later in Phase 34H
- [ ] External · developers — none
- [x] Internal · engineering — lifecycle meanings documented in code/comments
- [ ] Internal · support/admin — later
