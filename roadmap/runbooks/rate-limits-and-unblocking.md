# Runbook: Rate limits — Redis key namespaces & unblocking a user

**Subsystem:** All Redis-backed rate limiters and caches (`rate-limiter-flexible` + `ioredis`)
**Audience:** Support / on-call operators handling "I'm locked out" / "I'm being rate-limited" reports

---

## 1. Where Redis is and how to connect

Production Redis is a self-hosted **Valkey** instance on **Proxmox `10.0.50.10`, LXC 143** (`redis-rate-limit`), password-protected (`requirepass`), shared with other projects. Kontax uses **logical DB 1** (DB 0 is another project, `passportbase`). See `roadmap/runbooks/p47-production-readiness.md` (row 3) and `roadmap/runbooks/env-secrets.md`.

Kontax's app container runs under Coolify on **LXC 122**. To read `REDIS_URL` without printing the password to a shared terminal/log:

```sh
ssh -i ~/.ssh/claude-proxmox-uk root@10.0.50.10
pct exec 122 -- bash -c 'docker inspect $(docker ps --filter name=l96ws6pb8cgh38st6bl20955 -q) | grep -A1 REDIS_URL'
```

(the Coolify app container's UUID prefix is `l96ws6pb8cgh38st6bl20955-*`, per `p47-production-readiness.md`). Prefer piping through `grep -A1 REDIS_URL` or redacting the value in your terminal history rather than echoing the full `docker inspect` env block — the password is embedded in the URL.

Once you have `REDIS_URL` (format `redis://:<password>@<host>:6379`), connect **from a host that can reach LXC 143** (the Proxmox host or another LXC on the same bridge — not your laptop) and select DB 1 explicitly:

```sh
redis-cli -u "$REDIS_URL" -n 1
# or, if REDIS_URL has no /1 suffix:
redis-cli -u "$REDIS_URL"
127.0.0.1:6379> SELECT 1
```

Every command below assumes you are already in DB 1. Do not touch DB 0 (a different project's data lives there).

Do not touch production Redis, or anything else on `10.0.50.10`, without an explicit ask from the user — this runbook documents *how*, not a standing permission to go run it unprompted.

---

## 2. Key namespaces

All `rate-limiter-flexible` limiters store their bucket at **`<keyPrefix>:<key>`** (`RateLimiterAbstract.getKey`, `node_modules/rate-limiter-flexible/lib/RateLimiterAbstract.js:107`). A couple of prefixes are declared *with* their own trailing colon, which produces a double colon in the final key — noted below.

| Prefix (Redis key form) | Owner (file:line) | Identifier | Points / window (or TTL) | Safe to delete? |
|---|---|---|---|---|
| `rl:pw-change:user:<userId>` | `src/server/rate-limit.ts:106` | user id | 5 / 1 h | Yes — clears the counter early; next attempt starts a fresh window |
| `rl:email-resend:user:<userId>` / `rl:email-resend:email-change:<userId>` / `rl:email-resend:email-change-resend:<userId>` | `src/server/rate-limit.ts:109`, used at `src/app/actions/account.ts:91-93,158-160,240-242,522-524` | user id (three distinct sub-keys for three flows) | 3 / 5 min | Yes |
| `rl:pw-reset-email:email:<email>` | `src/server/rate-limit.ts:112`, `src/app/actions/auth.ts:41` | lower-cased email | 3 / 30 min | Yes |
| `rl:pw-reset-ip:ip:<ip>` | `src/server/rate-limit.ts:115`, `src/app/actions/auth.ts:43` | client IP (from `getClientIp`) | 10 / 30 min | Yes |
| `rl:totp-challenge:enrol:<userId>` / `rl:totp-challenge:user:<userId>` / `rl:totp-challenge:disable:<userId>` | `src/server/rate-limit.ts:118`, used at `src/app/actions/totp.ts:79,165,252` | user id (enrolment confirm / login challenge / disable, each its own sub-key) | 5 / 15 min | Yes |
| `rl:totp-recovery:user:<userId>` | `src/server/rate-limit.ts:121`, `src/app/actions/totp.ts:210` | user id | 5 / 15 min | Yes |
| `rl:step-up-verify:user:<userId>` | `src/server/rate-limit.ts:124`, `src/app/actions/account.ts:474`, `src/server/auth/step-up.ts:43` | user id | 5 / 1 h | Yes |
| `rl:registration:ip:<ip>` | `src/server/rate-limit.ts:127`, `src/app/api/register/route.ts:32` | client IP | 10 / 1 h | Yes |
| `rl:sync-elevation:user:<userId>` | `src/server/rate-limit.ts:130`, `src/app/actions/sync.ts:2238` | user id | 5 / 15 min | Yes |
| `rl:api-read::<tokenHash>` (double colon — prefix is `"rl:api-read:"`) | `src/server/rate-limit.ts:133`, `src/app/api/v1/_lib/auth.ts:32`, `src/server/api-rate-limit.ts` | SHA-256 hex of the raw bearer token | 1 000 / 1 h | Yes |
| `rl:api-write::<tokenHash>` (double colon — prefix is `"rl:api-write:"`) | `src/server/rate-limit.ts:134`, same call sites | SHA-256 hex of the raw bearer token | 200 / 1 h | Yes |
| `rl:contact-form:<ip>` (no `ip:` sub-prefix — the raw IP is passed as the key) | `src/server/rate-limit.ts:136`, `src/app/api/contact/route.tsx:31` | client IP | 3 / 1 h | Yes |
| `rl:card-click:ip:<ip>` | `src/server/rate-limit.ts:141`, `src/app/api/card/[username]/click/route.ts:17` | client IP | 30 / 1 h | Yes |
| `rl:image-proxy:<userId>` (no `user:` sub-prefix — raw user id is the key) | `src/server/rate-limit.ts:144`, `src/app/api/image-proxy/route.ts:49` | user id | 240 / 1 min | Yes |
| `rl:login-email:email:<email>` | `src/server/rate-limit.ts:148`, `src/server/auth/config.ts:127,136` | account email as stored (registration lower-cases it) | 5 / 15 min | Yes, but see §3 caution |
| `rl:login-ip:ip:<ip>` | `src/server/rate-limit.ts:150`, `src/server/auth/config.ts:111,137` | client IP | 20 / 15 min (shared across accounts behind that IP) | Yes, but see §3 caution |
| `dav:pair:<ip>:<email>` | `src/server/rate-limit.ts:162` (`davAuthByPair`) and `server.mjs:123` (`davPairLimiter`) — **same Redis bucket**, built independently in both files | `<ip>:<lower-cased email>` | 10 / 15 min | Yes |
| `dav:ip:<ip>` | `src/server/rate-limit.ts:163` (`davAuthByIp`) and `server.mjs:124` (`davIpLimiter`) — same bucket | client IP | 100 / 15 min | Yes |
| `dav:email:<email>` | `server.mjs:125` (`davEmailLimiter`) — **CardDAV-only**; there is no equivalent limiter exported from `rate-limit.ts` | lower-cased email | 50 / 15 min | Yes |
| `rl:share-email:user:<userId>` | `src/server/rate-limit.ts:168`, `src/app/actions/shares.ts:251,485` | sending user id | 20 / 1 h | Yes |
| `rl:invite-resend:family:<memberId>` / `rl:invite-resend:team:<memberId>` | `src/server/rate-limit.ts:173`, `src/app/actions/family.ts:471`, `src/app/actions/teams.ts:482` | `groupMember`/team-member id (per invite, not per owner) | 5 / 1 h | Yes |
| `dav:cred:<sha256(email:token)>` | key format at `src/server/dav/credential-cache.mjs:36` (`davCredentialRedisKey`); hash computed by `davCredentialCacheKey` (`credential-cache.mjs:32`); written by `server.mjs` `requireDavAuth` (`server.mjs:450`) | hash of normalised email + normalised app-password token | TTL 600 s (10 min) | Yes — cache only; next request re-verifies via bcrypt |
| `dav:cred:ap:<appPasswordId>` | `src/server/dav/credential-cache.mjs:38` (`davCredentialAppPasswordIndexKey`) | app-password id (Redis **Set** of cache hashes to invalidate) | same TTL as the entries it indexes | Only delete alongside the entries it points at (see §4) |
| `dav:cred:user:<userId>` | `src/server/dav/credential-cache.mjs:40` (`davCredentialUserIndexKey`) | user id (Redis **Set** of cache hashes to invalidate) | same TTL as the entries it indexes | Only delete alongside the entries it points at (see §4) |
| `sessval:v2:<userId>:<sid>` | `src/server/session-validation-cache.ts:33,38` | user id + session/jti id | TTL 45 s | Yes — worst case the next request re-reads the DB |
| `sns:msgid:<messageId>` | `src/app/api/ses/events/route.ts:24` | SNS `MessageId` (`SET NX EX`) | TTL 86 400 s (24 h) | Not a support-facing key — deleting it only risks re-processing a bounce/complaint notification; leave alone unless investigating SES dedupe specifically |

Notes:
- Every `rl:*` and `dav:*` limiter is built with an `insuranceLimiter` (a `RateLimiterMemory` with identical points/duration) — see §6.
- `davAuthByPair`/`davAuthByIp` in `src/server/rate-limit.ts` are declared but only actually consumed from `server.mjs`'s own copies (`davPairLimiter`/`davIpLimiter`); the comment at `src/server/rate-limit.ts:154-159` explains the two files must stay in sync because `server.mjs` is plain ESM and cannot import the TypeScript module.
- `checkRateLimit`/`peekRateLimit` (`src/server/rate-limit.ts:194-256`, approximately — the file has shifted slightly with an unrelated `KONTAX_DEPLOY_ENV` staging-vs-production fix; search for `export async function checkRateLimit` if line numbers have moved again) never throw for an insured limiter; a `RateLimiterMemory`-only limiter with no store still fails open on a transport error (that branch is effectively dead in production since `REDIS_URL` is required there).

---

## 3. Unblocking a user, per surface

General method: `redis-cli -u "$REDIS_URL" -n 1`, then:

```sh
--scan --pattern '<pattern>'   # find the exact key(s)
TTL <key>                       # seconds until it expires on its own
GET <key>                       # rate-limiter-flexible stores a JSON blob: points consumed + expiry
DEL <key>                       # clears it immediately
```

Normalise identifiers the way the code does before building a pattern: **emails are lower-cased and trimmed**; app-password tokens have dashes/spaces stripped (`normalizeAppPasswordToken` / `normalizeToken`); IPs are used verbatim from `cf-connecting-ip` (see §3's IP note below).

### Web login (`loginByEmail` / `loginByIp`)

- **Symptom:** "Wrong password" / silently rejected sign-in even with the correct password, or a generic failure for every account behind one IP (e.g. a shared office/Cloudflare-adjacent network).
- **Inspect:**
  ```sh
  redis-cli -u "$REDIS_URL" -n 1 --scan --pattern 'rl:login-email:email:<email>'
  redis-cli -u "$REDIS_URL" -n 1 --scan --pattern 'rl:login-ip:ip:<ip>'
  redis-cli -u "$REDIS_URL" -n 1 TTL 'rl:login-email:email:<email>'
  redis-cli -u "$REDIS_URL" -n 1 GET 'rl:login-email:email:<email>'
  ```
- **Unblock:**
  ```sh
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:login-email:email:<email>'
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:login-ip:ip:<ip>'
  ```
- **Do NOT unblock when:** the failed attempts in `ActivityEvent`/logs look like an ongoing brute-force (many distinct passwords, high rate, or the account has no legitimate reason to be logging in right then). Clearing `rl:login-ip` in particular re-opens the bucket for every account behind that IP, not just the one user — confirm the IP isn't mid-attack before touching it.

### Password reset

- **Symptom:** "Reset email never arrives" / "it says try again later."
- **Inspect/unblock:**
  ```sh
  redis-cli -u "$REDIS_URL" -n 1 --scan --pattern 'rl:pw-reset-email:email:<email>'
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:pw-reset-email:email:<email>'
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:pw-reset-ip:ip:<ip>'
  ```
- **Do NOT unblock when:** the request pattern suggests someone is enumerating/attacking an account they don't own (repeated resets with no follow-through). `requestPasswordReset` never reveals whether the account exists, so there is little support upside to lifting this except for the genuine account owner.

### TOTP challenge / recovery

- **Symptom:** "It won't accept my 6-digit code" (login-time challenge) or "my recovery code doesn't work."
- **Inspect/unblock (login challenge):**
  ```sh
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:totp-challenge:user:<userId>'
  ```
  Enrolment-confirm and disable-2FA have their own sub-keys if those are what's stuck:
  ```sh
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:totp-challenge:enrol:<userId>'
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:totp-challenge:disable:<userId>'
  ```
- **Recovery codes:**
  ```sh
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:totp-recovery:user:<userId>'
  ```
- **Do NOT unblock when:** the failures suggest someone other than the account owner is guessing codes (this is the last line of defence on a 2FA-protected account) — verify identity through another channel first.

### Step-up (password re-verification for sensitive actions)

- **Symptom:** "It keeps asking for my password again and rejecting it" on a sensitive action (e.g. viewing a secret, changing security settings).
- **Inspect/unblock:**
  ```sh
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:step-up-verify:user:<userId>'
  ```

### Registration

- **Symptom:** "Sign-up says try again later" — usually a shared IP (office NAT, VPN, mobile carrier) that has hit 10 sign-ups/hour.
- **Inspect/unblock:**
  ```sh
  redis-cli -u "$REDIS_URL" -n 1 --scan --pattern 'rl:registration:ip:<ip>'
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:registration:ip:<ip>'
  ```
- **Do NOT unblock when:** the volume looks like automated account creation (spam/fraud) rather than a handful of genuine users sharing a NAT'd IP.

### CardDAV device sync (pair / IP / email buckets)

- **Symptom:** Contacts app on phone/computer stops syncing; CardDAV client shows a 401/429, or "too many requests."
- **Inspect:**
  ```sh
  redis-cli -u "$REDIS_URL" -n 1 --scan --pattern 'dav:pair:<ip>:<email>'
  redis-cli -u "$REDIS_URL" -n 1 --scan --pattern 'dav:ip:<ip>'
  redis-cli -u "$REDIS_URL" -n 1 --scan --pattern 'dav:email:<email>'
  ```
  The **pair** bucket (10 failures/15 min) is what actually blocks a single device; the **IP** bucket (100/15 min) is a loose backstop that can catch an entire shared Cloudflare edge IP; the **email** bucket (50/15 min) is IP-independent and is the one that still protects a single account if the IP header is ever untrustworthy (`server.mjs:81-84`).
- **Unblock:**
  ```sh
  redis-cli -u "$REDIS_URL" -n 1 DEL 'dav:pair:<ip>:<email>'
  redis-cli -u "$REDIS_URL" -n 1 DEL 'dav:ip:<ip>'
  redis-cli -u "$REDIS_URL" -n 1 DEL 'dav:email:<email>'
  ```
- **Do NOT unblock the IP bucket** if many other users' pair-keys behind the same IP are also blocked and failing — that is exactly the "one bad client shouldn't lock out a shared IP" scenario the pair-bucket design exists for; check whether it's a genuine burst from many legitimate devices vs. one attacker before clearing `dav:ip:<ip>` broadly.
- Also check whether the account is simply `LOCKED` or has `scheduledDeleteAt` set (`server.mjs:1866` calls `verifyCardDavCredentials`, which rejects both) — that is not a Redis problem, see §5.

### REST API tokens (`apiRead` / `apiWrite`, keyed by token hash)

- **Symptom:** Integration/API client gets HTTP 429 with `X-RateLimit-*` headers.
- **Getting the hash:** the limiter key is `sha256(<raw bearer token>)`. Support cannot reconstruct this from the token prefix stored in the DB (`ApiToken.tokenPrefix`, first 12 chars of the plaintext) — you need either the user to paste the token they're using (never store it) or to compute the hash yourself if they share it over a secure channel:
  ```sh
  printf '%s' 'ktx_live_<...>' | shasum -a 256
  ```
- **Inspect/unblock:**
  ```sh
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:api-read::<tokenHash>'
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:api-write::<tokenHash>'
  ```
  (note the double colon — the key prefixes `rl:api-read:`/`rl:api-write:` already end in `:`).
- **Do NOT unblock when:** the traffic pattern looks like a runaway script rather than a legitimate integration bump — ask the user to fix the client's request rate first, since clearing the bucket without a client-side fix just delays the same 429s.

### Image proxy

- **Symptom:** Avatars/contact photos fail to load for one user after loading many photos quickly (e.g. big contact list, bulk import).
- **Inspect/unblock:**
  ```sh
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:image-proxy:<userId>'
  ```
- **Do NOT unblock repeatedly** — 240 fetches/minute is generous for normal use; a user consistently hitting it may need `NEXT_PUBLIC_MEDIA_HOST`/`MINIO_PUBLIC_URL` investigated instead (see `roadmap/runbooks/env-secrets.md`) so images bypass the proxy entirely.

### Share / invite email limits

- **Symptom:** "I can't send more contact-share invites" (`rl:share-email`) or "resending the invite says try again later" (`rl:invite-resend`).
- **Inspect/unblock:**
  ```sh
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:share-email:user:<userId>'
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:invite-resend:family:<memberId>'
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:invite-resend:team:<memberId>'
  ```
  (`memberId` is the `groupMember`/team-member row id of the *specific pending invite*, not the sending user — look it up from the family/team membership table, not from the user id.)
- **Do NOT unblock when:** the account is sending a high volume of invites to addresses that don't look related (this limiter exists specifically because an unlimited relay was an abuse vector — P48-17).

### Card click (public "add to Kontax" counter)

- **Symptom:** A public card's click counter looks capped / stops incrementing during a burst from one visitor.
- **Inspect/unblock:**
  ```sh
  redis-cli -u "$REDIS_URL" -n 1 DEL 'rl:card-click:ip:<ip>'
  ```
- This is an unauthenticated analytics counter, not a security control — safe to clear freely, but rarely worth a support ticket.

---

## 4. Forcing re-validation

Two caches sit in front of the database and can make a just-made admin change appear not to have taken effect for up to their TTL:

- **`sessval:v2:<userId>:<sid>`** (45 s TTL) — caches `sessionVersion`/`lifecycleState`/role/`emailVerified`/`scheduledDeleteAt` so the JWT callback doesn't hit the DB on every request.
- **`dav:cred:<hash>`** (10 min TTL), indexed by **`dav:cred:ap:<appPasswordId>`** and **`dav:cred:user:<userId>`** — caches a successful CardDAV bcrypt verification.

**The app already invalidates both automatically** on the paths that matter — you should rarely need to do this by hand:

- `invalidateSessionValidation(userId[, sid])` is called from: password change / account settings (`src/app/actions/account.ts:119,370,449`), login (`src/app/actions/auth.ts:147` — password reset), admin suspend/delete (`src/app/actions/admin.ts:138,216`), session revoke/revoke-all (`src/app/actions/sessions.ts:64,93`), notifications-triggered lockdowns (`src/server/notifications.ts:392`), email-change revert (`src/server/email-change-revert.ts:142`), and email verification (`src/server/email-verification.ts:99`).
- `invalidateDavCredentialCacheForUser(userId)` is called from: account deletion scheduling (`src/app/actions/account.ts:373`), admin suspend (`src/app/actions/admin.ts:141`), and the delete-accounts cron's hard delete (`src/app/api/cron/delete-accounts/route.ts:45`).
- `invalidateDavCredentialCacheForAppPassword(appPasswordId)` is called from `revokeUserAppPassword` (`src/server/app-passwords.ts:186-201`) whenever a single app password is revoked.

If you ever need to force it manually (e.g. you changed something directly in the DB, bypassing the app's own actions):

```sh
# All sessions for a user:
redis-cli -u "$REDIS_URL" -n 1 --scan --pattern 'sessval:v2:<userId>:*' | xargs -r redis-cli -u "$REDIS_URL" -n 1 DEL
# All cached CardDAV credentials for a user:
redis-cli -u "$REDIS_URL" -n 1 SMEMBERS 'dav:cred:user:<userId>' | xargs -r -I{} redis-cli -u "$REDIS_URL" -n 1 DEL 'dav:cred:{}'
redis-cli -u "$REDIS_URL" -n 1 DEL 'dav:cred:user:<userId>'
```

Worst case if you skip this: the stale session view self-heals within 45 s, and the stale CardDAV credential within 10 min.

---

## 5. Admin-level locks that are NOT Redis

Don't go hunting Redis keys for these — they're plain database state:

- **`lifecycleState = 'LOCKED'`** — admin suspend (`suspendAccount`, `src/app/actions/admin.ts:114-144`) / unsuspend (`unsuspendAccount`, `src/app/actions/admin.ts:158-184`). A locked account is refused at both web login (`authorize` in `src/server/auth/config.ts`) and CardDAV (`verifyCardDavCredentials`, `src/server/app-passwords.ts:231`). Fix: unsuspend via `/admin/users/<id>`, not Redis.
- **Scheduled self-deletion (`User.scheduledDeleteAt` set, `lifecycleState` stays `ACTIVE`)** — the user cancels this themselves by signing back in (their session is still valid — see the design note at `src/app/actions/account.ts:355-360`) and calling `cancelAccountDeletion` (`src/app/actions/account.ts:437`), or an admin can call `adminDeleteAccount`'s counterpart (`unsuspendAccount` also clears `scheduledDeleteAt`, `src/app/actions/admin.ts:170`).
- **Admin-scheduled deletion (`adminDeleteAccount`, `src/app/actions/admin.ts:192-227`)** — sets both `LOCKED` and `scheduledDeleteAt` (30-day purge window); reversed the same way via `unsuspendAccount`.
- **Revoked app passwords (`AppPassword.revokedAt`)** — set by `revokeUserAppPassword` (`src/server/app-passwords.ts:186`); the user must generate a new app password, there is no "unrevoke."
- **Revoked API tokens (`ApiToken.revokedAt`)** — checked in `validateApiToken` (`src/server/api-tokens.ts:29-`); same — no unrevoke, issue a new token.

---

## 6. During a Redis outage

Per `src/server/rate-limit.ts:1-35` (P48-16 policy) and `roadmap/runbooks/env-secrets.md` ("Behaviour during a Redis outage"):

- Every limiter — `rl:*` in `src/server/rate-limit.ts` and `dav:*` in both `src/server/rate-limit.ts` and `server.mjs` — is built with an `insuranceLimiter`, an in-process `RateLimiterMemory` with identical points/duration. A failed Redis round-trip transparently falls back to it.
- Nothing stops limiting; it degrades from **cluster-wide** to **per-process** counting (so effective limits are roughly multiplied by the number of running app processes for the duration of the outage), and counters start empty per process.
- `REDIS_URL` is required at boot in production. `src/server/rate-limit.ts` computes `isProductionDeploy` (`KONTAX_DEPLOY_ENV` takes priority over `NODE_ENV` so staging, which runs `NODE_ENV=production` but isn't production, is exempt — same rule as `scripts/runtime/start-production.mjs`) at `src/server/rate-limit.ts:40-42`, then throws at `src/server/rate-limit.ts:49-53` if `REDIS_URL` is unset. `assertProductionEnv()` in `src/env.js` enforces the same requirement independently. So this outage scenario is "Redis reachable at boot, then drops" — not "Redis absent."
- The CardDAV verified-credential cache (`dav:cred:*`) and the session-validation cache (`sessval:v2:*`) both fail open to the database on a Redis error — they never block a request, they just stop saving the round-trip.
- **Nothing needs manual unblocking once Redis recovers.** The next successful round-trip goes straight back to Redis; per-process memory counters simply age out on their own `duration`. No restart, no key cleanup.
- Expect one throttled warning log line per minute per scope (`warnThrottled`, `src/server/rate-limit.ts:72-81`) rather than a flood — that's by design, not a sign the throttle itself is broken.

---

## History: the shared-bucket bug

Before P48-09 every visitor landed in one rate-limit bucket keyed on the edge
proxy's address (`192.168.1.124`), because Traefik did not trust NPM's
`X-Forwarded-For`. The P47 readiness runbook proposed a Traefik
`forwardedHeaders.trustedIPs` change; that was never applied. P48-09 fixed it
in the app instead: `src/lib/client-ip.ts` and `src/server/dav/client-ip.mjs`
prefer Cloudflare's `cf-connecting-ip`, falling back to `X-Forwarded-For` /
`X-Real-IP` only for traffic that does not come through Cloudflare. When you
look up an `ip:` bucket, use the visitor's real public IP.
