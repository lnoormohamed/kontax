import type { Prisma } from "../../generated/prisma";
import { db } from "~/server/db";

// Shared authorization helpers for family (Phase 13) shared address books.
//
// Ownership model (P13-01): a shared contact is a Contact (nominally owned by
// the group owner's userId) linked into a GroupAddressBook via GroupContact.
// Mutation access is NOT userId equality — it is "you own it, OR it lives in a
// family book you're an accepted member of with canEdit".

export type FamilyMembership = {
  groupId: string;
  bookId: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER";
  canEdit: boolean;
  isOwner: boolean;
  groupName: string;
};

// The user's accepted FAMILY membership (owner or member), if any. v1: one per user.
export const getUserFamilyMembership = async (
  userId: string,
): Promise<FamilyMembership | null> => {
  const member = await db.groupMember.findFirst({
    where: { userId, inviteStatus: "ACCEPTED", group: { type: "FAMILY" } },
    include: { group: true },
  });
  if (!member) return null;
  return {
    groupId: member.groupId,
    bookId: member.group.defaultAddressBookId,
    role: member.role,
    canEdit: member.canEdit,
    isOwner: member.role === "OWNER",
    groupName: member.group.name,
  };
};

// Prisma `where` fragment: a contact the user may MUTATE — owns it, or it is in
// a family book they can edit. Drop-in replacement for `{ id, userId }` lookups.
export const editableContactWhere = (
  userId: string,
  contactId: string,
): Prisma.ContactWhereInput => ({
  id: contactId,
  OR: [
    { userId },
    {
      groupContacts: {
        some: {
          groupAddressBook: {
            group: {
              members: { some: { userId, inviteStatus: "ACCEPTED", canEdit: true } },
            },
          },
        },
      },
    },
  ],
});

// Prisma `where` fragment: a contact the user may READ — owns it, or it is in a
// family book they belong to (even view-only).
export const readableContactWhere = (
  userId: string,
  contactId: string,
): Prisma.ContactWhereInput => ({
  id: contactId,
  OR: [
    { userId },
    {
      groupContacts: {
        some: {
          groupAddressBook: {
            group: { members: { some: { userId, inviteStatus: "ACCEPTED" } } },
          },
        },
      },
    },
  ],
});

// Activity attribution for a shared-contact change (P13-04). When the contact
// lives in a family book, the event is attributed to the acting member so every
// member's history reads "[Member] via Family Book". Returns null for private
// contacts (caller falls back to actor USER).
export const getSharedEditAttribution = async (
  userId: string,
  contactId: string,
): Promise<{ actor: "FAMILY_MEMBER"; actorDetail: string } | null> => {
  const shared = await db.groupContact.findFirst({
    where: { contactId },
    select: { id: true },
  });
  if (!shared) return null;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const name = user?.name?.trim() ?? user?.email ?? "A family member";
  return { actor: "FAMILY_MEMBER", actorDetail: `${name} via Family Book` };
};

// Is this contact a shared (family-book) contact? Returns its book/group context.
export const getContactFamilyContext = async (contactId: string) => {
  const gc = await db.groupContact.findFirst({
    where: { contactId },
    include: { groupAddressBook: { include: { group: true } } },
  });
  if (!gc) return null;
  return {
    groupContactId: gc.id,
    bookId: gc.groupAddressBookId,
    groupId: gc.groupAddressBook.groupId,
    groupName: gc.groupAddressBook.group.name,
  };
};
