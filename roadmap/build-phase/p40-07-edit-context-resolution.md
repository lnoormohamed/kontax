# P40-07 — Edit-context resolution rules

Status: Resolver + tests landed (uncommitted, 2026-07-04) · Priority: P1 · Depends: [P40-06](p40-06-read-write-cutover.md)

## Implementation (2026-07-04)

`src/lib/edit-context.ts` — one pure resolver (`resolveFieldLayer` /
`partitionEditByLayer` / `resolveEditContext`) implementing the §6 rule table:
personal-ui & personal-sync → policy applies (via `isFieldShared`); shared-ui &
shared-sync → shared row always; short-circuit → SHARED when the contact is in
no shared book. The `EditOrigin` sync variants carry an optional `SyncLinkContext`
so P41's inbound reconciliation (P41-05) plugs in without a signature change.
Unit-verified case by case (`tests/node/edit-context.test.ts`, 7 tests). UI/import
caller wiring rides on the P40-06 write paths; the (stubbed) sync caller is the
P41 seam. Edit-context UI cue is specified in P40-DB01 §6.
Phase: [Phase 40](phase-40.md) · Source spec: [phase-37/01 §6](../phase-37/01-data-model-build-now.md)

## Scope

Given an edit arriving from UI, import, or sync, resolve which book/layer it
lands in (private vs shared, which membership) using the sharing policy
([P40-03](p40-03-schema-sharing-policies.md)). One resolution function — this
is the seam [Phase 41](phase-41.md)'s inbound reconciliation
([P41-05](p41-05-conflict-override-edit-matrix.md)) plugs into, so its
interface must accept a sync-link context even though sync callers arrive
later.

UI cues (which context an edit lands in) per
[P40-DB01](p40-db01-design-brief-books-first-navigation.md) §6.

## Acceptance

- The source doc §6 rule table is implemented and unit-verified case by case.
- UI, import, and (stubbed) sync callers all route through the one function.
