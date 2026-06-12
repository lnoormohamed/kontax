# P24B-DB16 — Design Brief: Merge surfaces (restyle + mobile compare)

## Purpose

Design the merge surfaces (`/merge/manual`, `/merge-suggestions/[id]`) in the Kontax light design
system and define the mobile **stacked A/B compare** with survivor selection. These pages are currently
off-brand (dark/cyan dev-scaffold) and undrawn for mobile.

## Background

The 2026-06-12 sweep found `/merge/manual` renders in a dark navy/cyan theme with "Ticket P4-03" copy —
not the design system, broken on every viewport. `/merge-suggestions/[id]` likely shares it. Build:
**P24B-17**.

## Scope

**In scope:** light-system restyle of both merge surfaces (desktop + mobile) and the mobile stacked
compare design. **Out of scope:** the merge engine / deterministic-preview logic.

## Design Requirements

### Chrome
Secondary header ("Review merge" / "Manual merge") + bottom nav (mobile).

### Tokens
Replace all dark/cyan with Part A light tokens. No "Ticket Pn" copy. Use FieldCard/FieldRow, segmented/
select pickers, `green` primary / outline cancel.

### Manual merge
Contact A / Contact B pickers as standard selects (label 12/600 + select). "Load merge preview" `blue`.

### A/B compare (mobile)
- **Stack vertically:** Record A card, then Record B card, **field-by-field**.
- Per-field **keep** choice (which value survives) using a clear control (radio/toggle per field).
- Explicit **Survivor** selector (which record is the base).
- **Deterministic preview card** showing the merged result before commit.
- Primary `green` "Merge" + outline "Cancel".

### Suggestion review (`/merge-suggestions/[id]`)
Same compare pattern, pre-populated from the suggested pair; confidence indicator if present.

### States to deliver
default · field-conflict (both sides differ) · no-conflict · preview · merging · success/undo.

### Deliverables
Annotated light-system frames for: manual picker, stacked A/B compare (mobile + desktop), preview, and
the suggestion-review variant.

## Acceptance Criteria (design sign-off)

- Both surfaces fully in the Kontax light system (no dark/cyan, no dev-ticket copy) on all viewports.
- Mobile A/B compare stacks and is usable at 375px; survivor + per-field keep are clear.
- Deterministic preview retained in the design.

## Dependencies / Risks

- Partly a **desktop** restyle — confirm both viewports are in scope here.
- Need a duplicate pair / suggestion id seeded to validate end-to-end.
- Implemented by **P24B-17**.
