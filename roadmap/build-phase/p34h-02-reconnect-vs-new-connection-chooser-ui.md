# P34H-02 — Reconnect vs New Connection Chooser UI

## Purpose

Add the product UI that lets the user decide whether to reconnect a matched
historical connection or create a brand-new connection and retire the old one.

## Background

Phase 34G provides the backend model. P34H-01 provides a choice-needed state.
This ticket is the interaction layer that turns technical behavior into a
trustworthy product flow.

## Scope

**In scope**
- chooser UI on desktop sync page
- mobile equivalent flow
- safe default selection
- explanatory copy for both options

**Out of scope**
- backend reconnect and replacement mutations
- history rendering of retired rows

## Design / Implementation Spec

### Recommended options

- `Reconnect existing connection`
  - "Restore this connection with its previous settings and history."
- `Create new connection and retire old one`
  - "Start fresh and keep the old connection as retired history."

### Recommended behavior

- default selection: reconnect existing
- show chooser only when there is a real match
- keep the first version short and calm

### Suggested metadata in the UI

- provider icon
- label
- when it was last connected / last synced
- note that reconnect preserves history
- note that new connection starts fresh

## Acceptance Criteria

- chooser appears only when a real match is detected
- reconnect is the default path
- replace/new path is clearly described as a fresh connection
- mobile and desktop both support the flow

## Risks / Open Questions

- Too much detail can make the chooser feel heavy. Keep the first version concise.

## Documentation

- [ ] External · users — sync-account help copy updated later
- [ ] External · developers — none
- [x] Internal · engineering — chooser states and copy direction documented here
- [ ] Internal · support/admin — none
