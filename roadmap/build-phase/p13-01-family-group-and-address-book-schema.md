# P13-01 Family Group and Shared Address Book Schema

## Purpose
This ticket extends the Phase 11 scaffolding models — Group, GroupMember, and GroupAddressBook — into a fully operational schema capable of supporting a real shared address book product. It introduces the GroupContact linking model, resolves the contact ownership question for shared contacts, adds the collection CTag derivation mechanism, and produces a clean Prisma migration that runs alongside existing contact and user data without touching the private contact ownership model. Every subsequent Phase 13 ticket depends on the schema decisions made here being correct and stable.

## Background
Phase 11 (P11-02) added three scaffolding models to the Prisma schema: Group, GroupMember, and GroupAddressBook. These were added explicitly with no product logic — their purpose was to validate the schema direction before Phase 13 builds on them. The exact fields added were:

- `Group`: id, ownerId (FK User), type (enum FAMILY/TEAM), name, subscriptionId, memberSlotsLimit (Int default 6), defaultAddressBookId (nullable FK GroupAddressBook), createdAt, updatedAt
- `GroupMember`: id, groupId, userId, role (enum OWNER/ADMIN/MEMBER), inviteStatus (enum PENDING/ACCEPTED/DECLINED/REVOKED), createdAt
- `GroupAddressBook`: id, groupId, name, description, isDefault (Boolean), archivedAt, createdAt, updatedAt

Phase 13 must extend these without breaking the existing private contact ownership model. The canonical Contact model uses `Contact.userId` as the sole ownership anchor — every query, entitlement check, import job, sync account, and export job in the application assumes this relationship. Any schema decision that touches Contact.userId has broad blast radius and must be documented carefully.

The Phase 9 CardDAV server introduced the collection CTag concept: a derived token equal to the most recent `Contact.updatedAt` among active contacts for a user. Phase 13's shared address book needs the same concept, but scoped to GroupContact rows rather than all of a user's contacts. The CTag is used by P13-08 (CardDAV exposure) and by P13-04 (change propagation signals).

## Scope

**In scope:**
- Adding GroupContact model with all fields, constraints, and indexes
- Extending Group with maxMembers and confirming defaultAddressBookId FK
- Extending GroupMember with canEdit, joinedAt, invitedAt, invitedByUserId fields
- Extending GroupAddressBook with isDefault and archivedAt (confirming fields already scaffolded)
- Documenting and committing the contact ownership model decision for shared contacts
- Defining the collection CTag derivation formula for GroupAddressBook
- Defining indexes to support all Phase 13 query patterns
- Writing the Prisma migration file
- One-family-group-per-user constraint documentation and enforcement approach

**Out of scope:**
- Any product logic, API endpoints, or UI — this ticket is schema-only
- Teams schema extensions (Phase 14)
- The invite token mechanism (P13-02)
- The SSE or polling mechanism (P13-04)
- CardDAV URL extensions (P13-08)

## Design / Implementation Spec

### Contact Ownership Model Decision

The central schema question for Phase 13 is: how does a contact that lives in a shared address book answer the question "who owns this contact?"

The existing Prisma schema has `Contact.userId String` as a non-nullable FK to User. This field is the access control anchor for every contact query in the app. All queries are `WHERE userId = <authenticated user id>`. Removing this non-nullable constraint or making it point to something other than an individual user would require auditing and updating every query in the codebase.

Two options were evaluated:

**Option A — Nullable groupId on Contact**
Add `groupId String?` to Contact. A contact is either private (groupId null, userId = owner) or shared (groupId set, userId null or set to the group owner).

Pros: contacts become first-class citizens of groups; CardDAV server can look up contacts by groupId directly.
Cons: the nullable userId breaks every existing query that assumes `Contact.userId` is non-null; the query pattern diverges significantly between private and shared contacts; adding a nullable FK with partial index semantics is error-prone.

**Option B — GroupContact linking table (chosen)**
Keep Contact.userId non-nullable, always pointing to the group owner's userId for shared contacts. Add a separate `GroupContact` model that links a Contact record to a GroupAddressBook.

Pros: zero impact on existing queries for private contacts; the Contact model is unchanged; all existing entitlement gates, import jobs, and sync accounts continue to work unmodified; shared contacts are identified by the existence of a GroupContact record, not by a nullable field.
Cons: queries for "all contacts this user can see" must join or union Contact + GroupContact; the group owner's userId appears on all shared Contact records, which is a nominal assignment rather than a real ownership signal.

**Decision: Option B — GroupContact linking table.**

