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
| P9-04 | Done | P0 | P9-02, P9-03 |
| P9-05 | Done | P1 | P9-04 |
| P9-06 | Done | P1 | P9-04 |
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
- Status: `Done`
- Priority: `P0`
- Dependencies: `P9-02`, `P9-03`
- Smoke test (local `server.mjs` on :3100 against the dev DB, isolated test user, 2026-06-08): **45/45 checks passed.** Covered: well-known 401/301, principal + collection PROPFIND (Depth 0/1), Depth:infinity → 403, REPORT with XML-escaped `address-data` and emoji preservation, GET + ETag + `If-None-Match` 304, missing → 404, OPTIONS Allow headers, PUT create (201) / update with `If-Match` (204) / stale `If-Match` (412 + precondition-failed body) / UID mismatch (422) / `If-None-Match:*` on existing (412) / `KIND:group` (415), DELETE (204) + tombstone exclusion from REPORT + re-DELETE 404, PUT revival of a tombstoned contact, CRLF line endings, multi-value email round-trip, wrong password (401), cross-user access (403). Test user and data torn down after the run.
- Implementation Notes:
  - **Architecture:** Implemented in `server.mjs` alongside the P9-03 discovery handlers (Next.js App Router cannot export REPORT/PROPFIND). Two new path matchers and handlers were added:
    - `getCollectionUserId` + `handleAddressBookCollection` — matches `/dav/addressbooks/{userId}/default/`. Handles `OPTIONS`, `PROPFIND` (Depth 0 = collection props with CTag; Depth 1 = collection + per-contact `getetag`), and `REPORT` (returns every active contact with `getetag` + `address-data`).
    - `getResourceParams` + `handleContactResource` — matches `/dav/addressbooks/{userId}/default/{uid}.vcf`. Handles `OPTIONS`, `GET`/`HEAD`, `PUT`, `DELETE`.
    - Both registered in `handleDavRequest` before the home-set handler (regexes are non-overlapping; resource is checked before collection before home-set).
  - **vCard serialization** (`serializeContactToVCard`): self-contained in server.mjs (cannot import the TS `contactsToVCard` at runtime). Produces vCard 3.0 with `UID:` always set to `Contact.syncUid`, CRLF line endings, and RFC-6350 75-octet line folding that is UTF-8-boundary-safe (never splits a multi-byte sequence). Emits `X-PHONETIC-FIRST-NAME`/`X-PHONETIC-LAST-NAME` (iOS-readable) and `PHOTO;VALUE=URI` for avatars (never embeds binary).
  - **vCard parsing** (`parseVCardToContactFields`): mirrors the `carddav.ts` client parser (unfold, unescape, line split). Maps FN/N/NICKNAME/ORG/TITLE/EMAIL/TEL/URL/ADR/BDAY/NOTE/PHOTO and both `X-PHONETIC-*` and `X-KONTAX-PINYIN-*` phonetic variants. Returns only fields present in the body so unmapped fields are left untouched on update.
  - **ETag** (`etagForContact`): quoted `"v{syncVersion}"` per RFC 7232. Returned in `getetag` props, `ETag:` headers, and compared for `If-Match`/`If-None-Match`.
  - **PUT semantics:** UID-in-body must match URL UID (else 422). `If-Match` stale/absent contact → 412. `If-None-Match: *` on existing contact → 412. Create sets `syncVersion=1` → 201. Update re-reads syncVersion inside a transaction, increments, clears `syncTombstoneAt`+`archivedAt` (revives tombstoned contacts) → 204. `KIND:group` vCards → 415.
  - **DELETE semantics:** soft-delete only — sets `syncTombstoneAt` + `archivedAt`, increments `syncVersion` → 204. Already-tombstoned or missing → 404. Stale `If-Match` → 412. Never hard-deletes.
  - **GET semantics:** active contact only (404 if archived/tombstoned). `If-None-Match` matching ETag → 304. Returns `text/vcard` + `ETag`.
  - **Conflict logging on 412 PUT** is deferred to P9-08 (needs the `SyncConflict` schema extension). P9-04 returns the correct 412 + `<d:precondition-failed/>` XML body; the conflict record is not yet written.
  - Verified pure-function logic (fold/unfold round-trip, escaping, N-field parse, emoji UTF-8 boundary safety) via standalone test. Full client verification is P9-07.
