"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import { movePrimaryMembership } from "~/server/contact-book-membership";
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

const readString = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

export async function createAddressBook(
  input: { name: string } | FormData,
): Promise<{ id: string }> {
  const userId = await requireUserId();
  const name = cleanName(input instanceof FormData ? readString(input, "name") : input.name);
  const slug = await uniqueSlug(userId, slugify(name));

  const created = await db.addressBook.create({
    data: { userId, name, slug, isDefault: false },
    select: { id: true },
  });
  revalidatePath("/contacts");
  revalidatePath("/contacts/new");
  revalidatePath("/settings/data/books");
  return created;
}

export async function createAddressBookFromForm(formData: FormData): Promise<void> {
  await createAddressBook(formData);
}

export async function renameAddressBook(
  input: { id: string; name: string } | FormData,
): Promise<void> {
  const userId = await requireUserId();
  const id = input instanceof FormData ? readString(input, "id") : input.id;
  const name = input instanceof FormData ? readString(input, "name") : input.name;
  const book = await db.addressBook.findFirst({ where: { id, userId } });
  if (!book) throw new Error("That book no longer exists.");
  if (book.isDefault) throw new Error("The default book can't be renamed.");

  // Name only — slug is intentionally preserved (CardDAV stability).
  await db.addressBook.update({
    where: { id: book.id },
    data: { name: cleanName(name) },
  });
  revalidatePath("/contacts");
  revalidatePath("/contacts/new");
  revalidatePath("/settings/data/books");
}

export async function archiveAddressBook(id: string): Promise<void> {
  const userId = await requireUserId();
  const book = await db.addressBook.findFirst({ where: { id, userId } });
  if (!book) throw new Error("That book no longer exists.");
  if (book.isDefault) throw new Error("The default book can't be archived.");

  if (book.archivedAt) {
    await db.$transaction([
      db.addressBook.update({ where: { id: book.id }, data: { archivedAt: null } }),
      db.contact.updateMany({
        where: { userId, bookId: book.id },
        data: { archivedAt: null },
      }),
    ]);
  } else {
    const now = new Date();
    await db.$transaction([
      db.addressBook.update({ where: { id: book.id }, data: { archivedAt: now } }),
      // Archive the book's contacts alongside it (only those not already archived).
      db.contact.updateMany({
        where: { userId, bookId: book.id, archivedAt: null },
        data: { archivedAt: now },
      }),
    ]);
  }
  revalidatePath("/contacts");
  revalidatePath("/contacts/new");
  revalidatePath("/settings/data/books");
}

export async function setDefaultAddressBook(targetBookId: string): Promise<void> {
  const userId = await requireUserId();
  const target = await db.addressBook.findFirst({
    where: { id: targetBookId, userId, archivedAt: null },
    select: { id: true, isDefault: true },
  });
  if (!target) throw new Error("That book is unavailable.");
  if (target.isDefault) return;

  const currentDefault = await db.addressBook.findFirst({
    where: { userId, isDefault: true },
    select: { id: true },
  });
  if (!currentDefault) throw new Error("Default book not found.");

  await db.$transaction(async (tx) => {
    // Null bookId rows historically belonged to the current default book. Pin
    // them there before switching so changing the default does not silently move
    // legacy contacts to the new book.
    await tx.contact.updateMany({
      where: { userId, bookId: null, groupContacts: { none: {} } },
      data: { bookId: currentDefault.id },
    });
    await tx.addressBook.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
    await tx.addressBook.update({
      where: { id: target.id },
      data: { isDefault: true },
    });
  });

  revalidatePath("/contacts");
  revalidatePath("/contacts/new");
  revalidatePath("/settings/data/books");
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

  await db.$transaction(async (tx) => {
    // Restrict to the caller's own contacts before we touch memberships.
    const owned = await tx.contact.findMany({
      where: { id: { in: input.contactIds }, userId },
      select: { id: true },
    });
    await tx.contact.updateMany({
      where: { id: { in: owned.map((c) => c.id) }, userId },
      data: {
        bookId: target.id,
        lastMutatedBy: "MANUAL",
        lastMutatedByDetail: null,
        syncVersion: { increment: 1 },
      },
    });
    // P40-06: dual-write — move each contact's primary membership to the target
    // book (drops the previous home membership, keeps any extra memberships).
    for (const { id } of owned) {
      await movePrimaryMembership(tx, id, target.id);
    }
  });
  revalidatePath("/contacts");
  revalidatePath("/settings/data/books");
}
