# P34A-06 — Smarter Duplicate Detection Scoring Weights

## Purpose

Update the point values used by the duplicate-detection scoring function so
that strong signals (exact phone, exact email) carry maximum weight, weaker
signals are proportionally less influential, and the minimum threshold for
surfacing a pair rises from ~45 to 50 — cutting noise while preserving all
true duplicates.

## Background

Current scoring weights in `src/server/contact-merge.ts` (as read from the
codebase):
- Exact email match: 100 pts
- Exact phone match (digit-normalised): 95 pts
- Normalised phone (different formats): 90 pts
- Name + company (same): 70 pts
- Name + missing company context: 45 pts
- Name-and-company proximity: varies (~60–70)
- Phonetic name (supporting): ~25–30
- Email domain + similar name: 15 pts

The existing `deriveConfidence` tiers: ≥ 90 (or hard match) = HIGH, ≥ 45 =
MEDIUM, < 45 = not surfaced (LOW).

Problems:
1. The minimum threshold of 45 surfaces phonetic-name-only pairs as MEDIUM,
   generating false positives.
2. Exact full name match has no explicit rule — it falls through to the
   name+company path with partial coverage.
3. Fuzzy name (Levenshtein ≤ 2) is not currently a distinct signal; it is
   handled only via phonetics.

## Scope

**In scope**
- Update the `add(signal, label, points)` call-sites in the scoring function
  in `src/server/contact-merge.ts` to the new weights below.
- Add an explicit **exact full name** signal with 80 pts.
- Add a **fuzzy name + same company** signal (Levenshtein distance ≤ 2 on the
  normalised full name + same company): 65 pts.
- Add a **fuzzy name alone** signal (Levenshtein ≤ 2, no company): 40 pts
  (below the new surfacing threshold — only boosts other signals).
- Update `deriveConfidence` thresholds: ≥ 80 = HIGH, 50–79 = MEDIUM, < 50 =
  not surfaced.
- Re-run scoring during the `POST /api/merge-suggestions/refresh` job so
  existing suggestions below the new threshold are retired.

**Out of scope**
- Levenshtein implementation (add `fast-levenshtein` or implement inline as
  a small pure function; either is fine).
- Changing the phonetic/Soundex logic in `src/lib/duplicate-signals.ts`.
- UI changes.

## Design / Implementation Spec

### New scoring table

| Signal | Points | Notes |
|---|---|---|
| Exact phone (E.164-normalised, digit key) | 95 | Hard match |
| Exact email (lowercased) | 95 | Hard match |
| Exact full name (normalised) | 80 | New explicit signal |
| Fuzzy name (Levenshtein ≤ 2) + same company | 65 | New |
| Name + company proximity (existing logic) | 60 | Was 70; slight reduction |
| Normalised phone (different format, same key) | 90 | Unchanged — still a hard match |
| Fuzzy name alone (Levenshtein ≤ 2) | 40 | New; below threshold, supporting only |
| Name + missing company | 40 | Was 45; below new threshold |
| Phonetic name (supporting only) | 25 | Unchanged |
| Email domain + similar name | 15 | Unchanged |
| Same company + fuzzy name (via new rule) | covered by "Fuzzy + company" | — |

### Confidence tiers

```ts
function deriveConfidence(
  score: number,
  hardMatch: boolean,
  hasEdgeWarnings: boolean,
): "HIGH" | "MEDIUM" | "LOW" {
  if (!hasEdgeWarnings && (hardMatch || score >= 80)) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";    // not surfaced
}
```

Note: `score >= 80` for HIGH (was `>= 90`), reflecting that an exact name
match alone is a strong signal.

### Levenshtein helper

If not already present, add to `src/lib/duplicate-signals.ts`:

```ts
/**
 * Wagner-Fischer Levenshtein distance, capped at maxDist to short-circuit
 * early for large strings that obviously exceed the threshold.
 */
export function levenshtein(a: string, b: string, maxDist = 3): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0]!;
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const temp = dp[i]!;
      dp[i] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[i]!, dp[i - 1]!);
      prev = temp;
    }
  }
  return dp[a.length]!;
}
```

### New signal additions in contact-merge.ts

After the existing email/phone block and before the phonetic block:

```ts
// Exact full name
if (
  left.fullName &&
  right.fullName &&
  normalizeName(left.fullName) === normalizeName(right.fullName)
) {
  add("exact-name", `Same full name: ${left.fullName}`, 80);
}

// Fuzzy name
const leftNorm = normalizeName(left.fullName);
const rightNorm = normalizeName(right.fullName);
const nameDist = leftNorm && rightNorm ? levenshtein(leftNorm, rightNorm, 2) : 3;

if (nameDist <= 2 && left.company && left.company === right.company) {
  add("fuzzy-name-company", `Similar name at same company: ${left.fullName} ≈ ${right.fullName}`, 65);
} else if (nameDist <= 2 && leftNorm && rightNorm) {
  add("fuzzy-name", `Similar name: ${left.fullName} ≈ ${right.fullName}`, 40);
}
```

Add `"exact-name"` and `"fuzzy-name-company"` and `"fuzzy-name"` to the
`MergeSuggestionSignal` union type in `src/lib/duplicate-signals.ts`.

### Refresh job retirement

In the refresh job
(`src/app/api/merge-suggestions/refresh/route.ts` or its called function),
after re-scoring, update suggestions with the new score. Suggestions whose
new score falls below 50 should be set to status `STALE` (not deleted, so
the history is preserved). The existing `STALE` status handling already
covers this.

## Acceptance Criteria

- [ ] Exact full name match contributes 80 pts to the score.
- [ ] Fuzzy name + same company contributes 65 pts.
- [ ] Fuzzy name alone contributes 40 pts.
- [ ] Confidence tier HIGH = score ≥ 80, MEDIUM = 50–79, LOW / not surfaced
      = < 50.
- [ ] Pairs scoring only on phonetic name (< 50) are not surfaced.
- [ ] Running `POST /api/merge-suggestions/refresh` retires suggestions that
      fall below the new threshold.
- [ ] The "why this was suggested" panel on `/merge-suggestions/[id]` shows
      the correct new signal labels (e.g. "Same full name: …", "Similar name
      at same company: …").
- [ ] `tsc --noEmit` passes with the new signal types added.

## Risks / Open Questions

- Raising the minimum threshold from 45 to 50 will retire some existing
  MEDIUM suggestions. This is intentional — communicate in release notes.
- `exact-name` and `name-and-company` can both fire for the same pair; this
  is fine — they stack. Document this in the concept doc.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: update merge-suggestions scoring table
      and confidence tier spec
