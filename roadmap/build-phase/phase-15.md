# Phase 15 — Row Context Icons and Contact Designations

## Objective
Give the contacts list a single, governed way to show what a contact *is* and *where it lives* — a consistent trailing icon cluster on each row, backed by the contact detail page for the full story. This phase also introduces the first net-new designation that isn't tied to sharing or sync: the **emergency contact** flag. The icon system is the visual home that the Family (Phase 13), Team (Phase 14), and Live-share (Phase 12) badges plug into, so they read as one coherent vocabulary rather than a grab-bag.

## Success Criteria
- A contact row can display membership badges (family / team / live-shared) and designations (favorite / emergency) through one shared icon component with consistent glyphs, tooltips, and accessibility.
- The icon cluster is capped and prioritised so rows never become icon soup — scannability at 500+ contacts is preserved.
- Users can mark a contact as an emergency contact, see it on the row and detail page, and filter to emergency contacts.
- Each badge's meaning is identical across the row, the sidebar, and the contact detail page.

## Exit Criteria
- A shared `ContactBadgeCluster` component exists and is the only place row context icons are rendered.
- `Contact.isEmergency` exists and is wired into create/edit, the row cluster, the detail page, and a sidebar/quick filter.
- Family, team, and live-share badges (built in their own phases) render through this component rather than ad-hoc markup.

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P15-01 | Not Started | P1 | P8-01c |
| P15-02 | Not Started | P1 | P15-01 |
| P15-03 | Not Started | P2 | P15-01, P10-01 |
| P15-04 | Not Started | P2 | P15-01 |

---

## P15-01 — Row context icon system (shared badge component)
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P8-01c`
- Implementation Notes:
  - Build a single `ContactBadgeCluster` component that renders a contact's context icons as a governed, capped set. This is the only place row context icons are rendered — family, team, live-share, favorite, and emergency badges all route through it.
  - Define a badge registry with, per badge: stable id, glyph/icon, accessible label template, tooltip text, tint, and priority rank.
  - Two badge categories, kept visually distinct:
    - **Membership / source:** family, team/org directory, live-shared, (optional) synced.
    - **Designations:** favorite, emergency, labels.
  - **Cap at 2–3 visible icons per row.** When more apply, render the highest-priority badges plus a `+N` affordance; the contact detail page shows the full set.
  - Icons are quiet by default — monochrome/tinted line icons, not full color. Reserve color for urgent states (emergency = subtle red).
  - Every icon carries an `aria-label`; tooltips on hover give the human-readable meaning ("Shared with Smith Family"). No icon-only meaning.
  - The same component (and registry) is reused on the contact detail page in an expanded form that spells each badge out.
  - This ticket ships the component with only the already-built badge (favorite) wired through it; family/team/live-share badges adopt it as those phases land.
- Acceptance Criteria:
  - One shared component renders all row context icons; no ad-hoc badge markup elsewhere.
  - The cluster caps at 2–3 with a `+N` overflow affordance.
  - Glyphs, labels, and tooltips are defined in one registry and identical across row, sidebar, and detail.
  - All icons have accessible labels and hover tooltips.
  - Favorite renders through the component without visual regression.
- Risks / Open Questions:
  - Priority order when multiple badges apply needs a product decision (e.g. emergency > live-shared > family > team > favorite). Document the ranking in the registry.
  - The optional "synced" badge may be noise on every contact once device sync is common — evaluate before enabling it by default.

---

## P15-02 — Emergency contact designation
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P15-01`
- Implementation Notes:
  - Add `isEmergency Boolean @default(false)` to the `Contact` model (mirrors the existing `isFavorite` pattern). Index alongside the existing favorite/active indexes if a dedicated emergency filter query is added.
  - Add a `toggleEmergencyContact` server action mirroring `toggleFavoriteContact`.
  - Surface the toggle in the contact create/edit flow and as a quick action on the contact detail page.
  - Render the emergency badge through the `ContactBadgeCluster` (P15-01) — subtle red, high priority so it surfaces even when other badges are present.
  - Add an "Emergency contacts" quick filter (sidebar sub-filter or a saved filter) so a user can pull up just their emergency contacts fast — this is the whole point of the designation.
  - Emergency status is Kontax-local user state for v1 (like favorites); do not attempt to translate it into first-wave CardDAV/vCard semantics. Document this decision.
- Acceptance Criteria:
  - A user can mark/unmark a contact as an emergency contact from create/edit and the detail page.
  - The emergency badge appears on the row (via the shared cluster) and on the detail page.
  - An emergency-contacts filter returns only flagged contacts.
  - Migration adds `isEmergency` cleanly with a `false` default; existing contacts are unaffected.
- Risks / Open Questions:
  - Whether emergency contacts should ever sync to a device's native "emergency/ICE" concept is out of scope for v1 — note as a future exploration.
  - Decide whether emergency is a standalone flag or a reserved system label; v1 recommendation is a standalone flag (like favorite) for query simplicity.

---

## P15-03 — Family-shared status on the contact detail page
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P15-01`, `P10-01`
- Implementation Notes:
  - Beyond the row badge, the contact detail page gets a "Shared with your family" section for contacts in a shared family book: member access list, who can edit, and "Last updated by [member] · [time]" attribution (sourced from the activity log / `ActivityEvent`).
  - Make shared status visible *before* edit so users understand a change propagates to everyone in the family book.
  - States: synced/healthy, recently changed by another member, this member's edit pending/propagating, view-only (member without edit rights).
  - This is the detail-page counterpart to the Phase 13 family work; it depends on the badge system (P15-01) and activity attribution (P10-01) and should be sequenced after Phase 13 ships the shared book itself.
- Acceptance Criteria:
  - A family-shared contact's detail page clearly shows it is shared, who can access/edit, and the last editor + time.
  - Shared status is visible before the user begins editing.
  - All four states render correctly.
- Risks / Open Questions:
  - Overlaps with Phase 13 family surfaces — confirm whether this lives here or folds into the Phase 13 contact-detail work to avoid duplication.

---

## P15-04 — Sidebar and filter integration for designations
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P15-01`
- Implementation Notes:
  - Wire the designation filters into the contacts workspace: Favorites already exists; add Emergency as a quick filter; ensure membership-based views (Family, Team books) live in the sidebar shared-book section, not mixed into personal filters.
  - Ensure the badge cluster, sidebar grouping, and filters use the same registry/labels so the vocabulary is consistent end to end.
- Acceptance Criteria:
  - Designation filters (favorites, emergency) and membership groupings (family/team books) are reachable from the sidebar.
  - Filter labels and icons match the badge registry exactly.
- Risks / Open Questions:
  - Avoid sidebar clutter — if designations grow, consider a collapsible "Filters" group rather than a flat list.
