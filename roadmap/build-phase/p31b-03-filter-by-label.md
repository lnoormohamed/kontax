# P31B-03 — Filter by Label (saveable as a smart list)

## Purpose

Let users filter the contacts list to a single label, and make that filtered view
**saveable as a smart list** — the seam that ties labels (data) to lists (saved
queries) per the organizing-contacts model.

## Background

The contacts list filter state lives in `~/lib/contact-filter-state.ts`
(`tab/filter/q/book/scope`) and is what smart lists persist (P28-01/02). Adding
`label` to that state means the existing "Save as list" flow captures it for free
— a list can be "everyone tagged VIP". The page query
(`src/app/contacts/page.tsx`) already composes private/shared/book filters; label
filtering slots in alongside `personalBookWhere`.

## Scope

**In scope**
- Add `label` to `ContactFilterState` (keys, `fromParams`, `toQueryString`,
  `normalise`, `matches`, `summarise`).
- Apply the label filter in the page query for the user's contacts.
- A "Label: <name>" chip in the filter-context bar.
- The "Save as list" modal shows the label chip and persists it (no new code —
  falls out of the filter-state change).

**Out of scope**
- The registry (P31B-01), sidebar section (P31B-02), management (P31B-04).

## Design / Implementation Spec

### Filter-state
- Add `label?: string` to `ContactFilterState`; include it in the KEYS list and
  in `summarise` (chip `{ k: "Label", v: <name> }`).
- `toQueryString` emits `label=<name>` when present.

### Query
- `Contact.labels` is a JSON string array. Match with Prisma's JSON array
  filter (`labels: { array_contains: <name> }`) or an equivalent raw condition,
  added as an `AND` fragment alongside `personalBookWhere` (so it doesn't clobber
  the search/filter `OR`s — same pattern P28-07 used).
- Scope to the user's private contacts (labels are personal).

### Save-as-list
- Because `label` is now part of the captured filter-state, clicking a sidebar
  label then "Save as list" produces a smart list that recalls the label filter.
  Verify the active-state matching (`matches`) treats label equality correctly.

## Acceptance Criteria
- Clicking a label filters the contacts list to contacts carrying it.
- The filter-context bar shows a "Label: <name>" chip.
- Saving the view creates a smart list that recalls the label filter.
- Label filter composes correctly with search and other filters (no clobbering).

## Risks / Open Questions
- JSON array containment performance — acceptable at per-user scale; revisit with
  the same indexing trade-off noted for P28-07 if needed.
- Canonical name matching must align with the registry's canonical form (P31B-01).

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help (P26-12): filtering by label + saving it as a list
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: note the label→list seam in `organizing-contacts.md`
