# P40-DB01 — Design Brief: Books-First Navigation & Multi-Membership Surfaces

> **Status: Brief delivered (2026-07-04)** →
> [roadmap/design-briefs/p40-db01-books-first-navigation.md](../design-briefs/p40-db01-books-first-navigation.md).
> The three open model decisions are landed there: remove-from-last-book = **block**;
> multi-membership indicators = **detail-only (v1)**; default books = **Personal + Work,
> renameable**.

## Purpose

Specify the visual design and interactions for the Phase 40 multi-book model:
a contact that can live in several books, carry private fields other members
never see, and obey a per-member sharing policy. The schema is designed
([phase-37/01-data-model-build-now.md](../phase-37/01-data-model-build-now.md)
§3–§8); what does not exist is the **user-facing shape** — the sidebar
hierarchy, how multi-membership reads on a row and on the detail page, how a
field is marked private, and where the sharing-policy default lives.

This is the highest-leverage design ticket in the 39–41 set: it changes the
first thing every user sees (`/contacts` sidebar) and the mental model of the
whole product (source doc §8 calls the sidebar consequence out explicitly).

## Background

- Source doc §8 sketches the direction: books become the **primary navigation
  axis**; My Lists and Labels (P31B, shipped) remain beneath as cross-cutting
  views. §5–§6 define the "no prompt on every edit" sharing-policy rule the UI
  must make legible without nagging.
- The locked design language applies. Reuse: sidebar section styling
  (P28-DB09 / P31B-DB12), chips (`label-chip.tsx` conventions), the sharing
  surfaces from [12-sharing-ui.md](../design-briefs/12-sharing-ui.md) and
  [13/14 family-teams briefs](../design-briefs/13-family-plan-surfaces.md).
- Constraint from Phase 38: the contacts list is on a payload diet — whatever
  membership indicators land on rows must fit the lean row shape (P38-01) and
  the windowed fetch (P38-02).

## Scope

### In scope

1. **Books-first sidebar** — section order and hierarchy (Books → shared books
   → My Lists → Labels), the default "Personal" / "Work" seeded books, counts,
   active states, book create/rename/reorder affordances, and where "All
   contacts" lives in the new model.
2. **Multi-membership on the contact row** — how a contact in 2+ books reads in
   the list without bloating the row (proposal to evaluate: book dot(s) or a
   compact badge, shown only outside a single-book filter context).
3. **Membership on the contact detail** — a "Books" block: current memberships
   as removable chips + "Add to book"; remove-from-last-book behaviour
   (blocked, or converts to a move — brief must decide with product).
4. **Private fields** — the marking affordance in the contact form (per-field
   lock toggle on multi-value rows), how a private field renders for the owner
   (subtle lock glyph), and the *absence* story for other members (they simply
   never see it — no redaction placeholder). Copy must be honest per the
   projection brief: private = "not shown to other members", not "never leaves
   your devices".
5. **Sharing-policy picker** — the per-member default (source doc §5) in group
   settings: options, plain-language descriptions, and the one-time educational
   moment when a user first edits a contact in a shared book. Teams
   `minimumSharingPolicy` shown as a floor ("Your team requires at least…").
6. **Edit-context cues** — when editing, which book/layer the edit lands in
   (§6): a quiet context line in the form header, not a per-field prompt.
7. **Migration moment** — what an existing user sees on first load after the
   backfill: their old single book renamed/seeded, a one-time dismissible
   explainer. No forced tour.
8. **Mobile treatment** — the sidebar equivalent in the mobile nav/sheet
   (roadmap/mobile-design-brief.md), membership chips on the mobile detail, and
   the private-field toggle at touch sizes.

### Out of scope
- `GroupLabel` / shared lists (explicitly deferred, source doc §9).
- Per-field sharing overrides beyond the private toggle.
- Sync projection scope UI (P41-DB01).
- Admin/ops views of the new model.

## Model decisions the brief must land (with product)

1. Remove-from-last-book: block vs move (ties to source doc §10.1).
2. Whether multi-membership indicators appear on rows at all in v1, or only on
   detail (performance + clutter trade-off).
3. Default-book naming and renameability (source doc §10.2 — recommendation:
   seed "Personal" + "Work", fully renameable).

## States to specify

Sidebar: default, empty book, >8 books overflow, drag/reorder, shared-book
badge, active. Detail books block: single, multiple, read-only shared book.
Private field: owner view, edit mode, and the shared-member absence case
(verified with two seeded accounts). Sharing-policy picker: each option,
Teams-floor disabled options. All at desktop / tablet / mobile.

## Deliverables

A `p40-db01` brief in `roadmap/design-briefs/` at P36-DB01 fidelity (layout
blocks, exact copy, tokens, all states), extending
[01-contacts-list.md](../design-briefs/01-contacts-list.md),
[02-contact-detail.md](../design-briefs/02-contact-detail.md) and
[03-create-edit-contact.md](../design-briefs/03-create-edit-contact.md) rather
than replacing them.

## Dependencies
Blocks P40-06 (cutover), P40-08 (sidebar build); informs P40-02 (private-field
read helper shape) and P40-03 (policy options). Should start **alongside** the
schema tickets so design and model decisions converge (source doc §10.4
recommends the parallel-brief approach).
