# P34Q-02 — User-Facing Sync Diagnostics and Unsupported-Field Explainers

## Purpose

Bring a simplified version of the new admin sync intelligence to end users so
they can understand what is syncing, what is local-only, and what needs action.

## Background

Admin tooling now has much stronger sync context, but users still have to infer
too much from generic status badges. That causes avoidable confusion and
support traffic, especially when provider field support differs.

## Scope

**In scope**
- per-connection sync diagnostics summary
- supported vs local-only field explanation
- last successful push/pull timing
- actionable reauth / paused / limited-support states

**Out of scope**
- full raw debug dump for normal users

## Dependencies

- P34O provider identity work
- existing provider capability rules from 34I / 34J / 34K

## Design / Implementation Spec

### Diagnostics block

For each connection, show:

- provider identity
- current state
- last successful sync timestamps
- fields that sync both ways
- fields that stay local-only
- notable current warnings

### Messaging rules

- use plain language, not protocol jargon
- explain behavior at the field-family level
- distinguish between "provider does not support this" and "this connection
  needs attention"

### Field families to explain explicitly

- names
- phones
- emails
- addresses
- websites
- notes
- birthday
- other significant dates

## Acceptance Criteria

- Users can understand why a field did or did not sync without contacting support first.
- Connection pages expose provider limitations in plain language.
- Sync state is legible enough to reduce avoidable support tickets.

## Documentation

- [ ] External · users — help copy likely grows from this ticket
- [x] Internal · engineering — diagnostics contract documented here
