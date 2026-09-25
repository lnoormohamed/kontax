/**
 * P48-18 — capability tokens at rest (calendar feed, vCard share link, group
 * invite). See docs/capability-token-storage.md for the full model.
 *
 * - The bearer token itself is generated exactly as before (unchanged entropy)
 *   and handed to the user once — in the UI, or in an invite email.
 * - The database stores `sha256(token)` as lowercase hex in a UNIQUE column, and
 *   every lookup hashes the presented token and queries that column. Plain
 *   SHA-256 (not an HMAC) matches the existing reset/verification/API token
 *   columns and survives `AUTH_SECRET` rotation; the tokens carry ≥ 144 bits of
 *   randomness, so the hash is not brute-forceable.
 * - Where the product shows the link again (calendar feed URL in Settings, the
 *   share link in the sharing panel) an encrypted display copy is kept too,
 *   under the P48-16 envelope with its own prefix and HKDF info label. Invite
 *   tokens get no display copy: nothing shows them again.
 * - LEGACY (dual-read window): rows issued before P48-18 still hold the token in
 *   the plaintext column. Each `find…ByToken` helper falls back to it after the
 *   hash lookup misses. App code never writes a value to a plaintext column any
 *   more — it only nulls one when revoking/rotating a token, so a legacy link
 *   dies with it. `scripts/backfill-p48-18-token-hashes.mjs` converts the
 *   remaining rows; once it has run everywhere, delete the fallbacks marked
 *   LEGACY below and drop the columns.
 *
 * This module deliberately does not import `~/server/db`: lookups take a finder
 * callback (so callers keep their own `select`/`include`/transaction client and
 * full Prisma typing), and the backfill script can import it with its own
 * PrismaClient and without the app's env validation.
 *
 * Never log a token or a display copy.
 */
import "server-only";

import { createHash } from "node:crypto";

import {
  buildSyncCredentialKeyring,
  decryptEnvelope,
  encryptEnvelope,
} from "~/server/sync-credentials";

import type { Prisma } from "../../generated/prisma";

// Own prefix + HKDF info label: a display-token envelope can never be confused
// with (or replayed as) a sync credential or TOTP envelope, even though all
// three share the sync credential keyring's keys.
const DISPLAY_ENVELOPE_PREFIX = "kontax-tok-v1";
const DISPLAY_HKDF_INFO = "kontax:display-tokens:v1";

/** Generated tokens are 32 chars; anything much longer is not one of ours. */
const MAX_TOKEN_LENGTH = 256;

// Every generator is base64url of random bytes (older rows may be hex), so
// restrict to that alphabet: malformed input (e.g. a %00 in /share/<token>)
// is rejected before any query instead of surfacing as a Postgres 500.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]+$/;

const isPlausibleToken = (token: string | null | undefined): token is string =>
  typeof token === "string" &&
  token.length >= 16 &&
  token.length <= MAX_TOKEN_LENGTH &&
  TOKEN_SHAPE.test(token);

// ── Hashing ──────────────────────────────────────────────────────────────────

/** SHA-256 of the exact token string, as lowercase hex. */
export const hashToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

// ── Display copy ─────────────────────────────────────────────────────────────

/**
 * Encrypt a token for later display. Throws when no encryption key is
 * configured — the caller must not persist a token it cannot show again.
 */
export const encryptDisplayToken = (token: string): string => {
  const keyring = buildSyncCredentialKeyring();
  if (!keyring) {
    throw new Error(
      "Token encryption is not configured. Set SYNC_CREDENTIAL_ENCRYPTION_KEYS (or SYNC_CREDENTIAL_ENCRYPTION_KEY, or AUTH_SECRET).",
    );
  }
  return encryptEnvelope(
    keyring,
    DISPLAY_ENVELOPE_PREFIX,
    DISPLAY_HKDF_INFO,
    Buffer.from(token, "utf8"),
  ).encoded;
};

/**
 * Decrypt a display copy, or `null` when it is absent or cannot be decrypted
 * (key retired from the keyring, malformed value, wrong envelope). Never
 * throws: the UI turns `null` into a "Regenerate link" state.
 */
export const decryptDisplayToken = (encrypted: string | null | undefined): string | null => {
  if (!encrypted?.startsWith(`${DISPLAY_ENVELOPE_PREFIX}:`)) return null;
  try {
    const keyring = buildSyncCredentialKeyring();
    if (!keyring) return null;
    return decryptEnvelope(keyring, DISPLAY_ENVELOPE_PREFIX, DISPLAY_HKDF_INFO, encrypted)
      .plaintext.toString("utf8");
  } catch {
    return null;
  }
};

/**
 * Key-rotation support (used by scripts/rotate-sync-credential-key.mjs).
 * Display copies share the sync credential keyring, so rotating that keyring
 * must re-encrypt them too, or retiring the old key turns every affected link
 * into a "Regenerate link" state.
 *
 * - "current": encrypted under the keyring's current key — nothing to do
 * - "stale": readable, but under an older key — re-encrypt
 * - "unreadable": no configured key can open it (or it is malformed)
 */
export const displayTokenKeyStatus = (
  encrypted: string,
): "current" | "stale" | "unreadable" => {
  if (!encrypted.startsWith(`${DISPLAY_ENVELOPE_PREFIX}:`)) return "unreadable";
  try {
    const keyring = buildSyncCredentialKeyring();
    if (!keyring) return "unreadable";
    const { keyId } = decryptEnvelope(keyring, DISPLAY_ENVELOPE_PREFIX, DISPLAY_HKDF_INFO, encrypted);
    return keyId === keyring.current.id ? "current" : "stale";
  } catch {
    return "unreadable";
  }
};