- Acceptance Criteria:
  - REPORT returns all active (non-archived, non-tombstoned) contacts as vCards. ✓
  - PUT creates new contacts and updates existing ones by UID without duplicating. ✓
  - DELETE archives the contact rather than destroying it. ✓
  - ETag and If-Match conditional updates work correctly (412 on stale). ✓
  - vCards include `UID:` matching `syncUid`, use CRLF, and are XML-escaped in REPORT responses. ✓
  - Protocol-level behaviour verified via smoke test (45/45). ✓
  - A full iOS initial sync populates the phone — **pending P9-07 real-device test.**
  - Changes made on the phone appear in Kontax — **pending P9-07 real-device test.**
- Risks / Open Questions:
  - **Streaming deferred:** REPORT builds the full response in memory. For users with 2000+ contacts (>4 MB) this may need `ReadableStream` chunking. Acceptable for current scale; flag for P9-07 load check.
  - **Multi-value websites/addresses:** serializer emits one `URL`/`ADR` from the scalar field plus extras from JSON arrays, but parser collapses multiples into the scalar + a simple array. Round-trip preserves the primary value; secondary labels may simplify. Acceptable for v1.
  - **412 conflict records** are not written until P9-08 extends `SyncConflict` with a device-write source.
  - Duplicate vCard logic now exists in three places (server.mjs, `contact-portability.ts`, `carddav.ts`). Consolidation into a shared module is a future hardening task.

---

## P9-05 — Add CardDAV server settings and connect instructions to the UI
- Status: `Done`
- Priority: `P1`
- Dependencies: `P9-04`
- Implementation Notes:
  - Delivered as an expanded "Connect a device" section on the existing `/settings` page (kept on the page rather than a separate `/settings/devices` route to reduce navigation; a `#settings-devices` nav chip jumps to it).
  - **Server connection details:** new `CopyField` client component (`src/app/_components/copy-field.tsx`) renders the Server URL and Username (email) each with a one-click copy button + "Copied" flash. The server URL is derived from request headers (`x-forwarded-host`/`x-forwarded-proto` with localhost fallback) via `getPublicOrigin()` in the settings server component — no new env var required. The origin is the value users enter; iOS/macOS/DAVx⁵ discover the rest via `/.well-known/carddav`.
  - **App password manager** (`src/app/_components/app-password-manager.tsx`, rewritten): full three-state show-once flow. Create → token revealed once in an amber `role="status"` box with a "Copy password" button (copies the un-hyphenated token) and an explicit "I've copied this password" acknowledgment that permanently hides it. Empty state with platform glyphs and onboarding copy. List rows show an inferred platform glyph (iPhone/Mac/Android/generic from the label), relative created/last-used dates (absolute past 30 days), and a Revoke button. Revoke opens an ARIA modal confirmation naming the device; confirm runs the action via `useTransition` with inline error handling. Plan-limit indicator ("Using X of Y" / "Unlimited") plus an amber at-limit callout.
  - **Connection guides** (`src/app/_components/connection-guides.tsx`): tabbed iPhone / macOS / Android (DAVx⁵) step lists with the real Server URL and Username pre-filled in copyable value chips so users never context-switch.
  - **Security:** plaintext token lives only in React state from the `createAppPassword` response; never written to DOM attributes, localStorage, or server-rendered HTML. Copy uses `navigator.clipboard.writeText`.
  - Verified via `tsc --noEmit`, `next lint` (clean), and a full `next build` (settings + DAV routes compile). Visual walkthrough on a real device is folded into P9-07.
- Acceptance Criteria:
  - App passwords can be created (show-once) and revoked (with confirmation) from the UI. ✓
  - Server URL and username are displayed and copyable. ✓
  - Plan limits are surfaced before the user hits them (indicator + at-limit callout + disabled create). ✓
  - Step-by-step guides for iPhone, macOS, and Android with pre-filled values. ✓
  - A non-technical user can follow the in-app guide to connect their iPhone — **end-to-end device walkthrough verified in P9-07.**
- Risks / Open Questions:
  - Server URL is presented as the bare origin (relies on `/.well-known/carddav` discovery). If P9-07 finds a client that needs the explicit principal/collection path, it is a guide-text-only change.
  - "Show once" relies on the user clicking the acknowledgment; closing the tab first loses the token (intentional — they revoke and recreate). Copy tone communicates this.

---

## P9-06 — Design brief: device connections and app passwords UI
- Status: `Done`
- Priority: `P1`
- Dependencies: `P9-04`
- Closeout note: the design-brief content exists (`p9-06-design-brief-device-connections.md`) and the device-connections UI it informs already shipped in P9-05 (server URL/username copy, show-once app passwords, revoke confirmation, connection guides). No further dedicated brief work needed; marked Done.
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
