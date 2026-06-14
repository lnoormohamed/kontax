# P31B-02 — "Labels" Sidebar Section

## Purpose

Replace the hardcoded "Labels" placeholder in the contacts sidebar with a real
section that lists the user's labels (color + name + count) and lets them create
a label and open the per-label actions menu.

## Background

`contact-dashboard.tsx` renders a placeholder Labels block with three hardcoded
entries (`Family`, `Work`, `VIP`) and a non-functional "Create label". With the
registry from P31B-01, this becomes a live section styled like the "My Lists" and
"Books" sections shipped in P28-03 (`smart-lists-books.tsx`).

## Scope

**In scope**
- A live Labels section: section header (11px/700/uppercase/`#8b938c`) + "+ New
  label"; rows with a color dot + name + non-archived contact count; active state
  when the list is filtered to that label; hover `⋯` (Rename / Recolor / Merge /
  Delete → P31B-04).
- Inline "create label" affordance.

**Out of scope**
- The label filter behavior (P31B-03), management operations (P31B-04), chips (P31B-05).

## Design / Implementation Spec

### Placement & styling
- Below "Books" / "Shared", mirroring the `SmartListsBooks` section components
  (reuse the section-header + row + context-menu patterns already built).
- Row: color dot (8–9px) + name (truncate) + count; on hover, count → `⋯`.
- Active row uses the green left-bar + tint (same as active smart list).

### Data
- The dashboard server component loads the registry (P31B-01) with per-label
  counts (a `groupBy`/count over `Contact.labels`, archived excluded), and passes
  them to a client island (like `personalBooks` / `savedFilters`).
- Counts follow the same approach as the personal-book counts already computed in
  `page.tsx`.

### Interactions
- Clicking a label navigates to the label filter (`?label=<name>`, P31B-03).
- "+ New label" and the `⋯` menu open the management surface (P31B-04).

## Acceptance Criteria
- The sidebar shows the user's real labels with colors and counts (no placeholder).
- Active label is highlighted when the list is filtered to it.
- The section matches the My Lists / Books styling.
- "+ New label" and the per-row `⋯` menu are present and wired (behavior in P31B-03/04).

## Risks / Open Questions
- Count query cost with many labels — bound it the way book counts are bounded.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [ ] Internal · engineering — docs/
