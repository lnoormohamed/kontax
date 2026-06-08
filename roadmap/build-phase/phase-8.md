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
| P8-03 | Done | P1 | P8-02 |
| P8-03a | Done | P1 | P8-03 |
| P8-03b | Done | P1 | P8-03a |
| P8-03c | Done | P1 | P8-03b |
| P8-03d | Done | P1 | P8-03c |
| P8-03e | Done | P1 | P8-03d |
| P8-03f | Done | P1 | P8-03e |

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
  - Decision made for v1: favorites are `Kontax-local` user preference state. They should influence workspace organization and quick access, but should not be treated as portable export metadata or first-wave CardDAV sync semantics.

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
- Status: `Done`
- Priority: `P1`
- Dependencies: `P8-02`
- Implementation Notes:
  - Ensure richer field support is visible and usable in product flows rather than living only in schema and background logic.
  - Extend the creation flow and field-coverage visibility so structured data feels first-class.
  - The delivered slice now includes richer create-flow identity coverage, visible Pinyin/name-reading fields, settings-driven Pinyin auto-fill, Pinyin-aware search and sorting, main-list rich-field signals, and import/export preservation for name-part and Pinyin fields.
- Acceptance Criteria:
  - Users can create and maintain richer contact records without needing hidden or purely technical flows.
  - Structured field depth is visible enough to influence how users trust imports, exports, and sync readiness.
- Risks / Open Questions:
  - We still need a follow-on pass for richer merge heuristics, richer mobile presentation, and deeper sync parity on these identity fields.

## P8-03a — Expand the create flow for richer identity and structured methods
- Status: `Done`
- Priority: `P1`
- Dependencies: `P8-03`
- Implementation Notes:
  - Make richer contact capture feel intentional instead of hidden behind generic “additional” text areas.
  - Allow organization-only records, add visible secondary labeled methods, and guide users toward structured data that helps import quality and future sync.
- Acceptance Criteria:
  - Users can create person-first or organization-first contacts cleanly.
  - Secondary email, phone, and website fields feel first-class in the create flow.
- Risks / Open Questions:
  - Edit-flow parity needed to stay aligned as field depth grows.

## P8-03b — Bring richer edit and detail parity into the product surface
- Status: `Done`
- Priority: `P1`
- Dependencies: `P8-03a`
- Implementation Notes:
  - Extend the contact detail editing flow so richer fields remain visible and editable after creation.
  - Add Pinyin/name-reading fields to the editable contact identity model.
- Acceptance Criteria:
  - Rich identity fields are editable from the contact detail page, not just during creation.
  - Manual overrides remain available for generated name-reading values.
- Risks / Open Questions:
  - Header and summary presentation may still need a future visual refinement pass.

## P8-03c — Add Pinyin auto-fill controls and visibility
- Status: `Done`
- Priority: `P1`
- Dependencies: `P8-03b`
- Implementation Notes:
  - Add a settings toggle for auto-filling Pinyin and name readings only when those fields are blank.
  - Use Chinese-specific Pinyin generation with fallback transliteration for other non-Latin scripts.
- Acceptance Criteria:
  - Users can enable or disable automatic Pinyin filling in settings.
  - Generated readings never overwrite manually-entered values.
- Risks / Open Questions:
  - Cross-language behavior outside Han-script names remains best-effort rather than locale-perfect.

## P8-03d — Use Pinyin-aware list sorting and placement
- Status: `Done`
- Priority: `P1`
- Dependencies: `P8-03c`
- Implementation Notes:
  - Let stored Pinyin/name-reading fields participate in list ordering when present.
  - Preserve favorites-first ordering and company fallback behavior.
- Acceptance Criteria:
  - Contacts with Han-script names sort naturally when Pinyin is available.
  - Contacts without Pinyin continue to sort sensibly under the existing fallback rules.
- Risks / Open Questions:
  - Future locale-aware sorting may still need a broader abstraction beyond Pinyin-specific handling.

## P8-03e — Surface richer-field signals in the main list
- Status: `Done`
- Priority: `P1`
- Dependencies: `P8-03d`
- Implementation Notes:
  - Add compact inline indicators in the list for Pinyin presence and richer structured completeness.
  - Keep the list single-row and dense while still signaling depth.
- Acceptance Criteria:
  - Users can recognize richer contacts without leaving the main list.
  - Signals remain lightweight enough that the list does not become noisy.
- Risks / Open Questions:
  - The threshold for “rich” completeness may need tuning after more real-world datasets.

## P8-03f — Preserve richer identity fields across import and export
- Status: `Done`
- Priority: `P1`
- Dependencies: `P8-03e`
- Implementation Notes:
  - Preserve first/last name and Pinyin fields in CSV import, CSV export, and vCard export.
  - Keep the data portable enough that richer identity work is not trapped inside Kontax-only UI.
- Acceptance Criteria:
  - CSV import can recognize Pinyin columns.
  - CSV export includes Pinyin columns.
  - vCard export preserves Pinyin/name-reading data with stable custom fields.
- Risks / Open Questions:
  - External clients may ignore custom vCard fields even when Kontax preserves them correctly.
