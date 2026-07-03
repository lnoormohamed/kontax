# P34H-04 — Create New Connection and Retire Old Flow

## Purpose

Wire the user-facing "start fresh" choice to the backend replacement action so a
new sync connection is created and the older matched connection is retired.

## Background

Some users do not want to resume the old logical connection. They want a clean
new connection identity and are happy for the older one to become historical
only. This ticket makes that behavior explicit.

## Scope

**In scope**
- Trigger replacement action from the chooser
- Create a new row and retire the old one
- Send the user into the new connection as an active row

**Out of scope**
- Retired history rendering
- Reconnect default path

## Design / Implementation Spec

### Expected result

- old row becomes `RETIRED`
- new row gets:
  - new row id
  - new `connectionId`
  - fresh active lifecycle
- replacement links connect the two rows

### Product behavior

- the old connection is no longer active or reconnectable
- the new connection is treated as a brand-new connection in sync/activity terms

## Acceptance Criteria

- replace/new choice creates a fresh active sync account
- old row is marked `RETIRED`
- replacement lineage is written both directions
- user lands in the new connection detail/settings view

## Risks / Open Questions

- Decide how much of the old configuration, if any, a fresh replacement row
  should inherit by default.

## Documentation

- [ ] External · users — help copy later
- [ ] External · developers — none
- [x] Internal · engineering — replacement flow documented here
- [ ] Internal · support/admin — none
