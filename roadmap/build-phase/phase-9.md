# Phase 9 — Kontax as a CardDAV Server (Native Device Sync)

## Objective
Turn Kontax into a CardDAV server so users can add it as a native contacts account on iPhone, Android, macOS, Outlook, and any other standards-compliant contacts client. This is the foundation of the contacts-hub vision: instead of asking users to remember to sync, their devices stay current automatically in the background, just like iCloud or Google Contacts.

## Success Criteria
- A user can go to iPhone Settings > Contacts > Accounts > Add Account > Other > Add CardDAV Account, enter their Kontax server URL and credentials, and have their Kontax contacts appear natively on their phone.
- Changes made on the phone are reflected in Kontax, and changes made in Kontax are pushed to the phone — without the user doing anything manually.
- The server is compatible with iOS, macOS Contacts, and at least one Android client (e.g. DAVx⁵).
- App passwords are distinct from the user's login password so native clients can be revoked independently.

## Exit Criteria
- The Kontax CardDAV server passes a basic standards-compliance smoke test against an iOS client and DAVx⁵.
- App password creation, listing, and revocation are available in the UI.
- The server is behind its own subdomain or path (`dav.kontax.app` or `/dav/`) and does not interfere with the existing web app routing.
- Existing CardDAV client sync (iCloud, Nextcloud, etc.) continues to work unchanged.
- Phase 9 note: `P9-01` is now complete as the frozen architecture baseline for all later CardDAV server implementation work.

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P9-01 | Done | P0 | P1-01 |
| P9-02 | Done | P0 | P9-01 |
| P9-03 | Done | P0 | P9-01 |
| P9-03a | Done | P0 | P9-03 |
| P9-03b | Done | P0 | P9-03a |
| P9-03c | Done | P0 | P9-03b |
| P9-04 | Not Started | P0 | P9-02, P9-03 |
| P9-05 | Not Started | P1 | P9-04 |
| P9-06 | Not Started | P1 | P9-04 |
| P9-07 | Not Started | P1 | P9-05, P9-06 |
| P9-08 | Not Started | P2 | P9-07 |

---

## P9-01 — Define CardDAV server architecture and URL structure
- Status: `Done`
- Priority: `P0`
- Dependencies: `P1-01`
- Implementation Notes:
  - Decide whether the CardDAV server lives on a dedicated subdomain (`dav.kontax.app`) or under a path prefix (`/dav/`) on the main app.
  - A dedicated subdomain is cleaner for iOS discovery and avoids Next.js routing conflicts; a path prefix is simpler to deploy on a single host. Document the tradeoff and pick one.
  - Define the full URL hierarchy:
    - `/.well-known/carddav` → redirect to principal URL (required for iOS auto-discovery)
    - `/dav/principals/{userId}/` → current-user-principal
    - `/dav/addressbooks/{userId}/` → address book home set
    - `/dav/addressbooks/{userId}/default/` → default address book collection
    - `/dav/addressbooks/{userId}/default/{contactUid}.vcf` → individual contact vCards
  - Map these routes to the existing Prisma schema: `Contact.syncUid` becomes the stable per-vCard resource identifier; `SyncAccount` is not involved (this is the server side, not a client connection).
  - Identify which HTTP methods each endpoint must handle: `PROPFIND`, `REPORT`, `GET`, `PUT`, `DELETE`, `OPTIONS`.
  - The delivered architecture slice now freezes the v1 decision to serve CardDAV under a `/dav/` path prefix on the main domain, use one default address book per user, scope collection URLs by `User.id`, and map individual card resources to `Contact.syncUid`.
  - Route-handler placement is defined under the Next.js App Router, middleware exclusions are called out explicitly, and the iOS discovery sequence is documented as the reference flow for later implementation tickets.
  - ETag/CTag derivation is now specified against `Contact.syncVersion` and collection-level `updatedAt` changes so later write and discovery tickets can implement stable change detection without redesign.
- Acceptance Criteria:
  - URL structure is documented and frozen.
  - Each endpoint's required HTTP methods are listed.
  - The mapping from URL space to Prisma models is unambiguous.
  - Deployment topology decision is made and recorded.
