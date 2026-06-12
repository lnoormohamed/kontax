# P24B-DB17 — Design Brief: Pricing page mobile

## Purpose

Design the mobile pricing layout — 1-column plan cards and a feature comparison that stacks (or scopes
its scroll) — replacing the current right-offset card + non-stacking comparison table.

## Background

The sweep found the hero + Monthly/Annual toggle fit on mobile, but the plan card is offset right and
the comparison table doesn't collapse. Build: **P24B-18**. Plan model: FREE / PRO / FAMILY / TEAMS.

## Scope

**In scope:** mobile design for plan cards, comparison, and CTAs, with current-plan / upgrade states.
**Out of scope:** pricing data and Stripe wiring.

## Design Requirements

### Layout (< 768px)
- **Hero + Monthly/Annual** segmented control — keep (already fits).
- **Plan cards stack to 1 column**, full-width, in plan order (Free → Pro → Family → Teams). Each card:
  name, blurb, price, period, CTA. The user's **current plan** is marked ("Current plan", disabled CTA);
  others show "Upgrade" / "Switch".
- **Feature comparison:** stack into **per-plan feature lists** (each plan card or section enumerates
  its features) rather than a wide matrix. If a matrix is required, use the sticky-column scroll
  helper (P24B-04) scoped to the table region only.

### Tokens & components
Part A tokens; cards radius 14 + hairline border; CTAs full-width (`green` upgrade / outline current).
Current-plan badge uses `green-tint`.

### States to deliver
logged-out · current = Free · current = Pro/Family/Teams · monthly vs annual pricing · upgrade CTA.

### Deliverables
Annotated mobile frames: stacked plan cards (each plan as current), comparison (stacked), and the
Monthly/Annual toggle.

## Acceptance Criteria (design sign-off)

- Plan cards are 1-column, full-width, no right-offset at 375px.
- Comparison does not overflow the page (stacked or scoped-scroll).
- Current-plan / upgrade states designed; CTAs full-width.
- Desktop pricing unaffected by the mobile design.

## Dependencies / Risks

- Decide stacked-cards vs scoped-scroll for the comparison (stacked recommended for phones).
- Implemented by **P24B-18** (depends on P24B-04 if the scroll variant is chosen).
