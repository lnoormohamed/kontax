# P24B-DB20 — Design Brief: Activity feed (mobile rows)

## Purpose

Design the mobile **Activity feed** properly — the design's `GroupCard` event rows — instead of
reusing the desktop `ActivityFeed` component. Define the row, filters, grouping, expandable detail,
retention, and plan states.

## Background

Activity is a bottom-nav tab (Plain "Activity" header). The desktop feed (`activity-feed.tsx`) has the
real data model we must present: 14 event types each with an icon + tint, a relative timestamp, an
actor label, and (for edits) an expandable field-diff table. Filters exist: **category**
(all/edits/sync/imports/merges/shares) and **actor** (all/you/sync/import/shared). Retention is
plan-gated; the API paginates by cursor.

Event types + tints (from `EVENT_META`): `CONTACT_CREATED` (plus/green), `CONTACT_UPDATED`
(pencil/blue), `CONTACT_ARCHIVED` (archive/amber), `CONTACT_RESTORED` (restore/green),
`CONTACT_DELETED` (trash/red), `CONTACT_MERGED` / `MERGE_UNDONE` (merge/grey), `CONTACT_IMPORTED`
(upload/grey), `CONTACT_SHARED` / `SHARE_RECEIVED` (share-download/blue), `SYNC_PULLED` (cloud) /
`SYNC_PUSHED` (sync) / `SYNC_CONFLICT_DETECTED` (warn/amber) / `SYNC_CONFLICT_RESOLVED` (check/green).

Build: **P24B-09** — redo against this brief. Spec §E4.

## Scope

**In scope:** the mobile feed — chrome, event row, grouping, filters, expandable diff, retention
caption, loading/empty, and plan states. **Out of scope:** the desktop feed (unchanged); the activity
API/data (reuse `/api/activity`).

## Design Requirements

### Chrome
Plain "Activity" header + bottom nav (no FAB).

### Event row (the core)
`GroupCard` containing rows. Each row:
- **Icon circle** 32px, `wash` background, the event's tint colour, 14–17px glyph.
- **Body:** "**Name** · <summary>" (14.5/600 name link in `blue` when the contact exists; 13–14 `ink2`
  summary). When there's no contact (global), just the summary.
- **Timestamp:** relative (e.g. "2h", "Yesterday"), 12 `mute`, right-aligned.
- **Expandable diffs (edits):** an inline "N changes" affordance that expands a compact before→after
  list (field · old → new). Tap to expand/collapse. Keep it lightweight on mobile (no wide table).
- Divider `line2` between rows.

### Grouping
Optional "New" / "Earlier" or day grouping via the existing group headers. Confirm whether to group by
day or keep a flat reverse-chronological list with a retention caption.

### Filters
Category + actor as a **horizontally-scrollable chip row** under the header (must not overflow). Active
chip = filled; idle = outline. "Clear" when filtering.

### Retention caption
"Showing the last {N} days" (Pro 365 / Family 90 / Teams unlimited) at the top or bottom of the list.

### States
- **Loading:** skeleton rows (icon circle + two text lines), not a bare spinner.
- **Empty (genuine):** "No activity yet" — distinct from the upsell.
- **Free (locked):** `UpsellCard` ("Activity log is a Pro feature") — **never** the empty state.
- **Load-more:** on scroll (cursor pagination); show a spinner row while loading more.

### Variance (per DB14)
Free → upsell. Pro 365-day / Family 90-day / Teams unlimited retention (caption reflects it). Read-only
lifecycle still shows the feed (read).

### Deliverables
Annotated frames: feed (several event types incl. sync + merge), edit row expanded (diffs), filters
applied, loading skeleton, genuine empty, Free upsell.

## Acceptance Criteria (design sign-off)

- Mobile feed uses GroupCard event rows (no desktop component, no horizontal overflow).
- All event types render with the correct tint + glyph + summary; edits expand to a compact diff.
- Filters (category/actor) work as a scrollable chip row; retention caption reflects the plan.
- Loading skeletons, genuine-empty, and Free-upsell are all distinct and correct.
- Load-more works on scroll.

## Dependencies / Risks

- Reuse `/api/activity` (cursor, category, actor, retentionDays) — presentation only.
- Decide grouping (day vs flat) and the expandable-diff mobile treatment.
- Implemented by **P24B-09**; variance per **P24B-DB14**.
