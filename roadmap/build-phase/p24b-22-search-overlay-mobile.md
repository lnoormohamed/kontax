# P24B-22 — Mobile search overlay → to spec

## Purpose

Bring the existing mobile search overlay (`mobile-search-button.tsx`) to the design language defined in
P24B-DB18 — proper results, recents, and empty/no-match/offline states.

## Background

P24A shipped a slide-down search panel that debounces into `?q=` and navigates to `/contacts`. It works
but was never specced; it lacks designed results/recents/empty states and hasn't been verified against
the language.

## Scope

**In scope:** the mobile search overlay UI to DB18 — field, results rows, recents/suggestions, no-match,
offline caption. **Out of scope:** the search backend / query logic.

## Design / Implementation Spec

Per spec §E13 and brief P24B-DB18.
- **Chrome/field:** full-screen overlay (or slide-down per DB18 decision); `wash` rounded field +
  search icon + "Search contacts…" (16px, autofocus) + "Cancel". Overlay covers the bottom nav.
- **Results:** 60px contact rows — avatar, name with `#fff0bf` match highlight, secondary line; tap →
  detail; show count.
- **Recents/suggestions** (empty query); **no-match** empty state; **offline** caption (cached list).
- Debounced `?q=` URL update so back / deep-link works.

## Acceptance Criteria

- Overlay matches DB18: field + results + recents + no-match + offline.
- Result rows use the list-row spec with match highlight; tap opens the contact.
- Overlay covers the bottom nav; Cancel/back returns to the prior screen.
- `?q=` deep-links and back works; verified at 375px.

## Risks and Open Questions

- **Design brief:** P24B-DB18 (search & notifications overlays).
- Confirm slide-down vs full-screen and whether recents are persisted.
