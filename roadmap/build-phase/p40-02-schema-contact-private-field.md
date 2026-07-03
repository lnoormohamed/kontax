# P40-02 — Schema: `ContactPrivateField` overlay

Status: Not started · Priority: P0 · Depends: [P40-01](p40-01-schema-contact-book-membership.md)
Phase: [Phase 40](phase-40.md) · Source spec: [phase-37/01 §3.2](../phase-37/01-data-model-build-now.md)

## Scope

Per-user overlay of field values not shared with other book members. Owner
sees the merged view; other members see the base contact only. Includes the
read-path helper used by workspace, detail, export, and sync — one function
so every consumer applies the same visibility rule (the export format
[P45-02](phase-45-open-export-format.md) and the projection
[P41-02](p41-02-outbound-projection-v1.md) both depend on it).

## Acceptance

- Owner-merged and member-base read paths verified with two seeded accounts
  sharing a book.
- The helper is the only code path that merges the overlay (no ad-hoc joins
  elsewhere).
