# P14-03 Multiple Shared Address Books

## Purpose
Teams is differentiated from Family by supporting multiple shared address books per group. This ticket delivers the full address book management lifecycle — creation, renaming, archiving, deletion, and per-book member permission assignment — and ensures each operation maintains a consistent, fully-bootstrapped permission matrix. It also defines how address books are presented to members in the workspace (collapsible team section, book selector on contact creation) and how archived books behave across the system.

## Background
Phase 11 scaffolded `GroupAddressBook` with a single-book assumption for Family: `Group.defaultAddressBookId` pointed to the one shared book, and `GroupMember.canEdit` was a group-wide boolean. Phase 13 made this operational with `GroupContact` and propagation.

Teams breaks the one-book assumption. A team might have books named "Clients", "Vendors", "Internal", and "Archive". Each book is independent: it has its own contacts, its own per-member permission row in `GroupMemberAddressBookPermission`, its own CTag for CardDAV (P14-09), and its own audit scope. The permission matrix (admin sets EDIT/VIEW/NONE per member per book) is the key organizational primitive.

From P14-01: when a new book is created, all active members get bootstrapped with EDIT permission for the new book. When a member joins, they get EDIT permission for all existing non-archived books. Both bootstraps happen inside database transactions.

## Scope

### In scope
- Server actions: `createTeamAddressBook`, `renameTeamAddressBook`, `archiveTeamAddressBook`, `deleteTeamAddressBook`.
- Per-book member permission management: `setMemberBookPermission` (admin updates a single member's permission for a single book), `setAllMembersBookPermission` (admin sets a permission for all members on a book).
- Workspace integration: team section in the contacts list, book selector on the "New Contact" modal, archived book filter.
- UI for book management in the team management page (detailed layout is P14-07, this ticket covers the server actions and data shapes).
- Validation rules for each operation.

### Out of scope
- Contact CRUD within books — P14-04.
- CardDAV per-book collection exposure — P14-09.
- Sync accounts per book — P14-06.
- Audit log display — P14-05.
- Design spec / visual design — P14-08.

## Design / Implementation Spec

### 1. Address Book Lifecycle

#### 1.1 Create Address Book

**Server Action: `createTeamAddressBook`**

```typescript
const CreateAddressBookSchema = z.object({
  groupId: z.string().cuid(),
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(300).trim().optional(),
});

export async function createTeamAddressBook(
  input: z.infer<typeof CreateAddressBookSchema>
) {
  const session = await auth();
  // Auth: OWNER or ADMIN
  await requireGroupRole(session.user.id, input.groupId, "ADMIN");

  return prisma.$transaction(async (tx) => {
    const book = await tx.groupAddressBook.create({
      data: {
        groupId: input.groupId,
        name: input.name,
        description: input.description ?? null,
        isDefault: false,
      },
    });

    // Bootstrap permissions for all active members
    const activeMembers = await tx.groupMember.findMany({
      where: { groupId: input.groupId, inviteStatus: "ACCEPTED" },
      select: { id: true },
    });

    await tx.groupMemberAddressBookPermission.createMany({
      data: activeMembers.map((m) => ({
        groupMemberId: m.id,
        addressBookId: book.id,
        permission: "EDIT",
        grantedByUserId: session.user.id,
      })),
    });

    return book;
  });
}
```

**Rules:**
- Book name must be unique within the group (case-insensitive). Enforce at the database level with a partial unique index: `UNIQUE (groupId, lower(name)) WHERE archivedAt IS NULL`.
- A group may have at most 20 active (non-archived) books. This is a soft limit enforced at the application layer to prevent UI clutter. Document as configurable.
- The first book on a team is created by `createTeam` (P14-02) with `name: "Main"` and `isDefault: true`. Subsequent books created here have `isDefault: false`.

#### 1.2 Rename Address Book

**Server Action: `renameTeamAddressBook`**

```typescript
const RenameAddressBookSchema = z.object({
  addressBookId: z.string().cuid(),
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(300).trim().optional().nullable(),
});

export async function renameTeamAddressBook(
  input: z.infer<typeof RenameAddressBookSchema>
) {
  // Auth: resolve groupId from addressBookId, then require ADMIN or OWNER
  // Validate: unique name within group (excluding self)
  // Update GroupAddressBook.name, GroupAddressBook.description
  // No permission matrix changes required
  // Emit ActivityEvent (eventType: BOOK_RENAMED, teamId, actorDetail)
}
```

Renaming a book does not affect contacts, permissions, or sync accounts. It does invalidate the CardDAV displayname for that collection (P14-09 must re-fetch).

#### 1.3 Archive Address Book

**Server Action: `archiveTeamAddressBook`**

```typescript
const ArchiveAddressBookSchema = z.object({
  addressBookId: z.string().cuid(),
});

export async function archiveTeamAddressBook(
  input: z.infer<typeof ArchiveAddressBookSchema>
) {
  // Auth: OWNER or ADMIN
  // Validate: book is not already archived
  // Validate: book is not the last non-archived book in the group
  //   (a team must always have at least one active book)
  // Set GroupAddressBook.archivedAt = now()
  // Emit ActivityEvent (eventType: BOOK_ARCHIVED)
}
```

**Archived book behavior:**
- `archivedAt IS NOT NULL` means the book is archived.
- All `GroupContact` rows for the book become read-only. No EDIT mutations are permitted, regardless of member permissions.
- The book is hidden from the default workspace view and the default book selector on "New Contact".
- Admins can reveal archived books via a "Show archived" filter toggle in the workspace.
- Members with NONE permission on an archived book continue to not see it — this is consistent behavior.
- Unarchiving: admins can unarchive a book with `unarchiveTeamAddressBook` (sets `archivedAt = null`). This does NOT change any permissions — the existing matrix is restored as-is.

**Guard: last book protection:**
```typescript
const activeBookCount = await prisma.groupAddressBook.count({
  where: { groupId, archivedAt: null },
});
if (activeBookCount <= 1) {
  throw new Error("Cannot archive the last active address book. Create a new book first.");
}
```

#### 1.4 Delete Address Book

Deletion is a destructive operation and must be treated with extreme care. Unlike archiving (reversible), deletion is permanent for the book record itself. However, contacts within the book are soft-archived, not hard-deleted.

**Server Action: `deleteTeamAddressBook`**

```typescript
const DeleteAddressBookSchema = z.object({
  addressBookId: z.string().cuid(),
  confirmation: z.string(), // must equal the book's name exactly
});

export async function deleteTeamAddressBook(
  input: z.infer<typeof DeleteAddressBookSchema>
) {
  // Auth: OWNER only (admins cannot delete books, only archive)
  // Fetch book, validate confirmation === book.name
  // Validate: book is archived (must archive first before deleting)
  //   This two-step flow (archive → delete) prevents accidental deletion
  // In transaction:
  //   1. Soft-archive all GroupContact.contact records:
  //      For each GroupContact in this book, set Contact.archivedAt = now()
  //      where the Contact is not already archived
  //   2. Delete all GroupMemberAddressBookPermission rows for this book
  //   3. Nullify TeamSyncAccount.groupAddressBookId rows pointing to this book
  //      (or cascade-delete depending on design — see risk)
  //   4. Delete GroupAddressBook record
  // Emit ActivityEvent (eventType: BOOK_DELETED)
}
```

**UI guard:**
The delete option is only shown if the book is already archived. The UI presents:
> "Delete '[Book Name]'? This will permanently remove the address book and archive all contacts within it. This cannot be undone."
> Type the book name to confirm: _____________

**Why archive-first before delete?**
This prevents a two-click accident. The admin must explicitly archive the book first (making it read-only and hidden), then separately choose to delete it. This gives a natural "cooling off" period.

---

### 2. Per-Book Permission Management

#### 2.1 Set a Single Member's Permission for a Book

**Server Action: `setMemberBookPermission`**

```typescript
const SetMemberBookPermissionSchema = z.object({
  groupMemberId: z.string().cuid(), // GroupMember.id
  addressBookId: z.string().cuid(),
  permission: z.enum(["EDIT", "VIEW", "NONE"]),
});

export async function setMemberBookPermission(
  input: z.infer<typeof SetMemberBookPermissionSchema>
) {
  // Auth: OWNER or ADMIN
  // Validate: groupMemberId belongs to a group where acting user is OWNER/ADMIN
  // Validate: cannot change OWNER's permissions via this action
  //   (OWNER always has EDIT on all books — enforced by not having a permission row
  //    or by having a fixed EDIT row — choose one approach and document)
  // Upsert GroupMemberAddressBookPermission
  // Emit ActivityEvent (eventType: PERMISSION_CHANGED)
}
```

**OWNER permission policy:**
The OWNER always has EDIT access to all books. Two approaches:
- Option A: Always upsert EDIT for OWNER — the action above throws if target is OWNER.
- Option B: Permission check code treats OWNER as implicitly EDIT even without a row.

**Decision: Option B** — the permission resolution code in `hasBookPermission` checks the member's role first. If role === OWNER, return EDIT regardless of permission rows. This avoids the need to maintain permission rows for the owner and eliminates the risk of someone mistakenly setting OWNER to NONE.

Update `hasBookPermission` in `src/lib/teams/permissions.ts`:
```typescript
export async function resolveEffectivePermission(
  userId: string,
  groupId: string,
  addressBookId: string
): Promise<BookPermission> {
  const member = await prisma.groupMember.findFirst({
    where: { userId, groupId, inviteStatus: "ACCEPTED" },
    select: { id: true, role: true },
  });
  if (!member) return "NONE";
  if (member.role === "OWNER") return "EDIT";

  const perm = await prisma.groupMemberAddressBookPermission.findUnique({
    where: {
      groupMemberId_addressBookId: {
        groupMemberId: member.id,
        addressBookId,
      },
    },
    select: { permission: true },
  });
  return perm?.permission ?? "NONE";
}
```

#### 2.2 Bulk Permission Update

**Server Action: `setBulkMemberPermissions`**

Used when an admin wants to set a single permission level for all members on a book (e.g., "make this book VIEW-only for all members"):

```typescript
const SetBulkPermissionsSchema = z.object({
  addressBookId: z.string().cuid(),
  permission: z.enum(["EDIT", "VIEW", "NONE"]),
  excludeOwner: z.boolean().default(true),
});

export async function setBulkMemberPermissions(
  input: z.infer<typeof SetBulkPermissionsSchema>
) {
  // Auth: OWNER or ADMIN
  // Fetch all GroupMember rows for the group (ACCEPTED, excluding OWNER if excludeOwner)
  // Update all GroupMemberAddressBookPermission rows for this book in a single updateMany
  // Emit one ActivityEvent summarising the bulk change
}
```

---

### 3. Workspace Integration

#### 3.1 Data Shape for Team Workspace Section

The workspace page query must return a structured view of all accessible books for the current user:

```typescript
// src/lib/teams/workspace.ts

export async function getTeamWorkspaceBooks(userId: string, groupId: string) {
  const member = await prisma.groupMember.findFirst({
    where: { userId, groupId, inviteStatus: "ACCEPTED" },
    select: { id: true, role: true },
  });
  if (!member) return [];

  // OWNER sees all non-archived books
  if (member.role === "OWNER") {
    return prisma.groupAddressBook.findMany({
      where: { groupId, archivedAt: null },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  // ADMIN and MEMBER: filter by permission != NONE
  const permissions = await prisma.groupMemberAddressBookPermission.findMany({
    where: {
      groupMemberId: member.id,
      permission: { not: "NONE" },
      addressBook: { archivedAt: null },
    },
    include: {
      addressBook: true,
    },
  });

  return permissions
    .map((p) => p.addressBook)
    .sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
}
```

#### 3.2 Book Selector on "New Contact" Modal

When a user creates a contact in the workspace and has access to at least one team book:
- Show a dropdown labelled "Add to address book" with options:
  - "My Contacts" (personal)
  - Under a "Team" section header: each accessible team book with EDIT permission
- Default selection: the most recently used book for this user (store in `localStorage` key `kontax_last_book_{groupId}`).
- If the user has only personal contacts (no team), the dropdown is hidden.
- If the user has only VIEW permissions on all team books, the team section is shown but grayed out with a tooltip: "You have view-only access to these books."

#### 3.3 Archived Book Filter Toggle

In the workspace team section header, show a subtle "Show archived books" toggle (checkbox or text link). When toggled on:
- Archived books appear in a visually distinct section (muted style, "ARCHIVED" badge).
- Contact list in archived books is read-only — all edit/add actions are hidden.
- Archived book filter state is per-session (reset on page load).

---

### 4. Database Constraints

#### 4.1 Unique Book Name Within Group (Active Only)
```sql
CREATE UNIQUE INDEX "GroupAddressBook_groupId_name_active_idx"
  ON "GroupAddressBook"(groupId, lower(name))
  WHERE "archivedAt" IS NULL;
```

This allows multiple archived books to have the same name (e.g., if the admin archives and recreates a "Clients" book).

#### 4.2 Soft Cap Enforcement at Application Layer
The 20-book cap is enforced in `createTeamAddressBook` as:
```typescript
const bookCount = await tx.groupAddressBook.count({
  where: { groupId: input.groupId, archivedAt: null },
});
if (bookCount >= 20) {
  throw new Error("Maximum of 20 active address books per team");
}
```

---

### 5. Error Handling and User-Facing Messages

| Error condition | User-facing message |
|---|---|
| Duplicate book name | "A book named '[name]' already exists in this team." |
| Last book archive | "You cannot archive the last active book. Create a new one first." |
| Delete without archive first | "Archive this book before deleting it." |
| Delete confirmation mismatch | "The name you entered does not match. Please try again." |
| 20-book cap | "Teams can have up to 20 active address books. Archive one to create a new one." |
| NONE permission attempt to create contact | "You have view-only access to [book name]." |

---

### 6. ActivityEvent Emission

All book lifecycle events emit an `ActivityEvent` row with:
- `teamId`: the group ID
- `actor`: `TEAM_MEMBER`
- `actorDetail`: `"[Member display name] · [Team name]"`
- `entityType`: `ADDRESS_BOOK`
- `entityId`: the `GroupAddressBook.id`
- `eventType`: one of `BOOK_CREATED`, `BOOK_RENAMED`, `BOOK_ARCHIVED`, `BOOK_UNARCHIVED`, `BOOK_DELETED`, `PERMISSION_CHANGED`

These events appear in the team audit log (P14-05) filtered by `eventType` category "Address Book".

## Acceptance Criteria

- [ ] An OWNER or ADMIN can create a new team address book; the name is unique within the team's active books.
- [ ] All active members receive EDIT permissions for the new book immediately upon creation (in the same transaction).
- [ ] An OWNER or ADMIN can rename a book; the new name is validated for uniqueness.
- [ ] An OWNER or ADMIN can archive a book; it becomes read-only for all members.
- [ ] Archiving the last active book returns a clear error.
- [ ] Archived books are hidden from the default workspace view and book selector.
- [ ] "Show archived books" toggle reveals archived books as read-only.
- [ ] An OWNER can delete an archived book after typing the book name to confirm.
- [ ] Deletion soft-archives all contacts in the book and removes all permission rows.
- [ ] An ADMIN can set any member's permission on any book to EDIT, VIEW, or NONE.
- [ ] A member with NONE permission on a book does not see that book in the workspace.
- [ ] A member with VIEW permission sees the book and contacts but no create/edit/delete actions.
- [ ] `resolveEffectivePermission` returns EDIT for OWNER regardless of permission rows.
- [ ] `getTeamWorkspaceBooks` returns only visible books sorted with default book first.
- [ ] The "New Contact" modal book selector defaults to the most recently used book for that user.
- [ ] All book lifecycle actions emit the correct ActivityEvent rows with teamId populated.
- [ ] Duplicate book name (case-insensitive) within active books is rejected at both DB and application layers.

## Risks and Open Questions

- **TeamSyncAccount on book deletion**: When a book is deleted, what happens to `TeamSyncAccount` rows pointing to it? Cascade delete via FK `onDelete: Cascade` is the simplest approach and is safe — the sync account itself (SyncAccount record) is not deleted, only the link. Confirm this with P14-06 implementer before finalising.
- **Unarchiving a book with stale permissions**: If an admin changes permissions while a book is archived, and then unarchives it, the permission matrix may differ from what members expect. This is acceptable behavior but should be documented in the UI as a warning when unarchiving: "Unarchiving restores this book with its current member permissions."
- **isDefault semantics for Teams**: Currently `isDefault` is a per-group boolean. For Teams with multiple books, there can only be one `isDefault=true` book at a time. If the default book is archived, should another book become the default automatically? Define: `isDefault` for Teams is just a UI hint for the workspace sort order. It does not affect routing or defaults outside the book selector's `localStorage` cache.
- **Permission matrix UI scalability**: A team with 25 members and 10 books = 250 permission cells. The matrix table in P14-08 needs careful pagination or virtualization. The backend query for the full matrix must be optimized: a single JOIN query, not N+1 per member.
- **Book count cap**: The 20-book limit is arbitrary. It should be configurable via an environment variable or a plan feature flag, not hard-coded.

## Outcome
Team admins can create and manage multiple shared address books with granular per-member, per-book permissions, providing the organizational structure that differentiates the Teams plan from Family sharing.
