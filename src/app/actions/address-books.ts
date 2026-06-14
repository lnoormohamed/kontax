"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

// P28-03: personal address-book management. The default book is immutable
// (cannot be renamed or archived); slugs are stable after creation so CardDAV
// device subscriptions survive a rename.

const requireUserId = async () => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("You need to be signed in.");
  }
  if (session.impersonatedBy) {
    throw new Error("This is a read-only impersonation session — changes are blocked.");
  }
  return session.user.id;
};

const cleanName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A book needs a name.");
  return trimmed.slice(0, 80);
};

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "book";

/** Find a slug not already used by this user (CardDAV path must be unique). */
const uniqueSlug = async (userId: string, base: string) => {
  const taken = new Set(
    (await db.addressBook.findMany({ where: { userId }, select: { slug: true } })).map(
      (b) => b.slug,
    ),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
};

export async function createAddressBook(input: { name: string }): Promise<{ id: string }> {
  const userId = await requireUserId();
  const name = cleanName(input.name);
  const slug = await uniqueSlug(userId, slugify(name));

  const created = await db.addressBook.create({
    data: { userId, name, slug, isDefault: false },
    select: { id: true },
  });
  revalidatePath("/contacts");
  return created;
}

export async function renameAddressBook(input: { id: string; name: string }): Promise<void> {
  const userId = await requireUserId();
  const book = await db.addressBook.findFirst({ where: { id: input.id, userId } });
  if (!book) throw new Error("That book no longer exists.");
  if (book.isDefault) throw new Error("The default book can't be renamed.");

  // Name only — slug is intentionally preserved (CardDAV stability).
  await db.addressBook.update({
    where: { id: book.id },
    data: { name: cleanName(input.name) },
  });
  revalidatePath("/contacts");
}

export async function archiveAddressBook(id: string): Promise<void> {
  const userId = await requireUserId();
  const book = await db.addressBook.findFirst({ where: { id, userId } });
  if (!book) throw new Error("That book no longer exists.");
  if (book.isDefault) throw new Error("The default book can't be archived.");

  const now = new Date();
  await db.$transaction([
    db.addressBook.update({ where: { id: book.id }, data: { archivedAt: now } }),
    // Archive the book's contacts alongside it (only those not already archived).
    db.contact.updateMany({
      where: { userId, bookId: book.id, archivedAt: null },
      data: { archivedAt: now },
    }),
  ]);
  revalidatePath("/contacts");
}

export async function moveContactsToBook(input: {
  contactIds: string[];
  targetBookId: string;
}): Promise<void> {
  const userId = await requireUserId();
  if (input.contactIds.length === 0) return;

  // Verify the target book belongs to this user (and isn't archived).
  const target = await db.addressBook.findFirst({
    where: { id: input.targetBookId, userId, archivedAt: null },
  });
  if (!target) throw new Error("That book is unavailable.");

  await db.contact.updateMany({
    where: { id: { in: input.contactIds }, userId },
    data: {
      bookId: target.id,
      lastMutatedBy: "MANUAL",
      lastMutatedByDetail: null,
      syncVersion: { increment: 1 },
    },
  });
  revalidatePath("/contacts");
}
