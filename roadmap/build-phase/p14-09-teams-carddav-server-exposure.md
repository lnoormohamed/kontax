# P14-09 Teams CardDAV Server Exposure (Optional)

## Purpose
This ticket extends Kontax's CardDAV server (Phase 9) to expose each accessible team address book as a separate CardDAV collection per authenticated user. A team member can connect their phone or desktop client (Apple Contacts, Thunderbird, Evolution) once to Kontax's CardDAV endpoint and receive their personal contacts, family contacts (if applicable), and all team address books they have VIEW or EDIT access to — all as distinct, named collections within a single authenticated connection. Writes to team collections are permission-checked and attributed, maintaining the full audit trail.

This ticket is explicitly marked optional. It must not ship until Phase 9 (CardDAV server) is stable and production-validated. If Phase 9 has known instability or the Phase 13 family collection extension has not been validated, this ticket is deferred to Phase 15.

## Background
Phase 9 implemented a CardDAV server at `/dav/addressbooks/{userId}/`. Two collections are exposed:
- `/dav/addressbooks/{userId}/default/` — the user's personal contacts.
- Phase 13 added `/dav/addressbooks/{userId}/family/` — the family shared book.

Phase 13's family extension followed the same PROPFIND/REPORT/PUT/DELETE protocol as the personal collection but sourced data from `GroupContact` rather than `Contact`. The CTag was derived from the max `GroupContact.updatedAt` for the family book.

Phase 14 adds N team collections per user, one per accessible team address book:
- `/dav/addressbooks/{userId}/team-{bookId}/` — a team address book.

The URL scheme uses the `GroupAddressBook.id` as the book identifier rather than the book name, because names can change (renaming a book would break synced clients if the URL were name-based).

The displayname returned in PROPFIND responses uses `[Team Name] · [Book Name]` so the user sees "Acme Corp · Clients" in their phone's contacts app rather than an opaque ID.

## Scope

### In scope
- PROPFIND on the user's address book home (`/dav/addressbooks/{userId}/`) — return team collections alongside existing collections.
- PROPFIND on a team collection (`/dav/addressbooks/{userId}/team-{bookId}/`) — collection properties including displayname, CTag, resourcetype.
- REPORT on a team collection — return VCARDs for all active contacts in the book.
- GET on a specific VCARD resource (`/dav/addressbooks/{userId}/team-{bookId}/{uid}.vcf`) — return a single contact as VCARD.
- PUT on a team collection resource — apply as a team contact mutation; enforce EDIT permission; emit ActivityEvent.
- DELETE on a team collection resource — archive the GroupContact; enforce EDIT permission; emit ActivityEvent.
- Permission enforcement: members with NONE permission do not see the collection in PROPFIND.
- CTag derivation for team collections.
- Connect-device UI update: explain multiple new collections to the user.

### Out of scope
- CardDAV server protocol implementation — already done in Phase 9.
- Authentication (app passwords) — Phase 9.
- Personal collection changes — Phase 9.
- Family collection changes — Phase 13.
- CardDAV scheduling / calendar extensions.
- Group VCARD (vCard group/category objects) — out of Phase 14 scope.

## Preconditions

Before starting this ticket:
- [ ] Phase 9 CardDAV server is stable in production with no known P0/P1 issues.
- [ ] Phase 13 family collection extension has been tested with at least two real CardDAV clients (recommended: Apple Contacts macOS + Thunderbird).
- [ ] P14-01 through P14-04 are complete (team address books, permissions, contact operations).
- [ ] Phase 9 app password authentication is production-validated.

If any of the above are not met, this ticket is automatically deferred.

## Design / Implementation Spec

### 1. URL Structure

```
/dav/addressbooks/{userId}/                   → Address book home (PROPFIND)
/dav/addressbooks/{userId}/default/           → Personal contacts (Phase 9, unchanged)
/dav/addressbooks/{userId}/family/            → Family book (Phase 13, unchanged)
/dav/addressbooks/{userId}/team-{bookId}/     → Team address book (new in Phase 14)
/dav/addressbooks/{userId}/team-{bookId}/{uid}.vcf  → Individual VCARD resource
```

The `{bookId}` is the `GroupAddressBook.id` (cuid). The URL is stable across renames.

**URL collision check**: the prefix `team-` ensures no collision with personal collection names (`default`) or family (`family`). Future collections should use a prefix namespace to avoid collisions.

---

### 2. PROPFIND — Address Book Home

When a CardDAV client performs `PROPFIND /dav/addressbooks/{userId}/` with `Depth: 1`, the server must return all collections the user has access to.

