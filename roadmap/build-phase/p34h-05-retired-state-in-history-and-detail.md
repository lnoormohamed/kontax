# P34H-05 — Retired State in History and Detail

## Purpose

Represent retired connections clearly in history/detail surfaces without
cluttering the active sync-account rail.

## Background

`RETIRED` is useful only if users and support can understand what it means. The
active list should stay focused on live connections, while history/detail views
need enough context to explain replacement chains.

## Scope

**In scope**
- Hide `RETIRED` from active connection lists
- Show retired rows in history/detail contexts
- Render replacement pointers in plain language

**Out of scope**
- Chooser UI
- Backend replacement logic

## Design / Implementation Spec

### Terminology

Use:
- `Retired`

Avoid:
- `Archived`
- `Permanently retired`

### Suggested UI copy

- `Retired`
- `This connection is no longer active.`
- `Replaced by iCloud on June 24, 2026.`

### Presentation rules

- active sync rail hides `DISCONNECTED` and `RETIRED`
- history/detail may show retired rows with timestamps and replacement links

## Acceptance Criteria

- retired rows are hidden from the active rail
- retired rows are visible in history/detail where appropriate
- replacement chain is understandable to a non-technical user

## Risks / Open Questions

- Decide whether retired connections need a dedicated "past connections" view or
  whether history/detail is enough for v1.

## Documentation

- [ ] External · users — help copy later
- [ ] External · developers — none
- [x] Internal · engineering — retired-state UX documented here
- [ ] Internal · support/admin — later