- Risks / Open Questions:
  - iOS requires `/.well-known/carddav` to redirect cleanly after auth challenge handling — this must not be blocked by Next.js middleware or static asset handling.
  - Next.js support for non-standard DAV methods (`PROPFIND`, `REPORT`) still needs validation in implementation, even though the URL and handler layout are now frozen.
  - Multiple address books are deferred in v1; future phases must treat `default` as a slug, not a protocol-level permanent limitation.

---

## P9-02 — Implement app password model
- Status: `Done`
- Priority: `P0`
- Dependencies: `P9-01`
- Implementation Notes:
  - Native CardDAV clients authenticate with Basic Auth (username + password over HTTPS). The user's account password must not be used for this — it would expose login credentials to every device they connect.
  - Add an `AppPassword` model to the Prisma schema: `id`, `userId`, `label` (e.g. "iPhone"), `hashedPassword`, `lastUsedAt`, `createdAt`, `revokedAt`.
  - Generate app passwords as random 24–32 character base58 strings. Show the plaintext exactly once at creation time, then store only the bcrypt hash.
  - Username for CardDAV auth is the user's email address.
  - App passwords are plan-gated: FREE users get 1, PLUS gets 3, PRO gets unlimited. Document the limits.
  - Revoking an app password immediately blocks that device from syncing without affecting other devices or the user's login session.
- Acceptance Criteria:
  - `AppPassword` schema is migrated and stable.
  - App passwords can be created, listed (label + last used + created), and revoked from the settings UI.
  - Plaintext is shown once at creation and never again.
  - Bcrypt hash is used for verification during CardDAV auth.
  - Revoked passwords are rejected at the server with HTTP 401.
- Risks / Open Questions:
  - Rate-limit app password creation and auth attempts to prevent brute-force.
  - Consider whether to support per-password sync-direction restrictions in a future pass.

---

## P9-03 — Implement CardDAV server authentication and discovery endpoints
- Status: `Done`
- Priority: `P0`
- Dependencies: `P9-01`
- Implementation Notes:
  - **Architecture:** DAV verbs (PROPFIND, REPORT, etc.) are handled in `server.mjs` — a custom Node.js HTTP server that wraps Next.js. The server intercepts all DAV traffic before Next.js processes it. Next.js App Router does not support non-standard HTTP method exports in production builds. Next.js route files under `src/app/dav/` and `src/app/.well-known/carddav/` are stubs that handle OPTIONS and return 405 for standard methods. All real DAV logic lives in server.mjs.
  - `handleWellKnown` in server.mjs handles `/.well-known/carddav`: issues a 401 auth challenge first (required for iOS to prompt for credentials), then on authenticated requests returns a 301 redirect to `/dav/principals/{userId}/`.
  - `handlePrincipal` in server.mjs handles `PROPFIND /dav/principals/{userId}/` (Depth:0 and Depth:infinity treated as 0): returns `current-user-principal`, `addressbook-home-set`, and `displayname`.
  - `handleAddressBooks` in server.mjs handles `PROPFIND /dav/addressbooks/{userId}/` (Depth:0 and Depth:1): Depth:1 includes the default address book collection with `displayname`, `resourcetype`, `getctag`, and `supported-address-data`.
  - CTag is computed from `MAX(updatedAt)` across all contacts for the user with no archived/tombstone filter — this ensures deletions and archives trigger a CTag change and clients detect them.
  - `verifyCardDavCredentials` in server.mjs uses Prisma ORM directly. The equivalent in `src/server/app-passwords.ts` uses raw SQL — these are separate code paths; server.mjs is the live auth path for CardDAV.
  - TypeScript helper modules (`src/server/dav/`) mirror server.mjs logic for use by future Next.js-native endpoints. These two implementations must be kept in sync manually when either changes.
- Acceptance Criteria:
  - iOS account setup wizard completes discovery without error when pointed at the Kontax server URL.
  - `/.well-known/carddav` redirects correctly after issuing a 401 challenge.
  - Principal and address book PROPFIND responses are well-formed XML with correct namespace declarations.
  - CTag changes whenever any contact in the collection is created, updated, archived, or tombstoned.
