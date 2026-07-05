# Phase 34N — Admin Governance, Safety & Power Tools

> Strengthens the governance side of admin: better audit tooling, safer
> impersonation/destructive actions, mature flag rollout controls, and global
> internal search.

## Phase status
Pre-plan

## Phase objective
Improve the parts of admin that deal with privilege, traceability, and support
speed so the platform is safer to operate as the internal surface grows.

## Background

The current admin tool can already:

- impersonate users
- override plans
- suspend accounts
- schedule deletion
- edit feature flags
- review audit logs

That is powerful enough now that governance polish matters a lot:

- better audit pivots
- stronger action safety rails
- more expressive rollout controls
- faster cross-entity search

## Success criteria

- Admins can answer "who changed this and why?" faster.
- Privileged actions are harder to misuse accidentally.
- Feature flags are fit for staged rollout work.
- Internal search spans the major admin entities.

## Exit criteria

- audit log is significantly more searchable and exportable
- destructive actions and impersonation are more explicitly controlled
- feature flags support richer rollout workflows
- global admin search exists

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34N-01 — Audit log deep filters, pivots, and export](p34n-01-audit-log-deep-filters-pivots-and-export.md)
> - [P34N-02 — Impersonation and destructive-action safety hardening](p34n-02-impersonation-and-destructive-action-safety-hardening.md)
> - [P34N-03 — Feature flag rollout maturity and change controls](p34n-03-feature-flag-rollout-maturity-and-change-controls.md)
> - [P34N-04 — Global admin search across users, sync, and governance entities](p34n-04-global-admin-search-across-users-sync-and-governance-entities.md)
> - [P34N-05 — Internal support notes and case-history timeline](p34n-05-internal-support-notes-and-case-history-timeline.md)

## Suggested implementation order
1. P34N-01 — better audit pivots
2. P34N-02 — harden privileged actions
3. P34N-03 — mature rollout controls
4. P34N-04 — global admin search
5. P34N-05 — support memory and case history

## Product decisions captured here

- Admin safety and auditability should grow alongside admin power.
- Search should span entities, not just users.
- Support memory belongs inside the admin workflow, not in ad hoc external
  notes.

## Risks / open questions

- **Too much admin power in one place**: more tools require stronger guardrails.
- **Search scope**: broad search is useful, but results need careful access and
  ranking rules.
- **Support notes sensitivity**: internal notes need a clear retention and
  privacy model.

## Documentation
- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — governance roadmap defined here
- [ ] Internal · support/admin — add policy notes later
