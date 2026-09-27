import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * P49A-13 — 2FA recovery codes: format, storage hash, and verification.
 *
 * Old format (P48-03 → P49A-19): 10 hex characters (40 bits), stored as an
 * unsalted SHA-256. 40 bits behind a fast unsalted hash is brute-forceable
 * offline from a database leak in minutes.
 *
 * New format: 16 characters of RFC 4648 base32 (80 bits), shown grouped as
 * `ABCD-EFGH-IJKL-MNOP`, stored as scrypt (N=2^14, r=8, p=1) under a random
 * salt. One salt per *set* rather than per code: a salt's job is to stop
 * precomputation across users and sets, which a per-set salt does, and it
 * means redeeming a code costs one scrypt instead of one per stored code.
 * Stored form: `s1$<salt b64url>$<hash b64url>` in the existing `codeHash`
 * column, so no schema change is needed.
 *
 * Compatibility: codes issued before this change keep working until the user
 * regenerates (their rows are 64-char hex SHA-256 digests and are verified as
 * such). They cannot be upgraded in place — only the hash is stored — and
 * forcing a regeneration would lock out anyone relying on printed codes.
 */

export const RECOVERY_CODE_COUNT = 8;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const NEW_CODE_LENGTH = 16;
const HASH_PREFIX = "s1";
const SCRYPT_KEYLEN = 32;
const SCRYPT_OPTIONS = { N: 1 << 14, r: 8, p: 1 } as const;

const scryptAsync = (secret: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(secret, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS, (err, key) => (err ? reject(err) : resolve(key)));
  });

/** 10 random bytes → exactly 16 base32 characters. */
const randomBase32Code = (): string => {
  const bytes = randomBytes(10);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
};

const groupCode = (raw: string): string => raw.match(/.{4}/g)!.join("-");

/** Separators and whitespace people type or paste between groups. */
const stripSeparators = (input: string): string => input.toUpperCase().replace(/[\s-]/g, "");

/**
 * Canonical new-format code, or null if the input can't be one. Base32 has no
 * 0, 1 or 8, so read those as the letters they are usually mistaken for.
 */
const canonicalNewCode = (input: string): string | null => {
  const code = stripSeparators(input).replace(/0/g, "O").replace(/1/g, "I").replace(/8/g, "B");
  if (code.length !== NEW_CODE_LENGTH) return null;
  for (const ch of code) if (!BASE32_ALPHABET.includes(ch)) return null;
  return code;
};

const sha256Hex = (value: string): string => createHash("sha256").update(value).digest("hex");

const LEGACY_HASH = /^[0-9a-f]{64}$/;

const constantTimeEqual = (a: Buffer, b: Buffer): boolean => a.length === b.length && timingSafeEqual(a, b);

/**
 * A fresh set of recovery codes (as shown to the user) and the values to store
 * for them — built together so the stored set is exactly the shown set.
 */
export async function newRecoveryCodeSet(): Promise<{ codes: string[]; hashes: string[] }> {
  const raw = new Set<string>();
  while (raw.size < RECOVERY_CODE_COUNT) raw.add(randomBase32Code());
  const salt = randomBytes(16);
  const saltText = salt.toString("base64url");
  const list = [...raw];
  const hashes = await Promise.all(
    list.map(async (code) => `${HASH_PREFIX}$${saltText}$${(await scryptAsync(code, salt)).toString("base64url")}`),
  );
  return { codes: list.map(groupCode), hashes };
}

/** True when a stored value is a pre-P49A-13 (10-hex, unsalted SHA-256) code. */
export const isLegacyRecoveryCodeHash = (stored: string): boolean => LEGACY_HASH.test(stored);

/**
 * The id of the stored code `input` matches, or null. Every candidate is
 * compared in constant time and the loop never exits early, so how long this
 * takes doesn't say which (or whether an earlier) row matched.
 */
export async function findMatchingRecoveryCode(
  input: string,
  candidates: ReadonlyArray<{ id: string; codeHash: string }>,
): Promise<string | null> {
  if (typeof input !== "string" || input.length === 0 || input.length > 64) return null;

  let match: string | null = null;

  // Legacy rows: SHA-256 of the upper-cased code, as P48-03 stored it.
  const legacyDigest = Buffer.from(sha256Hex(stripSeparators(input)), "hex");
  for (const row of candidates) {
    if (!isLegacyRecoveryCodeHash(row.codeHash)) continue;
    if (constantTimeEqual(Buffer.from(row.codeHash, "hex"), legacyDigest) && match === null) match = row.id;
  }

  // New rows: one scrypt per distinct salt (normally one per set).
  const code = canonicalNewCode(input);
  if (code) {
    const bySalt = new Map<string, Array<{ id: string; hash: Buffer }>>();
    for (const row of candidates) {
      const parts = row.codeHash.split("$");
      if (parts.length !== 3 || parts[0] !== HASH_PREFIX) continue;
      const list = bySalt.get(parts[1]!) ?? [];
      list.push({ id: row.id, hash: Buffer.from(parts[2]!, "base64url") });
      bySalt.set(parts[1]!, list);
    }
    for (const [saltText, rows] of bySalt) {
      const derived = await scryptAsync(code, Buffer.from(saltText, "base64url"));
      for (const row of rows) {
        if (constantTimeEqual(row.hash, derived) && match === null) match = row.id;
      }
    }
  }

  return match;
}
