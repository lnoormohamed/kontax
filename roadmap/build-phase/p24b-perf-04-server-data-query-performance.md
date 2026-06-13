# P24B-PERF-04 — Server data query performance

## Objective

Reduce server-side database work on the contacts workspace by avoiding heavy tab-specific reads when the user is not viewing that tab.

## Status

- Status: In Progress
- Priority: P1
- Owner: Kontax
- Depends on: P24B-PERF-01, P24B-PERF-03

## Scope

- Keep the default contacts list fast on mobile and desktop.
- Preserve existing navigation badge counts.
- Avoid loading archived contact rows unless the archived tab is active.
- Avoid loading full duplicate suggestion cards unless the duplicate review tab is active.
- Use cheap aggregate counts when the UI only needs badge totals.

## Implementation notes

- The contacts workspace now gates archived contact hydration behind the archived tab.
- Duplicate review details are only loaded on the duplicates tab.
- Non-duplicate tabs use aggregate `MergeSuggestion` counts for the duplicates badge and high-confidence bulk action count.
- Recent merge history remains scoped to the duplicates tab.

## Acceptance criteria

- [ ] People tab no longer fetches archived contact rows.
- [ ] People tab no longer fetches full duplicate suggestion card data.
- [ ] Duplicates badge remains accurate outside the duplicates tab.
- [ ] Archived tab still renders archived contacts.
- [ ] Duplicates tab still renders suggestion cards, recent merge history, and bulk actions.
- [ ] Production build passes.

## Risks and follow-ups

- Aggregate duplicate counts do not trigger stale-suggestion regeneration. If stale queue accuracy becomes visible, add a low-cost background refresh job rather than doing it during every contacts page load.
- Additional count queries may still be consolidated later with a dashboard aggregate endpoint or cached per-user counters.
