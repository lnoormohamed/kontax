# P34E-04 — CORS headers for /api/v1/*

## Purpose

Add `Access-Control-Allow-*` CORS headers to all `/api/v1/` route responses so
that developers can call the Kontax API from browser-based tools and third-party
web apps. Internal app routes must not receive these headers.

## Background

The public API (`/api/v1/*`) introduced in Phase 29 is intended for external
developer access. Without CORS headers, browser clients from non-Kontax origins
are blocked by the browser's CORS policy. Server-side clients (curl, SDKs) are
unaffected, but browser-based API explorers, web apps calling the API directly,
and the Kontax developer documentation's interactive examples all require CORS.

CORS headers must be scoped precisely: only `/api/v1/` routes get them.
Internal routes (`/api/auth/`, `/api/contacts/search`, `/api/webhooks/`) must
not expose CORS headers — they are not public developer endpoints and adding
CORS there would unnecessarily widen the attack surface.

## Scope

**In scope**
- Create `src/lib/api-cors.ts` with the `corsHeaders` object and a `withCors`
  response wrapper.
- Apply `corsHeaders` to all route handlers under `src/app/api/v1/`.
- The `withCors` wrapper adds headers to an existing `Response` or
  `NextResponse` — it does not replace the response body or status.

**Out of scope**
- OPTIONS preflight handling — see P34E-05.
- Routes outside `/api/v1/` — explicitly must not receive CORS headers.
- Authentication or rate limiting changes.
- Restricting `Allow-Origin` to specific domains at this stage — `"*"` is
  acceptable for a public read/write API with token auth (the token is the
  auth boundary, not the origin).

## Design / Implementation Spec

### `src/lib/api-cors.ts`

```typescript
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

/**
 * Add CORS headers to a Response.
 * Use only on /api/v1/* routes — never on internal routes.
 */
export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
```

### Applying to v1 routes

In each route handler under `src/app/api/v1/`:
```typescript
import { withCors } from "~/lib/api-cors";

export async function GET(request: Request) {
  // ... existing handler logic
  const response = NextResponse.json(data, { status: 200 });
  return withCors(response);
}
```

Alternatively, if all v1 routes share a common response utility, add `withCors`
there so each handler gets CORS automatically.

### Finding all v1 routes

```bash
find src/app/api/v1 -name "route.ts" -o -name "route.tsx"
```

Update every `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` export. The `OPTIONS`
handler is added in P34E-05.

### Routes that must NOT get CORS headers

- `src/app/api/auth/` — NextAuth routes
- `src/app/api/contacts/search/` — internal search overlay
- `src/app/api/webhooks/` — webhook receiver
- Any other route outside `src/app/api/v1/`

Verify by grepping for `corsHeaders` in non-v1 routes before merging.

## Acceptance Criteria
- Every successful response from `GET /api/v1/contacts` includes
  `Access-Control-Allow-Origin: *`.
- The same header is present on 4xx and 5xx responses from v1 routes (browsers
  need CORS headers on error responses too, to expose the error body).
- `GET /api/auth/session` does not include `Access-Control-Allow-Origin`.
- `GET /api/contacts/search?q=foo` does not include `Access-Control-Allow-Origin`.
- TypeScript compilation passes; `corsHeaders` is typed as `const` (no string
  widening).

## Risks / Open Questions
- If v1 routes wrap responses in a shared utility, adding `withCors` there is
  simpler and less error-prone than updating each handler individually. Check
  for a shared response helper before touching individual files.
- `Access-Control-Allow-Origin: "*"` prohibits cookies in cross-origin requests
  (browsers block `credentials: "include"` with wildcard origin). Kontax v1
  API uses `Authorization: Bearer` tokens, not cookies, so this is not a
  concern. Document this explicitly in `api-cors.ts` for future maintainers.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): none required
- [x] External · developers — /developers (P29-07): note that CORS is enabled
      for all v1 endpoints (wait for P34E-07 to update the full docs page)
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
- [x] Internal · engineering — docs/: document the `withCors` wrapper and the
      explicit exclusion of internal routes in the API architecture notes
