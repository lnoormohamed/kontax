# P40-06 — Read/write cutover from `Contact.bookId`

Status: Not started · Priority: P0 · Depends: [P40-05](p40-05-migration-backfill-default-books.md)
Phase: [Phase 40](phase-40.md) · Source spec: [phase-37/01 §4, §6](../phase-37/01-data-model-build-now.md)

## Scope

Contacts list, detail, create/edit, import/export, merge, sharing, and sync
read membership instead of `bookId`; writes dual-write both during the soak.

`Contact.bookId` removal is explicitly **out of scope** — separate cleanup
phase after a prod soak (source doc decision §10.1).

Performance guardrail: the membership join must not regress the Phase 38
numbers — re-run the P38 exit measurements (TTFB, query count) at 10k
contacts after cutover.

## Acceptance

- All listed read paths verified against membership (grep for remaining
  `bookId` reads outside the dual-write and the deprecation shim).
- Dual-write proven: mutating through any surface updates both.
- P38 exit numbers re-captured within agreed tolerance.
