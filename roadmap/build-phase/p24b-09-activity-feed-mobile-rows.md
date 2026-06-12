# P24B-09 — Activity feed: mobile event rows + retention + upsell

## Purpose

Render the unlocked activity feed as the design's mobile GroupCard event rows, show the plan's
retention window, and keep the Free-plan upsell distinct from a genuine empty state.

## Background

P24A fixed the locked-card overflow and removed the stray FAB, but the *unlocked* feed still renders
the desktop `ActivityFeed`. The design (`mob-tabs.jsx` `ActivityScreen`) is a GroupCard of compact
event rows.

## Scope

**In scope:** mobile event-row variant of the feed + retention caption + plan variance. **Out of
scope:** the activity API and event schema.

## Design / Implementation Spec

Per spec §E4 and §E0.
- **Rows:** GroupCard; each event = 32px circle `wash` icon · "**Name** · action" (14.5 `ink`) ·
  timestamp (12 `mute`); divider `line2`. Optional lightweight category/actor filter that must not
  overflow (h-scroll chips if needed).
- **Retention caption:** "Showing the last {N} days" (Pro 365 / Family 90 / Teams unlimited).
- **States:** loading skeleton rows; genuine empty = "No activity yet"; **Free** = `UpsellCard`
  ("Activity log is a Pro feature") — never the empty state.

## Acceptance Criteria

- Unlocked feed renders mobile event rows (no desktop component / no overflow).
- Retention caption reflects the plan; load-more works on scroll.
- Free shows the upsell card (fits `max-w-[460px]`), not "No activity yet".
- Desktop activity unchanged.

## Risks and Open Questions

- Reuse the existing `/api/activity` data; only the row presentation changes.
- Keep the desktop `ActivityFeed` and branch on viewport, or extract a shared data hook + two
  presentational layers — prefer the latter to avoid divergence.
