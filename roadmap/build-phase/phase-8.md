# Phase 8 — Contact Workspace Redesign And Rich-Field Productization

## Objective
Turn the contacts homepage into the base product surface for Kontax by making it calmer, denser, more list-driven, and more aligned with the interaction model users already understand from tools like Google Contacts.

## Success Criteria
- The contacts homepage feels like the primary operating surface for Kontax, not a temporary dashboard.
- Primary navigation, search, create flow, import/export, duplicates, archived records, and settings all have clear homes.
- The contact list becomes the visual anchor of the product and establishes a design language the rest of the app can follow.

## Exit Criteria
- Kontax has a stable list-first contact workspace shell.
- Header, tabs, and create-contact flow are coherent enough to extend into later phases.
- Account and plan controls no longer compete visually with contact management on the homepage.

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P8-01 | Done | P0 | P1-06, P3-06, P4-06 |
| P8-01a | Done | P0 | P8-01 |
| P8-01b | Done | P0 | P8-01a |
| P8-01c | Done | P1 | P8-01 |
| P8-02 | Done | P1 | P8-01 |
| P8-03 | In Progress | P1 | P8-02 |

## P8-01 — Rebuild the contacts homepage as the primary workspace
- Status: `Done`
- Priority: `P0`
- Dependencies: `P1-06`, `P3-06`, `P4-06`
- Implementation Notes:
  - Move away from a stacked dashboard-card composition and toward a list-first contact workspace.
  - Use a calmer, cleaner shell inspired by Google Contacts and other mature contact tools: strong search, obvious create action, persistent navigation, tabbed list states, and a dense readable grid.
  - Treat the contacts page as the design baseline for the rest of Kontax rather than a temporary stopgap.
  - This ticket now acts as the umbrella for `P8-01a` and `P8-01b`.
  - The current delivered slice now includes a rebuilt header, tabbed workspace states, URL-backed search/filter/sort/view controls, denser row presentation, and hover-driven desktop row actions.
- Acceptance Criteria:
  - The homepage is unmistakably a contact workspace.
  - The contact list is the primary visual focus.
  - Navigation and global actions are clearer than in the previous dashboard version.
  - The default experience feels tab-first and list-first rather than card-first.
- Risks / Open Questions:
  - The team should keep the shell neutral enough that future CRM-like expansion does not make the consumer product feel too enterprise-heavy.

## P8-01c — Add real favorites/starred contact support
- Status: `Done`
- Priority: `P1`
- Dependencies: `P8-01`
- Implementation Notes:
  - Replace the current `Favorites next` placeholder in the workspace sub-toolbar with a real product capability.
  - Add a lightweight star/favorite model that works for consumer contact habits without introducing heavy tagging or CRM concepts too early.
  - Expose favorites both as a first-class filter on the homepage and as a quick action within the list and contact detail flow.
  - Ensure the favorites model can later feed pinned sections, priority contacts, and mobile-friendly shortcuts.
  - The current delivered slice includes a real `Favorites` workspace filter, quick `Star`/`Unstar` actions in the list, a dedicated favorite quick action on the contact detail page, and pinned-favorites ordering that keeps starred contacts grouped at the top of the primary list.
- Acceptance Criteria:
  - Users can mark and unmark contacts as favorites.
  - The workspace exposes a real favorites filter instead of placeholder UI.
  - Favorited contacts can be recognized and reached quickly from the main list, not only through a separate filter.
  - Favorites persist cleanly across list view, detail view, import/export expectations, and future sync planning.
- Risks / Open Questions:
  - We should still decide whether favorites belong only to local user preference state or should be treated as portable contact metadata in exports and sync.

## P8-01a — Header, tabs, and settings architecture reset
- Status: `Done`
- Priority: `P0`
- Dependencies: `P8-01`
- Implementation Notes:
  - Replace the previous homepage header with a cleaner workspace header built around search, import/export access, create contact, and user identity.
  - Introduce a tabbed contact workspace model for `People`, `Archived`, and `Duplicates`.
  - Move account and plan information into a dedicated settings page so contact management stays focused.
  - Remove copy and framing that feels like a generic dashboard, including language like “Your contact desk.”
- Acceptance Criteria:
  - The header feels like product chrome, not a landing-page fragment.
  - Account controls are no longer embedded in the main contacts workspace.
  - Users can move between list states through obvious tabs instead of scanning multiple stacked panels.
- Risks / Open Questions:
  - If additional top-level areas arrive later, the header may need one more navigation pass to avoid crowding.

## P8-01b — Remove quick-add and replace it with a proper create-contact flow
- Status: `Done`
- Priority: `P0`
- Dependencies: `P8-01a`
- Implementation Notes:
  - Remove the homepage quick-add block and preview rail.
  - Replace the broken create-contact anchor with a dedicated `/contacts/new` route.
  - Make creation feel intentional and consistent with the richer data model already present in Kontax.
  - Preserve the richer structured fields where useful, but keep the first save path understandable.
- Acceptance Criteria:
  - The primary “Create contact” action works reliably.
  - Homepage clutter is reduced by removing quick-add and preview rails.
  - The new create-contact route fits the redesigned workspace language.
- Risks / Open Questions:
  - Later product passes may still want modal or drawer creation, but the dedicated route is the cleaner base for now.

## P8-02 — Refine the contact detail page around the denser homepage
- Status: `Done`
- Priority: `P1`
- Dependencies: `P8-01`
- Implementation Notes:
  - Reframe contact detail editing so it feels like a natural extension of the denser list-first homepage.
  - Keep grouped editing sections while making the page easier to scan.
- Acceptance Criteria:
  - Contact detail view feels consistent with the homepage redesign.
  - Richer fields remain usable without making the page feel overwhelming.
- Risks / Open Questions:
  - The edit page may still need a second pass once the new homepage interaction model settles.

## P8-03 — Bring richer field support into the product surface
- Status: `In Progress`
- Priority: `P1`
- Dependencies: `P8-02`
- Implementation Notes:
  - Ensure richer field support is visible and usable in product flows rather than living only in schema and background logic.
  - Extend the creation flow and field-coverage visibility so structured data feels first-class.
- Acceptance Criteria:
  - Users can create and maintain richer contact records without needing hidden or purely technical flows.
  - Structured field depth is visible enough to influence how users trust imports, exports, and sync readiness.
- Risks / Open Questions:
  - We still need a follow-on pass for deeper import/export and merge parity on the richer fields.
