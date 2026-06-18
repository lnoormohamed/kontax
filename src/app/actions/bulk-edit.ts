"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { mergeContactsForUser } from "~/server/contact-merge";

// P28-04: bulk field edits applied to a selection of contacts. Archive / delete
// / restore stay in ~/app/actions/contacts (they emit activity + security
// signals and redirect); these add the "set company" and "add label" actions
// the bulk-edit toolbar needs. Every write bumps syncVersion so the sync engine
// re-pushes the change, matching single-contact edits.

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

const SYNC_TOUCH = {
  lastMutatedBy: "MANUAL" as const,
  lastMutatedByDetail: null,
  syncVersion: { increment: 1 },
};

export async function setCompanyBulk(input: {
  contactIds: string[];
  company: string;
}): Promise<void> {
  const userId = await requireUserId();
  const ids = input.contactIds.filter(Boolean);
  if (ids.length === 0) return;
  const company = input.company.trim().slice(0, 200);

  await db.contact.updateMany({
    where: { id: { in: ids }, userId },
    data: { company: company || null, ...SYNC_TOUCH },
  });
  revalidatePath("/contacts");
}

export async function addLabelBulk(input: {
  contactIds: string[];
  label: string;
}): Promise<void> {
  const userId = await requireUserId();
  const ids = input.contactIds.filter(Boolean);
  const label = input.label.trim().slice(0, 60);
  if (ids.length === 0 || !label) return;

  // labels is a JSON string[]; read-modify-write each contact so we only add the
  // label where it's missing (no duplicates, existing labels preserved).
  const contacts = await db.contact.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true, labels: true },
  });

  await db.$transaction(
    contacts
      .map((c) => {
        const existing = Array.isArray(c.labels)
          ? (c.labels as unknown[]).filter((v): v is string => typeof v === "string")
          : [];
        if (existing.some((l) => l.toLowerCase() === label.toLowerCase())) return null;
        return db.contact.update({
          where: { id: c.id },
          data: { labels: [...existing, label], ...SYNC_TOUCH },
        });
      })
      .filter((op): op is NonNullable<typeof op> => op !== null),
  );
  revalidatePath("/contacts");
}

export async function removeLabelBulk(input: {
  contactIds: string[];
  label: string;
}): Promise<void> {
  const userId = await requireUserId();
  const ids = input.contactIds.filter(Boolean);
  const label = input.label.trim();
  if (ids.length === 0 || !label) return;

  const contacts = await db.contact.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true, labels: true },
  });

  await db.$transaction(
    contacts
      .map((c) => {
        const existing = Array.isArray(c.labels)
          ? (c.labels as unknown[]).filter((v): v is string => typeof v === "string")
          : [];
        const next = existing.filter((l) => l.toLowerCase() !== label.toLowerCase());
        if (next.length === existing.length) return null; // label not present
        return db.contact.update({
          where: { id: c.id },
          data: { labels: next, ...SYNC_TOUCH },
        });
      })
      .filter((op): op is NonNullable<typeof op> => op !== null),
  );
  revalidatePath("/contacts");
}

// P36-DB04: merge a selection of contacts into one primary. Secondaries are
// merged into the primary one at a time via the shared merge engine (default
// field resolution — primary wins, gaps filled from each secondary).
export async function mergeContactsBulk(input: {
  primaryContactId: string;
  secondaryContactIds: string[];
}): Promise<{ merged: number }> {
  const userId = await requireUserId();
  const primaryContactId = input.primaryContactId;
  const secondaries = input.secondaryContactIds.filter((id) => id && id !== primaryContactId);
  if (!primaryContactId || secondaries.length === 0) return { merged: 0 };

  let merged = 0;
  for (const secondaryContactId of secondaries) {
    await mergeContactsForUser({
      userId,
      primaryContactId,
      secondaryContactId,
      source: "BULK_MERGE",
    });
    merged += 1;
  }
  revalidatePath("/contacts");
  return { merged };
}
