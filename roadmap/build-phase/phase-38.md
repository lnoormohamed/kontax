# Phase 38 — Performance: Contacts Workspace & Hot Paths

> Cuts the server cost of the contacts workspace (the page behind almost every
> interaction), removes unbounded data fetching, and fixes a set of hot-path
> inefficiencies found in the July 2026 performance review. Goal: the app stops
> "feeling slow at times", and stays fast as real address books grow past a few
> thousand contacts.

## Phase status
Pre-plan

## Phase objective
A performance review (2026-07-02) found the client-side story healthy (102 kB
shared JS baseline, virtualized table, request-deduped `auth()`, good Prisma
indexes) but identified serious server-side costs concentrated on `/contacts`:

1. Every page view loads **every** contact in scope — no `take`, with heavy
   fields (`notes`, `significantDates`, `syncLinks` join) — sorts them in JS,
   and serializes the full set into the RSC payload.
2. A single `/contacts` request executes ~30 database queries across 4+
   sequential waves, with duplicated billing-context work between the page and
   its banner slots.
3. 39 server actions call `revalidatePath("/contacts")`, so every favorite
   toggle or label edit re-runs (1) and (2) before the UI updates.
4. Full-text search computes weighted tsvectors at query time over every
   in-scope contact — no stored column or GIN index.

The database runs in a separate container **on the same host**, so per-query
network latency is sub-millisecond. The dominant costs are row volume, Prisma
result serialization, sequential await waves, and repeated recomputation — not
the wire. Ticket framing and acceptance criteria reflect that.

## Success criteria
- `/contacts` TTFB and RSC payload size no longer scale linearly with total
  contact count for the initial view.
- Row-level mutations (favorite, label, archive) feel instant: optimistic UI
  plus a materially cheaper revalidation.
- Query count for a typical `/contacts` view drops from ~30 to a documented,
  intentional number.
- Search cost is index-backed rather than a per-request sequential scan.

## Exit criteria
- P38-01 … P38-10 verified (each ticket carries its own acceptance criteria).
- Before/after numbers captured for: `/contacts` TTFB, RSC payload bytes, and
  query count per view (Prisma query log), at 500 / 2,000 / 10,000 contacts.

## Tickets
| Ticket | Title | Priority |
| --- | --- | --- |
| P38-01 | Contact list payload diet | High |
| P38-02 | Contact list pagination / windowed fetch | High |
| P38-03 | Contacts page query consolidation | High |
| P38-04 | Request-scoped billing & shared-context cache | High |
| P38-05 | Optimistic UI for row-level mutations | High |
| P38-06 | Stored tsvector + GIN index for full-text search | Medium |
| P38-07 | Server hot-path micro-fixes (collator, label suggestions) | Medium |
| P38-08 | Avatar thumbnails for list rows | Medium |
| P38-09 | Redis-backed session validation cache | Low |
| P38-10 | Static rendering for marketing pages + import-export code split | Low |

## Sequencing notes
- P38-01 and P38-07 are safe to land immediately; no product-shape changes.
- P38-02 changes the data contract between `contacts/page.tsx` and
  `ContactDashboard`/`ContactsWorkspaceTable`; land after P38-01 so the
  per-row shape is already lean.
- P38-05 depends on nothing but pairs naturally with P38-02 (both touch the
  table's client state).
- P38-06 requires a raw-SQL setup script (the `db push` startup flow cannot
  create a generated column + GIN index by itself) — follow the existing
  `scripts/*.mjs` one-off pattern, and mind the deploy note in
  [project memory]: schema drift on startup `db push` crash-loops the site.
