# Phase 33 — Search v2 (hardening)

> Improvements to the P28-07 contact search. Numbered 33 to sit after Phase 32
> (Documentation); priority is flexible — user-facing search quality may warrant
> pulling this ahead of the docs backfill. Depends on Phase 31B for label search.

## Phase status
Pre-plan

## Phase objective
Turn P28-07 from "works" into "great": better matching (typo-tolerant, stemmed),
fast at scale (indexed), a richer search experience (as-you-type, snippets,
grouping), and complete/consistent coverage (labels searchable, one search core
behind both desktop and mobile). See [`docs/`](../../docs) for the search concept
doc this phase should produce/extend.

## Background
P28-07 shipped on-the-fly full-text search (`src/server/contact-search.ts`,
`searchContactIds`) plus a digit-normalized phone path. It works, but: matching is
exact/prefix only (no typo tolerance, English-stemmer only); it's an unindexed
per-user scan; results are a flat list with no snippets or grouping; labels aren't
searchable; and there are **two search entry points** — the desktop list
(`page.tsx`) and the mobile overlay (`/api/contacts/search`) — that must be kept
in sync by hand.

## Success criteria
- A single search core powers both desktop and mobile (no divergence).
- Typo-tolerant matching ("noormohammed" finds "Noormohamed"); non-Latin names
  are at least exact/substring matchable.
- Search stays fast on large libraries (indexed, not a full per-user scan).
- Results show a matched-text snippet and group by what matched (name / company /
  phone / notes / label).
- Labels are searchable and a label match is clearly indicated.

## Exit criteria
- `docs/` has a "Contact search" concept doc (how matching, ranking, and the
  index work) so the next person doesn't reverse-engineer it.
- The two-entry-point gotcha is gone (one core).

## Design dependency
- **[P33-DB13 — Design brief: Search experience](p33-db13-search-experience.md)** —
  the as-you-type results UI, snippet highlighting, grouping, and keyboard nav.

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P33-01 — Unified search core (+ labels, + shared phone fix)](p33-01-unified-search-core.md)
> - [P33-02 — Fuzzy & multilingual matching (pg_trgm + stemming)](p33-02-fuzzy-multilingual-matching.md)
> - [P33-03 — Stored search index + GIN (scale)](p33-03-stored-search-index.md)
> - [P33-04 — Search experience UI (as-you-type, snippets, grouping)](p33-04-search-experience-ui.md)

### P33-01 — Unified search core
Collapse the desktop (`page.tsx`) and mobile (`/api/contacts/search`) paths into
one `searchContacts` in `~/server/contact-search`. Give the ILIKE fallback the
same digit-phone match. Add **labels** to the searchable document (depends on the
label registry, [P31B-01]). Coverage/correctness.

### P33-02 — Fuzzy & multilingual matching
Add `pg_trgm` for typo tolerance (similarity/word_similarity), blend with FTS for
ranking, and add a `simple`-config pass so non-Latin names match. Matching quality.

### P33-03 — Stored search index + GIN
The documented scale upgrade: a trigger-maintained `searchVector` (+ a normalized
phone-digits column) with GIN / trigram indexes, db-push-safe (`Unsupported` +
idempotent raw index/trigger), with backfill. Supersedes the per-query scan.

### P33-04 — Search experience UI
Implement P33-DB13: debounced as-you-type results, `ts_headline` snippets with
highlight, grouping by match type, keyboard navigation, recent searches.

## Documentation (per roadmap/documentation-policy.md)
- [x] External · users — in-app Help: searching contacts (what's searchable, tips)
- [x] Internal · engineering — docs/: "Contact search" concept doc (matching, ranking, index)
- [ ] Internal · admins/ops — only if the pg_trgm extension / index needs an ops note

[P31B-01]: p31b-01-label-registry-and-model.md
