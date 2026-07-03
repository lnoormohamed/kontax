# P40-08 — Sidebar redesign implementation

Status: Not started · Priority: P1 · Depends: [P40-DB01](p40-db01-design-brief-books-first-navigation.md), [P40-06](p40-06-read-write-cutover.md)
Phase: [Phase 40](phase-40.md) · Source spec: [phase-37/01 §8](../phase-37/01-data-model-build-now.md)

## Scope

Books become the primary navigation axis, to P40-DB01's spec; the existing
Labels (P31B) and My Lists sections are preserved beneath. Includes the
migration moment for existing users (one-time dismissible explainer, per the
brief) and the mobile nav mirror (roadmap/mobile-design-brief.md).

## Acceptance

- Sidebar states from the brief implemented (default, empty book, overflow,
  shared-book badge, active); labels and lists sections regression-free
  (label filter → save-as-list flow still works).
- Mobile nav verified on a real device.
- Migration explainer shows once per existing user, never for new accounts.
