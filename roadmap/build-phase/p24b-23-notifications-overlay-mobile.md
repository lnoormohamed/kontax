# P24B-23 — Mobile notifications overlay → to spec

## Purpose

Bring the existing mobile notifications overlay (`notification-bell.tsx`, full-screen `< md`) to the
design language defined in P24B-DB18 — category rows, security-drawer/actionUrl behavior, mark-all-read,
and proper empty/loading states — and fix the overlay so it covers the bottom nav.

## Background

The bell opens a dropdown that becomes a full-screen overlay on mobile (`max-md:fixed inset-0`), with an
empty state and the security drawer. It works but wasn't specced; the bottom nav currently shows through
the overlay, and the rows haven't been verified against the language.

## Scope

**In scope:** the mobile notifications overlay UI to DB18 — header, category rows, security rows,
actionUrl navigation, mark-all-read, empty/loading, settings link, z-index fix. **Out of scope:**
notification generation / digest backends.

## Design / Implementation Spec

Per spec §E14 and brief P24B-DB18.
- **Header:** "Notifications" (19/700) + ✕ (44×44) + "Mark all read" (`blue`) when unread > 0. Overlay
  `z` above the bottom nav (cover it).
- **Rows:** category tile (`CATEGORY_TILE` icon, rounded `wash`/tint) · title 14.5/600 + body 13 `mute`
  + relative time · unread dot/tint. **SECURITY** → security drawer; **actionUrl** → navigate + mark
  read; tap marks read.
- **States:** loading skeleton rows; empty = bell + "No notifications"; error. Optional New/Earlier
  grouping. Link to `/settings/notifications`.
- Categories to render: SECURITY · SHARING · SYNC_STATUS · BILLING · REMINDERS · PRODUCT_UPDATES.

## Acceptance Criteria

- Overlay matches DB18: category rows, security-drawer + actionUrl behavior, unread/read, mark-all-read,
  empty, loading.
- Overlay covers the bottom nav (no nav bleed-through).
- All six categories render with the correct tile; SECURITY opens the drawer.
- Link to notification settings present; verified at 375px.

## Risks and Open Questions

- **Design brief:** P24B-DB18 (search & notifications overlays).
- Keep the desktop dropdown unchanged; only the mobile overlay changes.
