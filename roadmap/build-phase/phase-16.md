# Phase 16 — Contacts List Rebuild (Sidebar Shell + Column Rows)

## Objective
Rebuild the main contacts page (`/`) into the approved design: Direction A's left-sidebar shell with Direction B's column rows, in the real app style. This replaces the Phase-8 tabbed-card workspace. It is the canvas almost every later phase paints onto — the inline row badge cluster (Phase 15), family sidebar section and badges (Phase 13), share/live badges (Phase 12), activity tab (Phase 10), and team books (Phase 14) all layer onto this shell.

## Build order
**Build this BEFORE Phases 10–15.** Phase numbers are not strict build order in this roadmap — the dependency map governs sequence. Building 10–15 onto the old Phase-8 workspace and then swapping in this shell would mean redoing all that UI integration. This phase delivers the shell those phases extend. It also delivers Phase 15's `ContactBadgeCluster` component (P15-01) as P16-03; Phase 15's remaining tickets (emergency flag, family-shared detail, filters) build on it afterwards.

## Design source
- Design brief: `roadmap/design-briefs/01-contacts-list.md` (chosen direction + default state + row context icons).
- Approved production mock: Claude Design bundle `Contacts List.html` (`cx-kit.jsx` / `cx-list.jsx` / `cx-app.jsx`) — palette `#17352e` / `#4158f4` / `#d8ddd6`, Geist, straight corners.
- Render in the real app style; the wireframe Caveat/sketch look is not the target.

## Success Criteria
- `/` lands on a left-sidebar shell with column rows (Compact default), wired to the real contact data and existing server actions.
- Favorites pin above alphabetical groups; grouping follows sort/search rules; bulk-select works via the hover-checkbox pattern.
- The inline `RowBadges` cluster (favorite toggle + status badges) sits next to the name; no persistent trailing star.
- Duplicates, Archived, empty, search, and banner states all render in the new shell.
- Mobile (<768px) collapses to cozy two-line rows + bottom nav.

## Exit Criteria
- The Phase-8 tabbed-card workspace is fully replaced; no regressions in favorite/archive/restore/delete/search/sort.
- Typecheck, lint, and production build pass.

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P16-01 | Done | P0 | P8-01 |
| P16-02 | Done | P0 | P16-01 |
| P16-03 | Done | P0 | P16-02 |
| P16-04 | Done | P1 | P16-02 |
| P16-05 | In Progress | P1 | P16-02 |
| P16-06 | Done | P1 | P16-02 |
| P16-07 | Not Started | P1 | P16-02 |

> Build status: P16-01/02/03/04/06 landed (sidebar shell, column rows, inline RowBadges, bulk-select, duplicates+archived). P16-05 partial — search + empty states done; plan-limit / lifecycle / sync banners still to add. P16-07 (mobile bottom nav) not started — sidebar currently hides below `lg` with no replacement nav; list itself falls back to cozy rows. Verified via tsc + lint + production build; visual/logged-in review still pending.

---

## P16-01 — Sidebar shell + header (Direction A)
- Status: `Not Started`
- Priority: `P0`
- Dependencies: `P8-01`
- Implementation Notes:
  - Replace the tabbed-card workspace (`contact-dashboard.tsx`) with a persistent left sidebar (≈240px) + list area. Keep the top header full-width above both.
  - Header: wordmark, centered search, Create contact CTA, bell (visual placeholder, no dot unless pending shares), user chip.
  - Sidebar: account chip (name/email/plan badge), primary nav People / Favorites / Archived / Duplicates with live counts (Duplicates amber badge when >0), sub-filters under People (All contacts / Recently updated / Missing details), bottom Import / Export / Sync links with a sync-state dot.
  - Nav + filters drive existing URL params (`tab`, `filter`, `sort`, `view`, `q`). Favorites = `filter=favorites`.
  - Compute stable sidebar counts in `page.tsx` (people/favorites/archived totals via `db.contact.count`, duplicates from merge suggestions) so counts don't shift with the active filter.
- Acceptance Criteria:
  - `/` renders the sidebar shell; nav and sub-filters update the list via URL params.
  - Counts are stable and accurate regardless of the active filter/search.
  - Sync dot reflects ok/warning/error and links to `/sync`.