- Risks / Open Questions:
  - P9-03b hardens `buildPropfindResponse` in server.mjs with 404 propstat handling for unsupported requested properties and rejects `Depth: infinity` with 403 before P9-07 compatibility testing.
  - Duplicate implementations between server.mjs and `src/server/dav/*` must stay in sync manually. Consider importing from compiled TypeScript output in a future hardening pass.

---

## P9-03a — DAV auth, XML helpers, CTag, well-known, principal and address-book PROPFIND
- Status: `Done`
- Priority: `P0`
- Dependencies: `P9-03`
- Implementation Notes:
  - Delivered as part of P9-03. All logic lives in `server.mjs` (the custom Node.js HTTP adapter).
  - `src/server/dav/auth.ts` — `requireDavAuth` middleware for Next.js-native routes (future use). In-memory rate limiter (IP + email buckets, 15-min window). Acceptable for Docker/Coolify long-running deployment.
  - `src/server/dav/xml.ts` — `buildPropfindResponse` TypeScript helper. Includes 404 propstat block for unsupported properties. Mirrors server.mjs XML builder.
  - `src/server/dav/ctag.ts` — `computeAddressBookCTag` TypeScript helper. Queries all contacts (no archived/tombstone filter) so CTag reflects deletions. Mirrors server.mjs implementation.
  - `src/server/dav/responses.ts` — typed response helpers (`unauthorizedDavResponse`, `xmlDavResponse`, etc.) for Next.js routes.
  - `src/app/.well-known/carddav/route.ts` — Next.js stub. Handles GET/HEAD via `requireDavAuth` + 301 redirect. Real well-known handling is in server.mjs `handleWellKnown`.
  - `src/app/dav/principals/[userId]/route.ts` — Next.js stub. OPTIONS + 405 for standard methods. PROPFIND handled by server.mjs `handlePrincipal`.
  - `src/app/dav/addressbooks/[userId]/route.ts` — Next.js stub. OPTIONS + 405 for standard methods. PROPFIND handled by server.mjs `handleAddressBooks`.

---

## P9-03b — Harden DAV discovery XML and depth handling
- Status: `Done`
- Priority: `P0`
- Dependencies: `P9-03a`
- Implementation Notes:
  - Extend the live `server.mjs` XML builder to produce separate `HTTP/1.1 404 Not Found` propstat blocks for unsupported properties requested by DAV clients.
  - Parse requested property names from the `PROPFIND` body for discovery endpoints and return supported properties in a 200 propstat plus unsupported requested properties in a 404 propstat.
  - Mirror the safer propstat rendering behavior in `src/server/dav/xml.ts` so future TypeScript route/helper usage does not drift from the live adapter.
  - Reject `Depth: infinity` on principal and address-book discovery PROPFIND requests with 403 instead of silently treating it as supported.
  - Keep App Router DAV files as standard-method stubs only; all non-standard DAV verbs remain owned by `server.mjs`.
- Acceptance Criteria:
  - `npm run build` passes.
  - `PROPFIND` with a requested unsupported property returns a `207 Multi-Status` response containing a `404 Not Found` propstat.
  - `PROPFIND` with `Depth: infinity` returns `403`.
  - Existing well-known redirect, principal discovery, and address-book discovery smoke tests still pass.
- Risks / Open Questions:
  - The XML request parser is intentionally small and discovery-focused; P9-04 may need richer XML parsing for REPORT bodies.
  - DAV namespace prefixes are normalized by local property name for now, which is acceptable for the small discovery property set but should be revisited before broader DAV extensions.

---

## P9-03c — Fix forwarded-proto/host handling for CardDAV redirects
- Status: `Done`
- Priority: `P0`
- Dependencies: `P9-03b`
- Implementation Notes:
  - **Problem:** `handleDavRequest` in server.mjs built `requestUrl` using a hardcoded `http://` base, so the `Location` header on the well-known 301 redirect always read `http://kontax.vexon.co/...` even in production. The server sits behind Cloudflare → Coolify, both of which terminate TLS and forward requests to the Node process over plain HTTP. iOS may reject or silently downgrade a CardDAV account setup that redirects to an `http://` URL.
  - **Fix:** Read `x-forwarded-proto` (set by Cloudflare/Coolify with the client-facing protocol) and `x-forwarded-host` (set when the public hostname differs from the internal `Host` header) before constructing `requestUrl`.
    - `proto` = `req.headers["x-forwarded-proto"]?.split(",")[0]?.trim() ?? "http"` — splits on comma to handle multi-hop proxy chains (e.g. `https, http`), takes the leftmost (client-facing) value.
    - `host` = `req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:{port}"` — uses the public hostname if the proxy sets it, falls back to the `Host` header.
  - Result: `requestUrl` now reflects the public-facing URL (`https://kontax.vexon.co/...`), so all absolute URLs generated from it (currently only the well-known redirect Location) are correct.
  - **Discovered via:** P9-03b smoke test on the deployed Coolify instance.
