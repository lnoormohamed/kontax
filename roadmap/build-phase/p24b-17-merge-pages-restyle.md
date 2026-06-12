# P24B-17 — Merge pages restyle to the design system + mobile compare

## Purpose

Restyle the merge surfaces (`/merge/manual`, `/merge-suggestions/[id]`) from their off-brand dark/cyan
dev-scaffold theme to the Kontax light design system, and make the A/B compare work stacked on mobile.

## Background

The 2026-06-12 sweep found `/merge/manual` renders in a **dark navy / cyan** theme with "Ticket
`P4-03`" copy — not the light design system, broken on **all** viewports (not just mobile).
`/merge-suggestions/[id]` likely shares it. This is a restyle, not just a mobile tweak.

## Scope

**In scope:** restyle both merge surfaces to the light system; stacked mobile A/B compare; secondary
header + bottom nav chrome. **Out of scope:** the merge engine / deterministic-preview logic.

## Design / Implementation Spec

Per spec §E8.
- **Chrome:** secondary header ("Review merge" / "Manual merge") + bottom nav.
- **Tokens:** replace dark/cyan with Part A light tokens; use FieldCard/FieldRow, segmented/select
  pickers, `green` primary / outline cancel.
- **Manual:** contact A / contact B pickers as standard selects; "Load merge preview" `blue`.
- **Compare:** **stack vertically** on mobile — Record A card, then Record B card, field-by-field —
  with a per-field "keep" choice and an explicit **Survivor** selector; deterministic preview card;
  primary `green` "Merge".
- Desktop also moves to the light system (this fixes desktop too).

## Acceptance Criteria

- Both merge pages render in the Kontax light design system (no dark/cyan theme, no "Ticket Pn" copy).
- A/B compare is usable stacked at 375px; survivor selection + per-field keep work.
- Merge executes via the existing engine; deterministic preview preserved.
- Desktop merge also looks on-brand.

## Risks and Open Questions

- **Design brief:** P24B-DB16 (merge surfaces restyle + mobile compare) — build to its requirements.
- Scope check: this is partly a **desktop** fix. Confirm we restyle both viewports here vs splitting a
  desktop ticket.
- Need a duplicate pair / a suggestion id seeded to verify end-to-end.
