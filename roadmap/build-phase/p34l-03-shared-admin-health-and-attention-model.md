# P34L-03 — Shared Admin Health and Attention Model

## Purpose

Define one shared language for what is healthy, warning, critical, queued, and
actionable across the admin area.

## Background

Metrics pages, sync pages, and admin workflows currently use different implied
severity models. That makes it harder for admins to know which issues truly
need intervention.

## Scope

**In scope**
- define shared status tiers and tones
- define badge/copy rules for health states
- define which conditions feed the admin attention model

**Out of scope**
- page-specific chart redesigns
- end-user sync messaging

## Design / Implementation Spec

### Core states

- Healthy
- Watch
- Needs attention
- Critical
- Action required

### Example mappings

- repeated sync auth failures → action required
- high error rate but recovering → watch / needs attention
- locked user with no admin note → needs attention
- plan override active → informational, not warning

## Acceptance Criteria

- one shared health model is used across admin overview cards and lists
- state labels and tones are reused consistently
- operational queues can sort/filter by severity

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — state model documented here
- [ ] Internal · support/admin — short playbook after ship
