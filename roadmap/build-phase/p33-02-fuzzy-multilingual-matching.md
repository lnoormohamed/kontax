# P33-02 — Fuzzy & Multilingual Matching

## Purpose

Make search forgiving: tolerate typos and spelling variants ("noormohammed" →
"Noormohamed"), and ensure non-Latin names are findable even though the English
stemmer doesn't handle them.

## Background

P28-07 uses `to_tsvector('english', …)` + prefix `tsquery`. That's exact/prefix
only — a transposed or doubled letter misses entirely — and the English config
doesn't tokenize/stem CJK/Arabic/etc. meaningfully. PostgreSQL's `pg_trgm`
extension gives trigram **similarity** and fast `ILIKE`/`%` matching, which
covers both typo tolerance and substring matching for non-Latin tokens.

## Scope

**In scope**
- Enable `pg_trgm` (`CREATE EXTENSION IF NOT EXISTS pg_trgm` — idempotent).
- Add a **fuzzy** match tier: when FTS returns little/nothing, fall back to (or
  blend in) trigram `similarity()` / `word_similarity()` on name + company.
- A `simple`-config tsvector pass (alongside `english`) so non-Latin tokens are
  matched exactly without English stemming dropping them.
- Tune ranking so exact/prefix beats fuzzy, and a fuzzy match still surfaces.

**Out of scope**
- The index that makes trigram fast at scale (P33-03 — this ticket can be
  correct-but-unindexed first).
- UI/snippets (P33-04).

## Design / Implementation Spec

### Tiers (combined in the core from P33-01)
1. **Exact/prefix FTS** (current) — highest rank.
2. **Trigram similarity** on `fullName`/`nickname`/`company` — `similarity(x, q) >
   threshold` (tune ~0.3) — catches typos; ranked below exact.
3. **`simple` tsvector** pass — matches non-Latin tokens the english stemmer drops.

Blend: `WHERE fts_match OR phone_match OR trigram_match` with a `rank` that orders
exact > prefix > fuzzy. Cap fuzzy contributions so they don't outrank real hits.

### Thresholds & guards
- Set `pg_trgm.similarity_threshold` per-query or use explicit `similarity()`
  comparisons; pick a threshold that avoids noise (validate against real data).
- Only apply fuzzy to reasonably long terms (≥3 chars) to avoid everything
  matching.

## Acceptance Criteria
- A 1–2 character typo in a name still finds the contact ("noormohammed",
  "noormohamd" → "Noormohamed").
- Non-Latin names are findable by exact/substring (no silent drop from the
  English stemmer).
- Exact and prefix matches still rank above fuzzy matches.
- No flood of low-relevance fuzzy results for short queries.

## Risks / Open Questions
- Threshold tuning is data-dependent — validate against the real contact set.
- Unindexed `similarity()` is a sequential scan; acceptable per-user now, but
  P33-03 should add the trigram GIN index for scale.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help (P26-12): "search is typo-tolerant"
- [ ] External · developers — /developers (P29-07)
- [x] Internal · admins/ops — roadmap/runbooks/: pg_trgm extension is required
- [x] Internal · engineering — docs/: matching tiers + thresholds
