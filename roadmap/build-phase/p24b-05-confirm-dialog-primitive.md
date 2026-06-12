# P24B-05 — Confirm dialog / action-sheet primitive

## Purpose

A single mobile confirm/destructive-action primitive for archive-all, leave family, revoke device,
sign out, delete, and similar — so destructive flows look and behave consistently.

## Background

Destructive actions exist across settings, family/teams, and contacts but lack a shared mobile dialog;
desktop modals don't translate well to phones. The design language calls for a bottom-sheet/centered
card confirm (spec §D4).

## Scope

**In scope:** `ConfirmDialog` (and/or `ActionSheet`) primitive + the destructive styling.
**Out of scope:** wiring specific actions (consumers adopt it as they're built).

## Design / Implementation Spec

Per spec §D4. Centered card or bottom sheet: 17/700 title, 14 `ink2` body, action row — destructive
primary in `red`, secondary outline `ink2`. Scrim `rgba(20,28,24,0.42)`. Dismiss on scrim tap / cancel.
Reuse `MobileBottomSheet` infra where a sheet is preferred (e.g., multi-option action sheets); use a
centered card for simple yes/no.

## Acceptance Criteria

- One primitive renders a destructive confirm (red primary + outline cancel) and a neutral confirm.
- Scrim dismiss + cancel both close without acting; primary triggers the callback.
- Tap targets ≥44px; respects `prefers-reduced-motion`.

## Risks and Open Questions

- Decide centered-card vs bottom-sheet default; the spec allows either — pick one default and document.