The group owner's userId is used as the nominal owner on all shared Contact records. This means that if a family member creates a new shared contact, the underlying Contact row has `userId = groupOwner.id` regardless of which member created it. The actual creator is tracked in `GroupContact.addedByUserId` and in ActivityEvent rows. All mutations to shared contacts must be gated through group membership checks (does the requesting user have an ACCEPTED GroupMember row for this group with canEdit: true?) rather than through userId equality checks.

This decision must be documented in a comment in `src/lib/groups/ownership.ts` to prevent future engineers from accidentally gating shared contact access on userId equality.

### GroupContact Model

```prisma
model GroupContact {
  id                 String           @id @default(cuid())
  groupAddressBookId String
  contactId          String
  addedByUserId      String
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  groupAddressBook   GroupAddressBook @relation(fields: [groupAddressBookId], references: [id], onDelete: Cascade)
  contact            Contact          @relation(fields: [contactId], references: [id], onDelete: Cascade)
  addedBy            User             @relation("GroupContactAddedBy", fields: [addedByUserId], references: [id])

  @@unique([groupAddressBookId, contactId])
  @@index([groupAddressBookId, updatedAt(sort: Desc)])
  @@index([contactId])
}
```

**Field rationale:**

- `groupAddressBookId`: FK to GroupAddressBook with cascade delete — if the address book is deleted, all GroupContact linking records go with it. The underlying Contact records are handled separately (soft-archived by the group deletion flow in P13-06, not by the cascade).
- `contactId`: FK to Contact. OnDelete Cascade here means if the underlying Contact is hard-deleted, the GroupContact link is removed. In practice, Phase 13 never hard-deletes shared contacts — it soft-archives them — so this cascade is a safety net.
- `addedByUserId`: The GroupMember who first added this contact to the shared book. Used for attribution in the activity log and UI. Not cascaded — if the member is removed from the group, the attribution record is retained for audit purposes (the FK is a soft reference; member removal does not delete the user account).
- `updatedAt`: Tracks when the GroupContact link was last touched — used in CTag derivation. Note: when the underlying Contact is updated, the Contact.updatedAt changes but GroupContact.updatedAt does not automatically update. The mutation path (P13-03) must explicitly touch `GroupContact.updatedAt` (via `prisma.groupContact.update({ data: { updatedAt: new Date() } })`) whenever the linked Contact is updated through a group mutation, so that the CTag reflects the change.

**Unique constraint:** `(groupAddressBookId, contactId)` prevents the same contact from appearing twice in the same address book. This is the guard against the "Add to family book" action being applied twice to the same private contact.

**Index on `(groupAddressBookId, updatedAt DESC)`:** Supports the CTag derivation query: `SELECT MAX(updatedAt) FROM GroupContact WHERE groupAddressBookId = ?`. Also supports efficient paginated listing of contacts in a shared book sorted by recency of change.

**Index on `(contactId)`:** Supports the reverse lookup: "which shared books does this contact appear in?" Used during contact detail rendering (P13-05) to show the "Family address book" source badge.

### Group Model Extensions

Extend the existing Group scaffold model:

```prisma
model Group {
  id                   String            @id @default(cuid())
  ownerId              String
  type                 GroupType
  name                 String
  subscriptionId       String?
  maxMembers           Int               @default(6)
  defaultAddressBookId String?           @unique
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt

  owner                User              @relation("GroupOwner", fields: [ownerId], references: [id])
  members              GroupMember[]
  addressBooks         GroupAddressBook[]
  defaultAddressBook   GroupAddressBook? @relation("DefaultBook", fields: [defaultAddressBookId], references: [id])

  @@index([ownerId])
}
```

Changes from Phase 11 scaffold:
- Rename `memberSlotsLimit` to `maxMembers` for clarity (the scaffold name was a placeholder). Default remains 6 for FAMILY.
- `defaultAddressBookId` is retained from the scaffold. The `@unique` constraint is added here because a group has exactly one default book in v1 and this FK should be a 1:1 pointer.
- Add `updatedAt` with `@updatedAt` — the scaffold omitted this but it is needed for group-level change tracking.

### GroupMember Model Extensions

```prisma
model GroupMember {
  id              String             @id @default(cuid())
  groupId         String
  userId          String?
  role            GroupMemberRole
  inviteStatus    InviteStatus
  canEdit         Boolean            @default(true)
  joinedAt        DateTime?
  invitedAt       DateTime           @default(now())
  invitedByUserId String?
  inviteEmail     String?
  createdAt       DateTime           @default(now())

  group           Group              @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user            User?              @relation(fields: [userId], references: [id], onDelete: SetNull)
  invitedBy       User?              @relation("InvitedBy", fields: [invitedByUserId], references: [id])

  @@unique([groupId, userId])
  @@index([groupId, inviteStatus])
  @@index([userId, inviteStatus])
}
```

