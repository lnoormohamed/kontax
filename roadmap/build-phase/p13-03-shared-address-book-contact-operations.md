# P13-03 Shared Address Book Contact Operations

## Purpose
This ticket implements the full CRUD surface for contacts in a shared family address book: creating new contacts directly in the shared book, updating existing shared contacts, archiving and restoring them, importing contacts into the shared book, and copying a private contact into the shared book via the "Add to family book" action. It also establishes the permission model (canEdit gating), defines the activity event attribution pattern for family members, and specifies the concurrent-edit conflict strategy. Without this ticket, the shared address book is an empty container with no way to put contacts into it or change them.

## Background
Phase 13-01 defined the GroupContact model: a linking record that connects a Contact record (with userId set to the group owner as a nominal owner) to a GroupAddressBook. Phase 13-02 established the GroupMember model with the `canEdit` boolean that controls whether a member can mutate shared contacts.

Phase 10 established the ActivityEvent model with the FAMILY_MEMBER actor value, which was reserved for exactly this use case. The actor detail format for family member events is `"{Member display name} via Family Book"`.

The existing contact mutation paths in the app (manual create, edit, archive) all assume `Contact.userId === authenticated user id`. Shared contacts break this assumption because the Contact.userId is the group owner's id, not the acting member's id. The permission gate for shared contacts must therefore check GroupMember.canEdit rather than userId equality.

## Scope

**In scope:**
- Creating a new contact in the shared address book (same form as private, with target selector)
- Updating a shared contact (same edit flow, with canEdit permission check)
- Archiving a shared contact (soft-archive, visible to all members as archived)
- Restoring an archived shared contact (restricted to group admin or archiving member)
- "Add to family book" action: copy a private contact to the shared book without moving or deleting the original
- Import into shared book: extend the import destination selector to include "Family Book" option
- Concurrent edit handling: last-write-wins with conflict detection for simultaneous edits within a 5-second window
- ActivityEvent emission with FAMILY_MEMBER actor for all shared book mutations
- GroupContact.updatedAt touch on every Contact mutation that goes through a shared book path

**Out of scope:**
- Moving a private contact to the shared book (only copying is supported in v1)
- Moving a shared contact to a private book (not supported in v1)
- Bulk operations on shared contacts (individual operations only in v1)
- Contact deletion (hard-delete) for shared contacts — archive only
- UI rendering of shared contacts in the workspace (P13-05)
- Change propagation to other members (P13-04)

## Design / Implementation Spec

### Permission Check Utility

All shared contact mutation operations must go through a single permission check utility before executing. This prevents permission logic from being duplicated across mutation paths.

```typescript
// src/lib/groups/permissions.ts

export async function assertGroupEditPermission(
  tx: PrismaTransactionClient,
  groupId: string,
  requestingUserId: string
): Promise<GroupMember> {
  const membership = await tx.groupMember.findFirst({
    where: {
      groupId,
      userId: requestingUserId,
      inviteStatus: 'ACCEPTED'
    }
  })
  if (!membership) throw new AppError('NOT_A_GROUP_MEMBER')
  if (!membership.canEdit) throw new AppError('EDIT_PERMISSION_DENIED')
  return membership
}

export async function assertGroupReadPermission(
  tx: PrismaTransactionClient,
  groupId: string,
  requestingUserId: string
): Promise<GroupMember> {
  const membership = await tx.groupMember.findFirst({
    where: {
      groupId,
      userId: requestingUserId,
      inviteStatus: 'ACCEPTED'
    }
  })
  if (!membership) throw new AppError('NOT_A_GROUP_MEMBER')
  return membership
}
```

These functions must be called inside a Prisma transaction so they participate in the same snapshot as the mutation. A TOCTOU race between the permission check and the mutation is theoretically possible if the check and mutation are not in the same transaction — especially for the canEdit toggle which can be changed by the group admin at any time.

### Creating a Contact in the Shared Address Book

