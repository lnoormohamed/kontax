# P34P-03 — Production Schema Rollout Hardening Beyond Startup db push

## Purpose

Reduce production risk by moving away from relying on `prisma db push` during
every container startup as the primary schema rollout mechanism.

## Background

The current deploy model relies on `prisma db push` during container startup.
That is convenient, but it couples schema application directly to app boot and
can turn a risky schema change into a production crash loop.

## Scope

**In scope**
- define a safer production schema rollout path
- separate dev/staging convenience from prod discipline
- add predeploy schema checks and rollback guidance
- update deploy/runbook docs

**Out of scope**
- full platform migration to a different ORM

## Design / Implementation Spec

### Desired end state

- additive-safe schema changes are still easy in development
- production changes are reviewed and applied intentionally
- data migrations have an explicit playbook
- deploy failure modes are easier to reason about

### Topics this ticket should settle

- whether prod moves to checked-in migrations, a gated push workflow, or a
  hybrid policy
- when schema checks run relative to build/deploy
- how rollback works when app code and schema are out of step
- how staging and production differ operationally

## Acceptance Criteria

- Production schema rollout is documented and safer than startup-only `db push`.
- Engineers have a defined process for additive vs data-migration changes.
- Deploy docs and recovery docs reflect the new workflow.
- The chosen workflow is explicit enough that a future operator can follow it
  without tribal knowledge.

## Documentation

- [x] Internal · engineering — rollout policy documented here
- [x] Internal · support/admin — operator-facing deploy notes updated
