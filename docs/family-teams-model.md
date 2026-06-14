# Family & Teams model

**Cross-cutting subsystem.** How multi-user shared address books work — the Group, GroupMember, GroupAddressBook, and GroupContact models.

---

## Core abstractions

```
Group
  ├── type: FAMILY | TEAM
  ├── ownerId (User)
  ├── maxMembers (default 6 for Family)
  ├── members: GroupMember[]
  └── addressBooks: GroupAddressBook[]
                      └── contacts: GroupContact[]
```

A `Group` is the top-level container. It has **members** and **shared address books**. Contacts in a shared book are stored as `GroupContact` rows — distinct from the owner's personal `Contact` rows.

---

## GroupMember

Each `GroupMember` row represents one person's membership:

```
GroupMember {
  groupId
  userId             — null until the invited email registers
  invitedEmail
  role               — OWNER | ADMIN | MEMBER
  inviteStatus       — PENDING | ACCEPTED | DECLINED | REVOKED
  canEdit            — edit permission for Family (coarse-grained)
  addressBookPermissions — JSON: { [bookId]: "EDIT" | "VIEW" | "NONE" } (Teams only)
  inviteToken        — 48-hour token for the invitation email link
}
```

### Roles

| Role | Family | Teams |
|------|--------|-------|
| `OWNER` | Full control — manage members, billing, shared book | Full control |
| `ADMIN` | Can invite/remove members, manage books (Teams only) | Can invite/remove, create books |
| `MEMBER` | Read or edit based on `canEdit` (Family) or per-book permission (Teams) | Per-book permission |

In Family, permissions are coarse: `canEdit=true` means full write access to the shared book; `canEdit=false` means read-only. There are no per-book permissions for Family.

In Teams, `addressBookPermissions` is a JSON map of `{ [GroupAddressBook.id]: "EDIT" | "VIEW" | "NONE" }`. This allows a member to have different access levels across multiple shared books within the same team.

---

## GroupAddressBook

Each `GroupAddressBook` is a named address book within a group:

```
GroupAddressBook {
  groupId
  name
  isDefault     — true for the primary book (always exists)
  archivedAt    — archived books are read-only and hidden from default views
  dissolvedToBookId — if the group dissolved, personal book ID where contacts moved
}
```

**Family** has exactly one address book (`isDefault=true`). **Teams** may have multiple books, each with its own per-member permission map.

---

## GroupContact

Contacts in a shared book are represented as `GroupContact` rows:

```
GroupContact {
  groupId
  groupAddressBookId
  contactId       — FK to Contact (the actual contact data lives here)
  addedByUserId
}
```

The contact data itself lives in the `Contact` table, associated with a user. `GroupContact` is a join table that says "this contact is also visible in this group's address book." Mutations to the contact are gated by `GroupMember` permissions, not by `Contact.userId`.

"Add to family book" creates a new `Contact` + `GroupContact` pair — it is a copy, not a move from the owner's personal address book.

---

## Invite flow

1. Owner/admin sends an invite to an email address.
2. A `GroupMember` row is created with `inviteStatus=PENDING`, `inviteToken` set (48-hour expiry), `userId=null`.
3. An email is sent with a link containing the token.
4. If the invitee has a Kontax account: clicking the link links `userId` and sets `inviteStatus=ACCEPTED`.
5. If the invitee has no account: they register and the pending invite is linked on account creation.

---

## Change propagation

When a contact in a group book is edited:
- All members with `canEdit=true` (Family) or `EDIT` permission for that book (Teams) can write.
- Changes write through to the `Contact` row and are visible to all members immediately on next load.
- The activity log records the change with the editor's identity.

There is no eventual-consistency model — changes are synchronous writes to the shared `Contact` row.

---

## Group dissolution

When a group owner cancels their Family/Teams subscription (or deletes their account), the group dissolves:
- Each member's share of the shared book is split off into their personal address book (personal `Contact` rows are created from `GroupContact` rows).
- `GroupAddressBook.dissolvedToBookId` is set to the personal book that received the contacts.
- The `Group` row is deleted (cascades to `GroupMember`, `GroupAddressBook`, `GroupContact`).

> The dissolution logic is owned by Phase 13 (Family) and Phase 14 (Teams). The `stripe-handlers.ts` downgrade path currently logs a TODO for this step.

---

## Teams audit log

All changes to contacts in a Teams group are recorded in `AdminAuditEvent` with the member's identity. The full audit log is available to owners and admins from the Teams management panel.

---

## References

- Schema: `prisma/schema.prisma` — `Group`, `GroupMember`, `GroupAddressBook`, `GroupContact`, `GroupRole`, `GroupType`
- Billing relationship: [billing-lifecycle.md](billing-lifecycle.md)