- Acceptance Criteria:
  - Authenticated `GET /.well-known/carddav` returns `Location: https://kontax.vexon.co/dav/principals/{userId}/` (HTTPS, not HTTP).
  - Behaviour is unchanged in local development (`x-forwarded-proto` absent → falls back to `http://localhost`).
- Risks / Open Questions:
  - If Coolify or a future proxy sets `x-forwarded-proto` to a comma-separated list in a different order, the split-and-trim logic uses the first value. Verify the proxy chain sets the header in leftmost-client-facing order (standard behaviour for Cloudflare).

---

## P9-04 — Implement contact resource endpoints (REPORT, GET, PUT, DELETE)
- Status: `Not Started`
- Priority: `P0`
- Dependencies: `P9-02`, `P9-03`
- Implementation Notes:
  - `REPORT /dav/addressbooks/{userId}/default/` with `addressbook-query` body (Depth: 1): return a list of contact resources with `getetag` and `address-data` (full vCard). This is what clients use on first sync and after a CTag change.
  - `GET /dav/addressbooks/{userId}/default/{uid}.vcf`: return a single vCard. Used by clients that prefer per-resource fetching.
  - `PUT /dav/addressbooks/{userId}/default/{uid}.vcf`: create or update a contact from the client. Parse the vCard body using the existing `carddav.ts` vCard parser and upsert into the `Contact` table using `syncUid` as the stable key. Return the new ETag in the response header.
  - `DELETE /dav/addressbooks/{userId}/default/{uid}.vcf`: soft-delete (archive) the contact. Do not hard-delete — preserve the record and set `syncTombstoneAt` so conflict resolution and audit trails remain intact.
  - ETag is a per-contact change token. Derive it from `contact.syncVersion` or a hash of `contact.updatedAt` — clients send it in `If-Match` headers for conditional updates.
  - Respect `If-Match` on PUT: if the client sends a stale ETag, return HTTP 412 Precondition Failed so the client knows to re-fetch before overwriting.
  - vCard serialization: reuse the existing `contactsToVCard` function from `contact-portability.ts`, ensuring `UID` is always written as `Contact.syncUid`.
- Acceptance Criteria:
  - REPORT returns all active (non-archived) contacts as vCards.
  - PUT creates new contacts and updates existing ones by UID without duplicating.
  - DELETE archives the contact rather than destroying it.
  - ETag and If-Match conditional updates work correctly.
  - A full iOS initial sync populates the phone with the user's Kontax contacts.
  - Changes made on the phone appear in Kontax after the next iOS background sync.
- Risks / Open Questions:
  - iOS sends `REPORT` with `Depth: 1` — confirm the server handles this correctly and does not require an explicit `Depth: 0` fallback.
  - Large contact lists should be paged or streamed — consider a contact count limit warning for FREE tier users.
  - Archived contacts must not appear in REPORT responses but their UIDs must not be reused.

---

