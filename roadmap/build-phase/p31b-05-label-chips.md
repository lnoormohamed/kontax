# P31B-05 — Label Chips on Rows & Detail

## Purpose

Render labels consistently as colored chips wherever a contact is shown — the
contacts list rows and the contact detail page — sourced from the registry colors.

## Background

Labels are currently stored on the contact but not surfaced as chips in the
workspace list or detail. With registry colors from P31B-01, a single chip
component can render them consistently. The bulk "Add label" popover and the
create form already deal in label strings; this ticket is about *display*.

## Scope

**In scope**
- A reusable `LabelChip` (color dot/fill + name) used on contact rows
  (`contacts-workspace-table.tsx`) and contact detail (`contacts/[id]/page.tsx`).
- Colors resolved from the registry (fallback to a neutral when a label has no
  registry entry yet).
- Sensible truncation/overflow (e.g. "+N" when a contact has many labels in the
  compact row).

**Out of scope**
- Registry (P31B-01), sidebar (P31B-02), filter (P31B-03), management (P31B-04).

## Design / Implementation Spec

### Chip
- Small pill: color dot or tinted background + label name, matching the locked
  system (reuse the label color tokens; no new colors).
- Clicking a chip may navigate to that label's filter (`?label=<name>`) — optional
  but natural; align with P31B-03.

### Placement
- **Row (compact):** show up to ~2 chips inline with a "+N" overflow; the cozy
  row can show more.
- **Detail:** show all labels as chips in the contact header/meta area.

### Data
- The contact already carries `labels`; resolve each to a registry color via a
  passed-in color map (built once per page, like the label suggestions are today).

## Acceptance Criteria
- Labels render as consistent colored chips on rows and detail.
- Colors come from the registry; an unknown label falls back to a neutral chip.
- Compact rows handle overflow gracefully ("+N").
- No new colors outside the locked system.

## Risks / Open Questions
- Row density: cap inline chips so the grid layout stays clean.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/
