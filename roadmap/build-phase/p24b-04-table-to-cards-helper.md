# P24B-04 — "Stack table → cards / h-scroll" helper

## Purpose

Provide one reusable pattern for rendering dense, multi-column data on mobile — either stacked into
per-row cards or as a horizontally-scrollable table with sticky lead columns — so the team-permission
matrix, audit logs, and the pricing comparison don't each solve it differently.

## Background

Most settings content is already card-based and fits (verified in the sweep). The remaining wide
surfaces are the **team-owner permission matrix**, **teams/audit log**, and the **pricing comparison
table**. The import preview also needs the sticky-column scroll variant (spec §E7).

## Scope

**In scope:** a `MobileTable` / `StackedRows` helper supporting two modes — (a) stack each row into a
card `< md`, (b) h-scroll with N sticky lead columns. **Out of scope:** the specific pages (consumers
are P24B-13/14/15/18).

## Design / Implementation Spec

Per spec §C and §F. Two modes:

1. **Stacked cards (`< md`)** — each record becomes a card: primary field as heading, remaining
   fields as label/value rows (FieldRow style). Desktop renders the real table.
2. **Sticky-column scroll** — table wrapped in an `overflow-x:auto` region; first 1–2 columns
   `position:sticky; left:0` with a hairline shadow (matches the import preview spec: Name/Email sticky).

API sketch: `<MobileTable columns stickyCount data renderCard />` — picks mode via a prop or breakpoint.

## Acceptance Criteria

- A consumer can render a wide table as stacked cards under `md` with one component.
- The sticky-column scroll mode keeps the lead column(s) pinned while the rest scrolls horizontally.
- No horizontal page overflow (only the table region scrolls).
- Desktop rendering is unchanged for existing tables that adopt it.

## Risks and Open Questions

- The permission matrix (members × books × permission) may be clearer as per-member cards than a
  scrolled grid — decide per consumer in P24B-13.
