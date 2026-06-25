# Phase 34P — Platform Hardening, Test Coverage & Safer Delivery

> Reduces operational risk by adding repo-owned tests, safer schema/deploy
> workflows, and a real engineering handbook for the project.

## Phase status
Pre-plan

## Portfolio priority
1 of 5 (`34O-34S`)

## Phase objective
Strengthen the foundation under the product so new sync and admin work can ship
faster without increasing fragility.

## Background

Kontax now has meaningful complexity across:

- sync providers and capability rules
- billing and lifecycle behavior
- admin governance surfaces
- contact editing and multilingual data handling

The product surface is outgrowing an ad-hoc QA model. We also still rely on
startup-time `prisma db push` in production, and the root README does not
reflect the real system.

## Success criteria

- The repo has meaningful app-owned tests for critical flows.
- Sync regressions can be caught before deploy.
- Production schema rollout is safer and less coupled to container boot.
- A new engineer can understand the project from the root docs.

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34P-01 — Repo-owned test strategy and critical-path coverage baseline](p34p-01-test-strategy-and-critical-path-coverage.md)
> - [P34P-02 — Sync fixture harness and provider roundtrip regression suite](p34p-02-sync-fixture-harness-and-provider-roundtrip-regression-suite.md)
> - [P34P-03 — Production schema rollout hardening beyond startup db push](p34p-03-production-schema-rollout-hardening.md)
> - [P34P-04 — Project handbook, architecture README, and operator onboarding docs](p34p-04-project-handbook-and-architecture-readme.md)

## Suggested implementation order
1. P34P-01 — establish the test baseline
2. P34P-02 — add the sync-heavy regression harness
3. P34P-03 — reduce deploy/schema risk
4. P34P-04 — document the actual system clearly

## Why this phase sits here

Phase 34P comes first because everything else in 34O-34S becomes safer and
faster once we have:

- repo-owned regression coverage
- a less fragile schema rollout process
- a real onboarding handbook for engineers and operators

Without this layer, later sync and support changes are more expensive to ship
confidently.

## Documentation
- [ ] External · users — none
- [x] Internal · engineering — central phase for platform hardening
- [x] Internal · support/admin — deploy/runbook updates as part of rollout
