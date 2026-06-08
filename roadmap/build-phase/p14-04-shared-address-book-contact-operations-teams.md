# P14-04 Shared Address Book Contact Operations (Teams)

## Purpose
This ticket extends the contact CRUD operations established for Family in Phase 13 to the Teams context, with three critical additions: per-book permission enforcement on every mutation, richer ActivityEvent attribution for the audit trail, and bulk operations for admins. Every contact mutation in a team address book must be gated by the calling member's permission level for that specific book, and every operation must emit a properly attributed ActivityEvent row for P14-05's audit log.

## Background
Phase 13 made Family contact operations work: `GroupContact` links a Contact record to a `GroupAddressBook`, with `addedByUserId` tracking attribution. Phase 13's authorization was coarse — if `GroupMember.canEdit = true`, the member could mutate any contact in the group's single shared book.

Teams requires a finer authorization model. The same mutation endpoint (e.g., archive a contact) must behave differently depending on:
1. Which address book the contact lives in.
2. The calling member's permission level (`EDIT` / `VIEW` / `NONE`) for that specific book.
3. Whether the book itself is archived (all writes blocked regardless of permission).

Phase 10's `ActivityEvent` model exists for personal activity logs. For team events, P14-01 added `teamId` FK to `ActivityEvent`. This ticket defines the exact attribution format that P14-05 will query and display.

## Scope

### In scope
- Permission check middleware/helper for team contact mutations.
- Server actions: `createTeamContact`, `updateTeamContact`, `archiveTeamContact`, `restoreTeamContact`.
- Bulk operations (admin only): `bulkArchiveTeamContacts`, `bulkDeleteTeamContacts`.
- Import into team address book: extend existing import flow to accept a `groupAddressBookId` target.
- ActivityEvent emission with correct attribution for all mutations.
- 403 error handling with clear user-facing messages.

### Out of scope
- UI component design — P14-07 and P14-08.
- Merge suggestions for team contacts — out of Phase 14 scope, document as future work.
- CardDAV PUT/DELETE (team writes via CardDAV) — P14-09.
- Audit log display — P14-05.
- Phonetic search/indexing for team contacts — not in Phase 14 scope.

## Design / Implementation Spec

### 1. Permission Enforcement Architecture

Every team contact mutation must pass through a centralized permission check. This is not optional and must not be bypassed. The check lives in `src/lib/teams/contact-auth.ts`.

```typescript
// src/lib/teams/contact-auth.ts
import { prisma } from "@/lib/prisma";
import { BookPermission } from "@prisma/client";

export class TeamBookPermissionError extends Error {
  constructor(
    public bookName: string,
    public memberPermission: BookPermission | null
  ) {
    super(`Insufficient permission for address book "${bookName}"`);
    this.name = "TeamBookPermissionError";
  }
}

export class ArchivedBookError extends Error {
  constructor(public bookName: string) {
    super(`Address book "${bookName}" is archived and cannot be modified`);
    this.name = "ArchivedBookError";
  }
}

/**
 * Asserts that the given user has at least EDIT permission for the given
 * address book within a team. Throws on failure.
 * Returns the resolved GroupAddressBook and GroupMember for downstream use.
 */
export async function assertEditPermission(
  userId: string,
  addressBookId: string
) {
  const book = await prisma.groupAddressBook.findUniqueOrThrow({
    where: { id: addressBookId },
    select: {
      id: true,
      name: true,
      archivedAt: true,
      groupId: true,
      group: { select: { name: true, type: true } },
    },
  });

  if (book.group.type !== "TEAM") {
    throw new Error("This authorization helper is for TEAM groups only");
  }

  if (book.archivedAt !== null) {
    throw new ArchivedBookError(book.name);
  }

  const member = await prisma.groupMember.findFirst({
    where: {
      userId,
      groupId: book.groupId,
      inviteStatus: "ACCEPTED",
    },
    select: { id: true, role: true },
  });

  if (!member) {
    throw new TeamBookPermissionError(book.name, null);
  }

  // OWNER always has EDIT
  if (member.role === "OWNER") {
    return { book, member };
  }

  const perm = await prisma.groupMemberAddressBookPermission.findUnique({
    where: {
      groupMemberId_addressBookId: {
        groupMemberId: member.id,
        addressBookId,
      },
    },
    select: { permission: true },
  });

  if (!perm || perm.permission !== "EDIT") {
    throw new TeamBookPermissionError(book.name, perm?.permission ?? null);
  }

  return { book, member };
}

/**
 * Same as assertEditPermission but requires VIEW or better (for read operations
 * where we want to confirm access, e.g. fetching contact details).
 */
export async function assertViewPermission(
  userId: string,
  addressBookId: string
) {
  // Similar structure, but accepts EDIT or VIEW, not NONE
  // Archived books are readable (read-only behavior)
}
```

