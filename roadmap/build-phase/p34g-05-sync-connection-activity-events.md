# P34G-05 — Sync Connection Activity Events

## Purpose

Add explicit activity/audit events for sync-connection lifecycle changes so
history can distinguish reconnects from fresh replacements.

## Background

If reconnect and replace are implemented only as row mutations, the timeline is
hard to understand. The product and support tools both need events that answer
what happened to the connection and which row replaced which.

## Scope

**In scope**
- New/updated sync-connection lifecycle events
- Event payload structure
- Emission from reconnect and replace actions

**Out of scope**
- Final user-facing copy for the activity feed
- Visual history UI for retired rows

## Design / Implementation Spec

### Candidate event set

- `SYNC_CONNECTION_CONNECTED`
- `SYNC_CONNECTION_RECONNECTED`
- `SYNC_CONNECTION_DISCONNECTED`
- `SYNC_CONNECTION_RETIRED`
- `SYNC_CONNECTION_REPLACED`

### Payload expectations

Where relevant include:
- `syncAccountId`
- `connectionId`
- `replacesSyncAccountId`
- `replacedBySyncAccountId`
- provider
- label
- retirement reason

## Acceptance Criteria

- reconnect emits a reconnect event
- replace emits retirement/replacement events
- payloads contain enough ids to reconstruct lineage later

## Risks / Open Questions

- Decide whether replace should emit one compound event or two linked events.

## Documentation

- [ ] External · users — later in Phase 34H
- [ ] External · developers — none
- [x] Internal · engineering — event contract documented here
- [ ] Internal · support/admin — later
