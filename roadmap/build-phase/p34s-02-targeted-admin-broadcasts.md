# P34S-02 — Targeted Admin Broadcasts with Scheduling, Segmentation, and Rollback

## Purpose

Upgrade broadcast tooling so operational announcements can be targeted, staged,
and reversed safely.

## Background

The current broadcast surface is useful, but broad messaging without targeting
or rollback controls becomes risky as the product and user base grow.

## Scope

**In scope**
- audience targeting by plan / sync provider / lifecycle / flag segment
- scheduling and expiry
- preview of impacted users
- emergency disable / rollback

**Out of scope**
- fully fledged marketing automation

## Dependencies

- current broadcast surface
- admin search / filtering primitives where reusable

## Design / Implementation Spec

### Targeting dimensions

- plan
- provider / provider family
- lifecycle state
- feature-flag cohort

### Safety rules

- preview audience before send
- preserve broadcast history
- allow emergency stop or retract path

### First targeting dimensions

- plan
- provider family
- lifecycle state
- explicit feature-flag cohort

## Acceptance Criteria

- Broadcasts can target the right audience instead of all users.
- Operators can preview and roll back a message safely.
- Broadcast history is auditable.

## Documentation

- [x] Internal · support/admin — operations notes required
- [x] Internal · engineering — targeting rules documented here
