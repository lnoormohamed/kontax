# Phase 34L — Admin Home, Information Architecture & Operations Queue

> Turns the existing admin area from a set of separate pages into a coherent
> operations surface with a real landing page, shared attention model, and
> clearer navigation.

## Phase status
Pre-plan

## Phase objective
Give platform admins a true `/admin` command center instead of a redirect, and
make the admin surface feel like one joined-up tool rather than a handful of
isolated screens.

The current admin area is useful, but still feels first-pass:

- `/admin` redirects to users
- there is no cross-surface attention model
- platform health, support workload, and sync issues are not summarized in one
  place
- admins need to know where to click before they can act

## Background

We already have real admin surfaces for:

- users
- metrics
- feature flags
- broadcast
- audit

What is missing is the operational glue between them.

The first improvement should not be more isolated tools. It should be a better
frame around the tools we already have:

- a meaningful home screen
- better nav
- work queues
- shared status language

## Success criteria

- `/admin` becomes a useful overview dashboard instead of a redirect.
- Admins can quickly see what needs attention across platform, user, and sync
  operations.
- Navigation reflects operational tasks, not just implementation buckets.
- The admin surface has a clearer "what should I do next?" experience.

## Exit criteria

- `/admin` renders a real landing page.
- A shared attention model exists for warnings, critical issues, and pending
  work.
- Platform work queues are visible from the admin home.
- Navigation and empty states are updated to match the new structure.

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34L-01 — Admin home dashboard and command center](p34l-01-admin-home-dashboard-and-command-center.md)
> - [P34L-02 — Unified admin information architecture and navigation refresh](p34l-02-unified-admin-information-architecture-and-navigation-refresh.md)
> - [P34L-03 — Shared admin health and attention model](p34l-03-shared-admin-health-and-attention-model.md)
> - [P34L-04 — Admin work queues and pending-actions rail](p34l-04-admin-work-queues-and-pending-actions-rail.md)

## Suggested implementation order
1. P34L-01 — establish the real admin home
2. P34L-03 — define the attention/health language
3. P34L-04 — surface actionable queues
4. P34L-02 — finalize nav and IA around the new structure

## Product decisions captured here

- `/admin` should be a command center, not a redirect.
- The first screen should answer:
  - what is broken
  - what needs review
  - what changed recently
- Navigation should reflect admin jobs-to-be-done, not just backend modules.
- Calm visibility beats noisy alert spam.

## Risks / open questions

- **Too much density**: a dashboard can become noisy if every metric wants top
  billing.
- **Attention inflation**: if too many cards are marked as urgent, none of them
  feel urgent.
- **Data freshness**: overview cards should indicate when metrics are cached vs
  live.

## Documentation
- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — this phase defines the admin IA pivot
- [ ] Internal · support/admin — add admin usage notes once shipped
