# P34G-03 — Sync-Account Cap Accounting

## Purpose

Ensure plan-cap accounting counts only active sync-account slots, not historical
rows such as disconnected or retired connections.

## Background

The product already hit a confusing state where a hidden disconnected account
still counted toward the user's sync-account limit. Once `RETIRED` is added,
the same confusion would recur unless active-slot accounting becomes explicit
and consistent.

## Scope

**In scope**
- Define which statuses count toward `syncAccountsLimit`
- Update entitlement gates and helpers
- Make counting behavior consistent across sync surfaces

**Out of scope**
- User-facing chooser UI
- History rendering of retired rows

## Design / Implementation Spec

### Count toward plan cap

- `ACTIVE`
- `PAUSED`
- `NEEDS_REAUTH`
- `ERROR`

### Do not count toward plan cap

- `DISCONNECTED`
- `RETIRED`

### Review targets

- `assertCanCreateSyncAccount`
- usage summaries / billing surfaces
- mobile sync-account cap messaging
- admin/support usage reporting if present

## Acceptance Criteria

- active-slot counting excludes `DISCONNECTED` and `RETIRED`
- all sync-account entitlement gates use the same rule
- hidden historical rows no longer block reconnect or replacement flows

## Risks / Open Questions

- Admin reporting may want both raw-row counts and active-slot counts.

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — cap-count rule documented in code/comments
- [ ] Internal · support/admin — later
