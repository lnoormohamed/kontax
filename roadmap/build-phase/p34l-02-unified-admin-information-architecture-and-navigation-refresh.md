# P34L-02 — Unified Admin Information Architecture and Navigation Refresh

## Purpose

Rework admin navigation so the tool feels like a coherent console, not a list
of unrelated internal pages.

## Background

The current sidebar is functional, but now that admin usage is growing, the IA
needs to reflect operational jobs:

- monitor the platform
- support a user
- debug sync
- review privileged actions
- control rollout state

## Scope

**In scope**
- reorganize sidebar and mobile nav labels/order
- add a clearer hierarchy around overview, users, sync, governance, rollout
- update breadcrumbs and section titles for consistency

**Out of scope**
- new backend data sources
- permission model changes

## Design / Implementation Spec

### Proposed top-level structure

- Overview
- Users
- Sync Ops
- Governance
  - Audit
  - Feature flags
- Communications
  - Broadcast

### UX rules

- top-level nav labels should describe operational domains
- every deep page should have a clear breadcrumb path
- mobile nav should mirror desktop concepts, not invent a second IA

## Acceptance Criteria

- admin nav reflects the new domain structure
- `/admin` home is the first-class entry point
- breadcrumbs and page titles are consistent across all admin surfaces

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — IA defined here
- [ ] Internal · support/admin — none
