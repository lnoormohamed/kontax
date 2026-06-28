# Phase 34U — UX Audit Follow-Through: Navigation, List Hierarchy & Merge Entry

> Converts the first high-signal June 2026 audit findings into build-ready
> implementation tickets for responsive navigation, mobile action hierarchy,
> form clarity, and manual-merge discovery.

## Phase status
In progress

## Portfolio priority
5 of 5 (`34Q-34U`)

## Phase objective
Address the most actionable medium-severity UX issues from the live production
audit before the second audit pass continues deeper into remaining surfaces.

## Audit source
- [Kontax UX/UI Audit — June 2026](../runbooks/kontax-ux-ui-audit-2026-06.md)
- [Kontax UX/UI Audit Tracker — June 2026](../runbooks/kontax-ux-ui-audit-tracker-2026-06.md)

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34U-01 — Tablet overview navigation density and left-rail hierarchy](p34u-01-tablet-overview-nav-density.md)
> - [P34U-02 — Mobile people list action hierarchy and row decluttering](p34u-02-mobile-people-row-action-hierarchy.md)
> - [P34U-03 — Phone country selector clarity in create/edit flows](p34u-03-phone-country-selector-clarity.md)
> - [P34U-04 — Manual merge searchable pickers and mobile entry cleanup](p34u-04-manual-merge-searchable-pickers.md)
> - [P34U-05 — Investigate production React `#418` console error on authenticated app routes](p34u-05-production-react-console-error.md)

## Suggested implementation order
1. P34U-03 — shared phone-input clarity because it improves both create and edit
   behavior with low blast radius
2. P34U-02 — mobile people list hierarchy because it affects a core daily flow
3. P34U-01 — tablet overview navigation cleanup because it improves orientation
   and perceived polish
4. P34U-04 — manual merge entry because it benefits from a more deliberate
   interaction redesign
5. P34U-05 — production console/runtime cleanup because the UX fixes are now
   verified and the next risk is hidden client instability on deployed routes

## Why this phase sits here

These tickets are intentionally small-to-medium UX interventions that can ship
between larger platform phases. They come directly from audit evidence rather
than roadmap theory, and they should be closed before the audit findings sprawl
into a longer backlog with no implementation owner.

## Documentation
- [ ] External · users — only if help text changes materially
- [x] Internal · engineering — ticket specs documented here
- [x] Internal · QA — acceptance checks defined per ticket