export type DisplayToken =
  | { status: "ok"; token: string }
  /** A token exists but cannot be shown — offer "Regenerate link". */
  | { status: "unavailable" }
  /** No token has been issued. */
  | { status: "none" };

/**
 * Work out what the UI can show for a stored token.
 *
 * The decrypted copy is checked against the lookup hash when both exist, so a
 * display copy that does not belong to this row (restored from elsewhere,
 * copied between rows) is never shown as a working link.
 */
export const resolveDisplayToken = (stored: {
  hash: string | null | undefined;
  encrypted: string | null | undefined;
  /** LEGACY: the pre-P48-18 plaintext column. */
  legacy: string | null | undefined;
}): DisplayToken => {
  if (stored.encrypted) {
    const token = decryptDisplayToken(stored.encrypted);
    // Only show a copy that provably belongs to this row's lookup hash; a copy
    // without a hash (manual DB edit) could display a link that cannot resolve.
    if (token && stored.hash && hashToken(token) === stored.hash) {
      return { status: "ok", token };
    }
  }
  // LEGACY: a row issued before the deploy and not yet backfilled.
  if (stored.legacy) return { status: "ok", token: stored.legacy };
  if (stored.hash || stored.encrypted) return { status: "unavailable" };
  return { status: "none" };
};

// Per-type selects + resolvers, so the LEGACY plaintext column is named only in
// this module (and the backfill) rather than at every call site.

export const calTokenDisplaySelect = {
  calTokenHash: true,
  calTokenEncrypted: true,
  calToken: true, // LEGACY
} as const satisfies Prisma.UserSelect;

export const calDisplayToken = (
  row: { calTokenHash: string | null; calTokenEncrypted: string | null; calToken: string | null } | null | undefined,
): DisplayToken =>
  resolveDisplayToken({
    hash: row?.calTokenHash,
    encrypted: row?.calTokenEncrypted,
    legacy: row?.calToken,
  });

/** `where` fragment: the user has no calendar token at all (hashed or legacy). */
export const noCalTokenWhere = {
  calTokenHash: null,
  calToken: null, // LEGACY
} as const satisfies Prisma.UserWhereInput;

export const shareTokenDisplaySelect = {
  tokenHash: true,
  tokenEncrypted: true,
  token: true, // LEGACY
} as const satisfies Prisma.ContactShareSelect;

export const shareDisplayToken = (
  row: { tokenHash: string | null; tokenEncrypted: string | null; token: string | null } | null | undefined,
): DisplayToken =>
  resolveDisplayToken({
    hash: row?.tokenHash,
    encrypted: row?.tokenEncrypted,
    legacy: row?.token,
  });

// ── Column sets for writes ───────────────────────────────────────────────────
// Spread into a Prisma `data` object when issuing or rotating a token. Each one
// nulls the legacy plaintext column so a rotated token's old value stops
// resolving through the LEGACY fallback.

export const calTokenColumns = (token: string) => ({
  calTokenHash: hashToken(token),
  calTokenEncrypted: encryptDisplayToken(token),
  calToken: null,
});

export const shareTokenColumns = (token: string) => ({
  tokenHash: hashToken(token),
  tokenEncrypted: encryptDisplayToken(token),
  token: null,
});

export const inviteTokenColumns = (token: string) => ({
  inviteTokenHash: hashToken(token),
  inviteToken: null,
});

/** Clear an invite token entirely (accepted, declined). */
export const clearedInviteTokenColumns = () => ({
  inviteTokenHash: null,
  inviteToken: null,
});

// ── Lookups (hash first, LEGACY plaintext fallback) ─────────────────────────

type Finder<Where, T> = (where: Where) => Promise<T | null>;

const hashFirst = async <Where, T>(
  token: string | null | undefined,
  find: Finder<Where, T>,
  byHash: (hash: string) => Where,
  byLegacyPlaintext: (token: string) => Where,
): Promise<T | null> => {
  if (!isPlausibleToken(token)) return null;
  const found = await find(byHash(hashToken(token)));
  if (found) return found;
  // LEGACY (P48-18 dual-read): remove once the backfill has run everywhere.
  return find(byLegacyPlaintext(token));
};

/**
 * Resolve the user a calendar-feed token belongs to.
 *
 *   findUserByCalToken(token, (where) => db.user.findUnique({ where, select: { id: true } }))
 */
export const findUserByCalToken = <T>(
  token: string | null | undefined,
  find: Finder<Prisma.UserWhereUniqueInput, T>,
): Promise<T | null> =>
  hashFirst(
    token,
    find,
    (calTokenHash) => ({ calTokenHash }),
    (calToken) => ({ calToken }),
  );

/** Resolve the ContactShare a public share-link token belongs to. */
export const findShareByToken = <T>(
  token: string | null | undefined,
  find: Finder<Prisma.ContactShareWhereUniqueInput, T>,
): Promise<T | null> =>
  hashFirst(
    token,
    find,
    (tokenHash) => ({ tokenHash }),
    (legacyToken) => ({ token: legacyToken }),
  );

/** Resolve the GroupMember (family or team invite) an invite token belongs to. */
export const findMemberByInviteToken = <T>(
  token: string | null | undefined,
  find: Finder<Prisma.GroupMemberWhereUniqueInput, T>,
): Promise<T | null> =>
  hashFirst(
    token,
    find,
    (inviteTokenHash) => ({ inviteTokenHash }),
    (inviteToken) => ({ inviteToken }),
  );
