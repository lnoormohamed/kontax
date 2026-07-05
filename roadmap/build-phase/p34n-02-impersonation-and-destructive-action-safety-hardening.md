# P34N-02 — Impersonation and Destructive-Action Safety Hardening

## Purpose

Add stronger friction, visibility, and audit structure around the riskiest admin
actions.

## Background

The current flows already capture reasons, but as the admin area grows we
should harden:

- impersonation
- suspension
- plan override
- deletion scheduling

## Scope

**In scope**
- stronger confirmation UX
- reason categories / templates
- visible impersonation session state
- expiry/timeout cues
- action-specific guardrails

**Out of scope**
- multi-admin approval workflows
- external ticket-system enforcement

## Design / Implementation Spec

### Example improvements

- require structured reason categories
- add "this will sign the user out immediately" copy where relevant
- show active impersonation timer/state more prominently
- add stronger confirmation for destructive actions

## Acceptance Criteria

- high-risk admin actions are more explicit and harder to trigger casually
- impersonation state is highly visible while active
- audit payloads capture better support context

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — hardening rules documented here
- [ ] Internal · support/admin — policy notes later
