# Phase 34M — Admin Sync Ops & Support Console

> Adds the operational tools the current admin surface is missing: sync ops,
> connection inspection, user support deep dives, and billing/lifecycle support
> context.

## Phase status
Pre-plan

## Phase objective
Make the admin area genuinely useful for real support and sync debugging by
adding first-class sync operations tooling and upgrading the user detail page
into a support console.

## Background

We now have much richer sync behavior:

- connection lineage
- retired/replaced connections
- provider capability profiles
- generic-safe CardDAV mode
- multi-provider preservation rules

But none of that is easy to inspect from admin today. Support still has to jump
between multiple pages and infer too much from raw state.

## Success criteria

- Admins can inspect sync health and connection state without needing direct DB
  access.
- Support can open one user and see their sync, lifecycle, and entitlement
  context together.
- Verified-vs-generic provider behavior is legible in admin.
- Connection lineage and capability overrides are inspectable.

## Exit criteria

- `/admin/sync` exists as a first-class page
- sync connections can be inspected at list and detail levels
- user detail exposes sync and billing/lifecycle support context
- admin can understand why a connection is behaving conservatively

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34M-01 — Admin Sync Ops index and provider health dashboard](p34m-01-admin-sync-ops-index-and-provider-health-dashboard.md)
> - [P34M-02 — Sync connection detail, lineage, and capability inspector](p34m-02-sync-connection-detail-lineage-and-capability-inspector.md)
> - [P34M-03 — User detail upgrade into a support console](p34m-03-user-detail-upgrade-into-a-support-console.md)
> - [P34M-04 — Billing, entitlement, and lifecycle diagnostics in admin](p34m-04-billing-entitlement-and-lifecycle-diagnostics-in-admin.md)
> - [P34M-05 — Support-side provider verification and override workflows](p34m-05-support-side-provider-verification-and-override-workflows.md)

## Suggested implementation order
1. P34M-01 — sync ops overview
2. P34M-02 — connection detail and lineage
3. P34M-03 — enrich user support view
4. P34M-04 — add billing/lifecycle diagnostics
5. P34M-05 — controlled support actions

## Product decisions captured here

- Sync should be a first-class admin domain, not hidden inside user notes or
  logs.
- Support tooling should prefer interpreted state over raw storage details.
- Admin actions that alter sync behavior should be explicit, auditable, and
  limited.

## Risks / open questions

- **Scope creep**: sync ops can become its own product if not kept focused.
- **Overexposure**: admin should inspect rich sync state without offering too
  many risky controls too early.
- **Mixed abstractions**: we should avoid forcing support to think in raw vCard
  terms unless necessary.

## Documentation
- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — this phase defines admin sync ops
- [ ] Internal · support/admin — add playbooks after ship
