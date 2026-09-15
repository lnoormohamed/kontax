import crypto from "node:crypto";

import bcrypt from "bcryptjs";

import { getUserBillingContext } from "~/server/billing";
import { db } from "~/server/db";
import { getRedis } from "~/server/rate-limit";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const APP_PASSWORD_LENGTH = 24;
const BCRYPT_COST = 12;
const DUMMY_BCRYPT_HASH =
  "$2b$12$3Y0mFQ0M0l9n4Y3Q6p0g2uh2jQ7JmYI3d2eY0m4rA4Aq0vN5iVfL2";

type AppPasswordRow = {
  id: string;
  userId: string;
  label: string;
  hashedPassword: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type AppPasswordSummary = {
  id: string;
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

export const normalizeAppPasswordToken = (value: string) =>
  value.replaceAll("-", "").replaceAll(" ", "").trim();

export const formatAppPasswordToken = (value: string) =>
  normalizeAppPasswordToken(value)
    .match(/.{1,4}/g)
    ?.join("-") ?? value;

export function generateAppPasswordToken() {
  const bytes = crypto.randomBytes(18);
  let result = "";
  let num = BigInt(`0x${bytes.toString("hex")}`);
  const base = BigInt(58);

  while (num > 0n) {
    result = BASE58_ALPHABET[Number(num % base)]! + result;
    num /= base;
  }

  while (result.length < APP_PASSWORD_LENGTH) {
    result = BASE58_ALPHABET[0]! + result;
  }

  return result.slice(-APP_PASSWORD_LENGTH);
}

export const hashAppPassword = async (plaintext: string) =>
  bcrypt.hash(normalizeAppPasswordToken(plaintext), BCRYPT_COST);

export const verifyAppPassword = async (plaintext: string, hash: string) =>
  bcrypt.compare(normalizeAppPasswordToken(plaintext), hash);

const getActiveAppPasswordLimit = async (userId: string) => {
  const context = await getUserBillingContext(userId);
  // P11-02: read the entitlement (FREE=1, PRO/FAMILY/TEAMS=5 per the frozen
  // matrix). P11-03 folds app passwords into the central entitlement layer.
  return context.entitlements.appPasswordsLimit;
};

export const canCreateAppPassword = async (userId: string) => {
  const [limit, activeCountResult] = await Promise.all([
    getActiveAppPasswordLimit(userId),
    db.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint AS count FROM "AppPassword" WHERE "userId" = $1 AND "revokedAt" IS NULL',
      userId,
    ),
  ]);

  const current = Number(activeCountResult[0]?.count ?? 0n);

  return {
    allowed: limit == null ? true : current < limit,
    current,
    limit,
  };
};

export const listUserAppPasswords = async (userId: string): Promise<AppPasswordSummary[]> =>
  db.$queryRawUnsafe<AppPasswordSummary[]>(
    'SELECT "id", "label", "createdAt", "lastUsedAt", "revokedAt" FROM "AppPassword" WHERE "userId" = $1 ORDER BY "createdAt" DESC',
    userId,
  );

export const createUserAppPassword = async (userId: string, label: string) => {
  const token = generateAppPasswordToken();
  const hashedPassword = await hashAppPassword(token);
  const trimmedLabel = label.trim();

  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    'INSERT INTO "AppPassword" ("id", "userId", "label", "hashedPassword", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING "id"',
    crypto.randomUUID(),
    userId,
    trimmedLabel,
    hashedPassword,
  );

  return {
    id: rows[0]!.id,
    token,
    formattedToken: formatAppPasswordToken(token),
  };
};

// P48-09: DAV verified-credential cache invalidation.
//
// The canonical definitions of these key formats and of the in-process fallback
// store live in `src/server/dav/credential-cache.mjs`, because `server.mjs` (the
// plain-ESM CardDAV server that *writes* the cache) cannot import TypeScript.
// This module runs inside the Next bundle and cannot import that `.mjs` through
// the bundler, so the three key formats and the global symbol are repeated here.
// KEEP THE TWO IN SYNC.
const davCredentialRedisKey = (hash: string) => `dav:cred:${hash}`;
const davCredentialAppPasswordIndexKey = (appPasswordId: string) => `dav:cred:ap:${appPasswordId}`;
const davCredentialUserIndexKey = (userId: string) => `dav:cred:user:${userId}`;
const DAV_CREDENTIAL_STORE_SYMBOL = Symbol.for("kontax.dav.credentialCache");

type DavCredentialCacheEntry = { userId: string; appPasswordId: string; expiresAt: number };
type DavCredentialMemoryStore = {
  byKey: Map<string, DavCredentialCacheEntry>;
  byAppPassword: Map<string, Set<string>>;
  byUser: Map<string, Set<string>>;
};

