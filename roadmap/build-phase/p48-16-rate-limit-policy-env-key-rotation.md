# P48-16 — Rate-limit outage policy, required prod env, sync-credential key rotation

**Phase:** 48 · **Workstream:** G · **Priority:** P1 · **Depends on:** —
**Audit severity:** Medium (×2) + Low (×2)

## Objective

Make the rate limiter's behaviour during a Redis outage deliberate and
consistent, make the secrets the app depends on in production required
rather than silently defaulted, and make provider-credential encryption
rotatable.

## Context

- **Rate limiting.** `src/server/rate-limit.ts:19-24` returns
  `RateLimiterMemory` when `REDIS_URL` is unset — no warning, no prod guard
  (P47-03 notes prod was still on this fallback on 5 Jul). The Redis client
  uses `enableOfflineQueue: false` (`:10-13`) with no `insuranceLimiter`, so
  during an outage `consume()` rejects with an `Error` and
  `checkRateLimit`'s catch treats any rejection as denied (`:95-108`) →
  registration, password reset, TOTP challenge/recovery, step-up, sync
  elevation, contact form, image proxy and all of `/api/v1` return 429.
  Login uses `peekRateLimit` (fails open, `:132`) and fire-and-forget
  `checkRateLimit` (`auth/config.ts:121-122`), so brute-force protection is
  silently off in the same outage. `api-rate-limit.ts:16-22`'s "fail open"
  `try/catch` is dead code. No `redisClient.on("error")` handler.
- **Env.** `src/env.js:10` marks `AUTH_SECRET` optional; `APP_URL` (`:22`)
  and `SYNC_CREDENTIAL_ENCRYPTION_KEY` (`:12`) optional; `TOTP_ENCRYPTION_KEY`
  optional. Fallbacks: `email.ts:117 appUrl()` → `https://vexon.co`;
  `admin/impersonation.ts:15` HMAC key → a hard-coded string when
  `AUTH_SECRET` is unset; three different `APP_URL` fallbacks across the
  codebase (`localhost:3000`, `getkontax.com`, `vexon.co`).
- **Credential encryption.** `src/server/sync-credentials.ts:63-102,156-158`:
  `encryptionKeyRef` / `SYNC_CREDENTIAL_ENCRYPTION_KEY_ID` are written but
  never consulted on decrypt; decrypt always uses the current secret, so
  rotating the key (or moving from the `AUTH_SECRET` fallback to a dedicated
  key) makes every stored Google/Microsoft/CardDAV credential
  `CREDENTIALS_UNREADABLE`. The fallback reuses the JWT signing secret as the
  KEK. Key derivation is bare `sha256(secret)`. `totp-crypto.ts` uses the
  same primitive but a different envelope (no AAD/version, raw hex key).
- **Low:** `server.mjs` DAV limiter is a separate in-memory `Map` (P48-09
  moves it to Redis); `checkRateLimit` should distinguish `RateLimiterRes`
  from transport errors.

## Steps

1. **Outage policy.** Decide and document: security-critical buckets (login,
   reset, TOTP, register) fail **closed** via a local `insuranceLimiter`
   (`RateLimiterMemory` with the same points) so protection continues
   per-process; convenience buckets (image proxy, API, contact form) fail
   **open** with a logged warning. Make login consistent with the rest
   (`await checkRateLimit` on failure, keep `peek` on success). Add
   `redisClient.on("error")` with throttled logging. Distinguish
   `RateLimiterRes` (limited) from `Error` (transport) in `checkRateLimit`.
2. **Require Redis in prod.** In `rate-limit.ts`, throw at boot when
   `NODE_ENV === "production"` (or `KONTAX_DEPLOY_ENV=production`) and
   `REDIS_URL` is unset; keep the memory fallback for dev/test.
3. **Required env.** In `src/env.js`, use a refinement so that in
   production `AUTH_SECRET`, `APP_URL`, `TOTP_ENCRYPTION_KEY`,
   `SYNC_CREDENTIAL_ENCRYPTION_KEY`, `CRON_SECRET`, `REDIS_URL` are required.
   Delete the impersonation hard-coded fallback and the `vexon.co` fallback;
   centralise `appUrl()` in `src/lib/site-url.ts` with one behaviour.
   Derive the impersonation HMAC key with HKDF(`AUTH_SECRET`, "impersonation").
4. **Keyring.** `SYNC_CREDENTIAL_ENCRYPTION_KEYS` as `id:hex,id:hex` (current
   first). Encrypt with the first; decrypt by the stored `encryptionKeyRef`;
   re-encrypt lazily on successful decrypt with an old key; add a script
   `scripts/rotate-sync-credential-key.mjs` to re-encrypt everything.
   Derive DEKs with HKDF and an info label. Unify the envelope with
   `totp-crypto.ts` (version byte, AAD) and give TOTP the same keyring.
5. **Runbook.** Rotation procedure for each secret with impact
   (`AUTH_SECRET` = all sessions; credential key = none with keyring; TOTP
   key = none with keyring; `CRON_SECRET` = update LXC 152 crontab).

## Acceptance

- Stop Redis on staging: login still rate-limits (memory insurance), image
  proxy still serves, a warning is logged once per minute; start Redis: no
  restart needed.
- Booting with `NODE_ENV=production` and no `REDIS_URL` / `AUTH_SECRET` /
  `APP_URL` fails fast with a clear message.
- Add a second credential key, restart: existing sync accounts still sync;
  run the rotate script; remove the old key; still sync.
- `grep -rn "vexon.co\|hardcoded\|fallback-secret" src` → none.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help
- [ ] External · developers — /developers
- [x] Internal · admins/ops — roadmap/runbooks/ (env-secrets.md: required set, rotation, outage behaviour)
- [x] Internal · engineering — docs/ (crypto envelope + keyring)

## References

- Audit report §Medium "Sync credential encryption…", "Rate limiting: fails closed/open…"; §Low env items
- `src/server/rate-limit.ts`, `src/server/api-rate-limit.ts`, `src/env.js`, `src/server/sync-credentials.ts`, `src/server/totp-crypto.ts`, `src/server/admin/impersonation.ts`, `src/server/email.ts`
- P47-03 (Redis), P47-05 (env completeness), `roadmap/runbooks/env-secrets.md`
