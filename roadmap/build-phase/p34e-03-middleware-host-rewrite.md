# P34E-03 — Next.js middleware host rewrite

## Purpose

Add host-based path rewriting in `src/middleware.ts` so that requests arriving
at `api.getkontax.com/v1/...` are internally rewritten to
`/api/v1/...` and served by the existing route handlers — without any change
to the handlers themselves and without a visible redirect to the client.

## Background

Next.js middleware runs at the edge before route handlers and can rewrite the
URL the handler sees while keeping the original URL visible to the client. This
is the standard pattern for subdomain routing in Next.js apps without separate
deployments. After this ticket, `GET api.getkontax.com/v1/contacts` is
functionally identical to `GET getkontax.com/api/v1/contacts` — same handler,
same auth, same rate limiter, same response.

## Scope

**In scope**
- Create `src/middleware.ts` if it does not already exist; otherwise extend the
  existing middleware.
- Detect requests where `host` starts with `"api."`.
- For those requests, if the pathname does not already start with `/api/`,
  prepend `/api` to the pathname before rewriting.
- Return `NextResponse.rewrite(url)` with the modified URL.
- Requests to `api.getkontax.com/api/...` (already prefixed) must not be
  double-prefixed — the `!url.pathname.startsWith("/api/")` guard prevents this.
- All other requests (host does not start with `"api."`) must pass through
  unchanged via the existing middleware logic (or `NextResponse.next()`).
- Export a `config.matcher` that covers all paths except Next.js static assets:
  ```typescript
  export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  };
  ```

**Out of scope**
- CORS headers — see P34E-04.
- Auth middleware logic — unchanged.
- Any route handler changes.
- `www.api.getkontax.com` — not a supported subdomain.

## Design / Implementation Spec

### Middleware implementation

```typescript
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  if (host.startsWith("api.")) {
    const url = request.nextUrl.clone();
    if (!url.pathname.startsWith("/api/")) {
      url.pathname = `/api${url.pathname}`;
    }
    return NextResponse.rewrite(url);
  }

  // Preserve any existing middleware logic below:
  // e.g. auth redirects, locale detection, etc.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### Existing middleware

If `src/middleware.ts` already exists (e.g. for auth redirects), integrate the
`api.` host check at the top of the function — before any auth logic — so that
API requests are rewritten first and then proceed to auth via the route handler
itself (not middleware-level auth).

### Local testing

To test locally without DNS, use a `Host` header override:
```bash
curl -H "Host: api.getkontax.com" http://localhost:3000/v1/contacts
```
This simulates the middleware host check without needing actual subdomain DNS.

### Edge cases

- `api.getkontax.com/` (root) → rewrites to `/api/` → 404 (no `/api/` root
  handler). Acceptable — the `/api/` root is not a defined endpoint.
- `api.getkontax.com/api/v1/contacts` (already prefixed) → not double-prefixed
  due to the guard; rewrites to `/api/v1/contacts`.
- `api.getkontax.com/v1/contacts?include=labels` → query string is preserved by
  `request.nextUrl.clone()`.

## Acceptance Criteria
- `curl -H "Host: api.getkontax.com" http://localhost:3000/v1/contacts`
  (with valid auth header) returns the same response as
  `curl http://localhost:3000/api/v1/contacts`.
- The `Host` header seen by route handlers remains `api.getkontax.com` (the
  rewrite changes the pathname only, not the host).
- Paths not matching `/v1/...` (e.g. `/_next/static/`) are not rewritten.
- Requests to `getkontax.com` are unaffected — no rewrite, existing behaviour
  unchanged.
- TypeScript compilation passes; no `@ts-ignore` in middleware.

## Risks / Open Questions
- If an existing auth middleware redirects unauthenticated requests to `/login`,
  ensure the `api.` host branch returns the rewrite *instead of* reaching the
  auth redirect block — API clients should receive 401 from the route handler,
  not a 302 redirect to the login page.
- `request.nextUrl.clone()` in middleware is the correct Next.js pattern for
  rewrites. Avoid `new URL(...)` as it may not preserve the internal routing
  context.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): none required
- [ ] External · developers — /developers (P29-07): none yet (wait for P34E-07)
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [x] Internal · engineering — docs/: document the host-rewrite pattern and local
      testing method (`-H "Host: api..."`) in the API architecture notes
