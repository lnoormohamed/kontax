"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  fromJson,
  isEmpty,
  type ContactFilterState,
} from "~/lib/contact-filter-state";

// P28-01: smart-list (SavedFilter) mutations. Personal only; every write is
// scoped to the signed-in user and impersonation sessions are read-only.

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
  if (!trimmed) throw new Error("A list needs a name.");
  return trimmed.slice(0, 80);
};

export async function createSavedFilter(input: {
  name: string;
  filterState: ContactFilterState;
}): Promise<{ id: string }> {
  const userId = await requireUserId();
  const filterState = fromJson(input.filterState);
  if (isEmpty(filterState)) {
    throw new Error("Apply at least one filter before saving a list.");
  }

  const max = await db.savedFilter.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });

  const created = await db.savedFilter.create({
    data: {
      userId,
      name: cleanName(input.name),
      filterState,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });

  revalidatePath("/contacts");
  return created;
}

export async function renameSavedFilter(input: { id: string; name: string }): Promise<void> {
  const userId = await requireUserId();
  await db.savedFilter.updateMany({
    where: { id: input.id, userId },
    data: { name: cleanName(input.name) },
  });
  revalidatePath("/contacts");
}

export async function duplicateSavedFilter(id: string): Promise<void> {
  const userId = await requireUserId();
  const original = await db.savedFilter.findFirst({ where: { id, userId } });
  if (!original) throw new Error("That list no longer exists.");

  const max = await db.savedFilter.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });

  await db.savedFilter.create({
    data: {
      userId,
      name: cleanName(`${original.name} (copy)`),
      filterState: original.filterState ?? {},
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/contacts");
}

export async function deleteSavedFilter(id: string): Promise<void> {
  const userId = await requireUserId();
  await db.savedFilter.deleteMany({ where: { id, userId } });
  revalidatePath("/contacts");
}

export async function reorderSavedFilters(orderedIds: string[]): Promise<void> {
  const userId = await requireUserId();
  await db.$transaction(
    orderedIds.map((id, index) =>
      db.savedFilter.updateMany({
        where: { id, userId },
        data: { sortOrder: index },
      }),
    ),
  );
  revalidatePath("/contacts");
}
