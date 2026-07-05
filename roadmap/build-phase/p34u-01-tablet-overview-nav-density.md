# P34U-01 — Tablet Overview Navigation Density and Left-Rail Hierarchy

## Purpose

Reduce tablet-specific navigation density on the contacts overview so the main
dashboard content regains priority at mid-size breakpoints.

## Background

Audit finding `UX-002` showed that the overview at `768x1024` still inherits
the full desktop left rail: primary nav, subfilters, shared books, smart lists,
books, labels, and import/sync links all compete with the actual overview
cards. The result is not broken, but it feels desktop-heavy and visually noisy
for a tablet posture.

Current implementation anchors:
- `src/app/_components/contact-dashboard.tsx`
- `src/app/_components/labels-sidebar.tsx`
- `src/app/_components/smart-lists-books.tsx`

## Scope

**In scope**
- tablet-specific treatment for the overview left rail
- hierarchy reduction for labels, books, and secondary sections on tablet
- preserving desktop richness and mobile clarity while improving the in-between
  breakpoint

**Out of scope**
- a full contacts IA rewrite
- changing mobile bottom-nav behavior
- redesigning the overview cards themselves

## Dependencies

- Audit finding `UX-002` in the June 2026 UX report
- Existing `contact-dashboard` sidebar composition

## Design / Implementation Spec

### Breakpoint target

Focus on tablet portrait and narrow landscape widths where the sidebar is still
visible but the viewport cannot comfortably support full desktop density.

### Desired behavior

- The overview should retain top-level workspace orientation: Overview, People,
  Favorites, Archived, Duplicates, Activity.
- Secondary collections such as Labels, shared-book lists, and personal-book
  management should be visually compressed on tablet.
- The left rail should help with orientation, not behave like the main content.

### Suggested implementation direction

- Keep primary nav visible.
- Collapse or truncate secondary sections behind summary rows, disclosure
  toggles, or "View all" affordances on tablet.
- Reduce the default vertical footprint of Labels and Books.
- Keep the import/export/sync utility links available, but de-emphasized.
- Avoid introducing a second scrolling trap where the rail feels longer than
  the overview body.

### Engineering notes

- Prefer a tablet-only variant in `contact-dashboard.tsx` rather than changing
  the desktop layout for all widths.
- Reuse existing components where possible, but allow tablet-specific props for
  `LabelsSidebar` and `SmartListsBooks` if needed.

## Acceptance Criteria

- At tablet widths, the overview above-the-fold area is dominated by the main
  dashboard content rather than the left rail.
- Primary navigation remains visible and usable without expanding hidden
  sections.
- Labels and books no longer render at full desktop density by default on
  tablet.
- Desktop behavior remains unchanged.
- Mobile behavior remains unchanged.

## Documentation

- [ ] External · users
- [x] Internal · engineering
- [x] Internal · QA
