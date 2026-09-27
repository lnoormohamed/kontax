// P49A-12 (A-17): typed wrapper around src/server/dav/sync-propagation.mjs —
// the per-link "dirty since last sync" marker every non-sync writer sets, and
// the rules the Google / Outlook push uses to pick links up and settle them.
import type { Prisma, SourceType } from "../../generated/prisma";

import {
  DAV_DEVICE_MUTATION,
  isLocalMutationSource,
  LOCAL_MUTATION_SOURCE_TYPES as LOCAL_SOURCES,
  markSyncLinksDirty as markDirty,
  reviveSyncLinks as reviveLinks,
  SYNC_SOURCE_TYPES as SYNC_SOURCES,
} from "~/server/dav/sync-propagation.mjs";

export { DAV_DEVICE_MUTATION, isLocalMutationSource };

export const SYNC_SOURCE_TYPES: SourceType[] = [...SYNC_SOURCES];
export const LOCAL_MUTATION_SOURCE_TYPES: SourceType[] = [...LOCAL_SOURCES];

type LinkClient = Pick<Prisma.TransactionClient, "syncContactLink">;

/**
 * Mark every live sync link of the given contacts dirty. Call it in the same
 * transaction as the contact write that changed them.
 */
export const markSyncLinksDirty = (
  client: LinkClient,
  contactIds: string | readonly string[],
  now: Date = new Date(),
): Promise<number> => markDirty(client, contactIds, now);

// Did the local contact change since we last synced this link? (Mirrors
// sync-import-engine's isLocalChanged; kept here so this module has no import
// cycle with the engine.)
const changedSince = (lastSyncedAt: Date | null, updatedAt: Date | undefined) =>
  lastSyncedAt == null || (updatedAt?.getTime() ?? 0) > lastSyncedAt.getTime();

/**
 * Whether a linked contact has a local change this link has not pushed: the
 * link is marked dirty, or (the pre-P49A-12 rule, for any writer that only
 * stamps `lastMutatedBy`) the contact's last write came from a non-sync source
 * after the link last synced.
 */
export const linkHasPendingLocalChange = (
  link: { localDirtyAt?: Date | null; lastSyncedAt: Date | null },
  contact: { lastMutatedBy?: string | null; updatedAt?: Date },
): boolean =>
  link.localDirtyAt != null ||
  (isLocalMutationSource(contact.lastMutatedBy) &&
    changedSince(link.lastSyncedAt, contact.updatedAt));

/**
 * The `where` fragment selecting links that may have a pending local change
 * (refined per link with `linkHasPendingLocalChange`).
 */
export const pendingLocalChangeWhere = (): Prisma.SyncContactLinkWhereInput => ({
  OR: [
    { localDirtyAt: { not: null } },
    { contact: { lastMutatedBy: { in: LOCAL_MUTATION_SOURCE_TYPES } } },
  ],
});

/**
 * Settle the marker after the push that carried the change. Only a marker set
 * at or before `selectedAt` (when the push read the contact) is cleared, so an
 * edit that lands while the push is in flight stays dirty for the next run.
 */
export const clearSyncLinkDirty = async (
  client: LinkClient,
  linkId: string,
  selectedAt: Date,
): Promise<void> => {
  await client.syncContactLink.updateMany({
    where: { id: linkId, localDirtyAt: { lte: selectedAt } },
    data: { localDirtyAt: null },
  });
};

/**
 * P49A-12 (A-20): a contact coming back (restore from the trash, merge undo)
 * reaches every provider again — tombstoned links are removed so the next push
 * re-creates it there, live links are marked dirty. See `reviveSyncLinks`.
 */
export const reviveContactSyncLinks = (
  client: LinkClient,
  contactIds: string | readonly string[],
  now: Date = new Date(),
): Promise<{ removed: number; marked: number }> => reviveLinks(client, contactIds, now);
