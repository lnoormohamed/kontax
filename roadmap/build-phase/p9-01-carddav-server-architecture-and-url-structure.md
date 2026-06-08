# P9-01 CardDAV Server Architecture and URL Structure

## Purpose
This ticket defines the foundational architecture for running Kontax as a CardDAV server — the server-side counterpart to the existing CardDAV client sync that Kontax already performs against iCloud, Nextcloud, and other remote address books. Without a clear URL hierarchy, deployment topology decision, and HTTP method mapping, every subsequent Phase 9 ticket would be building on shifting ground. This ticket produces a frozen spec that all other P9 tickets depend on.

## Background
Kontax already functions as a CardDAV client: `src/server/carddav.ts` implements discovery, PROPFIND, REPORT, and PUT against remote CardDAV servers using Basic Auth. The existing `Contact` model in Prisma carries a `syncUid` field (unique, default cuid) that was explicitly designed to be the stable per-vCard resource identifier in sync scenarios. The `syncVersion` integer and `syncTombstoneAt` timestamp were also added with server-side sync in mind. This ticket does not touch those fields but maps them to the URL space.

Phase 9 is distinct from the existing sync feature in a critical direction: Kontax is no longer the client talking to iCloud — Kontax is the server, and the user's iPhone or Android device is the client talking to Kontax. The existing `SyncAccount` model tracks Kontax's outbound connections to external CardDAV servers; it is not used for inbound device connections.

## Scope

**In scope:**
- Decision: dedicated subdomain (`dav.kontax.app`) vs path prefix (`/dav/`) on the main Next.js app
- Complete URL hierarchy for all CardDAV server resources
- HTTP method matrix per endpoint
- Mapping from URL path parameters to Prisma model fields
- Notes on Next.js route handler placement and middleware interaction
- Discovery sequence expected by iOS, macOS Contacts, and DAVx⁵

**Out of scope:**
- Actual implementation of any endpoint (P9-03, P9-04)
- Authentication middleware implementation (P9-03)
- App password model (P9-02)
- UI (P9-05)
- Multiple address books per user — v1 ships one default address book per user

---

## Design / Implementation Spec

### Deployment Topology: Path Prefix vs Subdomain

#### Option A — Dedicated subdomain: `dav.kontax.app`
- Pros: clean separation from Next.js routing; no risk of middleware or static asset handling intercepting DAV requests; simpler `/.well-known/carddav` redirect because the `/.well-known/` path lives on a different origin; some iOS versions are stricter about redirects landing on HTTPS endpoints — a subdomain makes TLS provisioning cleaner.
- Cons: requires DNS entry, separate TLS cert (or wildcard), and additional reverse proxy configuration in production; local development requires `dav.localhost` or equivalent host entry.

#### Option B — Path prefix: `/dav/` on the main app domain
- Pros: single deployment unit; no DNS or TLS changes; Next.js route handlers can serve all DAV traffic; `/.well-known/carddav` redirect and the DAV tree are on the same domain.
- Cons: Next.js middleware runs before custom route handlers, so all `/dav/*` routes must be explicitly excluded from auth middleware, CSRF protection, and any asset-serving logic; DAV HTTP methods (`PROPFIND`, `REPORT`, `DELETE`) are non-standard from Next.js's perspective and require catch-all route handlers; harder to rate-limit independently.

**Decision: Option B — `/dav/` path prefix on the main domain.**

Rationale: Kontax is a single-server SaaS with a single Postgres instance. Adding a subdomain before the product has paying users in device-sync scenarios adds infrastructure cost for no functional benefit. The `/dav/` prefix is easy to identify in logs and can be migrated to a subdomain later if performance isolation becomes necessary. All Next.js middleware must explicitly bypass `/dav/*` routes.

### URL Hierarchy

Every URL in the CardDAV tree is scoped by `{userId}` which is the Prisma `User.id` (cuid). All paths are canonically lower-case. Trailing slash is significant on collection URLs; individual resource URLs do not have a trailing slash.

```
/.well-known/carddav
    → 301 permanent redirect to /dav/principals/{userId}/
    → This path lives at the domain root, not under /dav/.
    → iOS hits this URL first during account setup.

/dav/principals/{userId}/
    → Represents the authenticated user's principal resource.
    → Depth: 0 PROPFIND returns current-user-principal and addressbook-home-set.
    → HTTP methods: OPTIONS, PROPFIND

/dav/addressbooks/{userId}/
    → Represents the address book home set for the user.
    → Depth: 1 PROPFIND returns the list of address book collections (in v1, only "default").
    → HTTP methods: OPTIONS, PROPFIND

/dav/addressbooks/{userId}/default/
    → The default address book collection.
    → PROPFIND Depth: 0 returns collection properties (displayname, resourcetype, getctag).
    → REPORT with addressbook-query body returns all contact vCard resources.
    → HTTP methods: OPTIONS, PROPFIND, REPORT

/dav/addressbooks/{userId}/default/{contactUid}.vcf
    → An individual vCard resource. {contactUid} maps to Contact.syncUid.
    → HTTP methods: OPTIONS, GET, PUT, DELETE
```

