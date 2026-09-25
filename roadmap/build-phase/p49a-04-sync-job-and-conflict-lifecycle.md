# P49A-04 — Sync jobs & conflicts: lease reclaim, graceful shutdown, no conflict re-open

**Phase:** 49A · **Priority:** P0 · **Depends on:** — · **Effort:** S–M
**Audit IDs:** A-06 (high), A-08 (high), P2 `nextRetryAt` unused, A-24 export-job part

## Objective
A deploy or crash must never leave an account or export permanently stuck, and one unresolved
conflict must not snowball into an auto-paused account.

## Production verification (2026-09-25)
- **A-08 confirmed on the live prod container (LXC 122):** PID 1 is
  `node scripts/runtime/start-production.mjs`, which runs `spawnSync("npm", ["start"])`; the web
  server is `node server.mjs` at PID 264, two levels down. Container `Init=<nil>`. PID 1 installs
  no SIGTERM handler and is blocked in `spawnSync`, so `docker stop` on every deploy ends in
  SIGKILL; `server.mjs`'s own `shutdown()` (`:2355`) never runs.
- `leaseExpiresAt` is written (`sync-runner.ts:918`) and cleared, but **never read** anywhere in
  origin/main; `enqueueDueSyncJobs` (`:649`) skips any account with a QUEUED/RUNNING job. A job
  killed mid-run therefore blocks that account forever.
- Same pattern for exports: a `DataExportJob` left PROCESSING is counted as active
  (`data-export/jobs.ts:7`), blocking new exports; archive exports only pick up PENDING.
- **A-06 confirmed:** conflict rows are created in `sync-runner.ts:1937` with no check for an
  existing OPEN conflict on the same link (the photo pass has one at `sync-photo-pass.ts:176`);
  after `MANUAL_CONFLICT_QUEUE_LIMIT` (50) open conflicts the account auto-pauses (`:2076-2139`).
- Prod data today: 0 sync jobs, 0 conflicts, 1 old EXPIRED export — nothing stuck yet.

## Steps
1. **Reclaim.** At the start of each queue drain (and export drain), move RUNNING jobs with
   `leaseExpiresAt < now()` to FAILED (retryable) and PROCESSING exports older than their timeout
   to FAILED; log a count.
2. **Honour `nextRetryAt`** when choosing FAILED jobs to retry.
3. **Signals.** Make the container run the server as PID 1's direct child with forwarding:
   `exec` the final start from `start-production.mjs` (replace `spawnSync("npm",["start"])` with
   `spawn("node",["server.mjs"])` + forward SIGTERM/SIGINT, or use `tini`/`--init`). In
   `server.mjs` `shutdown()`: stop accepting (`server.close()`), stop claiming jobs, wait up to
   ~20 s for in-flight jobs, then exit. Set a matching Coolify stop grace period.
4. **No re-open.** Before creating a conflict, skip links that already have an OPEN conflict (update
   its snapshots instead).
5. Runbook: add "stuck sync job" and "stuck export" procedures to `sync-ops.md`.

## Acceptance
- Test: a RUNNING job with an expired lease is reclaimed and the account is enqueued next tick.
- Test: three runs against a remotely-deleted contact yield exactly one OPEN conflict.
- Staging: start a large sync, redeploy mid-run → logs show graceful shutdown; the account syncs
  again on the next tick without manual action.
