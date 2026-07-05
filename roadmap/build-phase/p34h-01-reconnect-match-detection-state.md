# P34H-01 — Reconnect Match Detection & Choice-Needed State

## Purpose

Detect when an add-account attempt matches a previously disconnected connection
and return a structured "choice needed" state instead of silently restoring it.

## Background

The backend can already restore a matching disconnected CardDAV row, but that
behavior is implicit. To let the user choose between reconnecting and starting
fresh, the add-account flow must surface that match as an explicit state.

## Scope

**In scope**
- Detect reconnectable historical matches in add-account actions
- Return a structured state for the UI to render
- Include enough metadata to explain what was found

**Out of scope**
- The chooser UI itself
- Replacement action implementation

## Design / Implementation Spec

### Match rules (v1)

- same `userId`
- same provider family
- same base URL + label for CardDAV

### Returned state

```ts
{
  ok: false,
  requiresChoice: true,
  match: {
    syncAccountId,
    connectionId,
    label,
    provider,
    disconnectedAt,
    lastSucceededAt,
  }
}
```

## Acceptance Criteria

- matching disconnected connections are detected before silent restore
- action can return a choice-needed state
- returned metadata is sufficient for the chooser UI

## Risks / Open Questions

- Keep matching conservative. A false positive is worse than forcing the user
  to add a fresh connection.

## Documentation

- [ ] External · users — Phase 34H chooser copy later
- [ ] External · developers — none
- [x] Internal · engineering — matching state contract documented here
- [ ] Internal · support/admin — none
