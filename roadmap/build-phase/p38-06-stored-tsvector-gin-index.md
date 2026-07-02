# P38-06 — Stored tsvector + GIN Index for Full-Text Search

## Purpose

Move contact full-text search from a per-request sequential scan with
query-time tsvector computation to an index-backed lookup, so search cost stops
growing linearly with address-book size.

## Background

`searchContactIds` (`src/server/contact-search.ts`) builds a weighted tsvector
per row at query time — concatenating ~15 columns including five JSON casts and
a `jsonb_array_elements_text` subquery, plus three `regexp_replace`
normalizations for phone/name matching — for **every contact in scope on every
search**. The module comment documents why: the startup `prisma db push` flow
can't model a generated tsvector column, and schema drift on startup crash-loops
the deploy (see project memory / Coolify deploy notes).

That constraint rules out a Prisma-native column, not a raw-SQL one: Prisma
supports `Unsupported("tsvector")` columns, and one-off SQL scripts are already
an established pattern (`scripts/*.mjs`).

## Scope

**In scope**
- Add `searchVector tsvector` to `Contact` as `Unsupported("tsvector")` in
  `schema.prisma` (so `db push` knows the column and does not try to drop it).
- One-off setup script (`scripts/setup-contact-search-index.mjs`) that:
  - adds the column if missing,
  - creates the trigger function replicating the exact weighting in
    `contact-search.ts` (A: fullName/nickname, B: company/jobTitle, C: rest),
  - creates the trigger (INSERT/UPDATE of the source columns),
  - backfills existing rows in batches,
  - creates the GIN index `CONCURRENTLY`.
- Rewrite the FTS branch of `searchContactIds` to
  `WHERE "searchVector" @@ to_tsquery(...)` + `ts_rank` on the stored column.
- Keep the phone-digits and order-aware name branches as-is for now (they are
  substring/ILIKE shaped and can't use the GIN index; measure before touching).
- Drift guard: extend `scripts/check-schema-drift.mjs` to verify column,
  trigger, and index exist.

**Out of scope**
- Trigram index for phone/name substring branches (follow-up if measurement
  says so).
- Search UX changes.

## Design / Implementation Spec

- Trigger function and query must use the same text-search config
  (`'english'`) and identical concatenation, or ranking silently changes —
  extract the SQL expression into one place referenced by both the script and
  a code comment in `contact-search.ts`.
- Backfill in batches of ~5,000 by id cursor to avoid a long lock; the column
  is nullable during backfill and the query falls back (`searchVector IS NULL`
  rows use the old inline expression) until backfill completes — or simpler:
  run the script before deploying the query change (two-step deploy,
  documented in the runbook).

## Acceptance Criteria

- `EXPLAIN ANALYZE` on a seeded 10,000-contact account shows a bitmap index
  scan on the GIN index for a text search (attach before/after plans).
- Search results and ranking identical to the pre-change implementation on the
  multilingual demo seed (`seed:demo:multilingual`) for a fixed query list.
- Deploy on staging Coolify completes without a `db push` crash-loop
  (explicitly verify — this is the failure mode that motivated the original
  design).
- New contact / edited contact is searchable immediately (trigger fires).

## Risks / Open Questions

- `db push` behaviour with `Unsupported` columns + external trigger/index must
  be verified on staging first — if `db push` ever tries to recreate the
  column, the drift guard should catch it before prod.
- Sync-engine bulk writes go through the same trigger; measure import
  throughput on a large vCard import before/after (trigger cost per row is
  real but should be well under the old per-search cost).

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — SQL expression source-of-truth note
- [x] Internal · support/admin — setup script runbook + two-step deploy order
