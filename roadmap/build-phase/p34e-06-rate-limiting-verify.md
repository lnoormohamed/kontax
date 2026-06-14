# P34E-06 — Rate limiting verify on subdomain

## Purpose

Confirm that the Next.js middleware host rewrite (P34E-03) does not strip the
`Authorization` header or alter the client IP, and that rate limiting behaviour
on `api.getkontax.com` is identical to `getkontax.com/api/v1/` — same limits,
same headers, same 429 response.

## Background

The rate limiter (from P29-08) keys off the API token extracted from the
`Authorization: Bearer` header. If the middleware rewrite strips or alters this
header, the rate limiter would fall back to IP-based keying (if implemented) or
fail open. Additionally, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
`X-RateLimit-Reset` headers must appear on responses so developers can manage
their usage. This is a verification ticket — it may produce a code fix if
issues are found, but the expected outcome is "no change needed".

## Scope

**In scope**
- Verify the `Authorization` header is preserved through the middleware rewrite.
- Verify the client IP (`X-Forwarded-For` or `request.ip`) is preserved through
  the rewrite.
- Confirm `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`
  headers are present on all `/api/v1/` responses (both success and 429).
- Simulate the per-token rate limit threshold to confirm 429 fires at the
  correct count (read-only token limit: 1000 req/hour per P29-08 spec).
- If any issue is found, apply a minimal fix and document it.

**Out of scope**
- Changing rate limit values or adding new rate limit tiers.
- Load testing at scale.
- Per-IP rate limiting changes (only token-keyed rate limiting is in scope for
  verification).

## Design / Implementation Spec

### Header preservation check

After deploying P34E-03, send a request with a known valid token:

```bash
# Via subdomain
curl -v -H "Authorization: Bearer kt_live_xxx" \
  https://api.getkontax.com/v1/contacts 2>&1 | grep -iE "x-ratelimit|authorization"

# Via main domain (baseline)
curl -v -H "Authorization: Bearer kt_live_xxx" \
  https://getkontax.com/api/v1/contacts 2>&1 | grep -iE "x-ratelimit|authorization"
```

Compare `X-RateLimit-Remaining` values — they should decrement from the same
counter (same token = same bucket).

### Rate limit threshold test

Use a small script to exhaust a test token (create a throwaway token for this
test):

```bash
for i in $(seq 1 20); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer kt_test_xxx" \
    https://api.getkontax.com/v1/contacts)
  echo "Request $i: $STATUS"
done
```

Verify that 429 is returned at the correct limit. If the limit is 1000/hour,
use a test environment or a dedicated low-limit test token if the rate limiter
supports it.

### X-Forwarded-For preservation

The middleware rewrite must not reset the `X-Forwarded-For` header. Verify by
checking access logs on the server or adding a temporary debug log in the rate
limiter to confirm the IP seen in the rewritten request matches the client IP.

### If headers are missing or rate limit breaks

Check the rate limiter implementation in `src/` (search for `X-RateLimit` or
the rate limit middleware). If it runs before the rewrite completes, the
request host may be `api.getkontax.com` — ensure the rate limiter does not
filter by host.

## Acceptance Criteria
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` are
  present on every `GET /api/v1/contacts` response via `api.getkontax.com`.
- The same token's `X-RateLimit-Remaining` decrements consistently whether
  the request is made via `api.getkontax.com` or `getkontax.com/api/v1/`.
- After exhausting the limit (in a test environment), 429 is returned with a
  `Retry-After` header (or equivalent).
- The 429 response also includes the CORS headers from P34E-04 (browsers must
  be able to read the 429 body).
- No regression: the rate limiter still works correctly on `getkontax.com`.

## Risks / Open Questions
- If the rate limiter uses `request.headers.get("x-forwarded-for")` and
  Traefik/Coolify sets this header differently for the subdomain, the IP key
  may differ from the token key. Verify the key extraction logic.
- Testing at the 1000 req/hour threshold in production would exhaust a real
  token. Use a separate test token or a staging environment if available.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): none required
- [x] External · developers — /developers (P29-07): confirm rate limit headers
      section is accurate; add note that limits apply per token regardless of
      which base URL is used
- [x] Internal · admins/ops — roadmap/runbooks/: document rate limit thresholds
      and the per-token keying strategy for on-call reference
- [ ] Internal · engineering — docs/: none required
