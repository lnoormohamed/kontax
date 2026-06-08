# P9-04 Contact Resource Endpoints (REPORT, GET, PUT, DELETE)

## Purpose
This ticket implements the endpoints that actually transfer contact data between Kontax and native device clients. Discovery (P9-03) tells clients where to look; these endpoints deliver and receive the contact vCards. A correct implementation of REPORT, GET, PUT, and DELETE is what enables a user's iPhone to show their Kontax contacts natively, and for changes on either side to flow bidirectionally. This is the core of the Kontax CardDAV server.

## Background
The existing codebase has strong foundations to build on:
- `src/server/carddav.ts` contains a full vCard parser (`parseCardDavContactCard`, `parseVCardLines`) already used in the CardDAV client sync path.
- `src/server/contact-portability.ts` contains `contactsToVCard` which serializes `Contact` records to vCard format, used by the existing export feature.
- `Contact.syncUid` is the stable per-vCard resource identifier, established in the schema from Phase 1.
- `Contact.syncVersion` is an integer incremented on every contact mutation — the source of truth for ETag values.
- `Contact.syncTombstoneAt` marks soft-deleted contacts that should not be served but whose UIDs must not be reused.
- `Contact.archivedAt` marks contacts hidden from the main UI — in CardDAV terms, archived contacts are not active and should not appear in REPORT responses.

P9-01 defined all URL patterns. P9-02 defined auth verification. P9-03 implemented auth middleware and discovery. This ticket consumes all of them and adds the read/write data layer.

## Scope

**In scope:**
- `REPORT /dav/addressbooks/{userId}/default/` with `addressbook-query` — return all active contacts as vCards
- `GET /dav/addressbooks/{userId}/default/{uid}.vcf` — return a single vCard
- `PUT /dav/addressbooks/{userId}/default/{uid}.vcf` — create or update a contact from a vCard body
- `DELETE /dav/addressbooks/{userId}/default/{uid}.vcf` — soft-archive a contact
- `PROPFIND /dav/addressbooks/{userId}/default/` (Depth: 0) — collection properties with CTag
- ETag derivation and conditional PUT via `If-Match`
- vCard serialization: reuse `contactsToVCard`, always include `UID:` field
- Soft-delete semantics: tombstone on DELETE, not hard delete
- `syncVersion` increment on every write
- `OPTIONS` for the collection and resource URLs

**Out of scope:**
- `addressbook-multiget` REPORT (P2 optimization)
- Contact group (`KIND:group`) vCards — return 415
- Paging / pagination of REPORT results — v1 returns all contacts in a single response
- Per-field merge or diff logic — PUT is a full-replace operation on the contact

---

## Design / Implementation Spec

### File Placement

Following the route handler structure from P9-01:

```
src/app/dav/addressbooks/[userId]/default/
  route.ts      ← OPTIONS, PROPFIND, REPORT for the collection
  [uid]/
    route.ts    ← OPTIONS, GET, PUT, DELETE for individual vCard resources
```

The `[uid]` segment captures `{contactUid}.vcf`. Strip the `.vcf` suffix before database lookup:

```typescript
const uid = params.uid.endsWith(".vcf")
  ? params.uid.slice(0, -4)
  : params.uid;
```

### ETag Derivation

Every contact has an ETag based on its `syncVersion`:

```typescript
function etagForContact(contact: { syncVersion: number }): string {
  return `"v${contact.syncVersion}"`;
}
```

ETags are quoted strings (including the double-quote characters) as required by RFC 7232. The value `"v7"` is the ETag for a contact at `syncVersion = 7`.

ETags are included:
- In `getetag` properties in REPORT and PROPFIND responses
- In `ETag:` response headers for GET and PUT responses

### `PROPFIND /dav/addressbooks/{userId}/default/` (Depth: 0)

**Logic:**
1. Authenticate using `requireDavAuth(request, params.userId)`.
2. Verify the address book exists (user exists and is active).
3. Compute CTag using `computeCTag(userId)` from P9-03.
4. Return 207 with properties:
   - `d:displayname` → "Kontax"
   - `d:resourcetype` → `<d:collection/><card:addressbook/>`
   - `cs:getctag` → CTag value
   - `card:supported-address-data` → `<card:address-data-type content-type="text/vcard" version="3.0"/>`
   - `d:sync-token` → (return 404 status for this prop — sync-collection not supported in v1)

