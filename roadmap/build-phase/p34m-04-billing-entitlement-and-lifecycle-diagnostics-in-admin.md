# P34M-04 — Billing, Entitlement, and Lifecycle Diagnostics in Admin

## Purpose

Expose the reasoning behind plan caps, lifecycle locks, overrides, and support
exceptions so admins can answer "why is this account blocked/capped?" quickly.

## Background

Support issues often sit at the boundary of:

- billing plan
- entitlement resolution
- lifecycle state
- admin override

These should be inspectable without reading several tables indirectly.

## Scope

**In scope**
- entitlement explanation blocks
- lifecycle reason surfaces
- plan override visibility
- cap/counter diagnostics

**Out of scope**
- Stripe-side refund tooling
- direct billing mutations beyond existing override

## Design / Implementation Spec

### Example diagnostics

- why sync-account cap is reached
- whether plan override is active
- why account is locked
- deletion schedule and reason
- effective entitlements vs base plan

## Acceptance Criteria

- admins can explain user cap and lock behavior from admin UI alone
- override and lifecycle reasons are clearly surfaced
- diagnostics distinguish base plan from effective entitlement state

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — diagnostics scope documented here
- [ ] Internal · support/admin — add support examples later
