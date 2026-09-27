// P49A-12 (A-17): how a local change reaches the sync providers.
//
// Every non-sync writer — the web app, the REST API, CSV / archive imports,
// Kontax's own CardDAV server (iPhone edits), merge / undo, restore — marks the
// changed contact's live sync links "dirty since last sync"
// (`SyncContactLink.localDirtyAt`). The Google / Outlook push picks up a link
// when it is dirty, or — the pre-P49A-12 rule, kept as a fallback for any
// writer that only stamps `lastMutatedBy` — when the contact's last write came
// from a non-sync source after the link last synced. A write made BY a sync
// (`lastMutatedBy` SYNC_*) never marks links, which is what keeps the
// push → provider normalises → re-import → push loop closed.
//
// The CardDAV client (sync-runner.ts) compares every link's supported-field
// shadow on each run and does not need the marker.
//
// Plain ESM with JSDoc types, like contact-multi-values.mjs, so the CardDAV
// server (`server.mjs`, not bundled by Next) shares it; the TS wrapper is
// src/server/sync-dirty.ts.

/** Writes made by a sync connector itself. They never mark links dirty. */
export const SYNC_SOURCE_TYPES = /** @type {const} */ ([
  "SYNC_CARDDAV",
  "SYNC_GOOGLE",
  "SYNC_MICROSOFT",
]);

/**
 * Every other writer: a change the providers have not seen yet. Contacts last
 * written by one of these are also eligible to be created on a provider.
 */
export const LOCAL_MUTATION_SOURCE_TYPES = /** @type {const} */ ([
  "MANUAL",
  "API",
  "IMPORT_CSV",
  "CARD_IMPORT",
  "SHARED_STATIC",
  "SHARED_LIVE",
]);

/**
 * `lastMutatedBy` for an edit a device made through Kontax's CardDAV server —
 * the user's own edit (it reads "Last updated by you"), so it is a local
 * mutation the providers must receive.
 */
export const DAV_DEVICE_MUTATION = /** @type {const} */ ({
  lastMutatedBy: "MANUAL",
  lastMutatedByDetail: "CardDAV device",
});

/** @param {unknown} source */
export const isLocalMutationSource = (source) =>
  typeof source === "string" &&
  /** @type {readonly string[]} */ (LOCAL_MUTATION_SOURCE_TYPES).includes(source);

/**
 * @typedef {object} SyncLinkDirtyClient
 * @property {{
 *   updateMany(args: { where: object, data: object }): PromiseLike<{ count: number }>,
 *   deleteMany(args: { where: object }): PromiseLike<{ count: number }>,
 * }} syncContactLink
 */

/**
 * Mark every live sync link of the given contacts dirty. Call it next to (in
 * the same transaction as) the contact write. Tombstoned links are skipped —
 * their remote copy is gone.
 *
 * @param {SyncLinkDirtyClient} client  Prisma client or transaction client
 * @param {string | readonly string[]} contactIds
 * @param {Date} [now]
 * @returns {Promise<number>} links marked
 */
export const markSyncLinksDirty = async (client, contactIds, now = new Date()) => {
  const ids = (typeof contactIds === "string" ? [contactIds] : [...contactIds]).filter(
    (id) => typeof id === "string" && id.length > 0,
  );
  if (ids.length === 0) return 0;
  const result = await client.syncContactLink.updateMany({
    where: { contactId: { in: ids }, tombstonedAt: null },
    data: { localDirtyAt: now },
  });
  return result.count;
};

/**
 * P49A-12 (A-20): a contact coming back (restore from the trash, merge undo, a
 * device re-saving a deleted card) must reach every provider again. A
 * tombstoned link's remote copy is gone, so the link is removed — the contact
 * is then unlinked for that account and the next push creates it there afresh
 * (it would otherwise be skipped by both the update and the create query, or
 * read as a remote delete). Live links are marked dirty so the restored state
 * is pushed.
 *
 * @param {SyncLinkDirtyClient} client  Prisma client or transaction client
 * @param {string | readonly string[]} contactIds
 * @param {Date} [now]
 * @returns {Promise<{ removed: number, marked: number }>}
 */
export const reviveSyncLinks = async (client, contactIds, now = new Date()) => {
  const ids = (typeof contactIds === "string" ? [contactIds] : [...contactIds]).filter(
    (id) => typeof id === "string" && id.length > 0,
  );
  if (ids.length === 0) return { removed: 0, marked: 0 };
  const removed = await client.syncContactLink.deleteMany({
    where: { contactId: { in: ids }, tombstonedAt: { not: null } },
  });
  const marked = await markSyncLinksDirty(client, ids, now);
  return { removed: removed.count, marked };
};

/**
 * After a device PUT through Kontax's CardDAV server updated an existing
 * contact (in the same transaction): flag the change for the sync providers
 * the contact is linked to, so the next Google / Outlook / CardDAV sync pushes
 * it instead of anchoring it away. A PUT that brings back an archived or
 * deleted card also revives its tombstoned links (the provider copy was
 * deleted, so it is re-created there). Pair with `DAV_DEVICE_MUTATION` in the
 * update data.
 *
 * @param {SyncLinkDirtyClient} tx
 * @param {{ id: string, archivedAt?: unknown, syncTombstoneAt?: unknown, deletedAt?: unknown }} existing
 *   the contact as it was before the PUT
 */
export const flagDeviceWriteForSync = (tx, existing) =>
  existing.archivedAt || existing.syncTombstoneAt || existing.deletedAt
    ? reviveSyncLinks(tx, existing.id)
    : markSyncLinksDirty(tx, existing.id);
