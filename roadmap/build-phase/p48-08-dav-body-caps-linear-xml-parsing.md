# P48-08 — DAV request body caps, linear XML parsing, request timeouts

**Phase:** 48 · **Workstream:** D · **Priority:** P0 · **Depends on:** —
**Audit severity:** High

## Objective

Make it impossible for one authenticated CardDAV client to stall the Node
process that also serves every Next.js page and API route.

## Context

- `server.mjs:298-306 readRequestBody` buffers the entire body with no size
  cap. Used for PROPFIND (`:1011,1071,1183,1407,1607`), REPORT (`:1210,1429,
  1631`, body read then discarded) and PUT (`:1270,1486,1697`).
- `server.mjs:308-323 extractRequestedPropNames` runs
  `/<[^>]*:?prop\b[^>]*>([\s\S]*?)<\/[^>]*:?prop>/i` on it. Measured on Node
  26: a body of repeated unclosed `<d:prop>` is quadratic — 64 KB → 216 ms,
  281 KB → 3.4 s, extrapolating to ~45 s at 1 MB and minutes at 4 MB. Regex
  evaluation is synchronous.
- Body is read *after* `requireDavAuth`, so one valid app password (free
  tier gets one) is enough. A handful of parallel 2 MB PROPFINDs takes the
  site down for as long as they are sent.
- PUT bodies on a stale `If-Match` are persisted verbatim into
  `SyncConflict.remoteSnapshot` (`:925-945`) — unbounded DB growth.
- No `server.requestTimeout` / `headersTimeout` set explicitly.
- Because entities are never expanded, classic XXE is not reachable; the DoS
  is the regex's own cost.

## Steps

1. **Cap bodies.** In `readRequestBody(req, maxBytes)`: reject up front when
   `Content-Length > maxBytes` (413), and abort the stream (destroy socket,
   413) when the running total exceeds it. Caps: 64 KB for PROPFIND/REPORT,
   1 MB for PUT (a vCard with an inline photo fits; larger photos are
   already normalised to ≤ 96 px thumbs + a capped canonical).
2. **Linear parsing.** Replace `extractRequestedPropNames` with a
   single-pass tokenizer over `<…>` tags (or `fast-xml-parser` with
   `processEntities: false`, `allowBooleanAttributes`, and a DOCTYPE reject).
   Reject any body containing `<!DOCTYPE` or `<!ENTITY`.
3. **Use REPORT bodies.** While here, parse `addressbook-multiget` hrefs and
   `sync-collection` tokens instead of returning the full collection (P14
   debt; bandwidth win for iOS).
4. **Truncate stored conflicts.** Cap `incomingVCard` stored in
   `SyncConflict.remoteSnapshot` at 64 KB with a `truncated: true` marker.
5. **Timeouts.** Set `server.requestTimeout = 30_000`, `headersTimeout =
   15_000`, `keepAliveTimeout` sensibly in `server.mjs` where the HTTP server
   is created.
6. **Bench.** Add a script under `tests/node/` that sends a 4 MB
   pathological PROPFIND to a local server and asserts a 413 within 50 ms and
   that a concurrent `/api/health` stays under 100 ms.

## Acceptance

- 4 MB `<d:prop>`-repeat PROPFIND → 413 in < 50 ms; `/api/health` p99 < 100 ms
  during a burst of 20 such requests.
- iOS, macOS Contacts, Thunderbird and DAVx⁵ still sync (existing manual
  matrix in `roadmap/runbooks/testing-and-critical-paths.md`).
- `SyncConflict.remoteSnapshot.rawVCard` never exceeds 64 KB.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help
- [ ] External · developers — /developers
- [x] Internal · admins/ops — roadmap/runbooks/ (DAV limits; 413 in logs)
- [x] Internal · engineering — docs/ (CardDAV server request pipeline)

## References

- Audit report §High "CardDAV server: unbounded bodies plus a quadratic regex stall the whole process"
- `server.mjs`, `src/server/dav/xml.ts`
