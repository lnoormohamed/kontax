# P38-05 — Optimistic UI for Row-Level Mutations

## Status
Implemented & verified 2026-07-02.

**Close-out:**
- Already optimistic before this ticket (no work needed): single favorite
  toggle (row menu, swipe, badge cluster) and swipe-archive (hiddenIds +
  mobile undo toast).
- Made optimistic here: desktop row-menu Archive / Restore / Delete (were
  plain form posts — row now hides in the same frame); bulk archive, restore,
  delete (hide instantly); bulk favorite, label add/remove, and set-company
  (rows patch instantly). Failed actions revert hides and patches.
- New row-patch overlay in ContactsWorkspaceTable also fixes a P38-02 gap:
  revalidation only re-delivers the first window, so bulk edits on
  scrolled-in rows would otherwise show stale chips. Patches persist for
  client-held rows; fresh server data for the first window prunes its
  patches (server truth wins).
- Verified on the seeded account (dev against ~200ms-RTT staging DB, so the
  optimistic gap is very visible): label chips updated 250ms after Apply vs
  ~2s+ round trip; archive/restore rows hide instantly; server state
  converged (sidebar label count 333→335, contact restored + labeled in DB).
- Emergency toggle: no row-level control exists in the table (badge only) —
  nothing to make optimistic; detail-page control unchanged.
- Undo toast remains mobile-only (existing design); desktop archive now hides
  instantly instead of redirecting.
- Real-device pass for the mobile selection toolbar still recommended
  (preview cannot emulate touch).

## Purpose

Make favorite, label, and archive toggles feel instant. Today every row-level
mutation waits for a server action that ends in `revalidatePath("/contacts")`
— a full server re-render of the heaviest page in the app — before the UI
reflects the change.

## Background

39 server-action call sites revalidate `/contacts`
(`src/app/actions/*.ts`; e.g. `contacts.ts:220`). P38-01/02/03 make that
re-render much cheaper, but even a cheap round trip is perceptible; a
favorite star should flip on click, not after the RSC payload returns.

`ContactsWorkspaceTable` is already a client component holding the row array
as props — the standard `useOptimistic` pattern applies directly.

## Scope

**In scope**
- `useOptimistic` (or equivalent local state reconciled on settle) in
  `ContactsWorkspaceTable` / `ContactDashboard` for: favorite toggle,
  emergency toggle, archive/restore, label add/remove, and bulk-edit
  equivalents where the affected rows are on screen.
- Same treatment in the mobile surfaces that expose these actions
  (`mobile-contact-sheet.tsx`, `mobile-contact-detail.tsx`) where they share
  the actions.
- Error handling: on action failure, revert the optimistic state and surface
  the existing error affordance (match current patterns — no new toast system).

**Out of scope**
- Create/delete/merge flows (navigation-bound; optimism adds risk, little
  perceived gain).
- Reducing the `revalidatePath` fan-out itself (the revalidation still runs;
  it just no longer gates perceived feedback).

## Design / Implementation Spec

- Keep server actions authoritative: optimistic layer only reorders perceived
  latency; the revalidated RSC payload remains the source of truth and
  replaces optimistic state when it lands.
- Favorite-first sorting: an optimistic favorite toggle changes the row's sort
  position. Decide UX: keep the row in place until the server payload re-sorts
  (recommended — avoids the row jumping out from under the pointer) — document
  the choice in the component.
- Bulk operations: optimistic for ≤ the visible window; beyond that fall back
  to the current pending state (bulk toolbar already has one).

## Acceptance Criteria

- Clicking favorite/emergency/archive/label on a row updates the UI in the
  same frame (no spinner, no wait for the action), verified on a seeded
  2,000-contact account with throttled CPU/network in devtools.
- A forced action failure (temporarily throw in the action, dev only) reverts
  the row and shows the error affordance.
- Real-device check on mobile for the sheet interactions (preview cannot
  emulate touch — per project convention, verify swipe/tap on a phone).

## Risks / Open Questions

- Double-fire protection: rapid toggling before the first action settles —
  `useOptimistic` reducer must be idempotent per field, and the action should
  set absolute state (`isFavorite: true`) rather than toggle.

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — optimistic-state pattern comment in the table
- [ ] Internal · support/admin — none
