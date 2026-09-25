# P49A-09 — Duplicate scoring: bounded, not O(n²), off the web thread

**Phase:** 49A · **Priority:** P0 · **Depends on:** — · **Effort:** M
**Audit IDs:** A-13 (high)

## Objective
Duplicate detection must never block the process that serves the website and CardDAV.

## Production verification (2026-09-25)
- **Reproduced with prod's code** (`buildContactMergeSuggestions` from origin/main, synthetic
  contacts): 250 contacts → 3.7 s, 500 → 14.9 s, 1,000 → 58.6 s of blocking CPU. Growth is
  quadratic; 5,000 contacts ≈ 25 min.
- Prod runs web + CardDAV + sync in one Node process (`node server.mjs`, PID 264), so that time
  is an outage for every user.
- Triggers in origin/main: `POST /api/merge-suggestions/refresh` (no rate limiter) and the first
  Google/Microsoft import (`sync-runner.ts:1015/1042`).
- Prod has 0 contacts today, so it has not fired.

## Steps
1. Precompute per contact once: normalised name, phonetic key, given/family tokens, email keys,
   phone keys.
2. Blocking: only compare pairs that share an email key, phone key, phonetic name key, or
   (family name + given-name initial). Score only those candidates.
3. Run the refresh as a background job (queued, one per user at a time) instead of inside the
   request/sync transaction; rate-limit the refresh route (e.g. 3/hour/user).
4. Yield to the event loop between chunks (or use a worker thread) for very large books.

## Acceptance
- Benchmark test: 5,000 synthetic contacts score in < 2 s total, with no single synchronous slice
  > 50 ms.
- Existing duplicate-scoring tests still pass (same pairs found on the fixture set).
- Refresh route returns 202 + job id; second call within the window → 429.
