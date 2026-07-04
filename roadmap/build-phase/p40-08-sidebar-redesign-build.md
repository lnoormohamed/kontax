# P40-08 — Sidebar redesign implementation

Status: Built — committed 53a42e8 (2026-07-04); real-device mobile QA pending · Priority: P1 · Depends: [P40-DB01](p40-db01-design-brief-books-first-navigation.md), [P40-06](p40-06-read-write-cutover.md)

## Implementation progress (2026-07-04)

**Done (committed `ee26e38` + `53a42e8`):**
- **Books-first sidebar** — `smart-lists-books.tsx` reordered so **Books** sits
  above **My Lists** (Labels already below). Affordances unchanged, regression-free.
- **Membership server actions** — `src/app/actions/contact-books.ts`
  (`addContactToBook`, `removeContactFromBook` [blocks last book, syncs primary],
  `setContactPrimaryBook`, `dismissBooksExplainer`) over the P40-06 helpers.
- **Detail "Books" block** — `contact-books-block.tsx` wired into `/contacts/[id]`
  (details tab, personal contacts): membership chips + home marker + "Add to book"
  + remove (disabled on last book), P40-DB01 §3.
- **Migration explainer** — `books-migration-explainer.tsx`, one-time dismissible
  banner (§7). Existing users only: new accounts set `booksNative` at signup;
  dismissal persists via whitelisted `booksExplainerDismissedAt` preference flag.
- **Mobile** nav mirror — `mobile-filter-sheet.tsx` Books section moved above My
  Lists + includes the default book (§8).
- **Tests** — 6 unit tests on the membership invariants (block-last, promote-primary).

**Remaining (needs a logged-in session / real device):**
- Interactive click-through of the Books block + explainer (auth required).
- Real-device mobile QA of the nav mirror + detail chips (preview can't emulate touch).
- Sidebar visual QA of all brief states (empty book, >8 overflow, drag/reorder).
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
