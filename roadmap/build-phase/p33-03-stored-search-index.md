# P33-03 — Stored Search Index + GIN (scale)

## Purpose

Replace the per-query on-the-fly `to_tsvector` scan with a **stored, indexed**
search representation so search stays fast as a user's library grows — the
documented upgrade deferred in P28-07.

## Background

P28-07 deliberately computes the tsvector at query time (no stored column), to
avoid the schema-drift risk of the `db push`-on-deploy model. That's correct at
current scale (per-user scan of hundreds–low-thousands of rows) but becomes a
sequential-scan cost at large libraries and for unindexed `pg_trgm` similarity
(P33-02). This ticket adds the stored column + indexes **safely** under `db push`.

## Scope

**In scope**
- A stored `searchVector` (`tsvector`) maintained by a **Postgres trigger** (not
  app-layer updates — avoids the "many mutation paths go stale" bug class).
- A **GIN** index on `searchVector`, and a **trigram GIN** index supporting fuzzy
  (P33-02) and fast phone-digit substring (a normalized `phoneDigits` text column
  or expression index).
- A **backfill** for existing contacts.
- Switch the search core (P33-01) to use the stored column/indexes; keep the
  on-the-fly path as a fallback only if the column is absent.

**Out of scope**
- Matching tiers (P33-02 — this indexes them), UI (P33-04).

## Design / Implementation Spec

### Deploy-safe modeling (critical — `db push` on startup, no `--accept-data-loss`)
- Declare `searchVector Unsupported("tsvector")?` (and a `searchPhone String?` for
  normalized digits) in `schema.prisma` so `db push` **creates and keeps** them
  and never tries to drop them.
- Create the **trigger**, the **GIN** index, the **trigram GIN** index, and
  `CREATE EXTENSION IF NOT EXISTS pg_trgm` via **idempotent raw SQL** run once
  (a guarded `ensureSearchIndexes()` at startup or a setup script):
  `CREATE INDEX IF NOT EXISTS …`, `CREATE OR REPLACE FUNCTION … TRIGGER`.
- **Validate that `db push` does not drop the unmanaged indexes/trigger** on
  deploy before this ships — this is the main risk and the reason P28-07 deferred
  it. Document the outcome.

### Trigger (keeps the vector correct regardless of write path)
A `BEFORE INSERT OR UPDATE` trigger recomputes `searchVector` (the weighted
document from P33-01, incl. labels) and `searchPhone` (digits of all phone
sources). This kills the staleness class that app-layer updates would create
across create/update/import/sync/merge/bulk paths.

### Backfill
One-time `UPDATE "Contact" SET …` to populate `searchVector`/`searchPhone` for
existing rows (and a re-run path if the document definition changes).

## Acceptance Criteria
- `searchVector` + `searchPhone` exist, are GIN/trigram indexed, and stay current
  via the trigger on every contact mutation (verified across create/update/
  import/merge/bulk).
- Search uses the indexes (verify with `EXPLAIN` — index scan, not seq scan).
- `db push` on deploy leaves the column/indexes/trigger intact (validated).
- Existing contacts are backfilled; results match the on-the-fly behavior.

## Risks / Open Questions
- **`db push` vs unmanaged indexes** is the core risk — must be validated against
  the real deploy before shipping; if it drops them, gate index creation at
  startup so it self-heals.
- Trigger cost on bulk import (per-row recompute) — measure; consider a
  set-based backfill after large imports if needed.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [x] Internal · admins/ops — roadmap/runbooks/: the search column/trigger/index + pg_trgm, and the db-push validation result
- [x] Internal · engineering — docs/: stored-index design + why trigger over app-layer
