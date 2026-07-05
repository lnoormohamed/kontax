# P40-01 — Schema: `ContactBookMembership` (additive)

Status: Schema landed (uncommitted, 2026-07-04) · Priority: P0 · Depends: —
Phase: [Phase 40](phase-40.md) · Source spec: [phase-37/01 §3.1](../phase-37/01-data-model-build-now.md)

## Scope

Join table replacing single `Contact.bookId` semantics — additive only;
`bookId` stays and is kept in sync during the transition (dual-write, per
source doc §4). Unique on `(contactId, bookId)`; indexed for the contacts
list join.

Deploy-safety: additive under the startup `db push` (schema drift
crash-loops the site — see runbooks); no destructive change in this ticket.

## Acceptance

- Model exists, generated client committed, no behaviour change yet (reads
  still come from `bookId` until [P40-06](p40-06-read-write-cutover.md)).
- The membership join is covered by an index that keeps the P38 contacts
  query plan intact (verify with the Prisma query log at 10k contacts).
