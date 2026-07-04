import type { Prisma } from "../../generated/prisma";
import { db } from "~/server/db";

/**
 * P40-06 — ContactBookMembership write helpers (dual-write + membership edits).
 *
 * During the soak, `Contact.bookId` stays the single "home" book and remains
 * authoritative; this module keeps `ContactBookMembership` in lock-step so the
 * read cutover can query membership instead. The membership whose
 * `addressBookId === Contact.bookId` is the `isPrimary` one; additional
 * memberships (multi-book) come only from the detail "Books" block via
 * {@link addMembership}.
 *
 * Invariants enforced here (Prisma can't express them):
 *   - a contact has ≥1 membership at all times (removal of the last is blocked);
 *   - exactly one membership per contact has `isPrimary = true`.
 *
 * Every function accepts a client/transaction so callers can enlist it in the
 * same transaction that writes `Contact.bookId`.
 */

type Client = Prisma.TransactionClient | typeof db;

/**
 * Make `addressBookId` the contact's primary ("home") book membership: upsert
 * the row, mark it primary, and demote every other membership. Does NOT remove
 * other memberships — use {@link movePrimaryMembership} for a book *move*.
 *
 * Used by contact create, import, API create/update, and family-snapshot copies
 * — the paths that also set `Contact.bookId`.
 */
export async function setPrimaryMembership(
  client: Client,
  contactId: string,
  addressBookId: string,
): Promise<void> {
  await client.contactBookMembership.upsert({
    where: { contactId_addressBookId: { contactId, addressBookId } },
    update: { isPrimary: true },
    create: { contactId, addressBookId, isPrimary: true },
  });
  await client.contactBookMembership.updateMany({
    where: { contactId, addressBookId: { not: addressBookId }, isPrimary: true },
    data: { isPrimary: false },
  });
}

/**
 * Move the contact's home to `addressBookId`: drop the previous primary
 * membership (single-book "move" semantics, matching the `bookId` overwrite),
 * then set the target as the new primary. Any additional non-primary
 * memberships are preserved.
 */
export async function movePrimaryMembership(
  client: Client,
  contactId: string,
  addressBookId: string,
): Promise<void> {
  const current = await client.contactBookMembership.findFirst({
    where: { contactId, isPrimary: true },
    select: { id: true, addressBookId: true },
  });
  if (current && current.addressBookId !== addressBookId) {
    await client.contactBookMembership.delete({ where: { id: current.id } });
  }
  await setPrimaryMembership(client, contactId, addressBookId);
}

/**
 * Add a non-primary membership (detail "Books" block → "Add to book"). No copy,
 * no move — the same contact row now also lives in `addressBookId`. Idempotent.
 */
export async function addMembership(
  client: Client,
  contactId: string,
  addressBookId: string,
): Promise<void> {
  await client.contactBookMembership.upsert({
    where: { contactId_addressBookId: { contactId, addressBookId } },
    update: {},
    create: { contactId, addressBookId, isPrimary: false },
  });
}

/** Thrown when a caller tries to remove a contact's only remaining book. */
export class LastBookMembershipError extends Error {
  constructor() {
    super("A contact must stay in at least one book.");
    this.name = "LastBookMembershipError";
  }
}

/**
 * Remove a membership (detail "Books" block → ✕). Blocks removal of the last
 * remaining book (decision P40-DB01 #1 — no orphan contacts). If the removed
 * membership was primary, promotes the oldest remaining membership to primary
 * and returns its `addressBookId` so the caller can keep `Contact.bookId` in
 * sync; returns `null` when the primary was untouched.
 */
export async function removeMembership(
  client: Client,
  contactId: string,
  addressBookId: string,
): Promise<{ newPrimaryBookId: string | null }> {
  const memberships = await client.contactBookMembership.findMany({
    where: { contactId },
    select: { id: true, addressBookId: true, isPrimary: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const target = memberships.find((m) => m.addressBookId === addressBookId);
  if (!target) return { newPrimaryBookId: null };
  if (memberships.length <= 1) throw new LastBookMembershipError();

  await client.contactBookMembership.delete({ where: { id: target.id } });

  if (!target.isPrimary) return { newPrimaryBookId: null };

  // Promote the oldest surviving membership to primary.
  const promoted = memberships.find((m) => m.id !== target.id)!;
  await client.contactBookMembership.update({
    where: { id: promoted.id },
    data: { isPrimary: true },
  });
  return { newPrimaryBookId: promoted.addressBookId };
}

/** The contact's memberships, primary first then oldest — for the detail block. */
export async function listMemberships(client: Client, contactId: string) {
  return client.contactBookMembership.findMany({
    where: { contactId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { id: true, addressBookId: true, isPrimary: true },
  });
}
