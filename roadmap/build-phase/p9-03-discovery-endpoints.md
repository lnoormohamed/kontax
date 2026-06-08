# P9-03 CardDAV Discovery Endpoints

## Purpose
Before a native contacts client can sync with Kontax, it must discover the server's capabilities and locate the user's address book collection. This discovery protocol is defined by RFC 6352 (CardDAV) and RFC 5785 (well-known URIs). Getting this phase right is the single most important prerequisite for iOS account setup to succeed — if discovery fails, the user sees a generic "cannot connect" error with no actionable guidance. This ticket implements every endpoint a CardDAV client touches before it starts reading or writing contact data.

## Current Build Status
Next.js App Router rejects non-standard route exports such as `PROPFIND` during `next build`, so the first production-safe slice keeps the shared DAV auth, response, XML, and CTag helpers plus the `/.well-known/carddav` redirect endpoint, but the `/dav/principals/{userId}/` and `/dav/addressbooks/{userId}/` route files currently expose only `OPTIONS`.

The next implementation slice must introduce a DAV verb adapter outside normal App Router method exports before `PROPFIND` can be enabled in production. Options include a custom server, a reverse-proxy rewrite to a small Node handler, or a dedicated DAV service mounted beside the Next app.

## Background
P9-01 defined the URL hierarchy, HTTP method matrix, ETag/CTag derivation, and route handler placement. P9-02 defined the `AppPassword` model and the `verifyCardDavCredentials` function. This ticket consumes both: every request to a discovery endpoint is authenticated via the function from P9-02, and every URL is defined by the hierarchy from P9-01.

The existing `src/server/carddav.ts` file implements the client side of CardDAV — it sends PROPFIND and REPORT requests to remote servers. The server-side code added in this ticket is a separate concern. The XML structures used in discovery responses mirror what the client parser in `carddav.ts` already parses from remote servers, which gives a useful reference implementation.

## Scope

**In scope:**
- Basic Auth middleware for all `/dav/*` routes and `/.well-known/carddav`
- `GET /.well-known/carddav` → 301 redirect with auth challenge
- `PROPFIND /dav/principals/{userId}/` (Depth: 0)
- `PROPFIND /dav/addressbooks/{userId}/` (Depth: 0 and Depth: 1)
- `OPTIONS` responses for all discovery endpoints
- `DAV:` capability headers on all responses
- CTag computation from `Contact.updatedAt`
- XML response builder utility
- Rate limiting wiring for failed auth attempts

**Out of scope:**
- Contact resource endpoints (P9-04): REPORT, GET, PUT, DELETE on `.vcf` resources
- App password creation UI (P9-05)
- `PROPFIND /dav/addressbooks/{userId}/default/` — this is a collection endpoint covered in P9-04

---

## Design / Implementation Spec

### Basic Auth Middleware

All requests to `/dav/*` paths and `/.well-known/carddav` must be authenticated. The auth middleware is a reusable function that wraps individual route handlers, not a Next.js middleware file entry (since session cookies are not involved).

**Function signature:**

```typescript
// src/server/dav/auth.ts

export async function requireDavAuth(
  request: Request,
  expectedUserId?: string,
): Promise<
  | { userId: string; appPasswordId: string }
  | Response // 401 or 429 response
>
```

**Logic:**

1. Extract the `Authorization` header. If absent or not `Basic ...`, return a 401 response with `WWW-Authenticate: Basic realm="Kontax CardDAV"`.
2. Decode the base64 credentials. Split on the first `:` to get `email` and `password`. Usernames (emails) may contain `@` and `.` but not `:`, so splitting on the first `:` is safe.
3. Apply rate limiting (per-IP and per-email counters as defined in P9-02). If the rate limit is exceeded, return a 429 response with `Retry-After: 900` header.
4. Call `verifyCardDavCredentials(email, password)` from P9-02. If it returns `null`, increment the failure counters and return 401.
5. If `expectedUserId` is provided (i.e., the URL contains a `{userId}` path segment), verify that the authenticated user's ID matches. If not, return 403 Forbidden — a user must not be able to access another user's address book by guessing their userId.
6. Reset the failure counters on successful auth.
7. Return `{ userId, appPasswordId }`.

