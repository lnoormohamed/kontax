# P13-08 Family Shared Address Book CardDAV Server Exposure

## Purpose
This ticket extends the Kontax CardDAV server (built in Phase 9) to expose each family member's shared address book as a separate CardDAV collection. Once implemented, native device clients — iPhone Contacts, macOS Contacts, DAVx⁵ on Android — see the shared family contacts alongside the user's private contacts without requiring any special app. Changes written to the family collection via CardDAV (a device editing a family contact) are attributed to the acting member and propagated to all other family members via the same mechanism as web-based edits. This ticket is marked P2 (optional) because it depends on Phase 9 being stable and does not block the core Phase 13 delivery.

## Background
Phase 9 (P9-01 through P9-08) built a CardDAV server at `/dav/` serving each user's private address book as a single default collection:

```
/dav/addressbooks/{userId}/default/           ← private address book collection
/dav/addressbooks/{userId}/default/{uid}.vcf  ← individual private contact vCards
```

The P9-01 architecture spec explicitly noted that the v1 URL structure uses a hardcoded `default` segment and that future multiple address books would use `/dav/addressbooks/{userId}/{bookSlug}/`. Phase 13-08 is the first implementation of this extension point: the family shared book gets the slug `family`.

Phase 9 defined:
- **ETag:** Derived from `Contact.syncVersion`, format `"v{syncVersion}"`
- **CTag:** Derived from max `Contact.updatedAt` for the user's private contacts

Phase 13-01 defined the family address book CTag as the max `GroupContact.updatedAt` for the GroupAddressBook. These two CTags are entirely separate — a change to a family contact changes the family CTag but not the private CTag.

The Phase 9 CardDAV server uses Basic Auth via app passwords (`AppPassword` model). Family members must use the same app password mechanism to authenticate against the family collection — no new authentication mechanism is introduced.

This ticket is gated on Phase 9 being stable. Before beginning implementation, verify:
- P9-01 through P9-06 are complete and in production
- The CardDAV server is tested with at least iOS and DAVx⁵
- No known blocking bugs in PROPFIND, REPORT, PUT, or DELETE on the private collection

If Phase 9 is not stable, do not start this ticket. The family CardDAV collection adds complexity to the server and will amplify any existing instability.

## Scope

**In scope:**
- New CardDAV collection URL: `/dav/addressbooks/{userId}/family/`
- PROPFIND on `/dav/addressbooks/{userId}/` (Depth: 1) — return both `default` and `family` collections
- PROPFIND on `/dav/addressbooks/{userId}/family/` (Depth: 0) — return collection properties including CTag
- REPORT on `/dav/addressbooks/{userId}/family/` — return all active shared contacts as vCards
- GET on `/dav/addressbooks/{userId}/family/{uid}.vcf` — return a single shared contact as vCard
- PUT on `/dav/addressbooks/{userId}/family/{uid}.vcf` — create or update a shared contact, attributing the change to the acting member
- DELETE on `/dav/addressbooks/{userId}/family/{uid}.vcf` — soft-archive the shared contact
- CTag derivation for the family collection (using GroupContact.updatedAt)
- ETag derivation for shared contacts (using Contact.syncVersion)
- Attributing CardDAV writes to the acting member (not the group owner)
- Propagation of CardDAV-written changes to other family members (reusing P13-04 mechanism)

**Out of scope:**
- CalDAV (calendars) — never in scope for Kontax
- Multiple family address books per group — v1 is one family book
- MKCOL (creating new address book collections via CardDAV) — not supported
- WebDAV sync-collection (`REPORT sync-collection`) — not supported in v1
- addressbook-multiget REPORT — deferred to v2
- Teams shared address books via CardDAV (Phase 14)

## Design / Implementation Spec

### URL Structure Extension

Phase 9 established:
```
/dav/addressbooks/{userId}/default/
/dav/addressbooks/{userId}/default/{contactUid}.vcf
```

