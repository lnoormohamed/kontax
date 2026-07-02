# P38-02 — Contact List Pagination / Windowed Fetch

## Purpose

Cap the initial contacts query so `/contacts` stops scaling linearly with total
address-book size. The virtualized table already renders a window; this ticket
makes the *data fetch* windowed too.

## Background

The three active-scope queries and the archived query in
`src/app/contacts/page.tsx` (~lines 452–518) have no `take`. A 10k-contact
account fetches, JS-sorts, and serializes 10k rows on every page view — and
again on every `revalidatePath("/contacts")` triggered by any mutation
(39 call sites). `ContactsWorkspaceTable` uses `@tanstack/react-virtual`, so
it can render any list length; the cost is entirely in fetch + payload.

Complication: sorting is currently done in JS (`compareWorkspaceContacts`)
because "name" sort is favourite-first + phonetic-aware with company fallback,
which has no direct SQL equivalent. Windowing the fetch requires the sort to
move into SQL, or a hybrid.

## Scope

**In scope**
- Add a persisted sort-key column on `Contact` (e.g. `sortKey`) computed on
  write (create/update/import/sync paths all funnel through a small number of
  server modules) that encodes the phonetic-aware last/first/company fallback
  ordering. Favourite-first stays as a leading `orderBy: isFavorite desc`.
- `take` + cursor on the private/family/team/archived list queries; merge and
  interleave scopes server-side per page.
- "Load more" (or scroll-triggered fetch) in `ContactsWorkspaceTable` via a
  server action or route handler returning the next page in the lean P38-01
  row shape.
- Keep full-text search results correct: FTS already returns ranked ids
  (capped at 1000) — paging within that id set is server-side slicing.
- Backfill script for `sortKey` following the `scripts/*.mjs` pattern.

**Out of scope**
- Changing filter/tab semantics or the health-card counts (those already use
  separate `count` queries — P38-03 territory).
- The duplicates/activity tabs.

## Design / Implementation Spec

- Page size: 200 initial, 200 per subsequent fetch (tune after measuring; the
  virtualizer makes larger pages cheap to render).
- `sortKey` derivation lives beside `getNameAwareSortKeys` (move that helper
  out of `page.tsx` into `src/server/` or `src/lib/` and reuse it in both the
  write paths and the backfill).
- Index: `@@index([userId, archivedAt, isFavorite, sortKey])` (verify the
  planner uses it with the `groupContacts: none` predicate).
- Cross-scope ordering: the shared-book queries are small relative to private
  in most accounts; fetch page-size rows per scope, merge-sort in JS, keep a
  per-scope cursor triple in the client's load-more state.
- `updatedAt` sort ("recent") pages trivially with the existing index.

## Acceptance Criteria

- Initial `/contacts?tab=people` on a seeded 10,000-contact account fetches at
  most one page per scope (verify via Prisma query log `LIMIT`).
- Scrolling to the bottom loads the next page without full page navigation;
  ordering across page boundaries matches the pre-change JS sort on a seeded
  fixture (spot-check first/last names around the boundary).
- Search, label filter, book filter, scope filter, and health filter all work
  with pagination (each resets the cursor).
- TTFB and payload before/after recorded at 500 / 2,000 / 10,000 contacts.

## Risks / Open Questions

- `sortKey` must be kept in sync on every write path (manual edit, import,
  sync engine, merge). Miss one and ordering silently drifts — add a repo test
  that creates a contact through each path and asserts `sortKey`.
- Health-card counts currently derive from the full in-memory list
  (`countContactsByHealth`); with pagination they must come from SQL counts —
  coordinate with P38-03 so it's done once.
- `Intl.Collator`-accurate ordering vs. Postgres collation will differ on
  edge cases (numerics, diacritics). Decide: accept Postgres `COLLATE`
  ordering, or normalize aggressively when computing `sortKey` (recommended).

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — sortKey semantics + write-path checklist
- [x] Internal · support/admin — backfill script runbook note

## Dependencies

- P38-01 (lean row shape) should land first.