#### 1.1 HTTP Error Mapping

Server actions should catch these custom errors and return structured error responses:

```typescript
try {
  await assertEditPermission(userId, addressBookId);
} catch (err) {
  if (err instanceof TeamBookPermissionError) {
    return { error: "permission_denied", message: err.message, status: 403 };
  }
  if (err instanceof ArchivedBookError) {
    return { error: "archived_book", message: err.message, status: 403 };
  }
  throw err;
}
```

The UI must handle these error codes distinctly:
- `permission_denied`: show toast "You have view-only access to [Book Name]."
- `archived_book`: show toast "[Book Name] is archived and cannot be modified."

---

### 2. ActivityEvent Attribution

All team contact mutations emit an ActivityEvent with the following shape:

```typescript
const actorDetail = `${memberDisplayName} · ${teamName} · ${bookName}`;

await prisma.activityEvent.create({
  data: {
    userId: contactOwnerId,        // The team owner's userId (contact ownership anchor)
    teamId: groupId,               // FK to Group — enables team audit queries
    actor: "TEAM_MEMBER",
    actorId: userId,               // The acting member's userId
    actorDetail,                   // Human-readable: "Alice Smith · Acme Corp · Clients"
    entityType: "CONTACT",
    entityId: contactId,
    eventType,                     // CONTACT_CREATED | CONTACT_UPDATED | CONTACT_ARCHIVED | ...
    diff: fieldDiff,               // JSON diff of changed fields (same format as Phase 10)
    createdAt: new Date(),
  },
});
```

**Key decisions:**
- `userId` on ActivityEvent is the team owner's userId, not the acting member's. This preserves the existing personal activity log query (which filters by `userId`) while the `teamId` + `actor: TEAM_MEMBER` fields enable team-scoped queries.
- `actorId` (new nullable field to add if not already present) stores the acting member's userId for audit attribution. If `actorId` is not yet on the model, add it in this ticket's migration.
- `actorDetail` is a human-readable string that combines member name, team name, and book name, matching Phase 10's pattern for display in audit log rows.

---

### 3. Contact CRUD Server Actions

#### 3.1 Create Team Contact

```typescript
// src/app/actions/team-contacts.ts

const CreateTeamContactSchema = z.object({
  addressBookId: z.string().cuid(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  // ... same contact fields as personal contact creation
  phones: z.array(PhoneSchema).optional(),
  emails: z.array(EmailSchema).optional(),
  // etc.
});

export async function createTeamContact(
  input: z.infer<typeof CreateTeamContactSchema>
) {
  const session = await auth();
  const { book, member } = await assertEditPermission(
    session.user.id,
    input.addressBookId
  );

  return prisma.$transaction(async (tx) => {
    // 1. Determine the Contact owner: use the team owner's userId
    //    (Group.ownerId) as the contact's userId anchor
    const group = await tx.group.findUniqueOrThrow({
      where: { id: book.groupId },
      select: { ownerId: true },
    });

    // 2. Create the Contact record
    const contact = await tx.contact.create({
      data: {
        userId: group.ownerId,
        firstName: input.firstName,
        lastName: input.lastName,
        // ... other fields
      },
    });

    // 3. Create the GroupContact join record
    await tx.groupContact.create({
      data: {
        groupAddressBookId: input.addressBookId,
        contactId: contact.id,
        addedByUserId: session.user.id,
      },
    });

    // 4. Emit ActivityEvent
    await emitTeamContactEvent(tx, {
      groupId: book.groupId,
      teamOwnerId: group.ownerId,
      actorId: session.user.id,
      addressBookId: input.addressBookId,
      contactId: contact.id,
      eventType: "CONTACT_CREATED",
      diff: null,
    });

    return contact;
  });
}
```

#### 3.2 Update Team Contact