#### 2.1 Existing behavior (unchanged)
- `/dav/addressbooks/{userId}/default/` — always included.
- `/dav/addressbooks/{userId}/family/` — included if user is a member of a Family group.

#### 2.2 New behavior (Phase 14 addition)
For each accessible team address book (permission != NONE, book not archived), include:

```xml
<response>
  <href>/dav/addressbooks/{userId}/team-{bookId}/</href>
  <propstat>
    <prop>
      <resourcetype>
        <collection/>
        <addressbook/>   <!-- per RFC 6352 -->
      </resourcetype>
      <displayname>Acme Corp · Clients</displayname>
      <getctag>{ctagValue}</getctag>
      <supported-address-data>
        <address-data-type content-type="text/vcard" version="3.0"/>
        <address-data-type content-type="text/vcard" version="4.0"/>
      </supported-address-data>
      <addressbook-description>External clients</addressbook-description>
    </prop>
    <status>HTTP/1.1 200 OK</status>
  </propstat>
</response>
```

The `displayname` format is `"[Team Name] · [Book Name]"`. The middle dot (·) is the Unicode character U+00B7, consistent with the audit log actorDetail format.

The `addressbook-description` is populated from `GroupAddressBook.description` if non-null, else omitted.

#### 2.3 Server Implementation

```typescript
// src/server/carddav/handlers/propfind-home.ts (modified)

async function getAddressBookCollections(userId: string): Promise<Collection[]> {
  const collections: Collection[] = [];

  // Personal collection (Phase 9 — unchanged)
  collections.push(personalCollection(userId));

  // Family collection (Phase 13 — unchanged)
  const familyBook = await getFamilyBookForUser(userId);
  if (familyBook) collections.push(familyCollection(userId, familyBook));

  // Team collections (Phase 14 — new)
  const teamBooks = await getVisibleTeamBooksForUser(userId);
  for (const book of teamBooks) {
    collections.push(teamCollection(userId, book));
  }

  return collections;
}

async function getVisibleTeamBooksForUser(userId: string) {
  // Query: user is an ACCEPTED team member
  // Filter: only books where permission != NONE (or OWNER, which is always EDIT)
  // Exclude: archived books
  const member = await prisma.groupMember.findFirst({
    where: { userId, inviteStatus: "ACCEPTED", group: { type: "TEAM" } },
    select: { id: true, role: true, groupId: true },
  });
  if (!member) return [];

  if (member.role === "OWNER") {
    // Owner sees all non-archived books
    return prisma.groupAddressBook.findMany({
      where: { groupId: member.groupId, archivedAt: null },
      include: { group: { select: { name: true } } },
    });
  }

  // ADMIN and MEMBER: filter by permission
  const perms = await prisma.groupMemberAddressBookPermission.findMany({
    where: {
      groupMemberId: member.id,
      permission: { not: "NONE" },
      addressBook: { archivedAt: null },
    },
    include: {
      addressBook: {
        include: { group: { select: { name: true } } },
      },
    },
  });

  return perms.map((p) => p.addressBook);
}
```

---

### 3. PROPFIND — Team Collection

`PROPFIND /dav/addressbooks/{userId}/team-{bookId}/`

Same as family collection PROPFIND (Phase 13), but sources data from the team book:

```typescript
async function handleTeamCollectionPropfind(
  userId: string,
  bookId: string,
  props: string[]
) {
  // Permission check
  const perm = await resolveEffectivePermission(userId, bookId);
  if (perm === "NONE") return respond(404); // Collection does not exist for this user

  const book = await prisma.groupAddressBook.findUniqueOrThrow({
    where: { id: bookId },
    include: { group: { select: { name: true } } },
  });

  if (book.archivedAt) return respond(404); // Archived books not exposed

  const ctag = await computeTeamBookCtag(bookId);
  const displayname = `${book.group.name} · ${book.name}`;

  return buildPropfindResponse({
    href: `/dav/addressbooks/${userId}/team-${bookId}/`,
    displayname,
    ctag,
    description: book.description ?? undefined,
  });
}
```

---

### 4. CTag Derivation for Team Collections

The CTag (collection tag) signals to CardDAV clients that the collection has changed and a sync is needed.

```typescript
async function computeTeamBookCtag(bookId: string): Promise<string> {
  const result = await prisma.groupContact.aggregate({
    where: { groupAddressBookId: bookId },
    _max: { updatedAt: true },
  });

  const maxUpdatedAt = result._max.updatedAt;
  if (!maxUpdatedAt) return `"empty-${bookId}"`;
  return `"${maxUpdatedAt.getTime()}-${bookId}"`;
}
```

