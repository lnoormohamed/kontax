# P48-04 — Hardened outbound fetcher for CardDAV, discovered hrefs, photo URIs and the photo pass

**Phase:** 48 · **Workstream:** B · **Priority:** P0 · **Depends on:** —
**Audit severity:** High (SSRF) + Medium (×2)

## Objective

Route every outbound request the sync engine makes through one hardened
transport so a user-supplied or remote-supplied URL can never reach the
private LAN, loopback, link-local or cloud-metadata addresses, and so
credentials are never sent to a host other than the address-book host.

## Context

- `src/app/actions/sync.ts:58-60` validates `baseUrl` / `principalUrl` /
  `addressBookUrl` with `z.string().url()` only: any scheme, host, port.
- `src/server/carddav.ts:219-262` (`davRequest`) and `:855-877`
  (`fetchCardDavPhotoBytes`) use bare `fetch(url)`: default `redirect:
  "follow"` (up to 20 hops), no timeout, no size cap, no IP checks, with a
  caller-chosen `Authorization: Basic` header.
- `carddav.ts:130-140 resolveHref` resolves hrefs from the *remote response*
  (`current-user-principal`, `addressbook-home-set`, `<href>`, vCard
  `PHOTO;VALUE=URI`) with `new URL(href, context)`, so an absolute href
  redirects the next hop anywhere.
- Raw Node errors (`connect ECONNREFUSED 10.0.0.5:9000`, `ETIMEDOUT`,
  `ENOTFOUND`) and HTTP statuses are returned to the browser
  (`actions/sync.ts:712,1307,1513`, `api/sync/[accountId]/books/route.ts:104-108`)
  and persisted to `lastErrorMessage` (`sync/page.tsx:442`). Remote
  `displayname` and `getctag` are echoed too.
- Photo URIs are fetched with the connection's Basic credentials attached to
  whatever host the URI names; bytes are base64-encoded into the next PUT
  (`sync-runner.ts:1558`), giving a full read primitive on internal HTTP.
- `src/server/contact-photo-sync.ts:196 loadAvatarBytes` does a raw
  `fetch(avatarUrl)`; `actions/contacts.ts:611-613,685-688` keep the raw URL
  when `internalizeExternalAvatar` fails (which is exactly when the guard
  blocked a private address), so the photo pass fetches it unguarded.
- The hardened fetcher already exists: `src/server/safe-image-fetch.ts`
  (scheme/port/userinfo checks, DNS resolve + private-range rejection incl.
  CGNAT and v4-mapped v6, connect-to-IP with SNI pinned, per-hop redirect
  re-validation, max 3 hops, size and time caps, tests). Free tier includes
  CardDAV (`billing.ts:156`), and cron re-probes saved connections.

## Steps

1. **Extract a general fetcher.** Split `safe-image-fetch.ts` into
   `src/server/safe-fetch.ts` (URL validation, DNS pinning, redirect
   handling, `AbortSignal.timeout`, body cap, method + headers passthrough)
   and keep the image-specific wrapper on top.
2. **Policy.** `https:` only in production; `http:` only behind an explicit
   `KONTAX_ALLOW_INSECURE_CARDDAV=1` for local dev. Reject userinfo in URLs.
   Reject any resolved address in private/reserved/loopback/link-local ranges.
   `redirect: "manual"`, re-validate each hop, max 3. Timeout 15 s per
   request; body cap 10 MB for PROPFIND/REPORT, 5 MB for photos.
3. **Apply it** in `carddav.ts` to `davRequest`, `discoverCardDavAccount`,
   `discoverCardDavAddressBooks`, `pushCardDavContact`, `deleteCardDavContact`,
   `fetchCardDavPhotoBytes`; validate every href from `resolveHref` before
   use.
4. **Credentials.** Attach `Authorization` only when the target origin equals
   the address-book origin. Never on photo URIs to other hosts.
5. **Photo pass.** `loadAvatarBytes` uses `fetchExternalImage`. In
   `actions/contacts.ts`, refuse to persist an external `avatarUrl` that the
   guard rejected (store null, surface a validation error).
6. **Error surface.** Replace `error.message` in `CARDDAV_NETWORK_ERROR` and
   the HTTP-status messages with fixed codes (`unreachable`, `auth_failed`,
   `not_carddav`, `timeout`). Do not persist raw upstream text to
   `lastErrorMessage`. Sanitise `displayname` before rendering.
7. **Tests.** Extend `tests/node/safe-image-fetch.test.ts` patterns to the new
   module: private IPv4/IPv6, `localhost`, `169.254.169.254`, `http://` in
   prod, redirect to private, DNS answer in private range, oversize body,
   timeout, credential stripping on cross-origin.

## Acceptance

- Creating a CardDAV connection with `baseUrl=http://10.0.0.5:9000/`,
  `http://169.254.169.254/`, `http://localhost:3000/` or an https host that
  redirects to any of them fails with a generic error that reveals nothing
  about reachability.
- A remote vCard with `PHOTO;VALUE=URI:http://attacker/…` on a different
  origin is fetched without credentials (or not at all if private).
- A contact whose `avatarUrl` points at a private address is never fetched by
  the photo pass.
- `lastErrorMessage` never contains a hostname, IP or port from a Node error.
- All tests above pass; existing iCloud/Fastmail fixtures still pass.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help (CardDAV requires https; error wording)
- [ ] External · developers — /developers
- [x] Internal · admins/ops — roadmap/runbooks/ (dev override flag; sync error codes)
- [x] Internal · engineering — docs/ (outbound request policy)

## References

- Audit report §High "Unrestricted SSRF through user-supplied CardDAV URLs"
- `src/server/safe-image-fetch.ts`, `src/server/carddav.ts`, `src/server/contact-photo-sync.ts`, `src/app/actions/sync.ts`, `src/app/actions/contacts.ts`
- SEC-03 (prior SSRF fix on the SES webhook) for precedent