**Response headers for 401:**
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Basic realm="Kontax CardDAV"
DAV: 1, addressbook
Content-Type: text/plain
```

iOS reads the `WWW-Authenticate` header to know it should prompt the user for credentials during account setup. Without this header, iOS account setup fails silently.

### XML Response Builder

XML generation must use a structured builder, not string concatenation. Introduce a minimal utility in `src/server/dav/xml.ts`:

```typescript
export function buildPropfindResponse(responses: DavResponseItem[]): string
```

Where `DavResponseItem` contains:
- `href: string`
- `props: DavProp[]` — properties returned with 200 status
- `notFoundProps?: string[]` — property names returned with 404 status

**DavProp** is a union of all supported DAV properties:
- `{ name: "displayname"; value: string }`
- `{ name: "resourcetype"; types: ("collection" | "addressbook")[] }`
- `{ name: "current-user-principal"; href: string }`
- `{ name: "addressbook-home-set"; href: string }`
- `{ name: "getctag"; namespace: string; value: string }`
- `{ name: "getetag"; value: string }`

The builder must:
- Produce well-formed XML with proper namespace declarations
- Use `d:` prefix for `DAV:` namespace, `card:` for `urn:ietf:params:xml:ns:carddav`, `cs:` for `http://calendarserver.org/ns/`
- Escape all user-controlled values (display names, hrefs) using XML entity encoding
- Set HTTP status 207 Multi-Status for PROPFIND responses
- Always include `<?xml version="1.0" encoding="utf-8"?>` declaration

**Example PROPFIND response structure:**

```xml
<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:"
               xmlns:card="urn:ietf:params:xml:ns:carddav"
               xmlns:cs="http://calendarserver.org/ns/">
  <d:response>
    <d:href>/dav/principals/cld123/</d:href>
    <d:propstat>
      <d:prop>
        <d:current-user-principal>
          <d:href>/dav/principals/cld123/</d:href>
        </d:current-user-principal>
        <card:addressbook-home-set>
          <d:href>/dav/addressbooks/cld123/</d:href>
        </card:addressbook-home-set>
        <d:displayname>Alice Example</d:displayname>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>
```

### `/.well-known/carddav` Endpoint

**File:** `src/app/.well-known/carddav/route.ts`

**Handled methods:** GET, HEAD (iOS uses GET; some clients may use HEAD)

**Logic:**

1. Authenticate the request using `requireDavAuth(request)` — no `expectedUserId` since we do not know the user yet.
2. If auth fails, return the 401 response from `requireDavAuth` directly (iOS will re-send with credentials).
3. If auth succeeds, redirect to `/dav/principals/{userId}/` using HTTP 301.

**Response on success:**
```
HTTP/1.1 301 Moved Permanently
Location: /dav/principals/{userId}/
DAV: 1, addressbook
```

**Important:** The redirect target must be an absolute path (not a full URL with scheme and host) or an absolute URL. Using a relative path may confuse some clients. Use the `Host` header from the request to construct the full URL if necessary: `https://{host}/dav/principals/{userId}/`.

### `PROPFIND /dav/principals/{userId}/`

**File:** `src/app/dav/principals/[userId]/route.ts`

**Handled methods:** OPTIONS, PROPFIND

Next.js does not have a built-in `PROPFIND` export. Use the following pattern:

```typescript
export async function OPTIONS(request: Request, { params }: { params: { userId: string } }) { ... }

// Catch-all for non-standard methods
export async function GET(request: Request, { params }: { params: { userId: string } }) {
  // Next.js routes GET requests; for unknown methods, use this as a fallback
  // Actually, use the undocumented Request.method check pattern
}
```

