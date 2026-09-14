# P48-10 — Cron and internal endpoint guards: `cleanup-card-views`, `/api/sync/run`, timing-safe compares

**Phase:** 48 · **Workstream:** E · **Priority:** P0 · **Depends on:** —
**Audit severity:** Medium (×2) + Low

## Objective

Close the one unauthenticated cron route, lock down the sync-run trigger,
and make secret comparisons constant-time.

## Context and steps

1. **`cleanup-card-views` is unauthenticated.**
   `src/app/api/cron/cleanup-card-views/route.ts:7` calls
   `assertCronSecret(req);` and discards the return value, so anyone can
   trigger `publicCardView.deleteMany` (full-table scan) repeatedly.
   → `const denied = assertCronSecret(req); if (denied) return denied;`
   Add a lint-level guard: make `assertCronSecret` throw instead of return,
   or add a `withCronAuth(handler)` wrapper used by all 8 cron routes so the
   pattern cannot be forgotten.
2. **`/api/sync/run`.** `src/app/api/sync/run/route.ts:7-49`:
   - any session user is authorised and `runQueuedSyncJobs` (`sync-runner.ts:736-748`)
     is not scoped to the caller; `limit` is unbounded (`Math.max(limit,1)`
     only) → a free user drains every tenant's queue;
   - consumes `formData`, so a cross-site top-level `<form method=POST>`
     triggers it (no Origin check);
   - `redirectTo.startsWith("/")` allows `//evil.com` → 303 open redirect;
   - the bearer fallback compares against `AUTH_SECRET` (the JWT signing
     key) with `===`.
   → Split the two uses: the cron/runner path requires `CRON_SECRET` (or a
   dedicated `SYNC_RUNNER_SECRET`) via `timingSafeEqual`; the user "Sync now"
   path becomes a server action that enqueues and runs jobs only for
   `syncAccount.userId === session.user.id` with `limit` capped at 5 and the
   P48-01 write guard. Validate `redirectTo` with P48-03's
   `safeInternalPath`. Check `Origin`/`Sec-Fetch-Site` on any remaining
   form-POST route.
3. **Timing-safe compares.** `src/server/cron-guard.ts:14` uses `!==`.
   → Compare `Buffer.byteLength`-equal buffers with `crypto.timingSafeEqual`;
   keep refusing when `CRON_SECRET` is unset.
4. **While here:** `card/[username]/click` — add a per-IP limiter
   (`rateLimiters` with a generous bucket) so the counter cannot be inflated
   trivially.

## Acceptance

- `POST /api/cron/cleanup-card-views` without the header → 401; with → 200.
  Same assertion added for all 8 cron routes in a single parametrised test.
- `POST /api/sync/run` with a user session and `limit=1000000` → runs only
  that user's accounts, at most 5 jobs; with `redirectTo=//evil.com` → lands
  on `/sync`.
- Cross-site form POST to the sync route is rejected.
- `assertCronSecret` is constant-time (code review + unit test with unequal
  lengths).

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help
- [ ] External · developers — /developers
- [x] Internal · admins/ops — roadmap/runbooks/ (cron LXC: new secret if `SYNC_RUNNER_SECRET` is introduced; update P47-04 crontab)
- [ ] Internal · engineering — docs/

## References

- Audit report §Medium "Cron route cleanup-card-views is unauthenticated", "/api/sync/run"; §Low timing compares
- `src/server/cron-guard.ts`, `src/app/api/cron/*`, `src/app/api/sync/run/route.ts`, `src/server/sync-runner.ts`
- PRE-PROD-CHECKLIST.md (cron schedule), P47-04
