# P40-03 — Schema: sharing policies (member default + Teams floor)

Status: Columns + resolution logic landed (uncommitted, 2026-07-04) · Priority: P1 · Depends: [P40-01](p40-01-schema-contact-book-membership.md)
Phase: [Phase 40](phase-40.md) · Source spec: [phase-37/01 §3.3–3.4, §5](../phase-37/01-data-model-build-now.md)

## Scope

- `GroupMember.sharingPolicy` — the member's default for what new/edited
  fields do in shared books (the "no prompt on every edit" rule, source doc
  §5).
- `GroupAddressBook.minimumSharingPolicy` — the Teams floor.
- Resolution logic shipping now; per source doc §10.3 the Teams
  admin-enforcement UI may defer to a Teams hardening phase — the column and
  resolution must not.

## Acceptance

- Policy resolution unit-verified against the source doc §5 cases (member
  default, book floor overriding a looser member default).
- Options/copy match [P40-DB01](p40-db01-design-brief-books-first-navigation.md).