### HTTP Method Matrix

| URL pattern | OPTIONS | PROPFIND | REPORT | GET | PUT | DELETE |
|---|---|---|---|---|---|---|
| `/.well-known/carddav` | yes | — | — | → 301 | — | — |
| `/dav/principals/{userId}/` | yes | yes (Depth 0) | — | — | — | — |
| `/dav/addressbooks/{userId}/` | yes | yes (Depth 0/1) | — | — | — | — |
| `/dav/addressbooks/{userId}/default/` | yes | yes (Depth 0/1) | yes | — | — | — |
| `/dav/addressbooks/{userId}/default/{uid}.vcf` | yes | — | — | yes | yes | yes |

OPTIONS must always return a `DAV: 1, addressbook` capability header and an `Allow:` header listing the permitted methods for that resource type.

### URL Parameter to Prisma Field Mapping

| URL parameter | Prisma field | Type | Notes |
|---|---|---|---|
| `{userId}` | `User.id` | String (cuid) | The authenticated user's primary key. Must match the user resolved from Basic Auth credentials. |
| `{contactUid}` | `Contact.syncUid` | String (cuid, unique) | Stable vCard resource identifier. Never reassigned. Survives archival. |

The `.vcf` extension on individual resource URLs is conventional for CardDAV. It must be stripped when looking up `Contact.syncUid` — i.e., a request for `/dav/addressbooks/{userId}/default/abc123.vcf` maps to `Contact.syncUid = "abc123"`.

### ETag and CTag Derivation

**ETag (per-contact):** Derived from `Contact.syncVersion`. Format: `"v{syncVersion}"`. Example: `"v7"`. This is an opaque string from the client's perspective. Clients send the ETag back in `If-Match` headers on conditional PUT and DELETE requests. When a contact is updated (by any means: UI edit, import, sync write), `syncVersion` must be incremented within the same transaction.

**CTag (per-collection):** Derived from the most recent `Contact.updatedAt` among active (non-archived, non-tombstoned) contacts for the user. Format: ISO 8601 UTC string of the timestamp. Example: `"2025-11-03T14:22:01.000Z"`. Clients cache the CTag and skip fetching contact data if it has not changed since their last poll.

Both tokens must change whenever any contact data changes. The ETag changes on every contact mutation. The CTag changes whenever any contact in the collection is created, updated, archived, or tombstoned.

### Next.js Route Handler Placement

CardDAV endpoints are implemented as Next.js Route Handlers (App Router) under `src/app/dav/`. The directory structure mirrors the URL hierarchy:

```
src/app/
  .well-known/
    carddav/
      route.ts           ← GET/HEAD → 301 redirect
  dav/
    principals/
      [userId]/
        route.ts         ← OPTIONS, PROPFIND
    addressbooks/
      [userId]/
        route.ts         ← OPTIONS, PROPFIND
        default/
          route.ts       ← OPTIONS, PROPFIND, REPORT
          [uid]/
            route.ts     ← OPTIONS, GET, PUT, DELETE
```

The `[uid]` segment captures `{contactUid}.vcf` — the `.vcf` extension is part of the path segment and must be handled by stripping it in the route handler before performing a database lookup.

### Middleware Exclusions

Next.js `middleware.ts` must exclude all `/dav/*` paths from:
- Session-based authentication checks (CardDAV uses Basic Auth, not session cookies)
- CSRF token validation
- Any redirect logic for unauthenticated users
- Any request body size limits below 2 MB (a full vCard can be several kilobytes; large contact lists sent via REPORT could be larger)

The `.well-known/carddav` redirect must also be excluded from middleware-level redirects that might interfere (e.g., redirects from HTTP to HTTPS should be handled at the infrastructure layer, not in Next.js middleware for this path).

### Content-Type Requirements

| Operation | Request Content-Type | Response Content-Type |
|---|---|---|
| PROPFIND | `application/xml` or `text/xml` | `application/xml; charset=utf-8` |
| REPORT | `application/xml` or `text/xml` | `application/xml; charset=utf-8` |
| GET (vCard) | — | `text/vcard; charset=utf-8` |
| PUT (vCard) | `text/vcard` or `text/vcard; charset=utf-8` | — (204 or 201 with ETag header) |
| DELETE | — | — (204) |

### DAV Capability Headers

All responses to CardDAV server URLs must include:

```
DAV: 1, addressbook
```

The `1` indicates basic DAV compliance. `addressbook` indicates CardDAV support. Do not advertise `calendar` or `2` compliance in this phase.

### Discovery Sequence (iOS walkthrough)

Understanding the iOS discovery sequence is critical for implementing P9-03 correctly. When a user enters the server URL in iPhone Settings:

