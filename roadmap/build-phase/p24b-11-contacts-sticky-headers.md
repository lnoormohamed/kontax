# P24B-11 — Contacts list: sticky group headers + plan variance

## Purpose

Make the alphabetical / Favourites group headers stick to the top while scrolling (per the design), and
apply the Free contact-limit and read-only variance to the list and FAB.

## Background

The design's group headers are `position: sticky` (`mob-kit.jsx` `GroupHeader`). The built list is
virtualized (`@tanstack/react-virtual`) where absolutely-positioned rows don't support native sticky —
deferred in P24A. The list also needs the 500-contact limit banner (Free) and read-only handling.

## Scope

**In scope:** sticky group headers in the virtualized list + limit/read-only variance. **Out of scope:**
list data/sorting.

## Design / Implementation Spec

Per spec §E1 and §E0.
- **Sticky headers:** implement a scroll-position overlay header (the current letter/section pinned at
  the top of the scroll region), since native `sticky` doesn't work on absolute virtualizer items.
  28px, `wash`, 11/700 `mute` label (star for Favourites).
- **Variance:** **Free** near/at 500 → `NearLimitBanner`; at cap → FAB disabled. **Read-only** → locked
  banner + FAB/swipe-edit disabled. **Family/Team** member → shared badges + "Save to" target handled
  in create (P24B-07).

## Acceptance Criteria

- The current section label stays pinned at the top of the list while scrolling; updates across sections.
- Free near/at 500 shows the limit banner; FAB disabled at cap.
- Read-only disables FAB + swipe edit and shows the locked banner.
- No hydration mismatch / scroll jank introduced.

## Risks and Open Questions

- Overlay-header approach must stay in sync with the virtualizer's measured offsets — verify on fast
  scroll and after row-height remeasure.
