# Phase 34T — Admin Workflow Scale, Governance & Operator Ergonomics

> Turns the admin area from a strong internal console into a genuinely scalable
> operator workspace: faster triage, safer communication, richer investigation
> context, and clearer permission boundaries.

## Phase status
In progress

## Portfolio priority
1 of 1 (`34T`)

## Phase objective
Make the admin section faster to work in, easier to reason about, and safer to
operate as support volume, privileged actions, and internal-team size grow.

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34T-01 — Support case inbox and operator workbench](p34t-01-support-case-inbox-and-operator-workbench.md)
> - [P34T-02 — Admin broadcast composer polish, templates, and operator safety UX](p34t-02-admin-broadcast-composer-polish-templates-and-safety.md)
> - [P34T-03 — Global admin search, saved views, and deep-link pivots](p34t-03-global-admin-search-saved-views-and-deep-link-pivots.md)
> - [P34T-04 — Unified investigation timeline across notes, cases, audit, and sync events](p34t-04-unified-investigation-timeline.md)
> - [P34T-05 — Admin permission tiers and destructive-action governance](p34t-05-admin-permission-tiers-and-governance.md)

## Suggested implementation order
1. P34T-01 — support case inbox and workbench
2. P34T-03 — faster search and saved operational views
3. P34T-04 — unified investigation timeline
4. P34T-02 — broadcast polish and reusable comms workflows
5. P34T-05 — permission tiers and governance hardening

## Why this phase sits here

Phase 34T makes sense after the current admin maturity work because the core
building blocks now exist:

- support cases
- admin overview queues
- richer audit events
- targeted broadcasts

What is still missing is the operator layer that makes those primitives feel
cohesive under real support pressure. This phase is about scale and workflow
quality rather than introducing new product-facing capability.

## Documentation
- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — admin workflow follow-on documented here
- [x] Internal · support/admin — operating model and guardrails required after shipping