```typescript
export async function updateTeamContact(input: {
  contactId: string;
  addressBookId: string;
  data: Partial<ContactUpdateFields>;
}) {
  const session = await auth();
  await assertEditPermission(session.user.id, input.addressBookId);

  // Validate the contact belongs to the specified addressBook
  const groupContact = await prisma.groupContact.findFirst({
    where: {
      contactId: input.contactId,
      groupAddressBookId: input.addressBookId,
    },
  });
  if (!groupContact) throw new Error("Contact not found in this address book");

  return prisma.$transaction(async (tx) => {
    const before = await tx.contact.findUniqueOrThrow({
      where: { id: input.contactId },
    });

    const updated = await tx.contact.update({
      where: { id: input.contactId },
      data: input.data,
    });

    const diff = computeDiff(before, updated); // existing diff utility from Phase 10

    await emitTeamContactEvent(tx, {
      /* ... */
      eventType: "CONTACT_UPDATED",
      diff,
    });

    return updated;
  });
}
```

#### 3.3 Archive and Restore Team Contact

```typescript
export async function archiveTeamContact(input: {
  contactId: string;
  addressBookId: string;
}) {
  // assertEditPermission
  // Validate contact is in the book via GroupContact
  // Set Contact.archivedAt = now() (same soft-delete pattern as personal contacts)
  // Emit ActivityEvent: CONTACT_ARCHIVED
}

export async function restoreTeamContact(input: {
  contactId: string;
  addressBookId: string;
}) {
  // assertEditPermission
  // Validate book is not archived (cannot restore into an archived book)
  // Set Contact.archivedAt = null
  // Emit ActivityEvent: CONTACT_RESTORED
}
```

---

### 4. Bulk Operations (Admin Only)

Bulk operations are restricted to OWNER and ADMIN roles — not available to MEMBERs with EDIT permission. The intent is to prevent accidental bulk destruction by a regular MEMBER.

#### 4.1 Bulk Archive

```typescript
const BulkArchiveSchema = z.object({
  addressBookId: z.string().cuid(),
  contactIds: z.array(z.string().cuid()).min(1).max(500),
});

export async function bulkArchiveTeamContacts(
  input: z.infer<typeof BulkArchiveSchema>
) {
  const session = await auth();
  const { book } = await assertEditPermission(session.user.id, input.addressBookId);

  // Additional check: ADMIN or OWNER (not just EDIT-level MEMBER)
  await requireGroupRole(session.user.id, book.groupId, "ADMIN");

  // Validate all contactIds belong to this addressBook
  const validGroupContacts = await prisma.groupContact.findMany({
    where: {
      groupAddressBookId: input.addressBookId,
      contactId: { in: input.contactIds },
    },
    select: { contactId: true },
  });

  const validIds = validGroupContacts.map((gc) => gc.contactId);
  if (validIds.length !== input.contactIds.length) {
    throw new Error("Some contact IDs do not belong to this address book");
  }

  return prisma.$transaction(async (tx) => {
    await tx.contact.updateMany({
      where: { id: { in: validIds }, archivedAt: null },
      data: { archivedAt: new Date() },
    });

    // Emit individual ActivityEvent per contact — NOT one bulk event
    const group = await tx.group.findUniqueOrThrow({
      where: { id: book.groupId },
      select: { ownerId: true },
    });

    for (const contactId of validIds) {
      await emitTeamContactEvent(tx, {
        groupId: book.groupId,
        teamOwnerId: group.ownerId,
        actorId: session.user.id,
        addressBookId: input.addressBookId,
        contactId,
        eventType: "CONTACT_ARCHIVED",
        diff: null,
      });
    }

    return { archivedCount: validIds.length };
  });
}
```

**Why individual ActivityEvent rows instead of one bulk event?**
The audit log (P14-05) must be able to answer "which contacts were archived by Alice on Tuesday?" at the individual contact level. A single bulk event ("Alice archived 47 contacts") is not sufficient for compliance or support investigations. The performance cost of N INSERTs inside a transaction for ≤500 contacts is acceptable. For larger bulk operations, a background job should be used instead — but the 500-contact cap on the Zod schema prevents this in the UI.

#### 4.2 Bulk Delete (Permanent Archive)