The CTag changes whenever any `GroupContact.updatedAt` changes (which is updated whenever the linked `Contact` is modified). This is consistent with the family collection CTag approach from Phase 13.

---

### 5. REPORT — List VCARDs in Team Collection

`REPORT /dav/addressbooks/{userId}/team-{bookId}/` with `addressbook-query` body.

```typescript
async function handleTeamCollectionReport(
  userId: string,
  bookId: string,
  reportBody: ParsedReport
) {
  // Permission check
  const perm = await resolveEffectivePermission(userId, bookId);
  if (perm === "NONE") return respond(404);

  if (book.archivedAt) {
    // Archived books: return the current contacts as read-only
    // (client may have them cached; returning 404 would cause the client to delete them locally)
  }

  const groupContacts = await prisma.groupContact.findMany({
    where: {
      groupAddressBookId: bookId,
      contact: { archivedAt: null },
    },
    include: {
      contact: {
        include: {
          phones: true,
          emails: true,
          addresses: true,
          // ... all contact relation fields
        },
      },
    },
  });

  const vcards = groupContacts.map((gc) => serializeContactToVCard(gc.contact));

  return buildMultistatusResponse(
    vcards.map((vcard, i) => ({
      href: `/dav/addressbooks/${userId}/team-${bookId}/${groupContacts[i].contact.uid}.vcf`,
      etag: computeVCardEtag(groupContacts[i].contact),
      vcard,
    }))
  );
}
```

ETag derivation: `"${contact.updatedAt.getTime()}"` — same approach as personal contacts.

---

### 6. GET — Individual VCARD Resource

`GET /dav/addressbooks/{userId}/team-{bookId}/{uid}.vcf`

```typescript
async function handleTeamContactGet(
  userId: string,
  bookId: string,
  uid: string
) {
  const perm = await resolveEffectivePermission(userId, bookId);
  if (perm === "NONE") return respond(404);

  const gc = await prisma.groupContact.findFirst({
    where: {
      groupAddressBookId: bookId,
      contact: { uid },
    },
    include: {
      contact: { include: { phones: true, emails: true, addresses: true } },
    },
  });

  if (!gc) return respond(404);

  const vcard = serializeContactToVCard(gc.contact);

  return respond(200, vcard, {
    "Content-Type": "text/vcard; charset=utf-8",
    ETag: `"${gc.contact.updatedAt.getTime()}"`,
  });
}
```

---

### 7. PUT — Create or Update VCARD in Team Collection

`PUT /dav/addressbooks/{userId}/team-{bookId}/{uid}.vcf`

This is the most sensitive operation. A client syncing a team collection may send back modified contacts.

```typescript
async function handleTeamContactPut(
  userId: string,
  bookId: string,
  uid: string,
  vcardBody: string,
  ifMatch: string | null
) {
  // Permission check: EDIT required for PUT
  const perm = await resolveEffectivePermission(userId, bookId);
  if (perm !== "EDIT") return respond(403, "Insufficient permission");

  // Archived book check
  const book = await prisma.groupAddressBook.findUniqueOrThrow({
    where: { id: bookId },
  });
  if (book.archivedAt) return respond(403, "Address book is archived");

  // Parse the VCARD body
  const parsed = parseVCard(vcardBody);
  if (!parsed.success) return respond(400, "Invalid VCARD");

  // If-Match header: optimistic concurrency control
  // If If-Match is set and doesn't match current ETag, return 412 Precondition Failed
  if (ifMatch) {
    const existing = await prisma.groupContact.findFirst({
      where: { groupAddressBookId: bookId, contact: { uid } },
      include: { contact: true },
    });
    if (existing) {
      const currentEtag = `"${existing.contact.updatedAt.getTime()}"`;
      if (ifMatch !== currentEtag) return respond(412);
    }
  }

  // Determine if this is a create or update
  const existingGc = await prisma.groupContact.findFirst({
    where: { groupAddressBookId: bookId, contact: { uid } },
    include: { contact: true },
  });

  const group = await prisma.group.findUniqueOrThrow({
    where: { id: book.groupId },
    select: { ownerId: true },
  });

  return prisma.$transaction(async (tx) => {
    let contact: Contact;
    let eventType: string;

    if (existingGc) {
      // Update existing contact
      const before = existingGc.contact;
      contact = await tx.contact.update({
        where: { id: existingGc.contact.id },
        data: mapVCardToContactFields(parsed.data),
      });
      eventType = "CONTACT_UPDATED";

      const diff = computeDiff(before, contact);
      await emitTeamContactEvent(tx, {
        groupId: book.groupId,
        teamOwnerId: group.ownerId,
        actorId: userId,
        addressBookId: bookId,
        contactId: contact.id,
        eventType,
        diff,
      });

      return respond(204, null, { ETag: `"${contact.updatedAt.getTime()}"` });
    } else {
      // Create new contact
      contact = await tx.contact.create({
        data: {
          userId: group.ownerId,
          uid,
          ...mapVCardToContactFields(parsed.data),
        },
      });

      await tx.groupContact.create({
        data: {
          groupAddressBookId: bookId,
          contactId: contact.id,
          addedByUserId: userId,
        },
      });

      eventType = "CONTACT_CREATED";
      await emitTeamContactEvent(tx, { /* ... */ eventType, diff: null });

      return respond(201, null, {
        ETag: `"${contact.updatedAt.getTime()}"`,
        Location: `/dav/addressbooks/${userId}/team-${bookId}/${uid}.vcf`,
      });
    }
  });
}
```

