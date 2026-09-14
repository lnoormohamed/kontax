/**
 * AES-256-GCM encryption for TOTP secrets and pending-enrolment tokens.
 *
 * P48-16: unified onto the shared keyring + envelope primitives in
 * `sync-credentials.ts`, so TOTP secrets and provider credentials now use the
 * same versioned envelope (version byte, embedded key id, AAD) and the same
 * HKDF key derivation, and both are rotatable without downtime.
 *
 * Current format: `kontax-totp-v2:<base64url envelope>` — see the envelope
 * layout documented in `sync-credentials.ts`.
 *
 * Legacy format (still decryptable, never written): bare base64url of
 * `iv(12) | authTag(16) | ciphertext`, encrypted directly under the raw
 * `TOTP_ENCRYPTION_KEY` bytes with no AAD and no key id.
 */
import { createDecipheriv } from "node:crypto";
import * as OTPAuth from "otpauth";

import {
  type Keyring,
  type KeyringEntry,
  decryptEnvelope,
  encryptEnvelope,
  parseKeyringVar,
} from "~/server/sync-credentials";

const ENVELOPE_PREFIX = "kontax-totp-v2";
const HKDF_INFO = "kontax:totp:v2";

/** Deterministic dev-only key, as hex. Never reachable in production. */
const DEV_PLACEHOLDER_SECRET = "42".repeat(32);

const readEnv = (name: string): string | null => {
  const value = process.env[name]?.trim();
  if (!value) return null;
  return value;
};

/**
 * Build the TOTP keyring, current key first:
 *
 *   1. `TOTP_ENCRYPTION_KEYS` — "id:hex64,id:hex64", first entry is current.
 *   2. `TOTP_ENCRYPTION_KEY` — the single-key form, id "t1". Retained as a
 *      decrypt-only key when (1) is also set, so adopting the keyring does not
 *      require re-encrypting anything first.
 *   3. Outside production only: a fixed placeholder so `npm run dev` and the
 *      test suite work without a key.
 */
const buildTotpKeyring = (): Keyring => {
  const entries: KeyringEntry[] = [];

  const keyringVar = readEnv("TOTP_ENCRYPTION_KEYS");
  if (keyringVar) {
    entries.push(...parseKeyringVar(keyringVar, "TOTP_ENCRYPTION_KEYS"));
  }

  const singleKey = readEnv("TOTP_ENCRYPTION_KEY");
  if (singleKey) {
    if (singleKey.length !== 64) {
      throw new Error("TOTP_ENCRYPTION_KEY must be a 64-char hex string.");
    }
    if (!entries.some((entry) => entry.id === "t1")) {
      entries.push({ id: "t1", secret: singleKey, aliases: ["t1"] });
    }
  }

  const current = entries[0];
  if (current) return { current, entries };

  if (
    process.env.NODE_ENV === "production" ||
    process.env.KONTAX_DEPLOY_ENV === "production"
  ) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY (or TOTP_ENCRYPTION_KEYS) must be set in production — TOTP secrets cannot be stored safely without it.",
    );
  }

  const devEntry: KeyringEntry = {
    id: "dev",
    secret: DEV_PLACEHOLDER_SECRET,
    aliases: ["dev"],
  };
  return { current: devEntry, entries: [devEntry] };
};

// ── Legacy decrypt ───────────────────────────────────────────────────────────

/**
 * Pre-P48-16 blobs used the configured key bytes directly as the AES key, with
 * no AAD and no key id. Try every key in the ring — the GCM auth tag rejects
 * the wrong one, so this cannot mis-decrypt.
 */
const decryptLegacyTotp = (keyring: Keyring, stored: string): string => {
  const buf = Buffer.from(stored, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);

  for (const entry of keyring.entries) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", Buffer.from(entry.secret, "hex"), iv);
      decipher.setAuthTag(tag);
      return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
    } catch {
      // wrong key — try the next one
    }
  }

  throw new Error("Stored TOTP secret could not be decrypted with any configured key.");
};

// ── Public API ───────────────────────────────────────────────────────────────

export function encryptTotp(plaintext: string): string {
  return encryptEnvelope(
    buildTotpKeyring(),
    ENVELOPE_PREFIX,
    HKDF_INFO,
    Buffer.from(plaintext, "utf8"),
  ).encoded;
}

export function decryptTotp(stored: string): string {
  const keyring = buildTotpKeyring();

  if (stored.startsWith(`${ENVELOPE_PREFIX}:`)) {
    return decryptEnvelope(keyring, ENVELOPE_PREFIX, HKDF_INFO, stored).plaintext.toString(
      "utf8",
    );
  }

  return decryptLegacyTotp(keyring, stored);
}

/**
 * True when a stored TOTP blob is not on the current key/envelope, i.e. the
 * rotation script should rewrite it.
 */
export function isTotpCiphertextStale(stored: string): boolean {
  const keyring = buildTotpKeyring();
  if (!stored.startsWith(`${ENVELOPE_PREFIX}:`)) return true;
  try {
    return (
      decryptEnvelope(keyring, ENVELOPE_PREFIX, HKDF_INFO, stored).keyId !==
      keyring.current.id
    );
  } catch {
    return false;
  }
}

/** Encrypt a JSON payload (for short-lived pending tokens) */
export function encryptPayload(payload: Record<string, unknown>): string {
  return encryptTotp(JSON.stringify(payload));
}

export function decryptPayload<T = Record<string, unknown>>(token: string): T {
  return JSON.parse(decryptTotp(token)) as T;
}

// ── TOTP helpers ──────────────────────────────────────────────────────────────

export function createTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function generateTotpUri(secret: string, email: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "Kontax",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

export function verifyTotpToken(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.validate({ token: code, window: 1 }) !== null;
}