```typescript
const BulkDeleteSchema = z.object({
  addressBookId: z.string().cuid(),
  contactIds: z.array(z.string().cuid()).min(1).max(100),
  confirmation: z.literal("DELETE"), // user must type "DELETE" to confirm
});

export async function bulkDeleteTeamContacts(
  input: z.infer<typeof BulkDeleteSchema>
) {
  // OWNER only
  // Validate all contacts are in the book and are already archived
  //   (must archive before delete, same as book-level delete)
  // Hard delete Contact records (cascade deletes GroupContact and related)
  // Emit ActivityEvent per contact: CONTACT_DELETED
}
```

---

### 5. Import into Team Address Book

The existing import flow (Phase 6/12) accepts a vCard or CSV file and creates contacts in the user's personal contact library. This ticket extends the import flow to optionally target a team address book.

#### 5.1 Import Target Parameter

The `importContacts` server action (or the import job that processes uploaded files) must accept an optional `groupAddressBookId: string | null`. When provided:
- Assert EDIT permission for the calling user on that book.
- Create contacts with `userId = group.ownerId` (same as manual contact creation above).
- Create `GroupContact` rows linking each imported contact to the address book.
- Attribute each ActivityEvent with `actor: TEAM_MEMBER`.
- Set `addedByUserId = session.user.id` on each GroupContact.

#### 5.2 UI Changes for Import

In the Import modal/page:
- Add a dropdown: "Import destination" with options:
  - "My Contacts" (personal, default if user has no team or no EDIT permissions)
  - Under "Team [team name]": list of accessible team books with EDIT permission
- If the user selects a team book and has only VIEW permission, show a tooltip and disable the option.
- After import, redirect to the team workspace section showing the book that was imported into.

#### 5.3 Validation

- Maximum contacts per import into a team book: 2,000 (same as personal import limit). Enforce in the server action.
- Duplicates: if a contact with the same email or phone already exists in the same address book, skip and add to an "import warnings" report. Do not create duplicates.
- Duplicate check: query `GroupContact JOIN Contact WHERE groupAddressBookId = X AND (email IN [...] OR phone IN [...])`.

---

### 6. ActivityEvent Emission Helper

Centralise ActivityEvent creation for team contact operations to avoid drift across actions.

```typescript
// src/lib/teams/activity.ts

interface TeamContactEventParams {
  groupId: string;
  teamOwnerId: string;
  actorId: string;
  addressBookId: string;
  contactId: string;
  eventType: string;
  diff: object | null;
}

export async function emitTeamContactEvent(
  tx: Prisma.TransactionClient,
  params: TeamContactEventParams
) {
  // Fetch display names in a single query for the actorDetail string
  const [actor, team, book] = await Promise.all([
    tx.user.findUniqueOrThrow({
      where: { id: params.actorId },
      select: { name: true },
    }),
    tx.group.findUniqueOrThrow({
      where: { id: params.groupId },
      select: { name: true },
    }),
    tx.groupAddressBook.findUniqueOrThrow({
      where: { id: params.addressBookId },
      select: { name: true },
    }),
  ]);

  const actorDetail = `${actor.name} · ${team.name} · ${book.name}`;

  return tx.activityEvent.create({
    data: {
      userId: params.teamOwnerId,
      teamId: params.groupId,
      actor: "TEAM_MEMBER",
      actorId: params.actorId,
      actorDetail,
      entityType: "CONTACT",
      entityId: params.contactId,
      eventType: params.eventType,
      diff: params.diff ? JSON.stringify(params.diff) : null,
    },
  });
}
```

This helper executes 3 SELECT queries inside the transaction. For bulk operations with 500 contacts, these 3 queries are still only executed once (the results are reused across the loop). Cache the actor/team/book lookups locally in the bulk action scope.

---

### 7. Read Operations

Read operations (list contacts in a book, fetch contact detail) require VIEW or better permission — not EDIT.

**Server Action: `getTeamBookContacts`**

```typescript
export async function getTeamBookContacts(addressBookId: string) {
  const session = await auth();
  await assertViewPermission(session.user.id, addressBookId);

  return prisma.groupContact.findMany({
    where: {
      groupAddressBookId: addressBookId,
      contact: { archivedAt: null },
    },
    include: {
      contact: true,
    },
    orderBy: { contact: { lastName: "asc" } },
  });
}
```

Archived contacts are excluded by default. A separate `getArchivedTeamBookContacts` action returns archived contacts for the restore flow.

---

### 8. Contact Ownership Model in Teams

**A fundamental design question**: who "owns" a contact in a team book?

