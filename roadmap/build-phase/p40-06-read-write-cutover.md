# P40-06 — Read/write cutover from `Contact.bookId`

Status: Core cutover landed (uncommitted, 2026-07-04) · Priority: P0 · Depends: [P40-05](p40-05-migration-backfill-default-books.md)

## Implementation (2026-07-04)

- **Dual-write** via `src/server/contact-book-membership.ts` (`setPrimaryMembership`,
  `movePrimaryMembership`, `addMembership`, `removeMembership` [blocks last book],
  `listMemberships`) wired into: contact create (`actions/contacts.ts`), move
  (`actions/address-books.ts`), import (`export-format/import.ts`), API v1
  create + update (`api/v1/contacts`), family-snapshot copy. `Contact.bookId`
  stays authoritative; the membership matching it is `isPrimary`.
- **Read cutover:** contacts list hot query (`contacts-workspace.ts` privateBranch)
  → membership `EXISTS` **with a soak deprecation shim** (`OR c."bookId" = …`)
  so nothing can vanish before backfill/dual-write are fully rolled out; sidebar
  + settings/books per-book **counts** → membership groupBy; export book-filter +
  API v1 GET book-filter → membership relation filter.
- **Index:** `ContactBookMembership @@index([addressBookId, contactId])` — EXPLAIN
  on staging confirms an index-only semi-join (Heap Fetches: 0), P38 plan preserved.
- **Deferred (soak-equivalent, documented):** home-book reads that legitimately
  mean the *primary* book stay on `bookId` (detail sharing-panel resolution,
  archive-book, set-default-book); export **serialization** of the book name
  still uses the primary `bookId` (multi-book export enrichment lands with the
  P40-08 "Add to book" UI, when membership can first diverge from `bookId`).
  Sync **inbound** → membership is the P41 reconciliation seam (P40-07/P41-05).
- **Exit item still open:** formal P38 10k TTFB / query-count re-measurement in
  the user's env (EXPLAIN sanity-check done; sub-ms at current staging scale).
Phase: [Phase 40](phase-40.md) · Source spec: [phase-37/01 §4, §6](../phase-37/01-data-model-build-now.md)

## Scope

Contacts list, detail, create/edit, import/export, merge, sharing, and sync
read membership instead of `bookId`; writes dual-write both during the soak.

`Contact.bookId` removal is explicitly **out of scope** — separate cleanup
phase after a prod soak (source doc decision §10.1).

Performance guardrail: the membership join must not regress the Phase 38
numbers — re-run the P38 exit measurements (TTFB, query count) at 10k
contacts after cutover.

## Acceptance

- All listed read paths verified against membership (grep for remaining
  `bookId` reads outside the dual-write and the deprecation shim).
- Dual-write proven: mutating through any surface updates both.
- P38 exit numbers re-captured within agreed tolerance.
