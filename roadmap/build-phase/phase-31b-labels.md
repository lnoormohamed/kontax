# Phase 31B — Labels (browse, filter, manage)

> **Mini-phase.** Split out from Phase 31 (session/auth hardening) because labels
> are an unrelated workstream. Numbered "31B" to keep **Phase 32 = Documentation**
> as agreed. Renumber freely if a flat sequence is preferred.

## Phase status
Pre-plan

## Phase objective
Make **labels** a first-class organizing primitive. Labels can already be
attached (contact form + bulk "Add label" → `Contact.labels`), but there is no
way to browse, filter, or manage them — the sidebar "Labels" section is a
hardcoded placeholder. This phase ships the real label experience and closes the
"write-only tag" gap noted in [`docs/organizing-contacts.md`](../../docs/organizing-contacts.md).

## Success criteria
- The sidebar lists the user's real labels (color + count), not a placeholder.
- Clicking a label filters the contacts list to contacts carrying it.
- A label filter is **saveable as a smart list** (labels are data; lists are
  saved queries over that data).
- Users can rename, recolor, merge, and delete a label across all tagged contacts.
- Label chips render consistently on contact rows and detail.

## Exit criteria
- `docs/organizing-contacts.md` updated: labels move from "half-built" to shipped.
- The four-primitive model (book / shared book / list / label) is fully realized.

## Design dependency
- **[P31B-DB12 — Design brief: Labels](p31b-db12-design-brief-labels.md)** must
  land before the build tickets (sidebar section, filter, management UI, color
  tokens, label registry model decision).

## Proposed tickets

> **Build-ready detail lives in the standalone ticket files** (the summaries
> below are the overview):
> - [P31B-01 — Label registry & model](p31b-01-label-registry-and-model.md)
> - [P31B-02 — "Labels" sidebar section](p31b-02-labels-sidebar-section.md)
> - [P31B-03 — Filter by label (saveable as a smart list)](p31b-03-filter-by-label.md)
> - [P31B-04 — Label management (rename / recolor / merge / delete)](p31b-04-label-management.md)
> - [P31B-05 — Label chips on rows & detail](p31b-05-label-chips.md)

### P31B-01 — Label registry & model
Status: Not Started · Priority: P0 · Depends: P31B-DB12

Decide and implement the canonical-label model so rename/recolor/delete/merge are
possible: a lightweight per-user label registry (name + color, and possibly
usage count) layered over the existing `Contact.labels` JSON array. Keep
attachment backward-compatible. Deploy-safe under `db push` (additive only).

Acceptance:
- A user-level source of truth for label name + color exists.
- Existing `Contact.labels` values reconcile into the registry (backfill).

### P31B-02 — "Labels" sidebar section
Status: Not Started · Priority: P0 · Depends: P31B-01

Replace the placeholder in `contact-dashboard.tsx` with a real Labels section:
color dot + name + count, active state, "+ New label", hover `⋯` menu. Matches
the My Lists / Books section styling.

### P31B-03 — Filter by label (saveable as a smart list)
Status: Not Started · Priority: P0 · Depends: P31B-01

Add `label` to the contacts filter-state (`~/lib/contact-filter-state`) and the
page query so `?label=<name>` filters the list and the filter is captured by the
existing "Save as list" flow. Filter-context chip "Label: <name>".

Acceptance:
- Clicking a label filters the list.
- Saving that view creates a smart list that recalls the label filter.

### P31B-04 — Label management (rename / recolor / merge / delete)
Status: Not Started · Priority: P1 · Depends: P31B-01

Management surface to rename (updates every contact), recolor (palette), merge
(fold A into B, dedupe), and delete (remove from all contacts, confirmed). All
operations bump `syncVersion` on affected contacts.

### P31B-05 — Label chips on rows & detail
Status: Not Started · Priority: P1 · Depends: P31B-01

Consistent label chip rendering (color + name) on contact rows and the contact
detail page, sourced from the registry colors.

## Documentation (per roadmap/documentation-policy.md)
- [x] External · users — in-app Help: "Organizing with labels"
- [x] Internal · engineering — docs/: update `organizing-contacts.md`
- [ ] External · developers / Internal · admins — only if the API or ops surface is affected
