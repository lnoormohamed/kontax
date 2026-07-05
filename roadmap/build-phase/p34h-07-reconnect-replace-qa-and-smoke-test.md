# P34H-07 — Reconnect / Replace QA and Smoke Test

## Purpose

Validate the full reconnect vs replace behavior end to end so the product does
not regress into hidden-slot, duplicate-history, or wrong-lineage behavior.

## Background

This work touches plan accounting, sync identity, UI choices, history, and
support semantics. It needs a focused smoke pass rather than relying only on
unit coverage.

## Scope

**In scope**
- manual QA matrix for reconnect and replace flows
- plan-cap edge cases
- history/detail verification
- activity/audit verification

**Out of scope**
- unrelated provider smoke testing

## Design / Implementation Spec

### Required test cases

1. reconnect a disconnected CardDAV account
2. create new + retire old from a matching disconnected account
3. verify retired row is hidden from active rail
4. verify retired row is visible in history/detail
5. verify plan-cap logic ignores disconnected rows
6. verify plan-cap logic ignores retired rows
7. verify reconnect preserves settings/history/links
8. verify replace creates a new row id and new `connectionId`
9. verify retired rows cannot be reconnected through the normal reconnect path

### Suggested fixtures

Use at least one provider with existing historical rows, such as iCloud or
Fastmail, where reconnect semantics can be validated against known contact links
and sync history.

## Acceptance Criteria

- QA matrix is written and executable
- reconnect/replace test cases pass
- edge-case failures are documented before release

## Risks / Open Questions

- Test data needs stable historical rows; ad hoc manual setup will make results
  much harder to trust.

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — QA matrix documented here and/or linked runbook
- [ ] Internal · support/admin — later
