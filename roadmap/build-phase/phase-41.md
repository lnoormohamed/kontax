# Phase 41 — CardDAV Projection (from P37 · Part 2)

> Reassigns the unbuilt design work in
> [roadmap/phase-37/02-carddav-projection.md](../phase-37/02-carddav-projection.md).
> Depends entirely on the Phase 40 data model (membership books, private
> fields, `destinationBookId`). "CardDAV is the dumb pipe, Kontax is the brain":
> each connection pushes a *projection* of the canonical contact — scoped by
> book, filtered by privacy, resolved by precedence — instead of the whole
> record.

## Phase status
Pre-plan · blocked on Phase 40

## Phase objective
Ship outbound projection first (V1 — CardDAV-safe by construction), then
inbound reconciliation (V2 — the diff-against-last-pushed-snapshot engine that
routes device edits back to the right book/layer). Source doc sections are the
authoritative spec; tickets cite them.

## Success criteria
- The §4.3 worked example passes end-to-end: one "John", two iCloud
  connections, each device sees only its projection (work fields vs personal
  fields; private notes on neither).
- A device edit routes to the correct layer per the §5.3 edit-context matrix.
- The sync page surfaces each connection's projection scope using the primary
  grouping P41-DB01 decides (destination-book grouping is the working
  proposal; it must be reconciled against the shipped P35 provider grouping),
  and states the honest limitations (§3) in plain copy — iOS card
  auto-linking, privacy stops at the Kontax boundary, no field-level merge in
  the protocol.

## Exit criteria
- P41-01 … P41-06 verified against real iCloud/Google/CardDAV staging accounts.
- docs/sync-carddav-model.md gains a "projection" section with the V1/V2 split.

## Tickets

| Ticket | Title | Priority | Depends on |
| --- | --- | --- | --- |
| [P41-DB01](p41-db01-design-brief-sync-projection-surfaces.md) | Design brief: projection surfaces & honest-limitations copy | P0 | P40-DB01 |
| [P41-01](p41-01-projection-config.md) | Per-connection projection config | P0 | P40-04, P40-06, P41-DB01 |
| [P41-02](p41-02-outbound-projection-v1.md) | Outbound projection build in the runner (V1) | P0 | P41-01 |
| [P41-03](p41-03-sync-page-projection-grouping.md) | Sync page: projection grouping + honest-limitations copy | P1 | P41-01, P41-DB01 |
| [P41-04](p41-04-pushed-snapshot-store-inbound-diff.md) | Per-link pushed-snapshot store & inbound diff engine (V2) | P0 | P41-02 |
| [P41-05](p41-05-conflict-override-edit-matrix.md) | Conflict-override rule + edit-context matrix (V2) | P1 | P41-04, P40-07 |
| [P41-06](p41-06-multi-connection-qa-matrix.md) | Multi-connection QA matrix | P1 | P41-02, P41-05 |

> Tickets are split into standalone files (linked above); the sections
> below remain the phase-level overview.

### P41-01 — Per-connection projection config
Source doc §4.1. Each connection gets: destination-book scope (which
memberships project), private-field exclusion (always), and a same-type
precedence preference ("favour work" / "favour personal") for collisions when
one person appears in multiple in-scope books. Config surfaces in the sync
settings panel (extends the Phase 39/P36 panel).

### P41-02 — Outbound projection build (V1)
Source doc §4.2–4.3. The runner assembles the outbound vCard from the
projection instead of the full contact: in-scope book fields, minus private
fields, collisions resolved by the precedence rule. Composes with the Phase 39
enforcement work (`excludedFields`, `exportLabelFilter` apply after
projection). CardDAV-safe: no protocol extensions.

### P41-03 — Sync page projection grouping + honest copy
Source doc §3 and §6. Sync connections regroup by destination book; each
connection row shows its projection scope. Limitation copy is explicit, not
buried: "private" means not shown to other members, *not* "can never leave a
device"; iOS may visually merge cards across accounts.

### P41-04 — Pushed-snapshot store & inbound diff (V2)
Source doc §5.1. Store the last-pushed vCard per (connection, contact); when a
card comes back, diff against the snapshot to infer *which fields changed*,
since inbound vCards carry no layer/book attribution. This is the engineering
cost the doc calls out — budget accordingly. Coordinate with p34i-05's remote
shadow design (same storage, two consumers).

### P41-05 — Conflict override & edit-context matrix (V2)
Source doc §5.2–5.3. Per-connection conflict-override rule; implement the full
edit matrix (private personal / private work / same-person collision / new
contact / shared-book edit) for both work-scoped and personal-scoped
connections. Routes through Phase 40's edit-context resolution (P40-07).

### P41-06 — Multi-connection QA matrix
Source doc §7 rollout table. Staging pass with two iCloud accounts on one
device (the auto-link caveat), a Google account, and a generic CardDAV client.
Captures V1-only behaviour (inbound falls back to pre-projection semantics)
separately from V2. Real-device verification required for the iOS scenarios.

## Documentation (per roadmap/documentation-policy.md)
- [ ] External · users — in-app Help: what each device sees and why; privacy boundary honesty
- [ ] Internal · engineering — docs/sync-carddav-model.md: projection + snapshot diff design
- [ ] Internal · admins/ops — runbook: diagnosing mis-routed inbound edits
