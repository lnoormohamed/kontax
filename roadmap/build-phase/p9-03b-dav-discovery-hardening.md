# P9-03b DAV Discovery XML and Depth Hardening

## Purpose
Harden the CardDAV discovery adapter before adding contact resource endpoints. Some clients request specific DAV properties and expect unsupported properties to be reported in a separate `404 Not Found` propstat instead of being silently omitted. The adapter should also reject unsupported `Depth: infinity` requests explicitly.

## Status
`Done`

## Priority
`P0`

## Dependencies
- `P9-03a` DAV verb adapter

## Implementation Notes
- Add unsupported-property `404 propstat` rendering to `server.mjs`.
- Parse requested property names from discovery `PROPFIND` XML bodies.
- Return requested supported properties in a `200 OK` propstat.
- Return requested unsupported properties in a `404 Not Found` propstat.
- Mirror the safer response rendering behavior in `src/server/dav/xml.ts`.
- Reject `Depth: infinity` with `403 Forbidden` on principal and address-book discovery endpoints.
- Keep non-standard DAV verbs out of Next App Router route exports.

## Acceptance Criteria
- `npm run build` passes.
- A discovery `PROPFIND` body that asks for an unsupported property returns `207 Multi-Status` with a `404 Not Found` propstat.
- `Depth: infinity` returns `403 Forbidden`.
- Existing discovery responses still include `DAV: 1, addressbook`.
- Existing well-known auth challenge and redirect behavior remains unchanged.

## Risks / Open Questions
- The XML parser is intentionally lightweight and discovery-focused; `P9-04` should use or introduce a more robust parser if REPORT bodies require richer handling.
- Namespace handling is local-name based for this slice. That is enough for discovery properties but should be revisited if we add extension properties with overlapping local names.

## Progress Tracker
| Item | Status | Notes |
| --- | --- | --- |
| 404 propstat rendering | Done | Added to live adapter and mirrored helper. |
| Requested property parsing | Done | Discovery-focused parser added to `server.mjs`. |
| Depth infinity rejection | Done | Principal and address-book discovery reject with 403. |
| Build validation | Done | `npm run build` passed. |
| Smoke validation | Done | Local production smoke returned 207 with 404 propstat and 403 for Depth: infinity. |
