# P24B-01 — Mobile plain-title header component

## Purpose

Extract the repeated "plain title + bell" mobile header (used by the Activity, Sync, and Settings tab
roots) into one shared `MobilePlainHeader` component so chrome is identical across tabs and future
screens reuse it instead of re-inlining markup.

## Background

P24A added 52px mobile headers inline in `sync/page.tsx`, `settings/layout.tsx`, and via
`MobileHomeHeader` (activity title variant). They drift independently. The design (`mob-tabs.jsx`
`PlainHeader`) is a single primitive: 52px, left 19/700 title, right bell.

## Scope

**In scope:** new `MobilePlainHeader` component; adopt it in Activity (already a title), Sync, and
Settings roots. **Out of scope:** the Home header (wordmark+search) and the Secondary (back) header —
those stay distinct variants.

## Design / Implementation Spec

Per spec §B1 (variant 2). Component: `MobilePlainHeader({ title, userId })` — 52px, `paper` bg, 1px
`line` bottom border, sticky `top:0` `z-40`, `padding 0 16`. Left: title 19/700 `#1d2823`, `flex:1`.
Right: `NotificationBellSlot` (existing). `className="... md:hidden"`.

Replace the inline headers in `sync/page.tsx` and `settings/layout.tsx`; keep the activity title path
(`MobileHomeHeader tab="activity"`) or migrate it to this component for consistency.

## Acceptance Criteria

- One component renders the Sync, Settings, and Activity mobile headers identically (52px, 19/700 title, bell).
- No visual change vs current P24A headers; desktop unchanged.
- No duplicate header markup remains in `sync/page.tsx` / `settings/layout.tsx`.

## Risks and Open Questions

- Settings sub-pages will instead use the Secondary header (P24B-02) — `MobilePlainHeader` is for the
  Settings *root* only. Keep them composable.
