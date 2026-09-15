// P48-09: verified-credential cache for the CardDAV server.
//
// iOS sends a burst of requests per sync cycle and every one of them used to run
// up to N bcrypt cost-12 compares (~250 ms each) plus a `lastUsedAt` UPDATE. We
// now cache the *result* of a successful verification for 10 minutes, keyed by
// sha256(email + ":" + token) so the plaintext never lands in Redis or memory.
//
// Revocation has to win over the cache, so every entry is also indexed by
// `appPasswordId` and by `userId`; `revokeUserAppPassword` deletes through those
// indexes. The Redis key layout is duplicated (with a pointer back here) in
// `src/server/app-passwords.ts` — KEEP THE TWO IN SYNC.

import crypto from "node:crypto";

export const DAV_CREDENTIAL_CACHE_TTL_MS = 10 * 60 * 1000;
export const DAV_CREDENTIAL_CACHE_TTL_SECONDS = DAV_CREDENTIAL_CACHE_TTL_MS / 1000;

// Bounded so a credential-stuffing run cannot grow the fallback map without end.
const MAX_MEMORY_ENTRIES = 5_000;

/**
 * @typedef {object} DavCredentialCacheEntry
 * @property {string} userId
 * @property {string} appPasswordId
 * @property {number} expiresAt  Epoch ms.
 */

/**
 * @param {string} email  Already normalised (trimmed, lower-cased).
 * @param {string} token  Already normalised (dashes/spaces stripped).
 */
export const davCredentialCacheKey = (email, token) =>
  crypto.createHash("sha256").update(`${email}:${token}`).digest("hex");

/** @param {string} hash */
export const davCredentialRedisKey = (hash) => `dav:cred:${hash}`;
/** @param {string} appPasswordId */
export const davCredentialAppPasswordIndexKey = (appPasswordId) => `dav:cred:ap:${appPasswordId}`;
/** @param {string} userId */
export const davCredentialUserIndexKey = (userId) => `dav:cred:user:${userId}`;

/**
 * @typedef {object} DavCredentialMemoryStore
 * @property {Map<string, DavCredentialCacheEntry>} byKey
 * @property {Map<string, Set<string>>} byAppPassword
 * @property {Map<string, Set<string>>} byUser
 */

// The memory fallback has to be reachable from two module graphs in the same
// process: `server.mjs` (loaded by node) writes entries, and the Next bundle
// (which loads `app-passwords.ts` for the revoke path) deletes them. A symbol on
// globalThis is the only handle they share.
const STORE_SYMBOL = Symbol.for("kontax.dav.credentialCache");

/** @returns {DavCredentialMemoryStore} */
export const getDavCredentialMemoryStore = () => {
  const globals = /** @type {Record<symbol, DavCredentialMemoryStore | undefined>} */ (
    /** @type {unknown} */ (globalThis)
  );
  const existing = globals[STORE_SYMBOL];
  if (existing) return existing;

  /** @type {DavCredentialMemoryStore} */
  const store = { byKey: new Map(), byAppPassword: new Map(), byUser: new Map() };
  globals[STORE_SYMBOL] = store;
  return store;
};

/**
 * @param {DavCredentialMemoryStore} store
 * @param {string} hash
 */
const unlink = (store, hash) => {
  const entry = store.byKey.get(hash);
  store.byKey.delete(hash);
  if (!entry) return;

  const byAppPassword = store.byAppPassword.get(entry.appPasswordId);
  if (byAppPassword) {
    byAppPassword.delete(hash);
    if (byAppPassword.size === 0) store.byAppPassword.delete(entry.appPasswordId);
  }

  const byUser = store.byUser.get(entry.userId);
  if (byUser) {
    byUser.delete(hash);
    if (byUser.size === 0) store.byUser.delete(entry.userId);
  }
};

/**
 * Drop every entry whose TTL has run out. O(size), called on write only.
 * @param {DavCredentialMemoryStore} store
 * @param {number} now
 */
const evictExpired = (store, now) => {
  for (const [hash, entry] of store.byKey) {
    if (entry.expiresAt <= now) unlink(store, hash);
  }
};

/**
 * @param {string} hash
 * @returns {DavCredentialCacheEntry | null}
 */
export const davCredentialMemoryGet = (hash) => {
  const store = getDavCredentialMemoryStore();
  const entry = store.byKey.get(hash);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    unlink(store, hash);
    return null;
  }

  return entry;
};

/**
 * @param {string} hash
 * @param {{ userId: string, appPasswordId: string }} value
 * @param {number} [ttlMs]
 */
export const davCredentialMemorySet = (hash, value, ttlMs = DAV_CREDENTIAL_CACHE_TTL_MS) => {
  const store = getDavCredentialMemoryStore();
  const now = Date.now();

  evictExpired(store, now);

  if (store.byKey.size >= MAX_MEMORY_ENTRIES && !store.byKey.has(hash)) {
    // Still full after eviction — drop the oldest insertion (Map preserves it).
    const oldest = store.byKey.keys().next();
    if (!oldest.done) unlink(store, oldest.value);
  }

  unlink(store, hash);

  store.byKey.set(hash, {
    userId: value.userId,
    appPasswordId: value.appPasswordId,
    expiresAt: now + ttlMs,
  });

  const byAppPassword = store.byAppPassword.get(value.appPasswordId) ?? new Set();
  byAppPassword.add(hash);
  store.byAppPassword.set(value.appPasswordId, byAppPassword);

  const byUser = store.byUser.get(value.userId) ?? new Set();
  byUser.add(hash);
  store.byUser.set(value.userId, byUser);
};

/**
 * Forget every cached verification for one app password. Returns the hashes that
 * were dropped so a Redis-backed caller can delete the matching keys.
 *
 * @param {string} appPasswordId
 * @returns {string[]}
 */
export const davCredentialMemoryDeleteByAppPasswordId = (appPasswordId) => {
  const store = getDavCredentialMemoryStore();
  const hashes = [...(store.byAppPassword.get(appPasswordId) ?? [])];
  for (const hash of hashes) unlink(store, hash);
  return hashes;
};

/**
 * Forget every cached verification for one user (account lock, password reset).
 *
 * @param {string} userId
 * @returns {string[]}
 */
export const davCredentialMemoryDeleteByUserId = (userId) => {
  const store = getDavCredentialMemoryStore();
  const hashes = [...(store.byUser.get(userId) ?? [])];
  for (const hash of hashes) unlink(store, hash);
  return hashes;
};
