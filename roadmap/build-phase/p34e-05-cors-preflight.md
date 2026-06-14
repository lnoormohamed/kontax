# P34E-05 — OPTIONS preflight handler

## Purpose

Handle HTTP `OPTIONS` preflight requests on all `/api/v1/*` routes by returning
`200` with CORS headers immediately, before any auth middleware or rate-limit
logic runs, so browser clients can proceed with their actual requests.

## Background

When a browser sends a cross-origin request with a custom header (e.g.
`Authorization`), it first sends an `OPTIONS` preflight request. If the server
does not respond with appropriate CORS headers within a timeout, the browser
blocks the actual request. The preflights must return 200 quickly without
hitting authentication (which would return 401 and break the preflight flow).

P34E-04 added CORS headers to successful responses; this ticket adds the
`OPTIONS` handler so preflights themselves succeed.

## Scope

**In scope**
- Add an `OPTIONS` export to every route handler under `src/app/api/v1/` that
  returns `200` with `corsHeaders` and an empty body.
- The `OPTIONS` handler must not invoke auth middleware or rate limiting.
- Verify with a `curl` preflight command after deployment.

**Out of scope**
- CORS headers on non-OPTIONS responses — see P34E-04.
- Routes outside `/api/v1/`.
- Middleware-level OPTIONS handling — per-route exports are simpler and more
  explicit.

## Design / Implementation Spec

### Per-route OPTIONS export

In each route handler under `src/app/api/v1/`, add:

```typescript
import { corsHeaders } from "~/lib/api-cors";

export function OPTIONS(_request: Request) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}
```

This is a plain synchronous function — no `async`, no DB calls, no auth. The
underscore prefix on `_request` signals the param is intentionally unused.

### If a shared v1 route layout exists

If the v1 routes share a `layout.ts` or a route-group file that runs for all
routes, a single OPTIONS handler there may suffice. Check the file structure
before adding individual exports — one shared handler is preferable to ten
individual copies.

### Verification

```bash
curl -X OPTIONS \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization" \
  https://api.getkontax.com/v1/contacts \
  -v 2>&1 | grep -E "< HTTP|Access-Control"
```

Expected output:
```
< HTTP/2 200
< access-control-allow-origin: *
< access-control-allow-methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
< access-control-allow-headers: Authorization, Content-Type
< access-control-max-age: 86400
```

### Auth middleware interaction

Ensure that any existing auth middleware in `src/middleware.ts` does not
intercept OPTIONS requests to `/api/v1/` and redirect them to `/login`. If the
middleware has an auth check for `/api/v1/`, add an early return for OPTIONS:

```typescript
if (request.method === "OPTIONS" && request.nextUrl.pathname.startsWith("/api/v1/")) {
  return new Response(null, { status: 200, headers: corsHeaders });
}
```

## Acceptance Criteria
- `curl -X OPTIONS https://api.getkontax.com/v1/contacts` returns `200`.
- The response includes all four `Access-Control-*` headers from `corsHeaders`.
- The response body is empty.
- A browser `fetch` with `Authorization` header to `api.getkontax.com/v1/contacts`
  from a different origin completes successfully (preflight + actual request both
  return 2xx).
- `OPTIONS /api/auth/session` is NOT handled by the new OPTIONS export —
  internal routes are unaffected.

## Risks / Open Questions
- If the Next.js middleware (P34E-03) rewrites `api.getkontax.com/v1/contacts`
  to `/api/v1/contacts` before the OPTIONS check runs, the OPTIONS handler in
  the route file is reached via the rewritten path. Verify that the middleware
  does not short-circuit OPTIONS before it reaches the handler.
- Some Next.js versions handle OPTIONS at the framework level and may not reach
  the route handler. If the exported `OPTIONS` function is not invoked, handle
  OPTIONS in the middleware instead.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): none required
- [x] External · developers — /developers (P29-07): note that CORS preflight is
      supported; include the curl verification command in the API reference
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [ ] Internal · engineering — docs/: none required (implementation is in code)
