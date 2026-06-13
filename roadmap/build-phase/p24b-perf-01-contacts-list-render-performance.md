# P24B-PERF-01 — Contacts list render performance

## Status

In Progress — initial render-churn reduction implemented 2026-06-13.

## Purpose

Improve contacts list responsiveness on both mobile and desktop by reducing unnecessary React work during list render, selection changes, virtual scrolling, grouping, and sticky-header updates.

## Background

The contacts list is Kontax's highest-traffic surface. It already uses virtualization, but several derived arrays and inline calculations were recreated every render, row subtrees were not memoized, and sticky group header lookup ran directly inside JSX. These costs are small individually but compound on mobile, especially Android Chrome.

## Scope

**In scope:** row memoization, derived array memoization, stable callbacks, sticky-section calculation cleanup, and low-risk render-path optimizations.

**Out of scope:** server query shape changes, pagination redesign, route bundle splitting, service worker behavior, or visual redesign.

## Acceptance Criteria

- Contact rows avoid re-rendering when unrelated parent state changes.
- Favorite/rest partitioning does not recreate dependencies on every render.
- Selection helpers use stable memoized IDs and callbacks.
- Sticky group header calculation is separated from inline JSX work.
- Existing list behavior remains unchanged on desktop and mobile.

## Implementation Notes

- Memoized `Highlight`, `Avatar`, `RowBadges`, `ContactRow`, and `GroupHeading`.
- Memoized `visibleIds`, `allSelected`, and favorite/rest contact partitions.
- Stabilized selection callbacks with `useCallback`.
- Moved sticky section lookup into a memoized value using current virtual rows.

## Follow-up Candidates

- Profile with React DevTools on a larger seeded list.
- Consider splitting mobile and desktop row renderers if memoization is not enough.
- Consider reducing virtualizer measurement work on mobile once Android Chrome behavior is rechecked.
- Review server query shape so list rows only receive fields needed for the list.
