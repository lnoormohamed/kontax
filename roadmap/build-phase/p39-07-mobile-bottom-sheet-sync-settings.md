# P39-07 — Mobile bottom-sheet treatment for sync settings

Status: Done — built against P39-DB01 (2026-07-03) · Priority: P2 · Depends: [P39-DB01](p39-db01-design-brief-sync-enforcement-states.md)
Phase: [Phase 39](phase-39.md)

## Problem

P36-DB01 specified a full-screen bottom sheet for the sync-settings panel on
mobile (< 768px); as built, the desktop panel renders inline full-width
inside the `SyncPageClient` detail takeover.

## Change

Implement the brief's mobile layout: full-screen bottom sheet with drag
handle, "Sync settings" header + close ×, sections stacked at 24px spacing,
full-width Save pinned above the safe area. Follow the bottom-sheet patterns
already used by mobile contact create (see `mobile-bottom-sheet.tsx` and
roadmap/mobile-design-brief.md). Dirty guard
([P39-06](p39-06-settings-panel-dirty-guard.md)) applies to sheet dismissal
(swipe-down counts as a close trigger).

## Acceptance

- On a real device (preview cannot emulate touch): sheet opens from the
  account's Settings action, scrolls the sections, Save stays pinned above
  the safe area, swipe-down with a dirty draft prompts.
- Desktop behaviour unchanged.