## P9-05 — Add CardDAV server settings and connect instructions to the UI
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P9-04`
- Implementation Notes:
  - Add a "Connect a device" section to the settings page (or a new `/settings/devices` route).
  - Surface the user's CardDAV server URL, their username (email), and a prompt to create an app password.
  - App password creation: label input (e.g. "iPhone", "macOS"), generate on submit, show plaintext once with a copy button, then display only the label and last-used date.
  - App password list: show label, created date, last used date, and a revoke button per password.
  - Include a step-by-step connection guide for:
    - iPhone/iPad: Settings > Contacts > Accounts > Add Account > Other > Add CardDAV Account
    - macOS: System Settings > Internet Accounts > Add Other Account > CardDAV
    - Android (DAVx⁵): link to setup instructions
  - Plan limits: show how many app passwords the user's plan allows and prompt upgrade if at the limit.
- Acceptance Criteria:
  - A user with no technical knowledge can follow the in-app guide and successfully connect their iPhone.
  - App passwords can be created and revoked from the UI.
  - The server URL and username are clearly displayed and copyable.
  - Plan limits are surfaced before the user hits them.
- Risks / Open Questions:
  - The "show once" plaintext pattern must be implemented carefully — no caching, no server logs, no clipboard persistence beyond the session.

---

## P9-06 — Design brief: device connections and app passwords UI
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P9-04`
- Implementation Notes:
  - Produce a design brief for the designer covering the following surfaces:
    - **Empty state:** no app passwords created yet — onboarding prompt with platform icons (iPhone, Android, macOS).
    - **App password creation flow:** label input → generate → show-once plaintext display with copy button and "I've copied this" confirmation.
    - **App password list:** compact rows showing label, platform icon (inferred from label), created date, last used date, and revoke action.
    - **Revoke confirmation:** destructive action — device will stop syncing immediately.
    - **Connection guide:** step-by-step instructions per platform with screenshots or illustrations.
    - **Plan limit state:** user has reached their app password limit — upgrade prompt inline.
  - Brief should specify: component hierarchy, states (empty / one password / at limit / revoked), copy (tone: approachable, not technical), and which interactions are destructive.
- Acceptance Criteria:
  - Designer has everything needed to produce high-fidelity mockups without follow-up questions.
  - All states and edge cases are covered.
  - The brief distinguishes between the connect-guide content and the credential-management UI.
- Risks / Open Questions:
  - Platform icon set needs to cover at minimum iPhone, iPad, macOS, Android, and generic/other.

---

## P9-07 — Compatibility testing: iOS, macOS, DAVx⁵
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P9-05`, `P9-06`
- Implementation Notes:
  - Test the full sync lifecycle against each client:
    - **iOS:** account setup, initial sync, create contact on phone → appears in Kontax, edit contact in Kontax → appears on phone, delete on phone → archived in Kontax.
    - **macOS Contacts:** same lifecycle as iOS.
    - **DAVx⁵ (Android):** account setup, initial sync, bidirectional changes.
  - Test edge cases: contact with no name, contact with special characters in name or notes, contact with multiple phone/email entries, very large contact list (500+).
  - Verify CTag and ETag behaviour: clients should not re-fetch unchanged contacts between syncs.
  - Document any client-specific quirks encountered and whether workarounds are needed server-side.
- Acceptance Criteria:
  - Bidirectional sync works end-to-end on iOS and macOS Contacts without manual intervention.
  - DAVx⁵ connects and syncs successfully.
  - No duplicate contacts are created by repeated syncs.
  - Special characters and multi-value fields survive a round-trip.
- Risks / Open Questions:
  - iOS may cache discovery results aggressively — test account removal and re-add to confirm clean reconnect.
  - Some Android clients implement non-standard CardDAV extensions — document what Kontax does and does not support.

---

## P9-08 — Sync conflict handling for server-side writes
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P9-07`
- Implementation Notes:
  - When a device sends a `PUT` with an outdated ETag (`If-Match` mismatch), return HTTP 412 and log a `SyncConflict` record with `conflictType: VERSION_MISMATCH`.
  - Provide a basic resolution strategy: last-write-wins by default (the server's version is authoritative), with the conflict logged for Pro users to review in the activity log (Phase 11).
  - Document the conflict types that can arise from concurrent edits across multiple connected devices and how each is handled.
  - This ticket scopes only the server-side write path. Full conflict review UI is deferred to the activity log phase.
- Acceptance Criteria:
  - VERSION_MISMATCH conflicts are detected and logged rather than silently dropped.
  - Last-write-wins resolution does not corrupt contact data.
  - Conflict records are queryable for future activity log integration.
- Risks / Open Questions:
  - Users with many connected devices will generate more conflicts — the resolution strategy should be revisited before Pro activity log launch.