The cleanest approach for Next.js App Router is to export a handler for the HTTP method that most closely maps to PROPFIND responses (which are GET-like reads), then check `request.method` at the top of the function to handle PROPFIND specifically. Since Next.js App Router passes all unrecognised HTTP method verbs through to the route handler, export all methods as a single unnamed export:

```typescript
// Handle both OPTIONS and PROPFIND
export async function OPTIONS(request: Request, context: RouteContext) { ... }

// PROPFIND and any other method lands here via the catch-all pattern
export const dynamic = "force-dynamic";

// Next.js App Router: unknown methods are routed to the method-named handler if it exists,
// otherwise 405. To handle PROPFIND, register it as a named export:
// This requires Next.js 14+ which supports arbitrary method names.
export async function PROPFIND(request: Request, context: RouteContext) { ... }
```

**PROPFIND logic:**

1. Call `requireDavAuth(request, params.userId)`. On auth failure, return the 401/403/429 response.
2. Read the `Depth` request header. Accept `0` and `infinity` (treat infinity as `0` for the principal resource — there are no children to enumerate).
3. Look up the `User` by `params.userId`. If not found, return 404.
4. Return 207 Multi-Status with the following properties in a `propstat` with 200 status:
   - `d:current-user-principal` → `<d:href>/dav/principals/{userId}/</d:href>`
   - `card:addressbook-home-set` → `<d:href>/dav/addressbooks/{userId}/</d:href>`
   - `d:displayname` → `User.name` (escaped)
5. Return `DAV: 1, addressbook` header on the response.

**Requested properties handling:** A correct CardDAV client sends a PROPFIND body listing the properties it wants. The server should return what is requested. For v1, return all supported properties regardless of what the client requests (i.e., always return `current-user-principal`, `addressbook-home-set`, and `displayname`). Properties not supported should be listed in a `propstat` with 404 status — this is important for clients that request specific properties the server does not implement.

**Example request body (iOS):**
```xml
<?xml version="1.0" encoding="utf-8"?>
<A:propfind xmlns:A="DAV:">
  <A:prop>
    <A:current-user-principal/>
    <A:resourcetype/>
    <A:displayname/>
  </A:prop>
</A:propfind>
```

### `PROPFIND /dav/addressbooks/{userId}/`

**File:** `src/app/dav/addressbooks/[userId]/route.ts`

**Handled methods:** OPTIONS, PROPFIND

**Depth: 0 response:** Returns the address book home set resource itself with:
- `d:displayname` → "Address Books"
- `d:resourcetype` → `<d:collection/>`
- `d:current-user-principal` → (for clients that ask here too)

**Depth: 1 response (most common — iOS uses Depth: 1 here):** Returns the home set resource (as above) PLUS one child entry per address book collection. In v1, one child: the `default` address book.

Child entry for `/dav/addressbooks/{userId}/default/`:
- `d:displayname` → "Kontax" (or user-configurable in a future pass)
- `d:resourcetype` → `<d:collection/><card:addressbook/>`
- `cs:getctag` → computed CTag (see below)
- `card:supported-address-data` → `<card:address-data-type content-type="text/vcard" version="3.0"/>`

**CTag computation:**

```typescript
async function computeCTag(userId: string): Promise<string> {
  const mostRecent = await prisma.contact.findFirst({
    where: {
      userId,
      archivedAt: null,
      syncTombstoneAt: null,
    },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  return mostRecent?.updatedAt.toISOString() ?? "empty";
}
```

The CTag must change whenever any active contact changes. Using `updatedAt` of the most recently changed contact satisfies this requirement because every contact mutation updates `updatedAt` (Prisma auto-updates this field). The `"empty"` fallback is returned when the user has no active contacts.

**Why not a hash?** A timestamp-based CTag is simpler to compute, avoids an expensive full-scan hash, and changes monotonically. The only edge case is a contact that is updated and then reverted to its previous state — in that case, `updatedAt` still changes, so the CTag still changes and clients will re-sync (at worst causing a no-op fetch). This is acceptable.

