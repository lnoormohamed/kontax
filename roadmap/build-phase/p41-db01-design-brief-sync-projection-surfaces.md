# P41-DB01 — Design Brief: Sync Projection Surfaces & Honest-Limitations Copy

## Purpose

Specify the UX for Phase 41's per-connection projection: the `/sync` page
regrouped by destination book, the projection-scope controls ("this connection
pushes Work contacts, favours work fields, never pushes private fields"), and
the plain-language copy for the protocol's genuine limitations
([phase-37/02-carddav-projection.md](../phase-37/02-carddav-projection.md) §3).

The projection model is the product's most conceptually demanding feature —
"each device sees a different slice of the same person". If the UI can't
explain it in one screen, users will file every projection difference as a sync
bug. Design is the risk here, not engineering.

## Background

- Source doc §4.1 (projection config), §4.3 (the two-iCloud "John" worked
  example — the brief should reuse it as the explanatory device), §5.2–5.3
  (conflict override + edit routing), §6 (sync page changes).
- Builds directly on the P35-DB01 grouped rail and the P36-DB01 settings panel;
  the projection controls are new sections in that panel, so P39-DB01's mobile
  sheet applies to them too.
- Honesty requirements from §3 are non-negotiable copy inputs: iOS auto-links
  cards across accounts; "private" is enforced at the Kontax boundary only;
  inbound edits are inferred by diff, not attributed by the protocol.

## Scope

### In scope

1. **Sync page regrouped by destination book** — rail sections become
   book-scoped ("Personal → iCloud (personal), Google", "Work → iCloud
   (work)"); connection rows gain a one-line projection summary ("Pushes: Work
   · favours work fields"). Reconcile with the existing provider grouping from
   P35-DB01 — the brief must pick one primary grouping and prove it with both
   single-book and multi-book accounts.
2. **Projection settings sections** (in the P36 settings panel):
   - **Destination / scope** — which book(s) this connection projects
     (`destinationBookId` + membership scope). Relationship to the existing
     CardDAV `bookAllowlist` section must be resolved — they read as the same
     control to a user; the brief decides merge vs distinct with copy.
   - **Precedence** — "When a contact is in more than one book: favour Work /
     favour Personal" with a concrete example line under each option.
   - **Private fields** — a non-editable statement, not a control: "Private
     fields are never pushed to this device."
3. **The explainer** — a compact "what will this device see?" preview:
   given the current config, a sample card render (the "John" example) showing
   included vs omitted fields. One shared component used in the settings panel
   and in first-connection onboarding.
4. **Honest-limitations copy** — where and how the §3 caveats surface:
   - iOS auto-link caveat on the connection row for a second same-provider
     account on one device (info tone, once, dismissible).
   - Privacy-boundary honesty sentence wherever "private" appears (shared
     wording with P40-DB01 §4 — write it once).
5. **V2 routing surfaces** — where an inbound edit's inferred routing is shown
   (history row: "Updated home phone → Personal book"), and the per-connection
   conflict-override control (§5.2) as a settings row, including the
   "couldn't attribute this change" fallback state that queues for manual
   review (reuses the P23 conflict-review surface).
6. **Mobile** — all of the above in the mobile sync layout (bottom-sheet
   settings per P39-DB01; stacked rail sections per mobile-design-brief).

### Out of scope
- The P36 base settings sections (direction, frequency, conflict policy).
- Enforcement/pause states (P39-DB01).
- Capability-matrix messaging for provider feature gaps (34I/34J territory —
  coordinate copy tone, don't duplicate).
- Native-app surfaces (phase-37 Part 3 remains exploration).

## States to specify

Connection row: single-book, multi-book, V1-only (inbound not yet
projection-aware — label it), misconfigured (destination book deleted).
Preview: empty book, fully private contact (nothing to push), collision case.
Settings: pre-P40-migration accounts (feature hidden vs defaulted). Desktop /
tablet / mobile.

## Deliverables

A `p41-db01` brief in `roadmap/design-briefs/` at P36-DB01 fidelity, written as
an extension of [07-sync-connections.md](../design-briefs/07-sync-connections.md)
and P35-DB01. Copy deck included: every limitation sentence, every option
description, the explainer text — reviewed against the §3 honesty table.

## Dependencies
Blocks P41-01 (config UI) and P41-03 (sync page regroup); informs P41-05
(routing/override surfaces). Requires P40-DB01's book vocabulary to be settled
first — the two briefs must share terms ("book", "private", "favour").