const readDavCredentialMemoryStore = (): DavCredentialMemoryStore | null =>
  (globalThis as unknown as Record<symbol, DavCredentialMemoryStore | undefined>)[
    DAV_CREDENTIAL_STORE_SYMBOL
  ] ?? null;

const purgeDavCredentialMemory = (matches: (entry: DavCredentialCacheEntry) => boolean) => {
  const store = readDavCredentialMemoryStore();
  if (!store) return;

  // Bounded at 5 000 entries by the writer, and this only runs on revoke.
  for (const [hash, entry] of store.byKey) {
    if (!matches(entry)) continue;
    store.byKey.delete(hash);
    store.byAppPassword.get(entry.appPasswordId)?.delete(hash);
    store.byUser.get(entry.userId)?.delete(hash);
  }
};

const purgeDavCredentialRedis = async (indexKey: string) => {
  const redis = getRedis();
  if (!redis) return;

  try {
    const hashes = await redis.smembers(indexKey);
    if (hashes.length > 0) {
      await redis.del(...hashes.map(davCredentialRedisKey));
    }
    await redis.del(indexKey);
  } catch (error) {
    // Failing open here would leave a revoked password usable for up to the
    // 10-minute TTL, so it is worth a loud log.
    console.error("Failed to invalidate DAV credential cache", error);
  }
};

/** Forget every cached CardDAV verification for one app password. */
export const invalidateDavCredentialCacheForAppPassword = async (appPasswordId: string) => {
  purgeDavCredentialMemory((entry) => entry.appPasswordId === appPasswordId);
  await purgeDavCredentialRedis(davCredentialAppPasswordIndexKey(appPasswordId));
};

/**
 * Forget every cached CardDAV verification for one user. Call this on a
 * lifecycle transition (e.g. into LOCKED) or a full credential reset.
 */
export const invalidateDavCredentialCacheForUser = async (userId: string) => {
  purgeDavCredentialMemory((entry) => entry.userId === userId);
  await purgeDavCredentialRedis(davCredentialUserIndexKey(userId));
};

export const revokeUserAppPassword = async (userId: string, appPasswordId: string) => {
  const result = await db.$executeRawUnsafe(
    'UPDATE "AppPassword" SET "revokedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1 AND "userId" = $2 AND "revokedAt" IS NULL',
    appPasswordId,
    userId,
  );

  const revoked = Number(result) > 0;

  if (revoked) {
    // P48-09: without this the CardDAV server would keep accepting the revoked
    // password from its verified-credential cache for up to 10 minutes.
    await invalidateDavCredentialCacheForAppPassword(appPasswordId);
  }

  return revoked;
};

/**
 * Next-side CardDAV credential verification.
 *
 * P48-09: this is NOT the implementation the CardDAV server uses. `server.mjs`
 * owns the DAV auth pipeline (rate limiting, verified-credential cache,
 * `lastUsedAt` debounce) and cannot import TypeScript, so it carries its own
 * copy. This one remains for the Next-side `/.well-known/carddav` fallback in
 * `src/server/dav/auth.ts`. Behavioural changes must be made in both.
 */
export async function verifyCardDavCredentials(email: string, plaintext: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = normalizeAppPasswordToken(plaintext);

  const user = await db.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      lifecycleState: true,
      scheduledDeleteAt: true,
    },
  });

  // P48-09: a LOCKED account must not be able to sync. The dummy compare keeps
  // every failure path costing one bcrypt — a known email with zero app
  // passwords used to cost none, which was an account-enumeration oracle.
  if (!user || user.lifecycleState === "LOCKED" || user.scheduledDeleteAt) {
    await bcrypt.compare(normalizedToken, DUMMY_BCRYPT_HASH);
    return null;
  }

  const appPasswords = await db.$queryRawUnsafe<AppPasswordRow[]>(
    'SELECT "id", "userId", "label", "hashedPassword", "lastUsedAt", "revokedAt", "createdAt" FROM "AppPassword" WHERE "userId" = $1 AND "revokedAt" IS NULL ORDER BY "createdAt" DESC',
    user.id,
  );

  if (appPasswords.length === 0) {
    await bcrypt.compare(normalizedToken, DUMMY_BCRYPT_HASH);
    return null;
  }

  for (const appPassword of appPasswords) {
    const matches = await verifyAppPassword(normalizedToken, appPassword.hashedPassword);

    if (!matches) {
      continue;
    }

    await db.$executeRawUnsafe(
      'UPDATE "AppPassword" SET "lastUsedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1',
      appPassword.id,
    );

    return {
      userId: user.id,
      appPasswordId: appPassword.id,
    };
  }

  return null;
}
