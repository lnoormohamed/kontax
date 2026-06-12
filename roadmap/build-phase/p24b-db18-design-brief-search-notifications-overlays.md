# P24B-DB18 — Design Brief: Search & Notifications mobile overlays

## Purpose

Design the two full-screen mobile overlays opened from the Home header — **Search** and
**Notifications** — to the Kontax mobile language. The P24 prototype only *stubbed* these (toasts:
"Search runs against your cached list", "Notifications open as a full-screen overlay"), so there is no
canonical frame; this brief defines them.

## Background

Both surfaces already exist in the build — `mobile-search-button.tsx` (slide-down search panel) and
`notification-bell.tsx` (dropdown that becomes a full-screen overlay `< md`). Neither was specced or
verified against the design language. Notification model:
`NotificationCategory = SECURITY · SHARING · SYNC_STATUS · BILLING · REMINDERS · PRODUCT_UPDATES`;
feed item = `{ category, title, body, read, actionUrl }`; SECURITY rows open the security drawer,
`actionUrl` rows navigate; `markAll` / `markRead` actions exist. Builds: **P24B-22** (search),
**P24B-23** (notifications).

## Scope

**In scope:** mobile design for the search overlay (field, results, recents, empty/no-match) and the
notifications overlay (header, category rows, security rows, mark-all-read, empty/loading). **Out of
scope:** the search index / notification generation backends; the desktop dropdown (keep as-is).

## Design Requirements

### Shared chrome
Full-screen overlay over the current screen: 52px header (paper, 1px `line` bottom), `z` above the
bottom nav (the overlay should **cover** the bottom nav, not show it through). Slide/fade in per Part A
motion. Dismiss returns to the prior screen.

### Search overlay
- **Header:** search field (rounded, `wash`, search icon, "Search contacts…", 16px input no-zoom,
  autofocus) + "Cancel" text button. Decide: slide-down panel (current) vs full-screen — **brief picks
  full-screen** for results room; confirm.
- **Body states:**
  - **Recents/suggestions** (empty query): recent searches or recently-viewed contacts as list rows.
  - **Results:** 60px contact rows (avatar, name with `#fff0bf` match highlight, secondary line), tap →
    detail. Grouped or flat; show result count.
  - **No match:** centered empty state ("No contacts match '…'").
  - **Offline:** caption that search runs against the cached list.
- **Scope:** all contacts vs current book — define default (all) and whether a scope toggle appears.
- Debounced query updates the `?q=` URL so results deep-link / back works.

### Notifications overlay
- **Header:** "Notifications" title (19/700) + ✕ (44×44). Optional "Mark all read" (`blue` text) when
  unread > 0.
- **Rows:** per item — category tile (rounded `wash`/tinted icon per `CATEGORY_TILE`), title (14.5/600)
  + body (13 `mute`) + relative time; unread indicator (dot / tint). Divider `line2`.
  - **SECURITY** rows → open the security drawer (existing). **actionUrl** rows → navigate + mark read.
  - Tapping marks read.
- **States:** loading skeleton rows; **empty** = centered bell + "No notifications" (current); error.
- **Grouping:** optionally "New" vs "Earlier"; confirm. Link to notification **settings**
  (`/settings/notifications`) from a header affordance or footer.

### Plan / lifecycle variance (per P24B-DB14)
- Notifications are not plan-gated, but categories reflect the user's surface (e.g., BILLING only when
  relevant; SHARING/SYNC presence depends on usage). Read-only lifecycle still shows notifications.
- Search works on all plans (Free searches the capped list; same UI).

### Deliverables
Annotated frames: search (recents, results, no-match, offline) and notifications (feed with each
category, security row, unread vs read, mark-all-read, empty, loading).

## Acceptance Criteria (design sign-off)

- Both overlays specified to Part A tokens + Part B chrome; overlay covers the bottom nav.
- Search defines recents / results / no-match / offline; result rows match the list-row spec with match
  highlight.
- Notifications defines all six category rows, the SECURITY-drawer and actionUrl behaviors, unread/read,
  mark-all-read, empty, and loading; link to notification settings.
- Dismiss returns to the prior screen; `?q=` deep-links for search.

## Dependencies / Risks

- Decide search pattern (slide-down vs full-screen) and whether recents are stored.
- Implemented by **P24B-22** and **P24B-23**; variance per **P24B-DB14**.
