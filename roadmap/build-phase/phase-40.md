# Phase 40 — Multi-Book Contact Model (from P37 · Part 1)

> Reassigns the unbuilt design work in
> [roadmap/phase-37/01-data-model-build-now.md](../phase-37/01-data-model-build-now.md).
> Phase 37's *phone rollout* (P37-01…12) shipped and is signed off; the four
> strategic "Parts" in the same folder never got build tickets. Part 1 — the
> membership-based book model — is the foundation for the CardDAV projection
> (Phase 41) and everything in the native-app / open-standard explorations
> (still parked at P42+). This phase turns Part 1 into tickets.

## Phase status
Pre-plan

## Phase objective
Move contacts from single-book ownership (`Contact.bookId`) to a
membership-based model where one contact can live in several books, carry
private fields invisible to other group members, and obey per-member sharing
policies. Ship the schema, migration, read/write cutover, and the sidebar
redesign the model implies. Full rationale, schema sketches, and edit-context
rules live in the source doc — tickets below reference its sections rather than
restating them.

## Success criteria
- A contact can belong to multiple books; adding/removing membership does not
  copy or destroy the contact.
- Private fields exist as an overlay: visible to the owner, absent for other
  members of a shared book, and preserved through sync/export for the owner.
- `GroupMember.sharingPolicy` resolves the "no prompt on every edit" default
  (source doc §5–6).
- Sidebar presents books as the primary navigation axis without regressing
  lists/labels (source doc §8).
- Zero data loss through the backfill; `Contact.bookId` still populated during
  the soak (removal is a later cleanup phase, per the source doc's own
  recommendation).

## Exit criteria
- P40-01 … P40-08 verified at 500 / 2,000 / 10,000-contact scale (respect the
  Phase 38 performance constraints — membership joins must not undo the
  payload-diet work).
- docs/organizing-contacts.md updated: book model moves from "one book per
  contact" to membership-based.
- The four "open decisions" in source doc §10 recorded as decided.

## Prerequisites / sequencing
- Land after Phase 38 (performance) — P40 changes the hottest query in the app.
- Deploy-safety: additive schema first (`db push` on startup crash-loops on
  drift — see runbooks); destructive cleanup deferred to a post-soak phase.

## Tickets

| Ticket | Title | Priority | Depends on |
| --- | --- | --- | --- |
| [P40-DB01](p40-db01-design-brief-books-first-navigation.md) | Design brief: books-first navigation & multi-membership surfaces | P0 | — |
| [P40-01](p40-01-schema-contact-book-membership.md) | Schema: `ContactBookMembership` (additive) | P0 | — |
| [P40-02](p40-02-schema-contact-private-field.md) | Schema: `ContactPrivateField` overlay | P0 | P40-01 |
| [P40-03](p40-03-schema-sharing-policies.md) | Schema: `GroupMember.sharingPolicy` + `GroupAddressBook.minimumSharingPolicy` | P1 | P40-01 |
| [P40-04](p40-04-schema-sync-destination-book.md) | Schema: `SyncAccount.destinationBookId` | P1 | P40-01 |
| [P40-05](p40-05-migration-backfill-default-books.md) | Migration & backfill + default-book seeding | P0 | P40-01…04 |
| [P40-06](p40-06-read-write-cutover.md) | Read/write cutover from `Contact.bookId` | P0 | P40-05 |
| [P40-07](p40-07-edit-context-resolution.md) | Edit-context resolution rules | P1 | P40-06 |
| [P40-08](p40-08-sidebar-redesign-build.md) | Sidebar redesign implementation | P1 | P40-DB01, P40-06 |

> Tickets are split into standalone files (linked above); the sections
> below remain the phase-level overview.

### P40-DB01 — Design brief: books-first navigation & multi-membership surfaces
Ticketed in full at
[p40-db01-design-brief-books-first-navigation.md](p40-db01-design-brief-books-first-navigation.md).
Source doc §8 and §10.4 recommend a parallel design brief implemented within the
phase. Covers: sidebar hierarchy (books above lists/labels), multi-membership
affordances on contact rows/detail, private-field marking in the contact form,
the sharing-policy picker, edit-context cues, the migration moment, and mobile.

### P40-01 — Schema: `ContactBookMembership`
Source doc §3.1. Join table replacing single `Contact.bookId` semantics —
additive only; `bookId` stays and is kept in sync during the transition
(dual-write, per §4). Unique on `(contactId, bookId)`; indexed for the contacts
list join.

### P40-02 — Schema: `ContactPrivateField`
Source doc §3.2. Per-user overlay of field values not shared with other book
members. Owner sees the merged view; other members see the base contact only.
Includes the read-path helper used by workspace, detail, export, and sync.

### P40-03 — Sharing policies
Source doc §3.3–3.4 and §5. `GroupMember.sharingPolicy` (member default for
what new/edited fields do in shared books — the "no prompt on every edit" rule)
and `GroupAddressBook.minimumSharingPolicy` (Teams floor). Per §10.3: ship the
column and resolution logic now; the Teams admin-enforcement UI may defer to a
Teams hardening phase.

### P40-04 — `SyncAccount.destinationBookId`
Source doc §3.5. Inbound sync targets a chosen book instead of the implicit
default. Surfaced in the P36 settings panel as a "Destination book" control
(coordinate with Phase 39 so the panel gains the section once the column
exists). Feeds Phase 41's per-connection projection scope.

### P40-05 — Migration & backfill + default-book seeding
Source doc §4. Backfill one membership row per existing contact from `bookId`.
**Seeding must respect P18-11:** users already have `AddressBook` rows (with
`isDefault`) — existing accounts keep their books exactly as named, and the
backfill maps memberships onto them; the "Personal" + "Work" seed pair
(renameable — decision §10.2) applies to **new accounts only**, plus
optionally offering "Work" as a suggested second book to existing single-book
users (product call, record in P40-DB01). Never create a book a user didn't
ask for next to ones they already named. One-off script per the
`scripts/*.mjs` pattern; must be re-runnable and additive. Rollback procedure
documented in a runbook before it runs on prod.

### P40-06 — Read/write cutover
Source doc §4 and §6. Contacts list, detail, create/edit, import/export, merge,
sharing, and sync read membership instead of `bookId`; writes dual-write both
during the soak. `Contact.bookId` removal is explicitly **out of scope** —
separate cleanup phase after a prod soak (decision §10.1).

### P40-07 — Edit-context resolution rules
Source doc §6. Given an edit arriving from UI, import, or sync, resolve which
book/layer it lands in (private vs shared, which membership) using the sharing
policy. This is the seam Phase 41's inbound reconciliation plugs into.

### P40-08 — Sidebar redesign implementation
Source doc §8, to P40-DB01's spec. Books become the primary axis; the existing
Labels (P31B) and My Lists sections are preserved beneath. Mobile: mirror in the
mobile nav per roadmap/mobile-design-brief.md.

## Explicitly deferred (source doc §9)
- `GroupLabel` (group-wide shared labels) — fast-follow once multi-book settles.
- Shared lists (`SavedFilter.groupId`) — same.
- Per-field sharing overrides on top of policy.
- `Contact.bookId` column removal — post-soak cleanup phase.
- Native apps / proprietary protocol and open-standard positioning — remain
  exploration docs (phase-37 Parts 3–4), not ticketed.

## Documentation (per roadmap/documentation-policy.md)
- [ ] External · users — in-app Help: books, private fields, sharing policies
- [ ] Internal · engineering — docs/organizing-contacts.md + new "privacy layers" section
- [ ] Internal · admins/ops — runbook: backfill + rollback procedure
