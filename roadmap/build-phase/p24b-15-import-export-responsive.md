# P24B-15 — Import / export wizard responsive (mobile)

## Purpose

Make the 4-step import wizard (Upload → Map fields → Preview → Done) and the export panel work on
mobile — single-column steps, 2×2 source chips, and a sticky-column preview table — while keeping the
richer field-mapping functionality.

## Background

`/import-export` uses the desktop multi-step wizard (with the new field-mapping step). Decision locked
(2026-06-12): **adapt the wizard responsively**, don't revert to the prototype's simpler segmented
screen. Depends on P24B-04 (sticky-column table) and P24B-03 (quota/upsell variance).

## Scope

**In scope:** mobile layout for all four import steps + export, plus quota/export plan variance.
**Out of scope:** the import parsing / column-classifier logic (already built).

## Design / Implementation Spec

Per spec §E7 and §E0.
- **Chrome:** secondary header ("Import & Export") + bottom nav. Top segmented **Import / Export**.
- **Import steps (single column):** source picker as a **2×2 chip grid**; "Choose CSV file" full-width
  `blue` 56px; **Map fields** as stacked field→column rows; **Preview** as a bordered table that
  **h-scrolls with sticky Name/Email columns** (P24B-04); commit full-width `green`.
- **Export:** format radio cards (CSV / vCard) + summary + full-width `blue` "Export".
- **Variance:** Free import quota 3/mo (meter + at-limit block + Upgrade); Free export = basic only
  (premium/filtered export gated → upsell). Read-only → export allowed, import disabled.

## Acceptance Criteria

- All four import steps usable at 375px (no horizontal page overflow; only the preview scrolls).
- Preview keeps Name/Email columns pinned while the rest scrolls.
- Field-mapping step works on mobile.
- Export format selection + download works.
- Free quota meter + at-limit block; premium export gated; read-only import-disabled/export-allowed.

## Risks and Open Questions

- The mapping step can be wide (many columns) — confirm the stacked field→column layout scales to
  large CSVs; consider a per-column accordion if needed.