Changes from Phase 11 scaffold:
- `userId` is now nullable. A pending invite to a user who does not yet have a Kontax account has no userId — only an inviteEmail. Once the invitee registers, their userId is linked to this record.
- `canEdit Boolean @default(true)`: controls whether a member can mutate shared contacts. Group admin can flip this per member via the management page (P13-06).
- `joinedAt DateTime?`: null until inviteStatus transitions to ACCEPTED.
- `invitedAt DateTime @default(now())`: set when the invite is created.
- `invitedByUserId String?`: tracks which group member sent this invite, for display in the management page.
- `inviteEmail String?`: stores the email address that the invite was sent to. Required for pending invites where userId is null. Once the invite is accepted, this is retained for display but the userId becomes the authoritative identity.
- `@@unique([groupId, userId])`: prevents a user from appearing twice in the same group. Note: null userId values are not subject to unique constraints in PostgreSQL — two pending invite rows with null userId are permitted and disambiguated by inviteEmail.
- `@@index([groupId, inviteStatus])`: supports "list all pending invites for this group" and "list all accepted members for this group."
- `@@index([userId, inviteStatus])`: supports "which groups is this user a member of?" — used for the one-family-group-per-user enforcement check.

### GroupAddressBook Model Extensions

```prisma
model GroupAddressBook {
  id            String         @id @default(cuid())
  groupId       String
  name          String
  description   String?
  isDefault     Boolean        @default(true)
  archivedAt    DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  group         Group          @relation(fields: [groupId], references: [id], onDelete: Cascade)
  contacts      GroupContact[]
  defaultFor    Group?         @relation("DefaultBook")

  @@index([groupId])
}
```

The Phase 11 scaffold already included isDefault and archivedAt. This ticket confirms those fields and adds the `updatedAt @updatedAt` field and the reverse relation to GroupContact. In v1, every family group has exactly one GroupAddressBook with isDefault: true.

### One-Family-Group-Per-User Constraint

A user cannot be an ACCEPTED member of more than one FAMILY group simultaneously. This constraint is enforced at the application layer (not the database layer) in the invite acceptance flow (P13-02):

Before accepting an invite, query:
```typescript
const existingMembership = await prisma.groupMember.findFirst({
  where: {
    userId: invitee.id,
    inviteStatus: 'ACCEPTED',
    group: { type: 'FAMILY' }
  }
})
if (existingMembership) throw new Error('USER_ALREADY_IN_FAMILY_GROUP')
```

The same check runs when creating a new family group (a user cannot create a second group if they are already an accepted member of one).

This constraint is not enforced at the database level because a unique constraint on (userId, groupType) across GroupMember and Group would require a complex partial index or check constraint that is not easily expressed in Prisma schema syntax. The application-layer check is sufficient for v1 and is well-tested in P13-02.

### Collection CTag Derivation

The CTag for a GroupAddressBook is derived from the maximum `updatedAt` value among active (non-archived) GroupContact rows for that address book:

```typescript
async function getGroupAddressBookCTag(groupAddressBookId: string): Promise<string> {
  const result = await prisma.groupContact.aggregate({
    where: {
      groupAddressBookId,
      contact: { archivedAt: null }
    },
    _max: { updatedAt: true }
  })
  const maxUpdatedAt = result._max.updatedAt
  if (!maxUpdatedAt) return 'empty'
  return maxUpdatedAt.toISOString()
}
```

This is the same pattern used for the private address book CTag in Phase 9 (derived from `Contact.updatedAt`). The CTag format is an ISO 8601 UTC string. An empty address book returns the string `'empty'` as a stable initial CTag.

The CTag is used in two contexts:
1. P13-04 change propagation: clients poll `GET /api/family/{groupId}/ctag` and compare to their cached CTag to detect changes without fetching the full contact list.
2. P13-08 CardDAV: returned as the `getctag` property in PROPFIND responses for the `/dav/addressbooks/{userId}/family/` collection.

### Enum Additions

```prisma
enum GroupType {
  FAMILY
  TEAM
}

enum GroupMemberRole {
  OWNER
  ADMIN
  MEMBER
}

enum InviteStatus {
  PENDING
  ACCEPTED
  DECLINED
  REVOKED
}
```