**Depth: 1 on the default collection:** Return collection properties (as above) plus one `d:response` entry per active contact with `getetag` and `d:href`. This is an optimisation some clients use to check ETags without fetching full vCard data. Implement it in the same handler: if `Depth: 1`, run the same contact query as REPORT but return only `getetag` (not `address-data`).

### `REPORT /dav/addressbooks/{userId}/default/` with `addressbook-query`

This is the primary sync endpoint. iOS and DAVx⁵ use this on first sync and after a CTag change.

**Request:** REPORT method, body contains an `addressbook-query` XML document requesting `getetag` and `address-data` properties. Depth: 1.

**Logic:**
1. Authenticate using `requireDavAuth(request, params.userId)`.
2. Parse the REPORT body to determine which properties the client is requesting. For v1, always return both `getetag` and `address-data` regardless of what is requested.
3. Query all active contacts:
   ```typescript
   const contacts = await prisma.contact.findMany({
     where: {
       userId,
       archivedAt: null,
       syncTombstoneAt: null,
     },
     orderBy: { syncUid: "asc" },
   });
   ```
4. For each contact, serialize to vCard using `contactsToVCard` and ensure `UID:` is set to `Contact.syncUid` (see vCard serialization section below).
5. Build a 207 Multi-Status response with one `d:response` per contact:
   ```xml
   <d:response>
     <d:href>/dav/addressbooks/{userId}/default/{syncUid}.vcf</d:href>
     <d:propstat>
       <d:prop>
         <d:getetag>"v{syncVersion}"</d:getetag>
         <card:address-data>{vcard content, XML-escaped}</card:address-data>
       </d:prop>
       <d:status>HTTP/1.1 200 OK</d:status>
     </d:propstat>
   </d:response>
   ```
6. The `address-data` element contains the raw vCard text, XML-escaped. Angle brackets and ampersands in vCard values must be escaped as `&lt;`, `&gt;`, `&amp;`.

**Performance note:** For users with many contacts, this response can be large. At 2 KB per vCard and 1000 contacts, the response body is ~2 MB. For v1, stream the response if the contact count exceeds 500. Do not paginate — CardDAV does not define a pagination protocol and clients expect a complete response.

**Empty collection response:** If the user has no active contacts, return a 207 Multi-Status with an empty body (just the `d:multistatus` root element). Do not return 404.

### `GET /dav/addressbooks/{userId}/default/{uid}.vcf`

**Logic:**
1. Authenticate using `requireDavAuth(request, params.userId)`.
2. Strip `.vcf` from the uid parameter.
3. Look up `Contact` where `userId = params.userId AND syncUid = uid AND archivedAt IS NULL AND syncTombstoneAt IS NULL`.
4. If not found: return 404.
5. Serialize to vCard with `contactsToVCard`.
6. Return 200 with:
   ```
   Content-Type: text/vcard; charset=utf-8
   ETag: "v{syncVersion}"
   ```

**Conditional GET:** Support `If-None-Match` header. If the client sends a matching ETag, return 304 Not Modified. This reduces bandwidth when clients re-verify a specific card.

### `PUT /dav/addressbooks/{userId}/default/{uid}.vcf`

PUT is used by clients to create new contacts or update existing ones. The client controls the UID — it sends a vCard with a `UID:` field, and the server uses that UID as the resource name.

**Logic:**
1. Authenticate using `requireDavAuth(request, params.userId)`.
2. Strip `.vcf` from the uid parameter.
3. Validate that the `UID:` in the vCard body matches the URL uid. If they disagree, return 422 Unprocessable Content.
4. Parse the request body as a vCard using the existing `parseVCardLines` logic from `src/server/carddav.ts`. Extract all contact fields.
5. Look up existing `Contact` where `userId = params.userId AND syncUid = uid`.
6. **If-Match conditional update:**
   - If the `If-Match` request header is present:
     - If the contact does not exist, return 412 Precondition Failed (the client thinks it's updating an existing contact, but it doesn't exist).
     - If the contact exists but `etagForContact(contact) !== clientEtag`, return 412 Precondition Failed and log a `SyncConflict` (handled in P9-08).
   - If `If-None-Match: *` is present:
     - If the contact already exists (non-tombstoned), return 412 Precondition Failed. This is the "create only if new" semantics.
   - If no conditional header is present: proceed with upsert (last-write-wins).