1. iOS sends `PROPFIND /.well-known/carddav` (Depth: 0) → receives 301 redirect to `/dav/principals/{userId}/`
2. iOS follows the redirect; sends `PROPFIND /dav/principals/{userId}/` (Depth: 0) → receives principal and addressbook-home-set
3. iOS sends `PROPFIND /dav/addressbooks/{userId}/` (Depth: 1) → receives the default address book collection URL
4. iOS sends `PROPFIND /dav/addressbooks/{userId}/default/` (Depth: 0) → receives CTag
5. iOS sends `REPORT /dav/addressbooks/{userId}/default/` with addressbook-query body → receives all vCards

Steps 1 and 2 require the server to know the `userId` before the principal URL is known. The `/.well-known/carddav` redirect cannot be user-specific because iOS hits it without a user context. The solution: `/.well-known/carddav` must redirect to a user-agnostic endpoint that then redirects once the user is authenticated. In practice, iOS sends Basic Auth credentials on all requests after the first 401 challenge. The `/.well-known/carddav` endpoint returns 401 on the first hit, iOS re-sends with credentials, and the server then redirects to `/dav/principals/{userId}/` using the authenticated user's ID.

### v1 Constraints

- One address book per user (named "default"). Multiple address books are deferred.
- No CalDAV support — calendar resources are explicitly out of scope.
- No WebDAV sync-collection (`REPORT sync-collection`) in v1. Clients must use CTag polling and full REPORT addressbook-query.
- No support for `addressbook-multiget` REPORT in v1 (client requests specific UIDs by href). This is a P2 optimization.
- Contact groups (vCard `KIND:group`) are not supported in v1. Clients that send group cards will receive 415 Unsupported Media Type.

---

## Acceptance Criteria

- The URL hierarchy described in this ticket is documented, reviewed, and frozen as the canonical reference for P9-02 through P9-08.
- The path-prefix deployment decision is recorded and all team members understand why the subdomain option was deferred.
- The HTTP method matrix is complete and each cell is justified.
- The Prisma field mapping table (`{userId}` → `User.id`, `{contactUid}` → `Contact.syncUid`) is unambiguous and no other interpretation is possible.
- ETag and CTag derivation formulas are specified and confirmed to produce stable, collision-resistant values.
- Next.js route handler file placement is defined so engineers implementing P9-03 and P9-04 know exactly where to put new files.
- Middleware exclusion requirements are listed so the platform engineer can update `middleware.ts` before P9-03 work begins.
- The iOS discovery sequence is documented step by step so P9-03 can implement the `/.well-known/carddav` redirect correctly.
- v1 constraints are explicitly listed so there is no ambiguity about what is deferred.

---

## Risks and Open Questions

- **iOS well-known redirect behaviour:** Some iOS versions do not follow 301 redirects across paths cleanly if the auth challenge has not been issued yet. The exact redirect behaviour when iOS first hits `/.well-known/carddav` without credentials needs to be confirmed during P9-07 testing and may require a 302 temporary redirect instead of 301.
- **Next.js App Router and non-standard HTTP methods:** Next.js Route Handlers support named exports `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`. `PROPFIND`, `REPORT`, and `MKCOL` are non-standard. They must be handled via the catch-all export pattern or a custom request handler. Confirm the approach during P9-03 implementation: the recommended pattern is to export a function named after the method if supported, otherwise use the `req.method` string inside a generic handler.
- **ETag stability across contact merges:** When two contacts are merged, the survivor's `syncVersion` is incremented and the merged contact is tombstoned. The merged contact's UID must not appear in REPORT responses but must be preserved in the database. Confirm this is handled correctly in the merge flow before P9-04 ships.
- **Multiple address books in the future:** The v1 URL structure uses a hard-coded `default` segment. If multiple address books are introduced later, this becomes `/dav/addressbooks/{userId}/{bookSlug}/`. The migration path should be noted so future engineers do not assume `default` is a reserved word at the protocol level — it is simply the slug of the first book.
- **URL encoding of contactUid:** cuid values use only alphanumeric characters, so URL encoding is not currently a concern. If the UID generation strategy changes, encoding must be revisited.
- **Trailing slash canonicalization:** CardDAV clients are inconsistent about whether they include trailing slashes on collection URLs. The server must handle both forms for collection URLs (`/dav/addressbooks/{userId}/default` and `/dav/addressbooks/{userId}/default/`) and redirect or accept both.

---

## Outcome
This ticket is done when the URL structure, HTTP method matrix, Prisma field mapping, ETag/CTag derivation, route handler placement, and middleware exclusion list are documented, reviewed, and signed off as the frozen reference for all P9-02 through P9-08 implementation work.

## Current Status
- Status: `Done`
- Decision Summary:
  - Serve the first CardDAV server slice under `/dav/` on the main domain.
  - Keep v1 to one default address book per user.
  - Use `User.id` for principal and address-book scoping, and `Contact.syncUid` for stable `.vcf` resource URLs.
  - Treat this document as the frozen implementation reference for `P9-02` through `P9-08`.