Phase 1 established `Contact.userId` as the ownership root. For personal contacts, this is straightforward. For team contacts:

**Decision**: `Contact.userId` is set to the team OWNER's userId. This means:
- Billing data scoping (if contacts are counted per user) naturally attributes team contacts to the team owner.
- Personal activity log (`ActivityEvent WHERE userId = me`) does not surface team contacts unless the querying user is the team owner.
- `ActivityEvent.teamId` + `ActivityEvent.actor = TEAM_MEMBER` is the correct filter for team-scoped audit queries.
- If the team owner's account is deleted or the team is disbanded, team contacts become orphaned (need a cleanup job — document as future work).
- A regular team member's personal contacts remain untouched if they leave the team.

Document this decision in the codebase at `src/lib/teams/README.md` or as a comment in the shared action file.

---

### 9. Access Guard for Server Components

For RSC pages that render team book contacts, add a server-side guard:

```typescript
// src/app/workspace/team-book/[bookId]/page.tsx (simplified)
export default async function TeamBookPage({ params }: { params: { bookId: string } }) {
  const session = await auth();
  const perm = await resolveEffectivePermission(
    session.user.id,
    params.bookId
  );

  if (perm === "NONE") {
    redirect("/workspace?error=no_access");
  }

  const contacts = await getTeamBookContacts(params.bookId);
  const isReadOnly = perm === "VIEW";

  return <TeamBookView contacts={contacts} isReadOnly={isReadOnly} />;
}
```

## Acceptance Criteria

- [ ] A member with EDIT permission can create, update, archive, and restore contacts in a team address book.
- [ ] A member with VIEW permission cannot create, update, or archive contacts — attempts return a 403-equivalent error with the correct error code.
- [ ] A member with NONE permission cannot access the team address book at all — the page redirects and the book does not appear in their workspace.
- [ ] Mutations on an archived book return `archived_book` error for all members including OWNER.
- [ ] Every contact mutation emits an ActivityEvent with `actor = TEAM_MEMBER`, `teamId` populated, and `actorDetail` in the format "[Member] · [Team] · [Book]".
- [ ] Bulk archive is restricted to OWNER and ADMIN; MEMBERs with EDIT permission cannot access it.
- [ ] Bulk archive emits one ActivityEvent per contact (not one bulk event).
- [ ] Import into a team book creates contacts with `userId = team owner's userId`.
- [ ] Import respects the same EDIT permission check as manual contact creation.
- [ ] Import skips duplicates (same email/phone already in the book) and reports them.
- [ ] `getTeamBookContacts` does not include archived contacts by default.
- [ ] `assertEditPermission` throws `ArchivedBookError` for archived books before checking member permissions.
- [ ] `emitTeamContactEvent` correctly formats `actorDetail` with the member's display name, team name, and book name.
- [ ] A member leaving the team (REVOKED) can no longer access contacts they previously could.
- [ ] Ownership of team contacts is set to the team owner's userId, not the creating member's userId.

## Risks and Open Questions

- **actorId on ActivityEvent**: Phase 10 may not have this column. If `actorId` is missing, add it as a nullable `String?` column in this ticket's migration. Confirm with P14-01 implementer whether it was added there.
- **Contact deduplication across personal and team books**: A member might have the same person in their personal contacts AND a team book. There is no de-duplication across these boundaries in Phase 14. Document as future work.
- **Bulk delete performance**: `bulkDeleteTeamContacts` hard-deletes up to 100 contacts inside a transaction. With cascade deletes on related tables (phones, emails, etc.), this could be slow for well-connected contacts. Test with production-scale contact records. Consider a soft-delete-only approach for Phase 14.
- **Import conflict resolution**: The current duplicate skip logic uses email/phone match. This may produce false positives (two different people who share a phone number) or false negatives (same person with different emails). Phase 14 import into teams should not attempt merge logic — skip and report is the correct behavior.
- **Transaction size for bulk archive**: 500 contacts × 3 SELECT queries for actorDetail = 1,500 queries inside one transaction. Cache the actor/team/book lookups before the loop to reduce this to 3 total. Enforce this in code review.

## Outcome
Every contact mutation within a team address book is permission-gated at the book level, fully attributed in the ActivityEvent log, and consistent with the existing personal contact operations, enabling the audit log and role-based access controls that define the Teams product.