### `OPTIONS` Responses

All CardDAV endpoints must respond to OPTIONS requests with:

```
HTTP/1.1 200 OK
DAV: 1, addressbook
Allow: OPTIONS, PROPFIND
Content-Length: 0
```

The `Allow` header must list only the methods supported at that specific URL (see the method matrix in P9-01). Including unsupported methods causes some clients to attempt them and receive 405s, which degrades the user experience.

### Namespace Reference

XML namespaces used in all responses:

| Prefix | Namespace URI | Purpose |
|---|---|---|
| `d:` | `DAV:` | WebDAV base properties |
| `card:` | `urn:ietf:params:xml:ns:carddav` | CardDAV-specific properties |
| `cs:` | `http://calendarserver.org/ns/` | CTag and calendar server extensions |

All namespace declarations must appear on the root `d:multistatus` element. Do not repeat them on child elements.

### Shared Response Headers

Apply these headers to all successful DAV responses:

```
DAV: 1, addressbook
Content-Type: application/xml; charset=utf-8
Cache-Control: no-cache, no-store
```

The `Cache-Control: no-cache, no-store` header prevents proxies and CDNs from caching CardDAV responses that carry user-specific contact data.

### Error Handling

| Condition | HTTP status | Notes |
|---|---|---|
| Missing or invalid Authorization header | 401 + WWW-Authenticate | |
| Valid credentials but wrong userId in URL | 403 | Do not reveal the user exists |
| User not found (deleted account) | 404 | |
| Rate limit exceeded | 429 + Retry-After: 900 | |
| Depth header value not supported | 400 | Only for values other than 0, 1, infinity |
| Malformed PROPFIND body | 400 | Non-fatal: accept empty body and return all props |
| Database error | 503 | Do not expose internal errors |

### Integration Points

- Calls `verifyCardDavCredentials` from P9-02 (`src/server/app-passwords.ts`)
- Calls `computeCTag` (defined in this ticket, `src/server/dav/ctag.ts`)
- Calls `buildPropfindResponse` from the XML builder (`src/server/dav/xml.ts`)
- Reads `User.name` and `User.id` from Prisma
- Reads `Contact.updatedAt` (via `computeCTag`) from Prisma

### Testing Notes

- Use a CardDAV test client (e.g. `cadaver` CLI tool, or a simple Node.js script using `fetch` with Basic Auth and custom methods) to manually verify discovery responses during development.
- Automated tests should cover: 401 on missing auth, 401 on wrong password, 403 on userId mismatch, well-formed XML in PROPFIND response (parse with DOMParser and check node presence), CTag changes after a contact is updated, OPTIONS returns correct Allow header.
- Do not test against a real iOS device in this ticket — that is P9-07.

---

## Acceptance Criteria

- `/.well-known/carddav` returns 401 on unauthenticated requests with a `WWW-Authenticate` header.
- `/.well-known/carddav` returns 301 to `/dav/principals/{userId}/` for authenticated requests.
- `PROPFIND /dav/principals/{userId}/` (Depth: 0) returns 207 with `current-user-principal` and `addressbook-home-set` properties.
- `PROPFIND /dav/addressbooks/{userId}/` (Depth: 1) returns 207 with the default address book collection including `displayname`, `resourcetype`, and `getctag`.
- The CTag in the PROPFIND response changes when any active contact is updated.
- All responses include `DAV: 1, addressbook` header.
- All responses are well-formed XML that can be parsed by a standard XML parser.
- A request authenticated with a revoked app password receives 401.
- A request with a valid app password but wrong userId in the URL receives 403.
- Rate limiting returns 429 after 10 failed auth attempts from the same email within 15 minutes.
- OPTIONS requests to all discovery endpoints return the correct `Allow` header.
- XML namespaces (`DAV:`, `urn:ietf:params:xml:ns:carddav`, `http://calendarserver.org/ns/`) are correctly declared on all responses.
- The `getctag` property uses the `http://calendarserver.org/ns/` namespace (not `DAV:`).

