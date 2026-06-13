# P24B-PERF-05 — Mobile search request performance

## Objective

Reduce unnecessary client work and network churn in the mobile contact search overlay when users type quickly.

## Status

- Status: In Progress
- Priority: P1
- Owner: Kontax
- Depends on: P24B-PERF-04

## Scope

- Abort stale in-flight search requests when a newer query starts.
- Ignore late responses that no longer match the latest query.
- Clear pending debounce timers and in-flight searches when the overlay closes.
- Preserve the existing search UX and result rendering.

## Implementation notes

- Added an `AbortController` ref for the current mobile contact search request.
- Added a latest-query ref so stale responses cannot overwrite newer results.
- Search overlay close now clears pending timers and aborts the active request.

## Acceptance criteria

- [ ] Fast typing does not allow older search responses to overwrite newer results.
- [ ] Closing the search overlay cancels pending search work.
- [ ] Empty queries still reset to idle with no results.
- [ ] Production build passes.

## Risks and follow-ups

- This pass keeps the existing 220ms debounce. If production telemetry still shows search pressure, tune debounce and result limits together.