Phase 13-08 adds:
```
/dav/addressbooks/{userId}/family/
/dav/addressbooks/{userId}/family/{contactUid}.vcf
```

The `{contactUid}` in the family collection maps to `Contact.syncUid`, the same field used in the private collection. Shared contacts are Contact records and therefore have `syncUid` values. The `.vcf` extension is stripped before the database lookup, identical to the private collection behavior.

**URL semantics:** The family collection is user-scoped (by `{userId}`) even though the underlying data is group-scoped. A family member authenticating as their own `userId` accesses their group's shared contacts at their own URL. Two family members with userIds `alice123` and `bob456` would access the same shared contacts at:
- `alice123`'s URL: `/dav/addressbooks/alice123/family/`
- `bob456`'s URL: `/dav/addressbooks/bob456/family/`

Both collections return the same contacts (the group's shared contacts), but the attributions for writes are different (Alice's writes are attributed to Alice, Bob's to Bob).

### Route Handler File Structure

Extending the Phase 9 structure from P9-01:

```
src/app/dav/
  addressbooks/
    [userId]/
      route.ts                    ← UPDATED: Depth:1 PROPFIND now includes family collection
      default/
        route.ts                  ← unchanged
        [uid]/
          route.ts                ← unchanged
      family/                     ← NEW
        route.ts                  ← OPTIONS, PROPFIND, REPORT
        [uid]/
          route.ts                ← OPTIONS, GET, PUT, DELETE
```

### PROPFIND on /dav/addressbooks/{userId}/ (Depth: 1) — Updated

The existing Depth: 1 PROPFIND returns the list of address book collections for the user. It currently returns only the `default` collection. It must now conditionally include the `family` collection if the user is an ACCEPTED family group member.

**Updated response XML (Depth: 1) for a family member:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <!-- Existing default collection -->
  <response>
    <href>/dav/addressbooks/alice123/default/</href>
    <propstat>
      <prop>
        <resourcetype>
          <collection/>
          <card:addressbook/>
        </resourcetype>
        <displayname>My Contacts</displayname>
        <getctag>2025-11-03T14:22:01.000Z</getctag>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
  <!-- New family collection (only included if user is a family member) -->
  <response>
    <href>/dav/addressbooks/alice123/family/</href>
    <propstat>
      <prop>
        <resourcetype>
          <collection/>
          <card:addressbook/>
        </resourcetype>
        <displayname>Smith Family</displayname>
        <getctag>2025-11-05T09:10:00.000Z</getctag>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>
```

**displayname for family collection:** Use the Group.name (e.g., "Smith Family") rather than the GroupAddressBook.name ("Family"). The group name is more meaningful to users in their device contacts app where they see the collection list.

**Non-family-member users:** For users without a family group membership, the Depth: 1 PROPFIND returns only the `default` collection — identical to the Phase 9 behavior. No family collection is shown.

### PROPFIND on /dav/addressbooks/{userId}/family/ (Depth: 0)

Returns the collection-level properties for the family address book.

**Authorization:** The authenticated userId must be an ACCEPTED GroupMember of the family group whose shared book is being accessed. The `{userId}` in the URL is the requesting member's own id — the group is looked up via the GroupMember relation.

**Server logic:**
```typescript
export async function handleFamilyCollectionPropfind(userId: string) {
  const membership = await prisma.groupMember.findFirst({
    where: { userId, inviteStatus: 'ACCEPTED', group: { type: 'FAMILY' } },
    include: { group: { include: { defaultAddressBook: true } } }
  })
  if (!membership) return new Response(null, { status: 404 })

  const addressBook = membership.group.defaultAddressBook!
  const ctag = await getGroupAddressBookCTag(addressBook.id)
  const displayName = membership.group.name

  // Return PROPFIND response XML with resourcetype, displayname, getctag
}
```

**Response:** 207 Multi-Status with collection properties.

**CTag calculation:** `getGroupAddressBookCTag(addressBookId)` from P13-01 — max `GroupContact.updatedAt`. Same formula as for private contacts but scoped to GroupContact.

### REPORT on /dav/addressbooks/{userId}/family/

Returns all active (non-archived) shared contacts as vCards in an addressbook-query REPORT response.

**Authorization:** ACCEPTED GroupMember (canEdit: false members CAN read via CardDAV — they are view-only but can still sync to their device).

**Server logic:**
```typescript
export async function handleFamilyCollectionReport(userId: string, requestBody: string) {
  const membership = await prisma.groupMember.findFirst({
    where: { userId, inviteStatus: 'ACCEPTED', group: { type: 'FAMILY' } },
    include: { group: { include: { defaultAddressBook: true } } }
  })
  if (!membership) return new Response(null, { status: 404 })

  const addressBook = membership.group.defaultAddressBook!

  const groupContacts = await prisma.groupContact.findMany({
    where: {
      groupAddressBookId: addressBook.id,
      contact: { archivedAt: null, syncTombstoneAt: null }
    },
    include: { contact: true },
    orderBy: { updatedAt: 'desc' }
  })

  // Serialize each contact to vCard format (reuse existing vCard serializer from Phase 9)
  // Return XML REPORT response with one <response> per contact
}
```

**Tombstoned contacts:** Contacts with `syncTombstoneAt` set must be excluded from REPORT responses (same rule as private contacts). They are signaled via DELETE in WebDAV sync-collection (not supported in v1) — in v1, the client discovers tombstoned contacts are missing by comparing ETags from a full REPORT.

**vCard serialization:** Reuse the existing `serializeContactToVCard` function from Phase 9. Shared contacts are Contact records and serialize identically to private contacts. The vCard does not include any indication that the contact is "shared" — from the device's perspective, it is just a contact in a collection.

### GET on /dav/addressbooks/{userId}/family/{uid}.vcf

Returns a single shared contact as vCard text.

**Authorization:** ACCEPTED GroupMember (read access for all members, canEdit or not)

**Server logic:**
```typescript
const contact = await prisma.contact.findFirst({
  where: {
    syncUid: uid,    // uid is the URL segment with .vcf stripped
    groupContacts: {
      some: {
        groupAddressBook: {
          group: {
            members: {
              some: { userId, inviteStatus: 'ACCEPTED' }
            }
          }
        }
      }
    }
  }
})
if (!contact) return new Response(null, { status: 404 })
```

**Response:** 200 with `Content-Type: text/vcard; charset=utf-8`, `ETag: "v{contact.syncVersion}"`, vCard body.

### PUT on /dav/addressbooks/{userId}/family/{uid}.vcf

Creates a new shared contact or updates an existing one. This is the most complex endpoint because it must:
1. Check canEdit permission
2. Distinguish between create (new syncUid not in GroupContact) and update (syncUid already in GroupContact)
3. Attribute the change to the acting member (not the group owner)
4. Touch GroupContact.updatedAt to trigger CTag change (for P13-04 propagation)
5. Emit ActivityEvent for all group members (fan-out from P13-03)

**Authorization:** ACCEPTED GroupMember with canEdit: true. canEdit: false members receive 403 Forbidden.

**Server logic for PUT:**

```typescript
export async function handleFamilyContactPut(
  userId: string,
  uid: string,         // syncUid from URL (without .vcf)
  vCardBody: string,
  ifMatchEtag?: string  // From If-Match header for conditional PUT
) {
  const membership = await prisma.groupMember.findFirst({
    where: { userId, inviteStatus: 'ACCEPTED', group: { type: 'FAMILY' } },
    include: { group: { include: { defaultAddressBook: true } } }
  })
  if (!membership) return 404
  if (!membership.canEdit) return 403

  const addressBook = membership.group.defaultAddressBook!
  const groupOwnerId = membership.group.ownerId

  // Parse vCard body into contact fields (reuse existing vCard parser from Phase 9)
  const contactFields = parseVCard(vCardBody)

  // Check if contact already exists in this family book
  const existing = await prisma.contact.findFirst({
    where: {
      syncUid: uid,
      groupContacts: { some: { groupAddressBookId: addressBook.id } }
    },
    include: { groupContacts: true }
  })

  if (existing) {
    // UPDATE path
    if (ifMatchEtag && ifMatchEtag !== `"v${existing.syncVersion}"`) {
      return 412 // Precondition Failed — ETag mismatch
    }
    await prisma.$transaction(async (tx) => {
      await tx.contact.update({
        where: { id: existing.id },
        data: { ...contactFields, syncVersion: { increment: 1 } }
      })
      await tx.groupContact.updateMany({
        where: { contactId: existing.id, groupAddressBookId: addressBook.id },
        data: { updatedAt: new Date() }
      })
      await emitGroupActivityEvent(tx, {
        groupId: membership.groupId,
        contactId: existing.id,
        eventType: 'CONTACT_UPDATED',
        actorUserId: userId,
        actorDetail: `${membership.user?.name ?? 'A family member'} via Family Book (CardDAV)`,
        payload: {}   // Full diff is not computed for CardDAV writes in v1
      })
    })
    return 204  // No Content — updated

  } else {
    // CREATE path
    await prisma.$transaction(async (tx) => {
      const newContact = await tx.contact.create({
        data: {
          userId: groupOwnerId,
          syncUid: uid,
          syncVersion: 1,
          ...contactFields
        }
      })
      await tx.groupContact.create({
        data: {
          groupAddressBookId: addressBook.id,
          contactId: newContact.id,
          addedByUserId: userId
        }
      })
      await emitGroupActivityEvent(tx, {
        groupId: membership.groupId,
        contactId: newContact.id,
        eventType: 'CONTACT_CREATED',
        actorUserId: userId,
        actorDetail: `${membership.user?.name ?? 'A family member'} via Family Book (CardDAV)`,
        payload: {}
      })
    })
    return 201  // Created
  }
}
```

**Response for 201 (Created):** Include `ETag: "v1"` header and optionally a `Location` header pointing to the new resource URL.

**Response for 204 (Updated):** Include the new `ETag: "v{newSyncVersion}"` header.

**actorDetail format for CardDAV writes:** `"{Member Name} via Family Book (CardDAV)"` — the `(CardDAV)` suffix distinguishes CardDAV-originated changes from web-originated ones in the activity log. This is useful for debugging sync issues.

### DELETE on /dav/addressbooks/{userId}/family/{uid}.vcf

Soft-archives the shared contact. Does not hard-delete.

**Authorization:** ACCEPTED GroupMember with canEdit: true. canEdit: false members receive 403 Forbidden.

**Server logic:**
```typescript
// Find contact in family book
// Verify canEdit
// Set contact.archivedAt = now(), increment syncVersion
// Update GroupContact.updatedAt = now()
// Emit ActivityEvent (CONTACT_ARCHIVED) for all group members
// Return 204 No Content
```

**Why soft-archive instead of hard-delete:** The GroupContact record is retained (with the Contact's archivedAt set). Subsequent REPORT requests will exclude archived contacts (already filtered by `contact.archivedAt: null`). The contact can be restored by an admin or the archiving member via the web UI (P13-06). Hard-delete via CardDAV is not supported for shared contacts in v1 — this is a known limitation to document.

### CTag Derivation for Family Collection

The family collection CTag is separate from the private collection CTag:

| Collection | CTag derivation |
|---|---|
| `/dav/addressbooks/{userId}/default/` | `MAX(Contact.updatedAt WHERE userId = userId AND archivedAt IS NULL)` |
| `/dav/addressbooks/{userId}/family/` | `MAX(GroupContact.updatedAt WHERE groupAddressBookId = addressBook.id AND contact.archivedAt IS NULL)` |

Both use ISO 8601 UTC format. Both change independently — a family contact update does not change the private CTag, and a private contact update does not change the family CTag.

### ETag Derivation for Shared Contacts

Same formula as private contacts: `"v{Contact.syncVersion}"`. The syncVersion is incremented within the same transaction as every Contact mutation (whether from the web UI, import, or CardDAV PUT). This ensures ETag correctness across all mutation paths.

### CardDAV Client Behavior Notes

CardDAV clients handle multiple collections differently:

- **iOS Contacts / macOS Contacts:** Merges all collections from a CardDAV account into a single flat list (with optional grouping by "Account" in the sidebar). A family member will see their private contacts and shared family contacts merged in their Contacts app. This is expected — iOS does not distinguish between "default" and "family" collections visually. From the user's perspective, all Kontax contacts are together.

- **DAVx⁵ (Android):** Shows each collection as a separate contact group (Android contact account). The family collection would appear as a separate group named "Smith Family".

- **Thunderbird / GNOME Contacts:** Typically handles multiple collections and may show them as separate lists.

**The merge behavior in iOS is not a bug** — it is how CardDAV works. Document this in the CardDAV setup help docs: "Your family's shared contacts will appear alongside your private Kontax contacts in your iPhone or Mac's Contacts app. Changes you make there sync back to the family book."

### Propagation to Other Family Members via CardDAV

When a family member writes a contact via CardDAV (PUT or DELETE), the P13-04 propagation mechanism must fire. The ActivityEvent fan-out in `emitGroupActivityEvent` (P13-03) is reused here — it runs inside the PUT/DELETE transaction and updates GroupContact.updatedAt, which triggers the CTag change that other members' SSE connections or polling will detect.

This means a contact edited on Alice's iPhone (via CardDAV PUT) will:
1. Update the Contact record and increment syncVersion
2. Update GroupContact.updatedAt (CTag changes)
3. Emit ActivityEvents for all members
4. Bob's browser (SSE or polling) detects the CTag change and shows the "Family book updated" banner
5. Bob's iPhone (next CardDAV sync) fetches the updated contact via REPORT

The propagation chain is identical to web-originated edits — CardDAV writes are not special-cased.

### Middleware and Route Configuration

The family collection routes must be excluded from Next.js middleware in the same way as the existing `/dav/*` routes (P9-01):
- No session-based auth checks (uses Basic Auth via app password)
- No CSRF validation
- No request body size limits below 2 MB

Additionally, `export const runtime = 'nodejs'` must be set on these route handlers (not edge runtime) because app password lookup queries Prisma, which requires Node.js.

### HTTP Method Matrix (Family Collection)

| URL | OPTIONS | PROPFIND | REPORT | GET | PUT | DELETE |
|---|---|---|---|---|---|---|
| `/dav/addressbooks/{userId}/family/` | yes | yes (Depth 0/1) | yes | — | — | — |
| `/dav/addressbooks/{userId}/family/{uid}.vcf` | yes | — | — | yes | yes | yes |

`MKCOL` is not supported — the family collection is created automatically when a user joins a family group, not via CardDAV protocol.

### Testing Requirements

Before shipping this ticket, test the following flows against at least two CardDAV clients (iOS and DAVx⁵):

1. **Initial sync:** New family member adds the CardDAV account to their device. The device performs PROPFIND and receives both `default` and `family` collections. The device syncs both collections. Private contacts appear. Shared family contacts appear.

2. **Family contact visible on device:** A contact created in the family book via the Kontax web app appears on a connected family member's device within one CardDAV sync cycle.

3. **Edit on device propagates to web:** Family member edits a shared contact on their iPhone. The Kontax web app shows the "Family book updated" banner. The updated contact appears after refresh.

4. **Edit on device propagates to other device:** Family member (Alice) edits a shared contact on her iPhone. Another family member (Bob) syncs his device. Bob sees the updated contact.

5. **View-only member cannot edit via CardDAV:** Bob has canEdit: false. Bob edits a shared contact on his device. CardDAV PUT returns 403. The contact is not updated.

6. **Non-family-member's PROPFIND:** A user without a family group membership performs Depth:1 PROPFIND on their addressbooks. Only the `default` collection is returned — no `family` collection.

7. **CTag changes after web edit:** Family contact is updated via the Kontax web app. CardDAV client's next PROPFIND detects the CTag change and fetches the updated contact.

## Acceptance Criteria

- `/dav/addressbooks/{userId}/family/` is a valid CardDAV collection accessible to ACCEPTED family group members
- Depth:1 PROPFIND on `/dav/addressbooks/{userId}/` returns both `default` and `family` collections for family members; returns only `default` for non-members
- REPORT on `/dav/addressbooks/{userId}/family/` returns all active shared contacts as vCards
- GET on a specific shared contact vCard returns the contact with correct ETag header
- PUT creates a new shared contact (201) or updates an existing one (204) with canEdit permission check; canEdit: false returns 403
- DELETE soft-archives the shared contact (204) with canEdit permission check; canEdit: false returns 403
- CTag for the family collection changes after any PUT or DELETE on a shared contact
- Shared contacts PUT from CardDAV emit ActivityEvents attributed to the acting member with actorDetail including "(CardDAV)"
- P13-04 propagation fires after a CardDAV PUT/DELETE — other members' SSE connections or polling detects the CTag change
- iOS Contacts app shows the family collection contacts alongside private contacts (merged behavior is documented as expected)
- DAVx⁵ shows the family collection as a separate contact group named with the group's display name
- All seven test flows in the Testing Requirements section pass
- The ticket is blocked and not started until Phase 9 stability is confirmed

## Risks and Open Questions

- **iOS well-known redirect with multiple collections:** Phase 9 documented that the `/.well-known/carddav` redirect sends iOS to the principal URL, which then discovers the address book home, which lists all collections. Adding a second collection should work transparently without changes to the discovery sequence. Verify this assumption during testing — some iOS versions may cache the collection list aggressively and not pick up the new family collection until the account is removed and re-added.
- **DAVx⁵ collection naming:** DAVx⁵ uses the `displayname` property to name the contact group in Android. If the group name contains characters that Android's contact account naming sanitizes (e.g., emoji, special characters), the displayed name may differ from what the user expects. Limit group names to alphanumeric + spaces + basic punctuation in the group creation form (P13-02) to avoid this.
- **syncUid collisions between private and family collections:** A Contact's syncUid is globally unique across the Contact table. Since shared contacts are Contact records, their syncUIDs are distinct from private contact syncUIDs. A CardDAV client that tries to create a contact in the family collection with a syncUid that already exists in the private collection will receive a conflict (PUT will update the wrong contact). This is a protocol-level ambiguity — the client generates the syncUid for new contacts, and a collision is theoretically possible. In practice, clients use UUID v4 for generated UIDs, making collisions astronomically rare. No mitigation is needed in v1.
- **canEdit check for CardDAV reads (GET and REPORT):** The spec says canEdit: false members can still read via CardDAV. This means their device will sync shared contacts even if they cannot edit them on the device. When the device syncs contacts it can't modify, most CardDAV clients show them as read-only or in a separate group. iOS merges all contacts and shows edit UI for all of them — a view-only member could edit a shared contact in iOS Contacts and the edit would be rejected by the server. The 403 response from PUT should cause iOS to show an error and revert the edit. Test this scenario explicitly.
- **Family book collection before the user has joined a group:** If the CardDAV account is set up before the user joins a family group (or after they leave), the `family` collection does not exist. The Depth:1 PROPFIND simply omits it — no 404 or error. If a client has previously synced the family collection and the user subsequently leaves the group, the family collection disappears from PROPFIND. The client should delete all contacts from the missing collection on next sync. Test this membership transition scenario with both iOS and DAVx⁵.

## Outcome
The Kontax CardDAV server exposes each family member's shared address book as a `/family/` collection, enabling native device sync of shared family contacts with correct attribution and propagation.
