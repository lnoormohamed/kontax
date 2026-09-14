# P48-09 — DAV auth: client IP, Redis-backed limits, credential cache, read-only book scope, headers

**Phase:** 48 · **Workstream:** D · **Priority:** P0 · **Depends on:** P48-08
**Audit severity:** High + Medium (×2) + Low (×3)

## Objective

Fix the CardDAV authentication layer so an unauthenticated attacker cannot
lock sync for every user, so verification cost cannot be used to pin CPU, and
so the read-only book flag is enforced.

## Context

- **Global lockout (High).** `server.mjs:147-150 getRequestIp` reads
  `x-forwarded-for` → `x-real-ip` → socket. `src/lib/client-ip.ts:1-23`
  documents that behind Cloudflare → NPM → Traefik those headers carry the
  proxy's address, which is why it prefers `cf-connecting-ip`. `server.mjs`
  never reads that header, so every DAV client shares bucket
  `ip:<proxy-ip>`. `requireDavAuth` (`:229-263`) checks `isLimited` *before*
  verification (`:241`), so once tripped (20 failures / 5 s, 15 min block)
  nobody can authenticate to reset it. Unauthenticated; repeatable every 15
  min. The per-email bucket (10 failures) also lets anyone lock a specific
  victim's sync. The `buckets` Map (`:22`) is never pruned.
- **bcrypt per request (Medium).** `server.mjs:181-226` runs up to N (5 on
  paid plans) sequential bcrypt cost-12 compares (~250 ms each) on *every*
  request plus a `lastUsedAt` UPDATE. iOS sends many requests per cycle. A
  known email with zero app passwords does no bcrypt at all (timing oracle).
- **Read-only bypass (Medium).** `server.mjs:1673-1679` rejects PUT/DELETE
  when the URL's book has `deviceWritable === false`, but `:1757` looks up
  `existing` by `{ userId, syncUid }` without `bookId`, so a PUT under a
  writable slug edits a contact living in a read-only book.
- **Low:** DAV responses bypass Next's security headers (`:1854-1858`);
  `decodeURIComponent` on a malformed resource name throws → 500 with stack
  trace (`:405,443,460`); `bookScopeWhere` with `sourceBookIds` drops the
  `userId` filter (`:366-371`, latent, no writer today); `.well-known` 301
  origin derives from Host when `APP_URL` is unset (`:152-179,962-966`).
- `src/server/dav/auth.ts` is a Next-side twin using `getClientIp` correctly
  but is only reachable via the `/.well-known` fallback. `verifyCardDavCredentials`
  is duplicated between `server.mjs:181` and `src/server/app-passwords.ts:125`.

## Steps

1. **Client IP.** Replace `getRequestIp` with the logic from
   `src/lib/client-ip.ts` (prefer `cf-connecting-ip`; trust `x-forwarded-for`
   only when the socket peer is a known proxy). Import from one module so the
   two can't drift.
2. **Limits.** Move DAV auth limiting onto `rateLimiters` (Redis-backed,
   `src/server/rate-limit.ts`) with keys `dav:ip:<ip>` and
   `dav:email:<email>`; use IP+email pairs and exponential backoff rather
   than a hard shared-IP block; check limits *after* a cheap email existence
   check but before bcrypt; evict expired entries in any in-memory fallback.
3. **Verified-credential cache.** After a successful verify, cache
   `sha256(email + ":" + token)` → `{ userId, appPasswordId }` in Redis with a
   10-minute TTL; invalidate on revoke (`revokeUserAppPassword`) and on
   lifecycle change. Always perform exactly one bcrypt on failure paths,
   including the zero-passwords case. Debounce `lastUsedAt` to once per 5 min.
4. **Single implementation.** Delete the `server.mjs` copy of
   `verifyCardDavCredentials`; import from `src/server/app-passwords.ts`
   (P48-03 adds the `lifecycleState` check there).
5. **Read-only scope.** Include `bookScopeWhere(userId, book)` in the
   `existing` lookup for GET/PUT/DELETE; on PUT-update refuse (409) when the
   contact's `bookId` differs from the URL book. Add `userId` to the
   `sourceBookIds` branch.
6. **Headers and errors.** Add `X-Content-Type-Options: nosniff`, HSTS and
   `Cache-Control: no-store` to `davHeaders()`. Wrap `decodeURIComponent` and
   return 400; reject NUL bytes. Use a relative `Location` for `.well-known`.

## Acceptance

- 50 unauthenticated garbage-credential requests from one IP block *that* IP
  only; a different client IP behind the same Cloudflare edge still
  authenticates.
- Limits persist across an app restart (Redis).
- Second and subsequent requests with a valid app password perform no
  bcrypt (verify via a counter in tests or timing < 20 ms).
- Revoking an app password takes effect on the next request.
- PUT to `/dav/addressbooks/{me}/default/{uid}.vcf` for a contact that lives
  in a `deviceWritable=false` book → 403/409; the contact is unchanged.
- `PROPFIND /dav/addressbooks/{me}/default/%E0.vcf` → 400, no stack trace.
- DAV responses carry `nosniff` and HSTS.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help
- [ ] External · developers — /developers
- [x] Internal · admins/ops — roadmap/runbooks/ (DAV rate-limit keys; unblocking a user)
- [x] Internal · engineering — docs/ (DAV auth pipeline)

## References

- Audit report §High "DAV brute-force limiter keys on the proxy's IP"; §Medium "DAV read-only book flag is bypassable; every request re-runs bcrypt"; §Low DAV items
- `server.mjs`, `src/lib/client-ip.ts`, `src/server/rate-limit.ts`, `src/server/app-passwords.ts`, `src/server/dav/auth.ts`
