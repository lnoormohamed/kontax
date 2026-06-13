# P24B-PERF-02 — Mobile gesture performance

## Status

In Progress — initial swipe hot-path cleanup implemented 2026-06-13.

## Purpose

Improve perceived smoothness on mobile gestures, especially contact-list swipe actions and scroll-adjacent interactions on Android Chrome and iOS Safari.

## Background

The contact list uses `@use-gesture/react` with horizontal axis locking so vertical scrolling can coexist with swipe actions. The next performance pass focuses on reducing per-frame React churn and layout reads in that existing gesture path.

## Scope

**In scope:** swipe-row hot-path cleanup, avoiding layout reads during gesture end/archive, avoiding no-op state updates, and preserving scroll-vs-swipe behavior.

**Out of scope:** redesigning swipe actions, replacing the gesture library, service worker caching, server queries, or large visual changes.

## Acceptance Criteria

- Swipe actions avoid layout reads during gesture end.
- No-op drag updates do not trigger state updates.
- Existing favorite/archive swipe behavior remains unchanged.
- The work remains compatible with iOS Safari and Android Chrome.

## Implementation Notes

- Cached row width on gesture start so release/archive can reuse it.
- Added a tiny offset epsilon to skip redundant state updates during drag.
- Replaced the unused catch binding to clear the current lint warning.

## Follow-up Candidates

- Profile Android Chrome with a large contact set.
- Consider closing open swipe rows when vertical scrolling begins.
- Consider disabling swipe actions while multi-select mode is active.
- Consider moving foreground transform fully out of React state if choppiness persists.