7. **Upsert logic:**
   - If the contact does not exist: create a new `Contact` with `syncUid = uid`, `userId = params.userId`, and all parsed vCard fields. Set `syncVersion = 1`.
   - If the contact exists (including tombstoned ones — a client may re-create a previously deleted contact): update all fields and increment `syncVersion`. Clear `syncTombstoneAt` if it was set (re-creating a deleted contact).
8. Return 201 Created (for new contacts) or 204 No Content (for updates) with `ETag: "v{newSyncVersion}"` header.

**vCard parsing to Contact fields — mapping table:**

| vCard property | Contact field(s) |
|---|---|
| `FN` | `fullName` |
| `N` (semicolon-separated: Last;First;Middle;Prefix;Suffix) | `lastName`, `firstName`, `middleName`, `namePrefix`, `nameSuffix` |
| `NICKNAME` | `nickname` |
| `ORG` (first component) | `company` |
| `TITLE` | `jobTitle` |
| `EMAIL` (all instances) | `emailAddresses` (array), `emailEntries` (JSON), `email` (primary) |
| `TEL` (all instances) | `phoneNumbers` (array), `phoneEntries` (JSON), `phone` (primary) |
| `URL` (all instances) | `websiteEntries` (JSON), `website` (primary) |
| `ADR` (all instances) | `addressEntries` (JSON), `postalAddresses` (JSON), `address` (primary formatted) |
| `BDAY` | `birthday` |
| `NOTE` | `notes` |
| `PHOTO` (URL type) | `avatarUrl` |
| `UID` | `syncUid` (must match URL) |
| `X-PHONETIC-FIRST-NAME` / `X-PHONETIC-LAST-NAME` | `phoneticFirstName`, `phoneticLastName` |

Fields not mapped by a vCard property are left unchanged on update (do not zero them out). On create, unmapped fields default to `null`.

**Transaction:** The upsert and `syncVersion` increment must occur in a single Prisma transaction to prevent race conditions with concurrent writes.

### `DELETE /dav/addressbooks/{userId}/default/{uid}.vcf`

**Logic:**
1. Authenticate using `requireDavAuth(request, params.userId)`.
2. Strip `.vcf` from the uid parameter.
3. Look up `Contact` where `userId = params.userId AND syncUid = uid`.
4. If not found or already tombstoned: return 404.
5. **If-Match conditional delete:** If the `If-Match` header is present and does not match the current ETag, return 412.
6. Soft-archive the contact: set `syncTombstoneAt = now()`, `archivedAt = now()` (if not already set), increment `syncVersion`.
7. Return 204 No Content.

**Why soft-delete?** Hard-deleting the `Contact` row would remove the `syncUid` from the database. If a client re-syncs and tries to re-create the same UID, there would be no way to detect this as a re-creation vs. a new contact. Tombstoning preserves the UID so the server can correctly handle re-creation requests. Tombstoned contacts must not appear in REPORT responses.

**Hard-delete safety:** Never hard-delete a `Contact` row from a CardDAV DELETE request. Audit trail and merge history depend on soft deletion.

### vCard Serialization

The existing `contactsToVCard` function in `src/server/contact-portability.ts` produces vCard output from a `PortableContactInput`. When serving contacts via the CardDAV server, wrap each `Contact` into the `PortableContactInput` shape and call `contactsToVCard`.

**Critical:** The `UID:` field must always be written as `Contact.syncUid`. The existing `contactsToVCard` function may not include the UID — verify this and add it if missing. The UID line in vCard format is:

```
UID:{syncUid}
```

This must appear before `END:VCARD`. The `src/server/carddav.ts` push function already shows the pattern:
```typescript
const buildCardDavContactBody = (contact: PortableContactInput, uid: string) =>
  contactsToVCard([contact]).replace(/\r\nEND:VCARD$/, `\r\nUID:${uid}\r\nEND:VCARD`);
```