---

### 8. DELETE — Archive Contact from Team Collection

`DELETE /dav/addressbooks/{userId}/team-{bookId}/{uid}.vcf`

```typescript
async function handleTeamContactDelete(
  userId: string,
  bookId: string,
  uid: string
) {
  // Permission check: EDIT required
  const perm = await resolveEffectivePermission(userId, bookId);
  if (perm !== "EDIT") return respond(403);

  const gc = await prisma.groupContact.findFirst({
    where: { groupAddressBookId: bookId, contact: { uid } },
    include: { contact: true },
  });
  if (!gc) return respond(404);

  // Soft-archive, not hard-delete
  await prisma.contact.update({
    where: { id: gc.contact.id },
    data: { archivedAt: new Date() },
  });

  await emitTeamContactEvent({ /* ... */ eventType: "CONTACT_ARCHIVED", diff: null });

  return respond(204);
}
```

**Why soft-archive on CardDAV DELETE?**
Hard-deleting a contact via a CardDAV DELETE from a phone sync is a potentially catastrophic accidental action (e.g., a client misconfiguration that marks all contacts for deletion). Soft-archiving preserves the contact for recovery. The contact will not appear in subsequent REPORT responses (since `archivedAt IS NOT NULL` is excluded), so from the CardDAV client's perspective, the contact is gone. An admin can restore it via the Kontax UI.

---

### 9. Router Integration

The CardDAV router (Phase 9) must route requests with path prefix `/team-{bookId}/` to the team collection handlers:

```typescript
// src/server/carddav/router.ts (modified)

const TEAM_COLLECTION_PATTERN = /^\/team-([a-z0-9]+)(?:\/(.+\.vcf))?$/;

function routeRequest(userId: string, path: string, method: string) {
  if (path === "/" || path === "") {
    return homeHandler(userId, method);
  }

  if (path.startsWith("/default/")) {
    return personalCollectionHandler(userId, path.slice(9), method);
  }

  if (path.startsWith("/family/")) {
    return familyCollectionHandler(userId, path.slice(8), method);
  }

  const teamMatch = path.match(TEAM_COLLECTION_PATTERN);
  if (teamMatch) {
    const bookId = teamMatch[1];
    const resource = teamMatch[2] ?? null; // uid.vcf or null for collection-level
    return teamCollectionHandler(userId, bookId, resource, method);
  }

  return respond(404);
}
```

---

### 10. Connect-Device UI Update

Phase 9 provides instructions for connecting a device to Kontax's CardDAV server. With team collections, users now need to understand that multiple collections will appear in their phone's contacts app.

Update the connect-device instructions page (`/settings/sync/carddav` or wherever it lives):

**New section: "Team address books"**

```
Team address books appear automatically in your contacts app.

When you connect to Kontax via CardDAV, your contacts app will show:
• My Contacts — your personal contacts
• The Johnsons — your family shared book (if applicable)
• Acme Corp · Clients — team address books you have access to
• Acme Corp · Vendors — (each book appears as a separate group)

You can edit contacts in any book you have edit access to.
Contacts in view-only books will appear but cannot be changed.
Archived books are not shown.
```

**Important:** the user will see multiple new groups appear in Apple Contacts (or equivalent) after connecting. If they have 3 team books, they will see 3 new groups. This is expected behavior. The instructions must set this expectation clearly to prevent confusion or support tickets.

**iOS contacts app behavior note**: Apple Contacts on iOS shows CardDAV collections as separate "Accounts" or "Groups" depending on the client version. The displayname ("Acme Corp · Clients") is what the user sees. Confirm this behavior with at least two client versions before shipping.

---

### 11. Error Handling

