"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import {
  addMembership,
  removeMembership,
  setPrimaryMembership,
} from "~/server/contact-book-membership";
import { db } from "~/server/db";

/**
 * P40-08 — server actions behind the contact-detail "Books" block. Each action
 * authorises the contact + book against the signed-in user, wraps the tested
 * P40-06 membership helpers, and keeps `Contact.bookId` (the primary/home book)
 * in sync during the soak.
 */

const requireUserId = async () => {
  const session = await auth();
  if (!session?.user?.id) throw new Error("You need to be signed in.");
  if (session.impersonatedBy) {
    throw new Error("This is a read-only impersonation session — changes are blocked.");
  }
  return session.user.id;
};

/** Assert the contact and the target book both belong to the user. */
const assertOwned = async (userId: string, contactId: string, bookId: string) => {
  const [contact, book] = await Promise.all([
    db.contact.findFirst({ where: { id: contactId, userId }, select: { id: true } }),
    db.addressBook.findFirst({
      where: { id: bookId, userId, archivedAt: null },
      select: { id: true },
    }),
  ]);
  if (!contact) throw new Error("That contact is unavailable.");
  if (!book) throw new Error("That book is unavailable.");
};

/** Add the contact to another personal book (multi-membership; no copy/move). */
export async function addContactToBook(input: {
  contactId: string;
  bookId: string;
}): Promise<void> {
  const userId = await requireUserId();
  await assertOwned(userId, input.contactId, input.bookId);
  await addMembership(db, input.contactId, input.bookId);
  revalidatePath(`/contacts/${input.contactId}`);
  revalidatePath("/contacts");
}

/**
 * Remove the contact from a book. Blocks removal of the last remaining book
 * (P40-DB01 #1). If the removed book was primary, `Contact.bookId` follows the
 * newly-promoted primary so the home book stays consistent.
 */
export async function removeContactFromBook(input: {
  contactId: string;
  bookId: string;
}): Promise<void> {
  const userId = await requireUserId();
  await assertOwned(userId, input.contactId, input.bookId);
  await db.$transaction(async (tx) => {
    const { newPrimaryBookId } = await removeMembership(tx, input.contactId, input.bookId);
    if (newPrimaryBookId) {
      await tx.contact.update({
        where: { id: input.contactId },
        data: { bookId: newPrimaryBookId },
      });
    }
  });
  revalidatePath(`/contacts/${input.contactId}`);
  revalidatePath("/contacts");
}

/** Make a book the contact's primary/home book (moves the primary membership). */
export async function setContactPrimaryBook(input: {
  contactId: string;
  bookId: string;
}): Promise<void> {
  const userId = await requireUserId();
  await assertOwned(userId, input.contactId, input.bookId);
  await db.$transaction(async (tx) => {
    // Promote an existing membership to primary (keeps all memberships intact).
    await setPrimaryMembership(tx, input.contactId, input.bookId);
    await tx.contact.update({
      where: { id: input.contactId },
      data: { bookId: input.bookId },
    });
  });
  revalidatePath(`/contacts/${input.contactId}`);
  revalidatePath("/contacts");
}
