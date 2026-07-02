# P38-09 — Redis-Backed Session Validation Cache

## Status
Implemented & verified 2026-07-02.

**Close-out:**
- `src/server/session-validation-cache.ts`: 45s Redis snapshot keyed
  `sessval:v1:{userId}:{sid}`, wrapped into the JWT callback's steady-state
  branch. Cache hit → 0 session-validation DB queries; miss → the existing
  2 queries + write-back. `getRedis()` now exported from rate-limit.ts.
- Fail-open everywhere: Redis down or `SESSION_VALIDATION_CACHE=off` → falls
  through to the DB. pendingTotp sessions bypass the cache (need a fresh
  totpChallengeVerified read so the 2FA gate lifts immediately).
- Invalidation wired into every security-relevant write (each deletes the
  affected key(s) so revocation beats the TTL): device revoke + revoke-all
  (sessions.ts), password change + self-service deletion (account.ts), admin
  suspend + admin delete (admin.ts), security-alert lockdown
  (notifications.ts), email change (email-verification.ts). Single-key for
  the current session, SCAN-based sweep for all-sessions.
- Impersonation: the impersonated identity is resolved by the `auth()`
  wrapper AFTER the JWT callback, and impersonation is short-lived/low-volume
  — the cache keys off the underlying token sub/sid, and admin lock of the
  impersonated user invalidates it, so no bypass needed.
- Tested end-to-end against an in-process RESP server
  (tests/node/session-validation-cache.test.ts): read/write round trip, 45s
  SETEX TTL, single-key invalidation, SCAN invalidate-all scoped per user,
  and the env-flag off no-op.
- **Prod note**: REDIS_URL is already set (rate limiter uses it); no new infra.
  Watch for it: staging/dev without REDIS_URL simply runs uncached (verified).

## Purpose

Cut the two database queries that `auth()` runs on **every authenticated
request** (user `sessionVersion`/lifecycle check + `UserSession` revocation
check) by caching the validation result in Redis for a short TTL.

## Background

The JWT callback in `src/server/auth/config.ts` (~line 201) validates every
request against the database: `user.sessionVersion` must match the token, the
user must not be `LOCKED`, and the `UserSession` row (by `jti`) must exist and
not be revoked. This is a deliberate security design — revocation and lockout
take effect immediately — but it puts 2 queries in front of every page, server
action, and API call.

`ioredis` is already a dependency (rate limiting), so no new infrastructure.
A short TTL (30–60s) bounds the revocation-to-effect window, which is an
acceptable trade for most surfaces — with explicit invalidation on the paths
that must be immediate.

## Scope

**In scope**
- Cache key `sessval:{userId}:{jti}` → the minimal validation payload
  (`sessionVersion`, `lifecycleState`, `role`, `emailVerified`, revoked flag),
  TTL 30–60s, in the JWT callback's steady-state branch only (initial sign-in
  and `trigger === "update"` branches stay DB-backed).
- **Explicit invalidation** (delete keys) on: session revocation
  (`sessions.ts` device sign-out), password change / sessionVersion bump,
  admin lock/unlock, account deletion. Revoking "all other devices" deletes
  by `sessval:{userId}:*` scan or maintains a per-user key set.
- Fail-open to the database: Redis unavailable → run the existing queries
  (never fail closed on cache infrastructure, never skip validation).
- Config flag to disable the cache (`SESSION_VALIDATION_CACHE=off`) for
  debugging.

**Out of scope**
- Caching anything else about the session (name/avatar refresh flows
  unchanged).
- Changing token lifetimes or the middleware cookie gate.

## Design / Implementation Spec

- Sensitive surfaces that re-check auth state independently (2FA settings,
  sync-settings password confirmation, admin routes) should bypass the cache
  — audit which flows read `sessionVersion` directly vs. via `auth()` and
  document the list.
- Impersonation (`impersonation-guard.ts`) must be checked for interaction —
  impersonated sessions should bypass the cache entirely (low volume).
- Keep the payload shape versioned (`v:1` prefix) so a schema change doesn't
  deserialize stale entries.

## Acceptance Criteria

- Steady-state authenticated request produces 0 session-validation DB queries
  on cache hit (Prisma query log), 2 on cold/miss.
- Revoking a device from `/settings/devices` signs that device out on its
  next request (not after TTL) — invalidation path verified.
- Password change invalidates all cached entries for the user.
- Killing Redis on staging degrades to DB validation with no auth failures.

## Risks / Open Questions

- The TTL window means a *missed* invalidation path = up to 60s of continued
  access after revocation. The invalidation list must be exhaustive; the
  security-review skill should look at this ticket's PR.
- Decide per-user key tracking strategy (SCAN vs. set) for "revoke all".

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — invalidation-path inventory in code comments
- [x] Internal · support/admin — note the flag + TTL in ops docs