| Scenario | HTTP Response |
|---|---|
| User not a team member | 404 (collection does not exist for this user) |
| NONE permission | 404 (same as not a member — do not reveal collection existence) |
| VIEW permission + PUT | 403 Forbidden |
| VIEW permission + DELETE | 403 Forbidden |
| Archived book + PUT | 403 Forbidden |
| Archived book + REPORT/GET | 200 (read-only, contacts returned) |
| Invalid VCARD body | 400 Bad Request |
| ETag mismatch (If-Match) | 412 Precondition Failed |
| Internal server error | 500 (with RFC 7807 problem JSON body) |

**404 vs 403 for NONE permission**: returning 404 rather than 403 prevents information leakage — the user should not know that a book exists if they have NONE permission. This is consistent with Phase 9's approach for personal collections (no cross-user visibility).

---

### 12. Performance Considerations

- PROPFIND on the home collection with Depth:1 now performs N+2 queries (personal + family + N team books). For a user with 10 team books, this is 12 queries. Optimize with a single JOIN query that fetches all visible books in one round trip.
- REPORT on a large team book (e.g., 10,000 contacts) can produce a very large XML/VCARD response. Phase 9 presumably handles large REPORT responses — confirm pagination behavior or chunked transfer encoding is in place.
- CTag computation (MAX query on GroupContact) is fast with the `(groupAddressBookId, updatedAt)` index. Confirm the index exists.

## Acceptance Criteria

- [ ] Phase 9 stability precondition is explicitly verified before starting this ticket.
- [ ] PROPFIND on the home collection returns team collections for a user with team access.
- [ ] A team member with NONE permission on a book does not see that collection in PROPFIND.
- [ ] Archived team books are not returned in PROPFIND.
- [ ] PROPFIND on a team collection returns the correct displayname "[Team] · [Book]".
- [ ] REPORT on a team collection returns all active contacts as VCARD.
- [ ] GET on a specific team contact VCARD returns the correct contact.
- [ ] PUT with EDIT permission creates or updates a contact, emits ActivityEvent, and returns correct ETag.
- [ ] PUT with VIEW permission returns 403.
- [ ] PUT to an archived book returns 403.
- [ ] DELETE with EDIT permission soft-archives the contact and emits ActivityEvent.
- [ ] DELETE with VIEW permission returns 403.
- [ ] CTag changes after a contact is added, updated, or archived in the team book.
- [ ] ETag (If-Match) concurrency control returns 412 on mismatch.
- [ ] ActivityEvent rows from CardDAV PUT/DELETE have `actor = TEAM_MEMBER`, `teamId` populated, and correct `actorDetail`.
- [ ] Connect-device instructions page includes the "Team address books" section.
- [ ] Tested with at least two real CardDAV clients: Apple Contacts macOS and Thunderbird.
- [ ] Personal and family collections continue to work identically after this change.

## Risks and Open Questions

- **Phase 9 stability gate**: This ticket is explicitly conditional. If Phase 9 has known issues, defer. The implementation engineer must not start this ticket without explicit sign-off from the team that Phase 9 is production-stable.
- **Client behavior with many collections**: A user with 20 team books will have 22+ collections in their contacts app. Some clients may have limits or may display poorly with many collections. Test with the maximum configuration (20 books).
- **VCARD UID uniqueness across teams and personal**: The `Contact.uid` field is used as the resource identifier in the URL. If the same person exists in both personal and team books (different Contact records), they will have different UIDs — this is correct. Document this explicitly to avoid confusion.
- **PUT creating contacts in team book**: When a user adds a contact in Apple Contacts to a team collection, the phone sends a PUT to Kontax. The resulting Contact record must have `userId = team owner's userId`, not the syncing user's userId. Ensure the `TeamContactStore.upsert` correctly resolves the team owner.
- **Soft-archive on DELETE**: The decision to soft-archive instead of hard-delete means that if a client sends DELETE and then immediately re-syncs (REPORT), the contact will be absent (correct). However, if the admin then restores the contact via the UI, the next client sync (REPORT) will show the contact again. Some clients may re-request the contact and re-delete it in a loop. Test this scenario explicitly.
- **RFC 6352 compliance**: Verify that the team collection PROPFIND response is fully RFC 6352 compliant, including the `addressbook` resourcetype element. Use the existing Phase 9 compliance test suite.

## Outcome
Kontax's CardDAV server exposes each accessible team address book as a named collection, allowing team members to connect any standard CardDAV client and see their personal, family, and team contacts as distinct, clearly labeled groups — with full write access (where permitted) creating a properly attributed, auditable record of every change.
