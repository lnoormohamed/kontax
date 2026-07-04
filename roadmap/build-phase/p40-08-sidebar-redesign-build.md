# P40-08 — Sidebar redesign implementation

Status: Partial (uncommitted, 2026-07-04) · Priority: P1 · Depends: [P40-DB01](p40-db01-design-brief-books-first-navigation.md), [P40-06](p40-06-read-write-cutover.md)

## Implementation progress (2026-07-04)

**Done:**
- **Books-first sidebar** — `smart-lists-books.tsx` reordered so **Books** sits
  above **My Lists** (Labels already below). Counts/active/rename/manage/archive
  affordances unchanged (regression-free). Per P40-DB01 §1.
- **Membership server actions** — `src/app/actions/contact-books.ts`
  (`addContactToBook`, `removeContactFromBook` [blocks last book, syncs primary],
  `setContactPrimaryBook`) wrapping the P40-06 helpers with auth + `bookId`
  dual-write. The backend the detail "Books" block calls.

**Remaining (needs running app + real-device loop — handed off against the brief):**
- Detail **"Books" block** component (chips + "Add to book" + block-remove-last +
  set-primary), P40-DB01 §3 — wire into `/contacts/[id]`.
- **Migration explainer** — one-time dismissible banner keyed on a
  `User.preferences` flag; existing users only, never new accounts (§7).
- **Mobile** nav mirror (Books section in `mobile-filter-sheet.tsx`) + detail
  chips at touch sizes; **verify on a real device** (preview can't emulate touch).
- Sidebar visual QA of all brief states (empty book, >8 overflow, drag/reorder,
  shared-book badge) at desktop/tablet/mobile.
Phase: [Phase 40](phase-40.md) · Source spec: [phase-37/01 §8](../phase-37/01-data-model-build-now.md)

## Scope

Books become the primary navigation axis, to P40-DB01's spec; the existing
Labels (P31B) and My Lists sections are preserved beneath. Includes the
migration moment for existing users (one-time dismissible explainer, per the
brief) and the mobile nav mirror (roadmap/mobile-design-brief.md).

## Acceptance

- Sidebar states from the brief implemented (default, empty book, overflow,
  shared-book badge, active); labels and lists sections regression-free
  (label filter → save-as-list flow still works).
- Mobile nav verified on a real device.
- Migration explainer shows once per existing user, never for new accounts.