Use this same approach in the server response path.

**vCard version:** Produce vCard 3.0 format (for broadest client compatibility). vCard 4.0 is supported by DAVx⁵ but not universally by iOS. The `VERSION:3.0` property must appear on line 2 of each vCard (after `BEGIN:VCARD`).

**Line folding:** vCard requires long lines to be folded at 75 octets. Apply folding to `address-data` values in REPORT responses. The existing `contactsToVCard` function should already handle this — verify.

**CRLF line endings:** vCard uses CRLF (`\r\n`) line endings. The existing serializer likely handles this — confirm before shipping.

**XML escaping in REPORT responses:** When embedding a vCard inside an XML `address-data` element, all `<`, `>`, `&` characters in the vCard text must be XML-escaped. Ampersands in email addresses (rare but possible in notes) must become `&amp;`. Do not CDATA-wrap the vCard — some clients do not handle CDATA in `address-data`.

### Conflict Handling (Preview — detailed in P9-08)

When a `PUT` request includes an `If-Match` header with a stale ETag (the contact has been modified since the client last fetched it), the server must:
1. Return HTTP 412 Precondition Failed.
2. Create a `SyncConflict` record:
   - `conflictType: VERSION_MISMATCH`
   - `status: OPEN`
   - `localSyncVersion: contact.syncVersion`
   - `remoteETag: clientEtag` (the ETag the client sent)
   - `localSnapshot: JSON of current contact fields` (for audit)
   - `contactId: contact.id`
   - `syncAccountId`: use a special sentinel value or null — this is not a sync account conflict, it is a server-write conflict. Define a new `conflictSource` enum value `DEVICE_WRITE` if needed, or add a nullable `appPasswordId` field to `SyncConflict` in P9-08.

The 412 response body should include an XML error document:
```xml
<?xml version="1.0" encoding="utf-8"?>
<d:error xmlns:d="DAV:">
  <d:precondition-failed/>
</d:error>
```

### `OPTIONS` Responses

**Collection (`/dav/addressbooks/{userId}/default/`):**
```
Allow: OPTIONS, PROPFIND, REPORT
DAV: 1, addressbook
```

**Resource (`/dav/addressbooks/{userId}/default/{uid}.vcf`):**
```
Allow: OPTIONS, GET, PUT, DELETE
DAV: 1, addressbook
```

### syncVersion Increment Rules

`Contact.syncVersion` must be incremented atomically on every mutation that comes through the CardDAV server:

| Operation | syncVersion change |
|---|---|
| PUT (create) | Set to 1 |
| PUT (update) | Increment by 1 |
| DELETE (tombstone) | Increment by 1 |
| Merge (not CardDAV) | Increment by 1 on survivor |
| UI edit (not CardDAV) | Increment by 1 |

This ensures ETags are always monotonically increasing. Never reset `syncVersion` to a lower value.

### Performance Considerations

- **REPORT query:** Fetch all active contacts in a single `findMany` query. Do not use pagination. Serialize each to vCard in memory. For users with >500 contacts, consider streaming the response using `ReadableStream` to avoid buffering the entire response body before sending.
- **PUT parsing:** vCard parsing is CPU-bound but fast (milliseconds per card). No special optimization needed for v1.
- **Concurrent PUTs:** Two devices updating the same contact simultaneously will race. The `syncVersion` increment in a transaction prevents silent data loss — one will win, the other will retry. Clients that send `If-Match` will get a 412 and know to re-fetch. Clients without `If-Match` will silently overwrite (last-write-wins). This is acceptable in v1.

### Integration Points

- Calls `requireDavAuth` from P9-03 (`src/server/dav/auth.ts`)
- Calls `contactsToVCard` from `src/server/contact-portability.ts`
- Calls `parseVCardLines` / `parseCardDavContactCard` from `src/server/carddav.ts`
- Calls `computeCTag` from P9-03 (`src/server/dav/ctag.ts`)
- Reads and writes `Contact` model via Prisma
- Writes `SyncConflict` model via Prisma (on 412 scenarios)
- Emits `AuditEvent` for contact creates and deletes initiated via CardDAV

