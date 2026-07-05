# P47-03 — Redis/Valkey rate-limit store verify/provision

**Phase:** 47 · **Workstream:** A · **Priority:** P1 · **Depends on:** P47-01

## Objective

Confirm production has a real, shared rate-limit store, or provision one. The
rate limiter (P18-10) silently falls back to an **in-memory store** when
`REDIS_URL` is unset — which is **not prod-safe**: limits are per-container and
reset on every restart/redeploy, so brute-force and abuse protections leak.

## Context

`REDIS_URL` is optional in `src/env.js` and degrades silently — so an unset value
produces no error, just a weaker prod. The infra memory does **not** list a
Redis/Valkey LXC (only DB, MinIO, cron), so the working assumption is that prod
has **no** shared store yet. Verify this first (it may exist undocumented).

## Steps

1. **Verify** — check the Coolify LXC 122 env for `REDIS_URL`; if present, test
   connectivity from the container (`redis-cli -u "$REDIS_URL" ping` → `PONG`).
2. **Provision if absent** — stand up a self-hosted Valkey (Redis-compatible)
   service, either as a Coolify service alongside the app or a dedicated LXC on
   `192.168.1.x`. Bind it to the private network; do **not** expose it publicly.
3. **Wire** — set `REDIS_URL=redis://<host>:6379` in Coolify (P47-05) → redeploy.
4. **Verify shared limiting** — hit a rate-limited endpoint (e.g. failed login)
   past the threshold; redeploy/restart the container mid-window; confirm the
   limit **persists across the restart** (proves it's the shared store, not
   in-memory).

## Acceptance

- `REDIS_URL` set in prod and reachable from the app container.
- A rate-limited endpoint enforces its limit **across a container restart**.
- Valkey is private-network only (not internet-reachable).
- Recorded on the P47-01 checklist.

## References

- env-secrets §Rate limiting
- `.env.example` §Rate limiting (P18-10)
</content>
