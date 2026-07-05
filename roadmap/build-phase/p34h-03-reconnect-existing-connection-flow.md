# P34H-03 — Reconnect Existing Connection Flow

## Purpose

Wire the user-facing reconnect choice to the backend reconnect action so the old
logical connection resumes with the same settings, history, and identity.

## Background

The reconnect path is the default and safest option. It should feel like
"continue where I left off", not like creating a brand-new sync-account row.

## Scope

**In scope**
- Trigger reconnect action from the chooser
- Restore the existing row
- Return the user to the active connection experience

**Out of scope**
- Replacement/new-connection flow
- Retired history rendering

## Design / Implementation Spec

### Expected result

- same sync-account row
- same `connectionId`
- restored credentials/validation
- old settings preserved
- old sync history preserved
- old sync links preserved

### Navigation

After success, route the user back into the sync detail/settings view for the
restored connection.

## Acceptance Criteria

- reconnect choice restores the previous row
- restored connection appears in the active sync rail
- no duplicate row is created
- activity/history records a reconnect event rather than a fresh connection event

## Risks / Open Questions

- Reconnect must not accidentally reset user settings such as conflict policy or
  allowlists.

## Documentation

- [ ] External · users — help copy later
- [ ] External · developers — none
- [x] Internal · engineering — reconnect behavior documented here
- [ ] Internal · support/admin — none