These enums were defined in the Phase 11 scaffold. This ticket confirms them and renames `GroupMemberRole` values from the scaffold (which may have used different naming) to OWNER/ADMIN/MEMBER. The OWNER role is held by exactly one GroupMember per group — the creator or the current owner after a transfer (P13-06).

### Migration Considerations

The Prisma migration adds:
1. New GroupContact table (no existing data to migrate)
2. New columns on GroupMember: canEdit (default true — safe backfill), joinedAt (nullable — safe), invitedAt (default now() — safe), invitedByUserId (nullable — safe), inviteEmail (nullable — safe)
3. New column on Group: maxMembers (default 6 — safe backfill), updatedAt (default now() for backfill)
4. New column on GroupAddressBook: updatedAt (default now() for backfill)
5. New indexes

Since the Phase 11 scaffold models have no data in production yet (they were scaffolding-only with no product logic), the migration is non-destructive and can run with no data migration concerns. The migration file should include a comment noting that Group, GroupMember, and GroupAddressBook were previously empty-table scaffolds and this migration activates them.

### File Structure

```
prisma/
  schema.prisma                            # Updated with all model extensions
  migrations/
    <timestamp>_p13_01_family_schema/
      migration.sql

src/
  lib/
    groups/
      ownership.ts                         # Documents the Contact.userId nominal ownership decision
      ctag.ts                              # getGroupAddressBookCTag() function
    activity/
      payload-schemas.ts                   # Extended in P13-03, referenced here for context
```

The `src/lib/groups/ownership.ts` file must include a prominent comment:

```typescript
/**
 * SHARED CONTACT OWNERSHIP MODEL
 *
 * Contacts in a shared family address book have Contact.userId set to the
 * group owner's userId. This is a nominal assignment for schema compatibility —
 * it does NOT mean the group owner is the contact's data custodian in the
 * product sense. Mutations to shared contacts must be gated through
 * GroupMember.canEdit checks, NOT through Contact.userId equality.
 *
 * Do not add userId equality checks for shared contact access.
 * Use isGroupContact() and checkGroupEditPermission() from this module.
 */
```

## Acceptance Criteria

- GroupContact model is present in prisma/schema.prisma with all specified fields, relations, unique constraint, and indexes
- GroupMember model is extended with canEdit, joinedAt, invitedAt, invitedByUserId, and inviteEmail fields
- Group model is extended with maxMembers and updatedAt fields
- GroupAddressBook model is extended with updatedAt field
- All four enums (GroupType, GroupMemberRole, InviteStatus) are present in the schema
- The contact ownership model decision (Option B: GroupContact linking table) is documented in src/lib/groups/ownership.ts
- The collection CTag derivation function is implemented in src/lib/groups/ctag.ts and returns a valid ISO 8601 UTC string for a non-empty address book and 'empty' for an empty one
- Prisma migration runs cleanly against a fresh database
- Prisma migration runs cleanly against an existing database that has User and Contact rows from earlier phases
- The one-family-group-per-user constraint is documented in src/lib/groups/ownership.ts with the enforcement query shown
- TypeScript compilation passes with no new errors after the schema change
- The index on (groupAddressBookId, updatedAt DESC) exists in the migration SQL and can be verified via EXPLAIN on the CTag derivation query

## Risks and Open Questions

- The GroupContact.updatedAt field must be explicitly updated by the mutation path (P13-03) when the underlying Contact is changed, because Prisma's @updatedAt only triggers on updates to the model that owns the field. If P13-03 forgets to touch GroupContact.updatedAt when updating a Contact through a group mutation, the CTag will not reflect the change and P13-04 propagation will silently fail. This coupling must be documented and tested in P13-03.
- The `@unique` constraint on Group.defaultAddressBookId creates a circular FK situation: Group references GroupAddressBook for its default, and GroupAddressBook references Group for its parent. Prisma handles this with nullable FKs on one side. Confirm that the migration generates the FKs in the correct order (GroupAddressBook first, then Group.defaultAddressBookId) to avoid constraint violations during group creation.
- Teams (Phase 14) will reuse Group, GroupMember, and GroupAddressBook. The maxMembers default of 6 applies only to FAMILY groups — Teams has a different limit (25, expandable). The application layer must enforce the correct limit based on Group.type, not rely on the schema default alone.
- The inviteEmail field on GroupMember stores a plain email address. This is PII and must be covered by the same data-at-rest protections as User.email. Confirm with the security baseline (Phase 1) whether this field needs field-level encryption before Phase 13 ships.

## Outcome
The Prisma schema is extended with a stable, documented GroupContact model and the necessary field additions to Group, GroupMember, and GroupAddressBook, establishing the complete data layer for all Phase 13 family sharing features.
