# Phase 32 — Documentation (backfill & standardization)

## Phase status
In progress — P32-01 complete

## Phase objective
Bring documentation up to standard across everything Kontax already does. Phases
1–28 predate the [documentation policy](../documentation-policy.md); this phase
audits them against the four documentation surfaces and fills the gaps, and
standardizes where each kind of doc lives. Phases 29–31 self-document via the
per-ticket convention, so this phase's scope is the **historical backlog plus any
29–31 misses**.

## The four surfaces (see [documentation-policy.md](../documentation-policy.md))
1. **External · users** → in-app Help system ([P26-12](p26-12-in-app-help-system.md)).
2. **External · developers** → public `/developers` page ([P29-07](p29-07-api-documentation-page.md)).
3. **Internal · admins/ops** → [`roadmap/runbooks/`](../runbooks).
4. **Internal · engineering** → [`docs/`](../../docs).

## Success criteria
- Every shipped, user-visible feature (Phases 1–28) has a Help article.
- Every public API surface is fully covered on `/developers`.
- Every operationally-significant subsystem has a runbook (deploy, env/secrets,
  email/SES, sync, billing/Stripe, impersonation, feature flags, data jobs,
  GDPR export/erasure).
- Every non-obvious cross-cutting subsystem has a `docs/` concept doc.
- A single index makes all four surfaces discoverable.

## Exit criteria
- A gap matrix (phase × surface) exists and is closed (or each remaining gap is
  explicitly deferred with a reason).
- Doc homes and indexes are standardized; the documentation policy is enforced
  going forward.

## Proposed tickets

### P32-01 — Documentation audit & gap matrix
Status: Done · Priority: P0 · Output: [p32-01-doc-audit-gap-matrix.md](p32-01-doc-audit-gap-matrix.md)

Inventory Phases 1–31 against the four surfaces. Produce a matrix (feature/phase
× user-help / dev-docs / runbook / concept-doc) marking present / missing /
N-A. This drives the rest of the phase.

### P32-02 — Information architecture & doc homes
Status: Done · Priority: P0

Standardize structure and add index/landing pages for each surface: the in-app
Help center taxonomy, the `/developers` outline, a `roadmap/runbooks/README.md`
index, and the `docs/README.md` concept index (started). Define naming and
cross-linking conventions.

### P32-03 — External user help backfill
Status: Done · Priority: P0 · Depends: P32-01

Write Help articles for shipped user-facing features missing them — contacts
CRUD, books/lists/labels, import/export, merge/duplicates, sync/CardDAV,
sharing, family/teams, billing, notifications, security/2FA, account lifecycle.

### P32-04 — External developer docs completeness
Status: Not Started · Priority: P1 · Depends: P32-01

Verify `/developers` covers every public endpoint, auth, field, error, and rate
limit shipped in Phase 29; fill gaps; add examples.

### P32-05 — Internal admin/ops runbooks backfill
Status: Not Started · Priority: P0 · Depends: P32-01

Runbooks for operating Kontax: deploy & the `db push`-on-startup model (and its
schema-drift footgun), env/secrets, SES/email, sync engine operations, Stripe/
billing & webhooks, admin impersonation, feature flags, import/export & data
jobs, GDPR export/erasure handling, incident basics.

### P32-06 — Internal engineering concept docs backfill
Status: Not Started · Priority: P1 · Depends: P32-01

`docs/` concept docs for cross-cutting subsystems: the sync/CardDAV model,
sharing (vCard/static/live) model, billing entitlements & lifecycle, import/
export pipeline, duplicate detection/merge, notifications, and the
organizing-contacts model (done — extend as labels ship in 31B).

### P32-07 — Documentation maintenance enforcement
Status: Not Started · Priority: P2

Make the per-ticket Documentation requirement stick: a PR checklist item and/or
a lightweight CI reminder, plus a short contributor note pointing at the policy.

## Documentation (per roadmap/documentation-policy.md)
- This phase *is* the documentation work; each ticket's output is the doc itself.
- [x] Internal · engineering — docs/: the IA/index and concept backfill land here.