- Risks / Open Questions:
  - Labels and shared-book sidebar sections are future (Phase 13/15) — leave structural room, don't build dead UI.

## P16-02 — Column rows (Direction B) with grouping
- Status: `Not Started`
- Priority: `P0`
- Dependencies: `P16-01`
- Implementation Notes:
  - Rebuild the list as a column table: sticky header (Name · Company · Email · Phone), Compact density as default, Cozy two-line as a toggle.
  - Favorites pinned above the groups (active mode, not searching). Alpha group dividers when sort = Name; flat list when sort = Recently updated; flat + highlighted during search with favorites un-pinned.
  - Empty email/phone/company cells show `—`. Phone uses tabular-nums.
  - Wire to real data from `page.tsx`; preserve per-row open (link to `/contacts/[id]`).
- Acceptance Criteria:
  - Columns render with sticky header; density toggle works; grouping follows sort/search rules; favorites pin correctly.
- Risks / Open Questions:
  - Group letter = first letter of last name (fallback company), matching the existing sort key.

## P16-03 — Inline RowBadges cluster (delivers P15-01)
- Status: `Not Started`
- Priority: `P0`
- Dependencies: `P16-02`
- Implementation Notes:
  - Build the shared `RowBadges` cluster inline after the name in both column and cozy rows: favorite toggle (hover-reveal when not starred, filled+persistent when starred) + `StatusBadges` (family/team/live/emergency), capped at 2 visible + `+N` overflow, `aria-label` + tooltip per icon, emergency in red.
  - Trailing cell = `RowActions` (edit/more, hover-revealed) only — **no persistent trailing star**.
  - This is the Phase 15 `ContactBadgeCluster` (P15-01). Only the favorite is wired live now; family/team/live/emergency badges read from contact flags as those phases land. Mark P15-01 satisfied by this ticket.
- Acceptance Criteria:
  - Favorite toggles from the inline cluster; trailing star is gone; status badge slot renders and caps correctly; a11y labels present.
- Risks / Open Questions:
  - Non-favorite star is hover-only (calm default) — favorite status only shows when on. Intentional.

## P16-04 — Bulk select (hover checkbox + contextual bar)
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P16-02`
- Implementation Notes:
  - Avatar→checkbox swap on row hover; header select-all revealed on hover/selection; contextual action bar replaces the toolbar only when something is selected (Favorite / Archive / Export / Delete in active; Restore / Delete in archived). No permanent select-all bar.
  - Preserve existing bulk server actions (`archiveContactsBulk`, `restoreContactsBulk`).
- Acceptance Criteria:
  - Selection works via hover checkboxes; contextual bar shows only on selection; bulk archive/restore function unchanged.

## P16-05 — States (search / empty / banners)
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P16-02`
- Implementation Notes:
  - Search active: flat highlighted list, favorites un-pinned, clear-search affordance.
  - Empty (no contacts): friendly illustration + Add contact / Import. Empty (no match / empty filter): contextual message.
  - Plan-limit banner (approaching/at Free limit), grace/locked lifecycle banner, sync-error indicator near the Sync sidebar link.
- Acceptance Criteria:
  - All states render in the new shell; banners are dismissible/non-blocking; locked state disables create/edit with explanation.

## P16-06 — Duplicates + Archived in the new shell
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P16-02`
- Implementation Notes:
  - Duplicates view keeps the pair-card layout (confidence badge, reasons, Review/Dismiss, Accept-all-high-confidence). Archived view = column rows with Restore / Delete actions.
- Acceptance Criteria:
  - Duplicates pair cards and Archived restore/delete work within the sidebar shell.

## P16-07 — Mobile cozy fallback + bottom nav
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P16-02`
- Implementation Notes:
  - <768px: columns collapse to cozy two-line rows; sidebar becomes a bottom nav (People / Favorites / Archived / Duplicates / More); search collapses to an icon that expands. Tablet drops the Company column.
- Acceptance Criteria:
  - Usable on mobile viewport; no horizontal overflow; bottom nav switches views.
