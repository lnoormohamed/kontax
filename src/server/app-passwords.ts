import crypto from "node:crypto";

import bcrypt from "bcryptjs";

import { getUserBillingContext } from "~/server/billing";
import { db } from "~/server/db";

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

export const revokeUserAppPassword = async (userId: string, appPasswordId: string) => {
  const result = await db.$executeRawUnsafe(
    'UPDATE "AppPassword" SET "revokedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1 AND "userId" = $2 AND "revokedAt" IS NULL',
    appPasswordId,
    userId,
  );

  return Number(result) > 0;
};

export async function verifyCardDavCredentials(email: string, plaintext: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = normalizeAppPasswordToken(plaintext);

  const user = await db.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    await bcrypt.compare(normalizedToken, DUMMY_BCRYPT_HASH);
    return null;
  }

  const appPasswords = await db.$queryRawUnsafe<AppPasswordRow[]>(
    'SELECT "id", "userId", "label", "hashedPassword", "lastUsedAt", "revokedAt", "createdAt" FROM "AppPassword" WHERE "userId" = $1 AND "revokedAt" IS NULL ORDER BY "createdAt" DESC',
    user.id,
  );

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