**API Route:** `POST /api/contacts` (extends existing route with new `targetAddressBook` field)

The existing contact creation API accepts contact field data and creates a Contact with `userId = authenticated user`. The extension adds an optional `targetAddressBook` field:

```typescript
interface CreateContactRequest {
  // ... existing contact fields (givenName, familyName, phoneNumbers, etc.) ...
  targetAddressBook?: {
    type: 'group'
    groupAddressBookId: string
  }
}
```

When `targetAddressBook.type === 'group'`:

1. Look up the GroupAddressBook by id, including its group
2. Run `assertGroupEditPermission` for the requesting user against the group
3. Determine the group owner's userId: `const ownerUserId = group.ownerId`
4. **Transaction:**
   a. Create Contact: `{ userId: ownerUserId, givenName, familyName, ... all other fields ... }`
   b. Create GroupContact: `{ groupAddressBookId, contactId: newContact.id, addedByUserId: requestingUserId }`
   c. Emit ActivityEvent for the group owner's userId: `{ userId: ownerUserId, contactId: newContact.id, eventType: 'CONTACT_CREATED', actor: 'FAMILY_MEMBER', actorDetail: '{requestingUserName} via Family Book', payload: {} }`
   d. Emit ActivityEvent for each other ACCEPTED GroupMember's userId: same event type with same actorDetail — every member gets the event in their activity feed
5. Return the created Contact

**Why emit ActivityEvent for all members:** Each member has their own activity feed (userId-scoped). For a shared contact creation to appear in every member's feed, an event must be written for every member's userId. This is intentional — the shared book's changes are visible in every member's global activity feed, not just the owner's.

ActivityEvent fan-out: after the contact creation transaction completes, a separate operation (not in the same transaction) emits ActivityEvent rows for all other group members. The order is: core transaction first (Contact + GroupContact), then fan-out. If the fan-out fails, the creation is not rolled back — the activity log is best-effort for shared events.

### Updating a Shared Contact

**API Route:** `PATCH /api/contacts/{contactId}` (extends existing route)

The existing update route checks `WHERE Contact.userId = authenticated user`. For shared contacts, this check will fail because the Contact.userId is the group owner's id, not the requesting member's id.

The update route must detect shared contacts:

```typescript
// Look up the contact
const contact = await prisma.contact.findUnique({ where: { id: contactId } })

// Check if it's a shared contact
const groupContact = await prisma.groupContact.findFirst({
  where: { contactId },
  include: { groupAddressBook: { include: { group: true } } }
})

if (groupContact) {
  // Shared contact path
  await assertGroupEditPermission(tx, groupContact.groupAddressBook.groupId, requestingUserId)
} else {
  // Private contact path — existing ownership check
  if (contact.userId !== requestingUserId) throw new AppError('FORBIDDEN')
}
```

**Transaction for shared contact update:**
1. Run `assertGroupEditPermission`
2. Compute field diffs (before and after values) for ActivityEvent payload
3. Update Contact fields
4. Update GroupContact.updatedAt = now() — CRITICAL: this triggers the CTag change for change propagation
5. Emit ActivityEvent for all ACCEPTED group members: `{ eventType: 'CONTACT_UPDATED', actor: 'FAMILY_MEMBER', actorDetail: '{editorName} via Family Book', payload: { diffs } }`

The diff computation uses the existing FieldDiff pattern from P10-01. For shared contacts, the `before` values must be captured before the transaction begins (snapshot the contact state before mutation), and the `after` values are the new field values.

### Archiving a Shared Contact

**API Route:** `DELETE /api/contacts/{contactId}` (existing route, extended)

For shared contacts, "delete" means soft-archive: set `Contact.archivedAt = now()`. The GroupContact record is NOT deleted — it is retained so the contact remains visible to all members as archived.

Permission check: any ACCEPTED member with canEdit can archive. (Same rule as update — archive is a mutation.)

