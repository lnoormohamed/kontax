# P24B-PERF-06 — Mobile viewport listener performance

## Objective

Reduce scroll and keyboard-related repaint churn on mobile contact detail and bottom-sheet surfaces.

## Status

- Status: In Progress
- Priority: P1
- Owner: Kontax
- Depends on: P24B-PERF-05

## Scope

- Batch scroll-driven header visibility work with `requestAnimationFrame`.
- Avoid redundant header visibility state updates during mobile scroll.
- Batch visual-viewport keyboard updates for bottom sheets and mobile contact editing.
- Preserve existing keyboard-aware positioning and focused-field behavior.

## Implementation notes

- Mobile contact detail now only updates compact-header state when the boolean visibility value changes.
- Mobile contact detail scroll and visual-viewport handlers are rAF-batched and cleaned up on unmount.
- Mobile bottom sheet visual-viewport updates are rAF-batched and skip duplicate state updates.

## Acceptance criteria

- [ ] Contact detail header transitions remain correct while scrolling.
- [ ] Mobile edit sheets still adjust for the keyboard.
- [ ] Bottom sheets still fit inside the visual viewport with the keyboard open.
- [ ] Production build passes.

## Risks and follow-ups

- Device-level keyboard behavior varies between iOS and Android. Keep this ticket open until it is checked on both platforms after deployment.