---

## Acceptance Criteria

- `REPORT /dav/addressbooks/{userId}/default/` returns 207 with one `d:response` per active contact, each containing `getetag` and `card:address-data`.
- Archived contacts (`archivedAt IS NOT NULL`) do not appear in REPORT responses.
- Tombstoned contacts (`syncTombstoneAt IS NOT NULL`) do not appear in REPORT responses.
- `GET /dav/addressbooks/{userId}/default/{uid}.vcf` returns the vCard with `Content-Type: text/vcard` and `ETag:` header.
- `PUT` creates a new `Contact` row when the UID does not exist.
- `PUT` updates the existing `Contact` row when the UID already exists, incrementing `syncVersion`.
- `PUT` with stale `If-Match` ETag returns 412 and does not modify the contact.
- `PUT` with matching `If-Match` ETag succeeds and updates the contact.
- `DELETE` sets `syncTombstoneAt` and `archivedAt` on the contact; does not hard-delete the row.
- `DELETE` with stale `If-Match` returns 412.
- All vCards served by REPORT and GET include a `UID:` line matching `Contact.syncUid`.
- vCard line endings are CRLF.
- vCard data embedded in XML responses is properly XML-escaped (no unescaped `<`, `>`, `&`).
- ETags are formatted as quoted strings (`"v7"`, not `v7`).
- `syncVersion` is incremented on every write (PUT and DELETE), within a single transaction.
- A full round-trip test (PUT a vCard → GET the same resource → vCard content matches with only whitespace normalization) passes.
- `OPTIONS` responses return the correct `Allow` header per resource type.

---

## Risks and Open Questions

- **Large contact lists:** Users with 2000+ contacts will generate REPORT responses over 4 MB. Verify that the Vercel/Docker deployment can handle this response size and that the iOS CardDAV client does not time out waiting for the full body. Streaming response with `ReadableStream` is the mitigation.
- **vCard encoding edge cases:** Contact names with Unicode characters, emoji, or RTL text must survive the vCard serialization and XML escaping round-trip. The existing `contactsToVCard` function should handle Unicode, but it has not been tested with XML escaping in the `address-data` context. Add explicit tests for contacts with `<`, `>`, `&`, and multi-byte Unicode in name fields.
- **iOS REPORT filter handling:** iOS sends an `addressbook-query` with a `filter` element (e.g. `prop-filter name="FN"`). The filter in the request body is a server-side filter hint. For v1, ignore the filter and return all contacts. Some future optimization could apply filters server-side to reduce response size, but this is not required for correctness.
- **UID mismatch between URL and vCard body:** The spec requires the server to use the URL as the authoritative resource identifier, not the UID in the vCard body. If they differ, the server should either return 422 or use the URL's UID and update the `UID:` in the stored vCard. The recommended behaviour is 422 — do not silently accept a disagreement.
- **Re-creating tombstoned contacts:** A client that re-PUTs a UID that was previously tombstoned. The server should revive the contact (clear `syncTombstoneAt`) and update it with the new vCard data. This matches the spirit of the PUT semantics (resource at this URL should be this content).
- **`PROPFIND` with `Depth: 1` on the default collection vs. REPORT:** Some clients use `PROPFIND Depth: 1` to get ETags without full vCard data, then make targeted `GET` requests only for changed cards. Implementing this correctly reduces bandwidth for incremental syncs. Decide in this ticket whether to implement Depth: 1 PROPFIND on the collection with `getetag` only, or defer it as a P2 optimization.
- **Photo/avatar in vCard:** The `PHOTO` vCard property can be embedded as base64 data (binary, large) or as a URI. Embedded photos will bloat REPORT responses significantly. For v1, only include `avatarUrl` as a `PHOTO;VALUE=URI:` line. Do not embed binary photo data.

---

## Outcome
This ticket is done when a CardDAV client (iOS, macOS Contacts, or DAVx⁵) can complete a full bidirectional sync cycle: initial REPORT populates the device with all active Kontax contacts, device-side contact creation results in a new `Contact` row, device-side deletion tombstones the contact, and Kontax-side edits appear on the device at the next sync.
