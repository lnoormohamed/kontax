# P40-05 — Migration & backfill + default-book seeding

Status: Not started · Priority: P0 · Depends: P40-01…04
Phase: [Phase 40](phase-40.md) · Source spec: [phase-37/01 §4](../phase-37/01-data-model-build-now.md)

## Scope

Backfill one membership row per existing contact from `bookId`.

**Seeding must respect P18-11:** users already have `AddressBook` rows (with
`isDefault`) — existing accounts keep their books exactly as named, and the
backfill maps memberships onto them. The "Personal" + "Work" seed pair
(renameable — source doc decision §10.2) applies to **new accounts only**,
plus optionally offering "Work" as a suggested second book to existing
single-book users (product call, record in
[P40-DB01](p40-db01-design-brief-books-first-navigation.md)). Never create a
book a user didn't ask for next to ones they already named.

One-off script per the `scripts/*.mjs` pattern; must be re-runnable and
additive. Rollback procedure documented in a runbook **before** it runs on
prod (startup `db push` deploy caution applies).

## Acceptance

- Every contact has exactly one membership row matching its `bookId`;
  re-running the script is a no-op.
- Existing accounts: zero new books created by the backfill.
- New-account signup seeds the default pair.
- Runbook (backfill + rollback) exists and is linked from the phase file.
