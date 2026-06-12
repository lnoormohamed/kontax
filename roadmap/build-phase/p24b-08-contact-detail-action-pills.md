# P24B-08 — Contact detail: action pills + scroll-aware header + plan variance

## Purpose

Bring the mobile contact detail to spec: replace the 5 outlined square action buttons with the design's
4 round green-tint action pills, add the scroll-aware compact header, and apply the Free-plan history
cap and Sharing-tab gating.

## Background

The detail is a strong match already (centered header, Details/Sharing/History tabs, field cards, edit
FAB) but the action row uses 5 outlined squares (Call/Email/Fav/Archive/Share) instead of the design's
4 green-tint pills (Call/Message/Email/More) per `mob-detail.jsx`.

## Scope

**In scope:** action-pill row, scroll-aware compact header, Free history cap, Sharing-tab gating, read-
only/permission handling. **Out of scope:** the field/data model.

## Design / Implementation Spec

Per spec §E2 and §E0.
- **Action row:** 4 `ActionPill`s — Call · Message · Email · More — 46px `green-tint` circle, icon 21
  `green`, label 11.5/600. (Favourite/Archive/Share move into "More" or stay as swipe/secondary.)
- **Scroll-aware header:** full centered header (64px avatar, 22/700 name, 14 `ink2` subtitle) scrolls
  away; the secondary header's title fades in past `scrollTop > 60`.
- **Tabs:** Details / Sharing / History, active = 700 + 2.5px green underline. Edit FAB (52px pencil)
  on Details only.
- **Variance:** **Free** → History tab capped to last 3 ("Upgrade for full history"); **Sharing tab
  gated** on Free (UpsellCard, no live/static share). Member without `canEdit` or read-only lifecycle →
  hide Edit + FAB, view-only.

## Acceptance Criteria

- Action row shows 4 green-tint pills matching the design; tapping Call/Message/Email fires the right intent.
- Compact header title fades in on scroll; full header scrolls away.
- Free user sees ≤3 history entries + upsell; Sharing tab shows the upsell on Free.
- No-edit-permission / read-only → no Edit affordances.
- Desktop detail unchanged.

## Risks and Open Questions

- Confirm where Favourite/Archive/Share live now that the row is 4 pills (likely under "More" sheet +
  swipe on the list). Keep parity with current capabilities.
