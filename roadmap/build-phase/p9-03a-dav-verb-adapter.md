# P9-03a DAV Verb Adapter for Next.js Compatibility

## Purpose
Next.js App Router rejects non-standard route exports such as `PROPFIND` during production builds. CardDAV requires `PROPFIND`, `REPORT`, and other DAV-specific verbs, so Kontax needs a small Node adapter in front of Next that can handle DAV protocol traffic while delegating the normal web app to Next.

## Status
`Done`

## Priority
`P0`

## Dependencies
- `P9-03` CardDAV discovery endpoint foundation
- `P9-02` App password authentication

## Implementation Notes
- Add `server.mjs` as the production entrypoint.
- Keep Next App Router for the normal web app and standard HTTP routes.
- Intercept DAV-specific discovery traffic before it reaches Next:
  - `GET` / `HEAD /.well-known/carddav`
  - `OPTIONS /dav/principals/{userId}/`
  - `PROPFIND /dav/principals/{userId}/`
  - `OPTIONS /dav/addressbooks/{userId}/`
  - `PROPFIND /dav/addressbooks/{userId}/`
- Delegate every other request to Next's request handler.
- Use email + app password Basic Auth for all DAV discovery requests.
- Keep response headers compatible with iOS/macOS/DAVx5 expectations:
  - `DAV: 1, addressbook`
  - `WWW-Authenticate: Basic realm="Kontax CardDAV"`
  - `Allow: OPTIONS, PROPFIND`
- Compute address-book CTag from the newest contact `updatedAt` value across active, archived, and tombstoned contacts so deletes trigger client refreshes.
- Update `npm start` and the Docker runtime image to use the custom server entrypoint.

## Acceptance Criteria
- `npm run build` passes with no invalid Next route export errors.
- `npm start` boots the custom Kontax server.
- Unauthenticated `/.well-known/carddav` returns `401` with the CardDAV Basic Auth challenge.
- Authenticated `/.well-known/carddav` redirects to `/dav/principals/{userId}/`.
- Authenticated `PROPFIND /dav/principals/{userId}/` returns `207 Multi-Status` XML with `current-user-principal` and `addressbook-home-set`.
- Authenticated `PROPFIND /dav/addressbooks/{userId}/` with `Depth: 1` returns the default `Kontax` address book and CTag.
- Normal app routes continue to be served by Next.

## Risks / Open Questions
- The adapter duplicates a small amount of DAV auth/XML logic from TypeScript helpers because `server.mjs` runs directly in Node after build. A later refactor can move shared DAV protocol logic to buildable JavaScript modules if this grows.
- Future `REPORT`, `PUT`, and `DELETE` support from `P9-04` should be added to the adapter rather than App Router route exports.
- Long-term deployment may still prefer a dedicated `dav.kontax.*` service, but this slice keeps the current single-container Coolify deployment simple.

## Progress Tracker
| Item | Status | Notes |
| --- | --- | --- |
| Custom Node server entrypoint | Done | `server.mjs` added as DAV-aware front controller. |
| Production start command | Done | `npm start` now runs `node server.mjs`. |
| Docker runtime copy | Done | Runtime image copies `server.mjs`. |
| DAV discovery PROPFIND adapter | Done | Principal and address-book home-set handlers implemented in the adapter. |
| Smoke test | Done | Local production smoke returned 401, 301, and 207 PROPFIND responses. |
