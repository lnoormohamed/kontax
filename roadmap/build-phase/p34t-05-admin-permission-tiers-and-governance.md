# P34T-05 — Admin Permission Tiers and Destructive-Action Governance

## Purpose

Reduce blast radius in the admin section by introducing clearer internal role
boundaries and stronger governance around the riskiest operations.

## Background

The admin area keeps growing in power. Even with good audit coverage and reason
capture, a flat admin model becomes harder to justify as teams grow and
specialize across:

- support
- billing / lifecycle
- sync operations
- platform governance

## Scope

**In scope**
- internal admin capability tiers
- scoped access to major admin sections/actions
- stronger destructive-action confirmations
- clearer audit payloads for privileged actions

**Out of scope**
- enterprise RBAC exposed to customers
- multi-party approval workflows

## Dependencies

- P34N-02 destructive-action hardening
- existing admin route guards
- admin audit infrastructure

## Design / Implementation Spec

### Initial capability buckets

- support ops
- billing ops
- sync ops
- governance / super-admin

### First actions to scope tightly

- impersonation
- suspension / deletion scheduling
- billing override / owner-transfer actions
- feature-flag and broadcast control

### Governance rules

- the UI should clearly explain why an action is unavailable
- risky actions should continue to capture structured reasons
- audit payloads should reflect both actor and capability context

## Acceptance Criteria

- not every admin can automatically do every privileged action
- destructive flows remain supportable while becoming harder to misuse
- audit history makes permission and governance context clearer

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — permission/governance model documented here
- [x] Internal · support/admin — policy notes required
