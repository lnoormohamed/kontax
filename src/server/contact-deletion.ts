// P49A-12 (A-16): "Delete permanently" without resurrecting the contact.
//
// A hard delete used to cascade the contact's SyncContactLinks away, so the
// CardDAV client re-imported the remote card as a new contact, Google / Outlook
// never received a delete, and a device on Kontax's CardDAV server could keep a
// ghost (the book CTag is the newest `updatedAt`, which a delete need not move).
//
// Now a permanent delete is:
//   1. immediate — only when nothing can still see the contact: it was already
//      in the trash (archived, so devices have seen it disappear) and every
//      sync link is tombstoned (each provider has already deleted it);
//   2. otherwise deferred — the row is archived + sync-tombstoned (the providers'
//      push deletes it remotely, the CTag moves, device REPORTs omit it) and
//      stamped `deletedAt`, which hides it everywhere, the trash included;
//   3. purged later by `purgeDeletedContacts` (the sync cron), once every link
//      has pushed its remote delete (or belongs to a retired connection) and a
//      grace period has passed so offline devices see the CTag move first.
// A link that can never push a delete (an import-only connection) keeps the
// hidden row until the provider deletes the contact too — purging it would
// make the next import re-create it.
import type { Actor, Prisma, SourceType } from "../../generated/prisma";

import { isKontaxHosted } from "~/lib/avatar-src";
import { deleteContactPhoto } from "~/server/contact-photo-sync";
import { db } from "~/server/db";

/** How long a deferred delete stays hidden before it may be purged. */
export const DELETED_CONTACT_PURGE_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

// A link that still has to push its remote delete. Retired connections never
// sync again, so they do not hold a purge back.
const liveLinkWhere: Prisma.SyncContactLinkWhereInput = {
  tombstonedAt: null,
  syncAccount: { status: { not: "RETIRED" } },
};

const displayName = (c: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) => {
  const full = c.fullName?.trim();
  if (full) return full;
  const composed = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
  return composed.length > 0 ? composed : "Unnamed contact";
};

export type PermanentDeleteResult = {
  /** Display names of every contact deleted (immediately or deferred). */
  names: string[];
  /** Deleted outright. */
  purgedIds: string[];
  /** Hidden now, purged once the providers have deleted them. */
  deferredIds: string[];
  /** Photos of the purged rows — pass to `cleanupDeletedContactPhotos` after commit. */
  avatarUrls: (string | null)[];
};

/**
 * Permanently delete the given contacts of `userId` (run inside the caller's
 * transaction). Emits CONTACT_DELETED for each. Contacts that are not the
 * user's, or already deleted, are ignored.
 */
export const deleteContactsPermanently = async (
  tx: Prisma.TransactionClient,
  {
    userId,
    contactIds,
    actor,
    source,
    now = new Date(),
  }: {
    userId: string;
    contactIds: readonly string[];
    actor: Actor;
    source: SourceType;
    now?: Date;
  },
): Promise<PermanentDeleteResult> => {
  const rows = await tx.contact.findMany({
    where: { id: { in: [...contactIds] }, userId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      avatarUrl: true,
      archivedAt: true,
      syncLinks: { where: liveLinkWhere, select: { id: true } },
    },
  });
  if (rows.length === 0) return { names: [], purgedIds: [], deferredIds: [], avatarUrls: [] };

  const immediate = rows.filter((row) => row.archivedAt != null && row.syncLinks.length === 0);
  const immediateIds = new Set(immediate.map((row) => row.id));
  const deferred = rows.filter((row) => !immediateIds.has(row.id));

  if (immediate.length > 0) {
    await tx.contact.deleteMany({ where: { id: { in: [...immediateIds] }, userId } });
  }

  if (deferred.length > 0) {
    const activeIds = deferred.filter((row) => row.archivedAt == null).map((row) => row.id);
    if (activeIds.length > 0) {
      await tx.contact.updateMany({ where: { id: { in: activeIds } }, data: { archivedAt: now } });
    }
    // Bumps updatedAt (the CardDAV client reads the link as locally changed →
    // remote DELETE; the book CTag moves) and syncVersion (the device ETag).
    await tx.contact.updateMany({
      where: { id: { in: deferred.map((row) => row.id) } },
      data: {
        deletedAt: now,
        syncTombstoneAt: now,
        lastMutatedBy: source,
        lastMutatedByDetail: null,
        syncVersion: { increment: 1 },
      },
    });
  }

  await tx.activityEvent.createMany({
    data: rows.map((row) => ({
      userId,
      contactId: null,
      eventType: "CONTACT_DELETED" as const,
      actor,
      payload: {
        fullName: displayName(row),
        ...(row.email ? { email: row.email } : {}),
        ...(row.phone ? { phone: row.phone } : {}),
      },
    })),
  });

  return {
    names: rows.map(displayName),
    purgedIds: immediate.map((row) => row.id),
    deferredIds: deferred.map((row) => row.id),
    avatarUrls: immediate.map((row) => row.avatarUrl),
  };
};

// P46-03: best-effort removal of the Kontax-hosted photo objects behind deleted
// contacts. Guards against aliasing — a live-share recipient copy or another
// contact can reference the same avatarUrl — by only deleting objects no
// surviving Contact row still points at. External (pasted, not-yet-internalized)
// URLs are never delete-attempted. Runs after the delete has committed.
export const cleanupDeletedContactPhotos = async (avatarUrls: (string | null | undefined)[]) => {
  const hosted = [...new Set(avatarUrls.filter((u): u is string => Boolean(u) && isKontaxHosted(u)))];
  for (const url of hosted) {
    const stillReferenced = await db.contact.count({ where: { avatarUrl: url } });
    if (stillReferenced === 0) void deleteContactPhoto(url);
  }
};

/**
 * Purge deferred deletes whose remote copies are gone. Called by the sync cron
 * after the queued sync jobs ran. Returns how many rows were deleted.
 */
export const purgeDeletedContacts = async ({
  now = new Date(),
  limit = 500,
}: { now?: Date; limit?: number } = {}): Promise<{ purged: number }> => {
  const cutoff = new Date(now.getTime() - DELETED_CONTACT_PURGE_GRACE_DAYS * DAY_MS);
  const where: Prisma.ContactWhereInput = {
    deletedAt: { not: null, lte: cutoff },
    syncLinks: { none: liveLinkWhere },
  };
  const rows = await db.contact.findMany({
    where,
    select: { id: true, avatarUrl: true },
    orderBy: { deletedAt: "asc" },
    take: limit,
  });
  if (rows.length === 0) return { purged: 0 };
  // The filter is repeated so a link created since the read holds the row back.
  const result = await db.contact.deleteMany({
    where: { ...where, id: { in: rows.map((row) => row.id) } },
  });
  await cleanupDeletedContactPhotos(rows.map((row) => row.avatarUrl));
  return { purged: result.count };
};
