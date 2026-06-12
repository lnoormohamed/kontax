# P24B-18 — Pricing page mobile (stacked plan cards + comparison)

## Purpose

Make the pricing page stack correctly on mobile: 1-column plan cards and a comparison table that
stacks (or scrolls) instead of the current right-offset card + non-stacking table.

## Background

The sweep found the hero + Monthly/Annual toggle fit, but the plan card is offset to the right and the
feature-comparison table doesn't collapse on mobile. Depends on P24B-04 (table→cards).

## Scope

**In scope:** mobile layout for plan cards + comparison table + CTA. **Out of scope:** pricing data /
Stripe wiring.

## Design / Implementation Spec

Per spec §E10. Plan cards stack to **1 column** under `md`, full-width CTAs. The feature comparison
either stacks into per-plan cards (each plan lists its features) or uses the P24B-04 sticky-column
scroll. Monthly/Annual segmented control stays. Current-plan state and Upgrade CTA reflect the user's plan.

## Acceptance Criteria

- Plan cards are 1-column and full-width at 375px; no right-offset.
- The comparison no longer overflows the page (stacked or scoped-scroll).
- CTAs are full-width; current-plan / upgrade states correct.
- Desktop pricing unchanged.

## Risks and Open Questions

- Decide stacked-cards vs scrolled-table for the comparison; stacked is usually clearer on phones.