---

## Risks and Open Questions

- **PROPFIND as a Next.js method export:** Next.js 14 App Router supports arbitrary HTTP method names as named exports only if the runtime accepts them. Verify that deploying on Vercel or the Docker environment used by Kontax does not silently drop PROPFIND requests. An alternative is to use a catch-all route handler and branch on `request.method`.
- **iOS aggressive caching of well-known redirect:** Some iOS versions cache the 301 redirect from `/.well-known/carddav` for the duration of the account. If the userId changes (e.g. the account is deleted and recreated), the cached redirect will break. Use `Cache-Control: no-cache` on the well-known response to prevent this.
- **Empty-body PROPFIND:** RFC 4918 allows a PROPFIND with no body, which is interpreted as requesting `allprop`. Some clients (particularly older DAVx⁵ versions) send empty bodies. The server must handle this gracefully by returning all supported properties.
- **Encoding of user display names:** `User.name` is user-supplied and may contain XML special characters (`<`, `>`, `&`, `"`, `'`). The XML builder must escape these. Failing to do so produces malformed XML that crashes the client parser.
- **`infinity` Depth on principals:** The DAV spec allows `Depth: infinity` but CardDAV clients should never send it to the principal URL. Handle it by treating it as `Depth: 0` with a `418 I'm a Teapot` response or simply ignoring and returning the same response as Depth: 0. RFC 4918 §9.1 recommends returning `403 Forbidden` for `Depth: infinity` on PROPFIND if the server does not support it, which is the safe choice.
- **Encoding of userId in redirect URL:** `User.id` is a cuid (alphanumeric), so URL encoding is not currently a concern. If the ID generation changes, ensure the redirect URL is properly percent-encoded.

---

## Outcome
This ticket is done when a CardDAV client (tested using `cadaver` or equivalent) can complete the full discovery sequence — well-known redirect, principal PROPFIND, address book home set PROPFIND — using Basic Auth with an app password, and receives well-formed 207 responses with the correct XML properties at each step.

## Current Status
- Status: `In Progress`
- Delivered Slice:
  - Added reusable DAV Basic Auth backed by `verifyCardDavCredentials`.
  - Added DAV response helpers for 401, 403, 429, OPTIONS, XML 207, and method-not-allowed responses.
  - Added XML multistatus generation with DAV, CardDAV, and CalendarServer namespace support.
  - Added CTag computation from active contact `updatedAt`.
  - Added `/.well-known/carddav`, `/dav/principals/{userId}/`, and `/dav/addressbooks/{userId}/` route handlers.
- Remaining Before Done:
  - Resolve native `PROPFIND` handling in the Next.js runtime. Local smoke testing showed `OPTIONS` and `/.well-known/carddav` work, but `PROPFIND` currently returns `400 Bad Request` before the route handler can return XML.
  - Confirm the deployed runtime accepts DAV verbs after the handler/proxy strategy is updated.
  - Decide whether to keep the temporary in-memory rate limiter for local/dev only or replace it before production rollout.

## Smoke Test Notes
- `GET /.well-known/carddav` without auth returned `401` with `WWW-Authenticate: Basic realm="Kontax CardDAV"` and `DAV: 1, addressbook`.
- `GET /.well-known/carddav` with a temporary app password returned `301` to `/dav/principals/{userId}/`.
- `OPTIONS /dav/principals/{userId}` returned `200` with `Allow: OPTIONS, PROPFIND` and DAV headers.
- `PROPFIND /dav/principals/{userId}` returned `400 Bad Request` before route logic produced a DAV response. This confirms that the next slice needs a custom server/proxy strategy or another runtime-compatible DAV verb path before `P9-03` can be marked done.
