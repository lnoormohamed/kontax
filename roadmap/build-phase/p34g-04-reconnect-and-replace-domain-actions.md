# P34G-04 — Reconnect and Replace Domain Actions

## Purpose

Formalize two explicit backend actions for sync connections:

1. reconnect the existing logical connection
2. create a new connection and retire the old one

## Background

The current add-account flow can restore a matching disconnected row, but that
behavior is implicit rather than a first-class domain action. Once the user can
choose between reconnecting and starting fresh, the backend needs two separate
paths with different identity and lifecycle rules.

## Scope

**In scope**
- Backend reconnect action
- Backend replace-with-new action
- Shared validation rules and invariants

**Out of scope**
- User-facing chooser UI
- Activity-feed copy

## Design / Implementation Spec

### Reconnect existing

- reuse existing row
- preserve `connectionId`
- clear `disconnectedAt`, `credentialRevokedAt`, and last-error markers
- preserve settings, sync links, sync history

### Create new + retire old

- old row:
  - `status = RETIRED`
  - `retiredAt = now`
  - `retiredReason = REPLACED_BY_NEW_CONNECTION`
  - `replacedBySyncAccountId = new.id`
- new row:
  - fresh row id
  - fresh `connectionId`
  - `replacesSyncAccountId = old.id`

### Matching constraints

For v1:
- CardDAV can match on same user + same base URL + same label

## Acceptance Criteria

- reconnect action preserves logical identity/history
- replace-with-new action retires old row and creates a fresh one
- `RETIRED` rows cannot be restored through reconnect logic

## Risks / Open Questions

- Decide how much configuration, if any, a fresh replacement row inherits by default.

## Documentation

- [ ] External · users — Phase 34H
- [ ] External · developers — none
- [x] Internal · engineering — domain semantics documented here
- [ ] Internal · support/admin — later
