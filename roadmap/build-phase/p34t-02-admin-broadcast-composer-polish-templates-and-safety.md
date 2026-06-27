# P34T-02 — Admin Broadcast Composer Polish, Templates, and Operator Safety UX

## Purpose

Refine the richer broadcast workflow into a communication tool that feels safe,
fast, and repeatable for real operators.

## Background

Targeting, preview, scheduling, and retraction now exist, but the workflow can
still be improved around:

- reuse
- clarity
- validation
- operator confidence under time pressure

## Scope

**In scope**
- cleaner status / history presentation
- template support for common announcement types
- stronger schedule validation
- explicit retract / impact confirmations
- audience summary chips and clearer filter readability

**Out of scope**
- full marketing-campaign management
- external email/SMS campaign tooling

## Dependencies

- P34S-02 targeted broadcast model and actions
- admin audit events

## Design / Implementation Spec

### Template examples

- release note
- incident / degraded provider
- billing / lifecycle notice
- maintenance / scheduled downtime

### Safety improvements

- warn on very broad audiences
- warn when scheduling is in the past or implausibly soon
- show a clearer before-send audience summary
- confirm retraction with visible impact wording

### UX rules

- operators should be able to duplicate a prior broadcast into a new draft
- history should be readable without opening raw payloads
- scheduled / sent / retracted states should be visually distinct

## Acceptance Criteria

- the broadcast composer feels safer and more legible for non-trivial sends
- common announcement patterns are faster to create consistently
- broadcast history and state changes are easier to understand at a glance

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — broadcast UX follow-on documented here
- [x] Internal · support/admin — communication-playbook notes required
