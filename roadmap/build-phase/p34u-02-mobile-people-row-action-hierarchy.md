# P34U-02 — Mobile People List Action Hierarchy and Row Decluttering

## Status

Implemented and visually verified on 2026-06-28.

## Purpose

Make the mobile people list feel tap-safe and scannable by restoring a single
dominant row action and moving secondary actions behind more intentional
gestures.

## Background

Audit finding `UX-003` showed that compact people rows on mobile expose too
many simultaneous affordances around the primary "open contact" action. The
list works, but it asks users to parse badges, favorite state, and action
controls inside a very tight surface.

Relevant implementation anchors:
- `src/app/_components/contacts-workspace-table.tsx`
- `src/app/_components/contact-badge-cluster.tsx`
- `src/app/_components/contact-list/swipeable-row.tsx`

## Scope

**In scope**
- compact mobile people-row hierarchy
- how archive / favorite / more-actions are revealed on touch devices
- preserving clear access to secondary actions without crowding the row

**Out of scope**
- desktop row redesign
- archived-list redesign beyond shared mobile patterns
- bulk-edit toolbar behavior

## Dependencies

- Audit finding `UX-003`
- Existing swipe-reveal primitive in `contact-list/swipeable-row.tsx`

## Design / Implementation Spec

### Desired behavior

- A tap on the row should clearly mean "open contact."
- Favorite and archive should not compete visually with the row's main target.
- Secondary actions should still be reachable in an accessible way.

### Suggested implementation direction

- Keep the contact name / avatar / key metadata as the dominant visible content.
- Reduce always-on action chrome in compact mobile rows.
- Prefer one of these patterns for secondary actions:
  - swipe-to-reveal favorite and archive using the existing swipeable row
  - a single overflow control
  - a hybrid where one action is swipe-only and destructive actions stay in
    overflow
- Keep desktop hover actions intact where they already work well.

### Accessibility / behavior guardrails

- Any swipe-only affordance must still have a non-gesture fallback.
- Screen readers should not lose access to favorite / archive / more actions.
- The row should avoid accidental action triggers during vertical scrolling.

### Engineering notes

- Start in `contacts-workspace-table.tsx`, where row badges and row actions are
  currently composed.
- Evaluate whether `SwipeableRow` can wrap only compact mobile rows rather than
  becoming a universal row primitive.

## Acceptance Criteria

- On mobile compact rows, there is one visually dominant primary action:
  opening the contact.
- Secondary actions are still available, but no longer crowd the default row
  state.
- Row interactions feel reliable during normal vertical scrolling.
- Desktop row behavior is unchanged unless explicitly needed for parity.

## Implementation Notes

- Compact mobile rows now render a stripped-back layout with avatar, name,
  primary metadata, and one trailing overflow action.
- Favorite state is no longer always visible in the default mobile row chrome.
  It remains available through the overflow menu and the existing swipe
  affordance.
- Labels and secondary context are condensed into short summary text on mobile
  instead of persistent badge clusters and chip stacks.
- Desktop row composition keeps the richer badge / chip treatment.

## Verification Evidence

- Before: `roadmap/runbooks/artifacts/ux-audit-before-after/p34u-02-before-mobile-people-list.png`
- After: `roadmap/runbooks/artifacts/ux-audit-before-after/p34u-02-after-mobile-people-list.png`
- Re-tested on local preview at `390x844` with seeded contacts and confirmed:
  - row-open remains the dominant action
  - a single overflow control is visible per row
  - metadata remains scannable without inline favorite clutter

## Documentation

- [ ] External · users
- [x] Internal · engineering
- [x] Internal · QA
