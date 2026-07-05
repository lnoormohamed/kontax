# P34U-04 — Manual Merge Searchable Pickers and Mobile Entry Cleanup

## Purpose

Make manual merge selection fast and believable by replacing long pseudo-search
dropdowns with real searchable pickers and by cleaning up the entry layout on
small screens.

## Background

Audit finding `UX-011` showed that `/merge/manual` labels its contact pickers
as `Search contacts…`, but the current controls are native `<select>` elements
with very long static option lists. Audit finding `UX-008` also showed that the
entry step remains desktop-shaped on mobile because the initial selector row is
laid out as `1fr auto 1fr`.

Relevant implementation anchors:
- `src/app/merge/manual/page.tsx`
- `src/app/_components/merge-review.tsx`
- Design context from `p24b-db16-design-brief-merge-mobile.md`

## Scope

**In scope**
- manual merge contact discovery before preview
- mobile entry layout for Contact A / Contact B selection
- aligning the picker behavior with what the UI copy promises

**Out of scope**
- merge scoring or duplicate suggestion logic
- survivor-selection logic inside the existing merge review
- merge commit semantics

## Dependencies

- Audit findings `UX-008` and `UX-011`
- Existing merge-review surface and mobile merge design brief

## Design / Implementation Spec

### Desired behavior

- Users should be able to find a contact quickly with search, not long
  alphabetical scanning.
- The first step should feel mobile-ready before the preview even loads.
- The route should stop implying search if it is not providing search.

### Suggested implementation direction

- Replace the native selects with real searchable comboboxes or typeahead
  pickers.
- Support at least:
  - typed filtering
  - clear current selection
  - obvious selected-state display
- On mobile, stack the Contact A and Contact B controls rather than keeping a
  three-column row.
- Keep `Load merge preview` as a distinct action after both selections are
  made.
- If useful, consider pre-populating recent contacts or likely duplicate hints,
  but do not block this ticket on suggestion logic changes.

### Engineering notes

- `merge/manual/page.tsx` currently fetches all active contacts for the page and
  renders them into `<option>` elements. Revisit whether the new picker should
  use that data directly or narrow the payload.
- Preserve server-driven preview loading and the current merge-review flow once
  a valid pair is selected.

## Acceptance Criteria

- Manual merge no longer relies on giant native dropdowns that masquerade as
  search.
- Users can filter or search for contacts directly from the picker UI.
- At mobile widths, the Contact A / Contact B entry step is stacked and easy to
  operate.
- Existing preview generation still works once a valid pair is selected.

## Documentation

- [ ] External · users
- [x] Internal · engineering
- [x] Internal · QA
