# Phase 34E — api.getkontax.com subdomain

> Routes `api.getkontax.com/v1/*` to the existing `/api/v1/*` handlers via DNS
> + Coolify domain configuration + Next.js middleware host rewriting, giving the
> public developer API a clean dedicated subdomain before go-live.

## Phase status
Pre-plan

## Phase objective
Give the Kontax public API a professional base URL (`https://api.getkontax.com/v1`)
that is independent of the main app URL. Today all API endpoints are reachable
only via `getkontax.com/api/v1/...`. A dedicated subdomain is a standard
developer-experience signal that the API is a first-class surface. The route
handlers, auth, and rate limiting do not change — only the URL developers use
to reach them.

## Background
Phase 29 shipped the public API (`/api/v1/*`) with token auth and rate limiting.
The developer docs page at `/developers` already exists. Pre-launch user feedback
flagged the `getkontax.com/api/v1` base URL as unexpected for a REST API —
developers expect a dedicated subdomain. This phase is purely infrastructure and
routing; no new API behaviour is introduced.

## Success criteria
- `curl https://api.getkontax.com/v1/contacts` (with valid token) returns 200
  with the same response as `getkontax.com/api/v1/contacts`.
- CORS preflight (`OPTIONS`) returns 200 with correct headers from the subdomain.
- Rate limiting, auth, and error responses are identical on both URLs.
- The TLS certificate for `api.getkontax.com` is valid (Let's Encrypt, via
  Coolify).
- Developer docs and the token UI show `api.getkontax.com/v1` as the base URL.

## Exit criteria
- DNS propagated; `dig api.getkontax.com` resolves.
- Coolify domain configuration includes `api.getkontax.com`.
- Next.js middleware rewrites `api.` host paths correctly.
- CORS headers present on all `/api/v1/*` responses.
- OPTIONS preflight: 200 with CORS headers, no auth middleware hit.
- Rate limit headers (`X-RateLimit-*`) present on subdomain responses.
- `/developers` page and token UI show the new base URL.
- Smoke test ticket (P34E-10) passes all 7 test cases.

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34E-01 — DNS: api subdomain CNAME](p34e-01-dns-api-subdomain.md)
> - [P34E-02 — Coolify: add api domain](p34e-02-coolify-api-domain.md)
> - [P34E-03 — Next.js middleware host rewrite](p34e-03-middleware-host-rewrite.md)
> - [P34E-04 — CORS headers for /api/v1/*](p34e-04-cors-headers.md)
> - [P34E-05 — OPTIONS preflight handler](p34e-05-cors-preflight.md)
> - [P34E-06 — Rate limiting verify on subdomain](p34e-06-rate-limiting-verify.md)
> - [P34E-07 — /developers docs base URL update](p34e-07-docs-base-url-update.md)
> - [P34E-08 — Token UI base URL update](p34e-08-api-token-ui-base-url.md)
> - [P34E-09 — OpenAPI servers array](p34e-09-openapi-servers.md)
> - [P34E-10 — Smoke test: api subdomain](p34e-10-smoke-test-api-subdomain.md)

### P34E-01 — DNS: api subdomain CNAME
Add `api CNAME getkontax.com TTL 300` at the DNS provider. No code change.
Verify with `dig api.getkontax.com` after propagation.

### P34E-02 — Coolify: add api domain
In Coolify application settings, add `api.getkontax.com` as an additional
domain. Coolify provisions the TLS cert automatically.

### P34E-03 — Next.js middleware host rewrite
In `src/middleware.ts`, detect `host: api.*` and rewrite
`/v1/...` → `/api/v1/...` so the existing route handlers are reached.

### P34E-04 — CORS headers for /api/v1/*
Create `src/lib/api-cors.ts` with `corsHeaders`. Apply to all `/api/v1/`
route handlers. Internal routes (`/api/auth/`, search, webhooks) must not
receive CORS headers.

### P34E-05 — OPTIONS preflight handler
Return 200 + CORS headers immediately for `OPTIONS` requests on all `/api/v1/*`
routes, before auth middleware runs.

### P34E-06 — Rate limiting verify on subdomain
Confirm that middleware rewrite preserves the Authorization header and client
IP. Verify rate limit headers are present and 429 fires at the correct threshold
on `api.getkontax.com`.

### P34E-07 — /developers docs base URL update
Replace all `getkontax.com/api/v1` references in the `/developers` page with
`api.getkontax.com/v1`. Update curl examples and auth section.

### P34E-08 — Token UI base URL update
Update the API token management UI to show `https://api.getkontax.com/v1`
as the base URL and update any example curl command shown post-creation.

### P34E-09 — OpenAPI servers array
If an OpenAPI spec exists, update `servers[0].url` to
`https://api.getkontax.com/v1`. Note as future enhancement if no spec exists.

### P34E-10 — Smoke test: api subdomain
Manual smoke test covering: 401 without auth, 200 with valid token, POST 201,
rate limit headers, CORS preflight, no rewrite of non-v1 paths, TLS validity.

## Documentation (per roadmap/documentation-policy.md)
- [x] External · developers — /developers: base URL and curl examples updated (P34E-07)
- [ ] External · users — in-app Help: none required (API subdomain is dev-facing)
- [x] Internal · admins/ops — roadmap/runbooks/: document DNS record and Coolify
      domain config for future reference
- [ ] Internal · engineering — docs/: middleware host-rewrite pattern is self-documenting