**Transaction:**
1. `assertGroupEditPermission`
2. Set `Contact.archivedAt = now()`
3. Update `GroupContact.updatedAt = now()`
4. Emit ActivityEvent for all members: `{ eventType: 'CONTACT_ARCHIVED', actor: 'FAMILY_MEMBER', actorDetail: '{archiverName} via Family Book' }`

**Restoring an archived shared contact:**

**API Route:** `POST /api/contacts/{contactId}/restore`

Restricted to: group ADMIN/OWNER, or the specific member who archived the contact (identified by checking which member's userId sent the most recent CONTACT_ARCHIVED ActivityEvent for this contact).

The "archiving member can restore" rule requires checking the ActivityEvent log to identify who archived the contact. This is the only permission check in Phase 13 that reads from ActivityEvent at mutation time. If the ActivityEvent log is unavailable or empty, fall back to requiring ADMIN/OWNER for restoration.

**Transaction:**
1. Verify permission (admin OR archiving member)
2. Set `Contact.archivedAt = null`
3. Update `GroupContact.updatedAt = now()`
4. Emit ActivityEvent for all members: `{ eventType: 'CONTACT_RESTORED', actor: 'FAMILY_MEMBER', actorDetail: '{restorerName} via Family Book' }`

### "Add to Family Book" Action

This action copies an existing private contact to the shared address book. It does NOT move the contact — the original private contact record is unchanged and stays in the member's private library.

**API Route:** `POST /api/family/groups/{groupId}/contacts/add-from-private`

**Request body:**
```typescript
{
  contactId: string           // The private contact to copy
  groupAddressBookId: string  // The target family address book
}
```

**Server-side flow:**
1. Verify `contact.userId === requestingUserId` (the private contact must belong to the requesting user)
2. `assertGroupEditPermission` for the requesting user
3. Check for existing GroupContact with the same contactId in this groupAddressBook — if exists, return `CONTACT_ALREADY_IN_FAMILY_BOOK` error
4. **Decide: copy vs link.**
   - Option A — Create a new Contact record (deep copy): creates a second Contact record with userId = group owner's id, copies all fields from the original. The two records are independent after creation — editing the private copy does not affect the shared copy and vice versa.
   - Option B — Create a GroupContact link to the original Contact: the original Contact record is shared. The Contact.userId remains the original member's userId, which breaks the nominal ownership model.

   **Decision: Option A — deep copy.** Create a new Contact record for the shared book with userId = group owner's id. This is clean: the private and shared records are fully independent. The copy is identified as originating from the private contact via the ActivityEvent payload.

5. **Transaction:**
   a. Create new Contact: copy all fields from original, set userId = group owner's id
   b. Create GroupContact: `{ groupAddressBookId, contactId: newContact.id, addedByUserId: requestingUserId }`
   c. Emit ActivityEvent for all group members: `{ eventType: 'CONTACT_CREATED', actor: 'FAMILY_MEMBER', actorDetail: '{memberName} via Family Book', payload: { copiedFromContactId: originalContact.id } }`

6. The `copiedFromContactId` in the payload is informational — it lets the UI show "Copied from [member]'s private contacts" if desired in a future version. It is not a live FK — the two records are fully decoupled after creation.

### Import into Shared Address Book

Extend the existing import flow (CSV/vCard import) to allow the user to select the destination address book.

**Import destination selector** (UI, specified for backend contract here):
- "Private contacts" (default, existing behavior)
- "Family Book — {GroupName}" (shown only if user is an ACCEPTED member of a FAMILY group with canEdit: true)

When "Family Book" is selected, the import job:
1. Sets `ImportJob.targetGroupAddressBookId = groupAddressBookId` (add this nullable field to ImportJob in the migration)
2. For each contact row in the import, instead of `prisma.contact.create({ data: { userId: requestingUserId, ... } })`, use the shared contact creation path: creates Contact with userId = group owner's id, creates GroupContact, emits ActivityEvent
3. All ActivityEvents for import rows use actor: FAMILY_MEMBER and actorDetail: `"{importerName} via Family Book (Import)"`

ImportJob model extension required:
```prisma
model ImportJob {
  // ... existing fields ...
  targetGroupAddressBookId String?
  targetGroupAddressBook   GroupAddressBook? @relation(fields: [targetGroupAddressBookId], references: [id])
}
```

### Concurrent Edit Handling

Two members editing the same shared contact simultaneously is handled with last-write-wins in v1. The more recent write wins regardless of which member submitted it first.

**Conflict detection for near-simultaneous edits (5-second window):**

When a CONTACT_UPDATED ActivityEvent is about to be emitted, check whether another CONTACT_UPDATED event was emitted for the same contactId within the last 5 seconds by a different actor:

```typescript
const recentEdit = await prisma.activityEvent.findFirst({
  where: {
    contactId,
    eventType: 'CONTACT_UPDATED',
    actor: 'FAMILY_MEMBER',
    createdAt: { gte: new Date(Date.now() - 5000) }
  },
  orderBy: { createdAt: 'desc' }
})

if (recentEdit && recentEdit.actorDetail !== currentActorDetail) {
  // Near-simultaneous edit detected — escalate to SyncConflict
  await prisma.syncConflict.create({
    data: {
      contactId,
      conflictType: 'FAMILY_CONCURRENT_EDIT',
      localActorDetail: recentEdit.actorDetail,
      remoteActorDetail: currentActorDetail,
      detectedAt: new Date()
    }
  })
}
```

The SyncConflict model from Phase 8 (or whichever phase introduced it) is reused here. The conflict is logged and the write proceeds (last-write-wins). The conflict log is surfaced in the activity feed as a SYNC_CONFLICT_DETECTED event. In v1, there is no manual conflict resolution UI for family concurrent edits — the conflict is logged for visibility only.

If the SyncConflict model does not yet exist in the schema, create a minimal version in this ticket's migration:

```prisma
model SyncConflict {
  id                 String   @id @default(cuid())
  contactId          String?
  conflictType       String
  localActorDetail   String?
  remoteActorDetail  String?
  detectedAt         DateTime @default(now())
  resolvedAt         DateTime?
  resolution         String?

  contact            Contact? @relation(fields: [contactId], references: [id])
}
```

### ActivityEvent Fan-Out

The ActivityEvent emission for shared contacts fans out to all ACCEPTED group members. The fan-out is implemented as a helper function:

```typescript
// src/lib/groups/activity.ts

export async function emitGroupActivityEvent(
  tx: PrismaTransactionClient,
  params: {
    groupId: string
    contactId: string
    eventType: EventType
    actorUserId: string
    actorDetail: string
    payload: Record<string, unknown>
  }
): Promise<void> {
  const members = await tx.groupMember.findMany({
    where: { groupId: params.groupId, inviteStatus: 'ACCEPTED' },
    select: { userId: true }
  })

  await tx.activityEvent.createMany({
    data: members
      .filter(m => m.userId !== null)
      .map(m => ({
        userId: m.userId!,
        contactId: params.contactId,
        eventType: params.eventType,
        actor: 'FAMILY_MEMBER',
        actorDetail: params.actorDetail,
        payload: params.payload,
        createdAt: new Date()
      }))
  })
}
```

Using `createMany` is important for performance — a family with 6 members should not require 6 sequential inserts. `createMany` batches all inserts into one query.

The fan-out runs inside the same transaction as the contact mutation so that it is atomic — if the fan-out fails, the mutation rolls back (this is acceptable behavior). For larger groups (Teams in Phase 14 with 25+ members), the fan-out strategy may need to move out of the transaction to avoid long transaction durations. Document this as a known scaling concern.

### Error Codes

| Code | Meaning |
|---|---|
| `NOT_A_GROUP_MEMBER` | User is not an ACCEPTED member of this group |
| `EDIT_PERMISSION_DENIED` | User's canEdit is false — they are view-only |
| `CONTACT_ALREADY_IN_FAMILY_BOOK` | The contact is already in this family address book |
| `CANNOT_RESTORE_SHARED_CONTACT` | User does not have permission to restore this archived contact |
| `IMPORT_PERMISSION_DENIED` | User cannot import into this family book (canEdit: false) |

## Acceptance Criteria

- An ACCEPTED member with canEdit: true can create a contact in the shared address book; the Contact is created with userId = group owner's id and a GroupContact linking record is created
- An ACCEPTED member with canEdit: false receives EDIT_PERMISSION_DENIED error when attempting to create, update, or archive a shared contact
- Updating a shared contact produces a field diff ActivityEvent emitted for every ACCEPTED group member's userId with actor: FAMILY_MEMBER and actorDetail: "{member name} via Family Book"
- GroupContact.updatedAt is updated every time the underlying Contact is mutated through a group path — this can be verified by checking that the CTag changes after a contact mutation
- Archiving a shared contact sets Contact.archivedAt without deleting the GroupContact record; the contact is visible as archived to all members
- Restoring a shared contact is permitted for group admins and the member who performed the archive; other members receive CANNOT_RESTORE_SHARED_CONTACT
- "Add to family book" creates a new independent Contact record (deep copy) with userId = group owner's id; the original private contact is unchanged; GroupContact linking record is created
- "Add to family book" on a contact already in the shared book returns CONTACT_ALREADY_IN_FAMILY_BOOK error
- Import flow shows "Family Book" as a destination option for ACCEPTED members with canEdit: true; imported contacts are created with the group ownership model
- Near-simultaneous edits (within 5 seconds, different actors) create a SyncConflict record; the write still succeeds (last-write-wins)
- ActivityEvent fan-out uses createMany for all ACCEPTED members in a single query
- TypeScript compilation passes; assertGroupEditPermission and assertGroupReadPermission are used consistently throughout the shared contact mutation paths

## Risks and Open Questions

- **GroupContact.updatedAt update coupling:** The CTag for change propagation (P13-04) depends on GroupContact.updatedAt reflecting every Contact mutation that goes through a group path. If any mutation path bypasses the group update helper and uses the raw Contact update without touching GroupContact.updatedAt, the CTag will not change and other members will not see the propagation signal. This is a silent bug. Add an integration test that updates a shared contact and verifies the CTag changes.
- **ActivityEvent fan-out transaction duration:** For a 6-member family, the fan-out adds 6 ActivityEvent rows inside the same transaction as the contact mutation. With createMany, this is one additional DB round trip. This is acceptable. However, for Phase 14 Teams (25+ members), the fan-out must move outside the transaction. Add a note to the Phase 14 kickoff checklist.
- **The deep copy approach for "Add to family book" creates divergence:** After a private contact is copied to the shared book, changes to the private contact are not reflected in the shared copy and vice versa. This is intentional (no live link between private and shared), but it may surprise users who expect the shared copy to stay in sync with their private version. The UI in P13-05 must clearly communicate that the shared copy is independent.
- **Import job fan-out for large CSVs:** If a member imports 500 contacts into the family book, 500 × 6 = 3000 ActivityEvent rows are created. The createMany approach handles this, but the transaction duration may be significant. Consider batching the fan-out in chunks of 100 rows for large imports. Document this as a P1 follow-up optimization.
- **The canEdit check is evaluated at request time, not at mutation time:** If a group admin flips a member's canEdit to false while that member has the contact edit form open, the member's mutation request (submitted after the flip) will be rejected with EDIT_PERMISSION_DENIED. This is correct behavior but may feel jarring. The UI should handle this gracefully with an error message ("Your edit permission for this family book has been changed. Your changes were not saved.").

## Outcome
Family group members with edit permission can perform the full range of contact mutations on the shared address book, with correct activity attribution to the acting member and reliable CTag updates for change propagation.
