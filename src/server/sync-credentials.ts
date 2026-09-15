import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const LEGACY_ENVELOPE_PREFIX = "kontax-sync-v1";
const LEGACY_AAD_CONTEXT = "kontax-sync-credentials";

// P48-16 — versioned envelope + key ring.
const ENVELOPE_PREFIX = "kontax-sync-v2";
const HKDF_INFO = "kontax:sync-credentials:v2";

export type SyncCredentialPayload = {
  username: string;
  password: string;
  note?: string;
  provider: "CARDDAV";
  version: 1;
};

// P27-01: Google Contacts OAuth token envelope. Stored encrypted in the same
// SyncAccount.credentialReference column as CardDAV credentials, just a
// different JSON shape behind the same AES-256-GCM envelope.
export type GoogleSyncCredentialPayload = {
  provider: "GOOGLE";
  version: 1;
  accessToken: string;
  refreshToken: string;
  // Epoch milliseconds when the access token expires (google-auth-library
  // expiry_date). May be null on rare token responses that omit it.
  expiryDate: number | null;
  // The connected Google account email (people/me), used for the account label
  // and the connected-account row in the detail panel (P27-07).
  googleEmail: string;
  // Granted OAuth scopes, space-delimited as returned by Google. Used by P27-07
  // to detect the "scope reduced" state.
  scope: string;
};

// P27-04: Microsoft Outlook/Graph OAuth credential. MSAL-node hides raw refresh
// tokens, so we persist its serialized token cache (which holds the refresh
// token) and use acquireTokenSilent to auto-refresh. Stored in the same column
// + AES envelope as CardDAV/Google, different JSON shape.
export type MicrosoftSyncCredentialPayload = {
  provider: "MICROSOFT";
  version: 1;
  // Serialized MSAL token cache (contains the rotating refresh token).
  cacheBlob: string;
  // MSAL account identifier, used to select the account from the cache.
  homeAccountId: string;
  // The connected Microsoft account email (mail ?? userPrincipalName).
  microsoftEmail: string;
  // Granted scopes, space-delimited.
  scope: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// P48-16 — shared keyring + envelope primitives
//
// `totp-crypto.ts` builds on the same primitives so both at-rest secrets share
// one envelope format, one derivation scheme and one rotation story. They live
// here (rather than in a third module) because the sync credential keyring is
// the richer of the two and owns the legacy compatibility paths.
//
// Envelope layout (base64url-encoded, prefixed with a version tag):
//
//   byte  0        envelope version (2)
//   byte  1        key id length n (1..64)
//   bytes 2..2+n   key id, ASCII
//   next  12       AES-GCM IV
//   next  16       AES-GCM auth tag
//   rest           ciphertext
//
// The key id travels with the ciphertext, so a row is decryptable without
// consulting any out-of-band column — `SyncAccount.encryptionKeyRef` is now a
// hint/audit field rather than load-bearing state.
//
// AAD is `"<prefix>:<keyId>"`, which binds each ciphertext to both its envelope
// version and the key that produced it: a blob cannot be replayed into another
// context or relabelled with a different key id without failing the auth tag.
// ═══════════════════════════════════════════════════════════════════════════

const ENVELOPE_VERSION = 2;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const HKDF_SALT = Buffer.alloc(0);

const KEY_ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const HEX_64_PATTERN = /^[0-9a-fA-F]{64}$/;

export type KeyringEntry = {
  /** Short stable label stored inside the envelope, e.g. "k1", "k2", "legacy". */
  id: string;
  /**
   * The secret as configured. Kept verbatim because the pre-P48-16 formats
   * derived their key from it directly (sha256 of the string for sync v1, the
   * hex-decoded bytes for TOTP v1); v2 runs it through HKDF instead.
   */
  secret: string;
  /** Extra names this entry answers to when resolving a stored `encryptionKeyRef`. */
  aliases: string[];
};

export type Keyring = {
  /** The key new ciphertext is written under — always `entries[0]`. */
  current: KeyringEntry;
  /** Current key first, then every key retained for decryption. */
  entries: KeyringEntry[];
};

/** HKDF input keying material: hex secrets decode to bytes, passphrases don't. */
const keyMaterial = (secret: string): Buffer =>
  HEX_64_PATTERN.test(secret)
    ? Buffer.from(secret, "hex")
    : Buffer.from(secret, "utf8");

/** The v2 content-encryption key for one keyring entry in one context. */
const deriveKey = (entry: KeyringEntry, info: string): Buffer =>
  Buffer.from(hkdfSync("sha256", keyMaterial(entry.secret), HKDF_SALT, info, KEY_BYTES));

/**
 * Parse a `"id1:hex64,id2:hex64"` keyring variable. The first entry is the
 * current key. Throws on a malformed value rather than silently ignoring keys —
 * a typo here would otherwise look like "all credentials suddenly unreadable".
 */
export const parseKeyringVar = (raw: string, varName: string): KeyringEntry[] =>
  raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const separator = part.indexOf(":");
      if (separator < 1) {
        throw new Error(
          `${varName} is malformed — expected "id:hex64,id:hex64" (comma-separated, current key first).`,
        );
      }
      const id = part.slice(0, separator).trim();
      const secret = part.slice(separator + 1).trim();

      if (!KEY_ID_PATTERN.test(id)) {
        throw new Error(
          `${varName} has an invalid key id "${id}" — use letters, digits, "_", "-" or "." (max 64 chars).`,
        );
      }
      if (!HEX_64_PATTERN.test(secret)) {
        throw new Error(
          `${varName} key "${id}" must be a 64-char hex string (generate with \`openssl rand -hex 32\`).`,
        );
      }

      return { id, secret, aliases: [id] };
    });

/** Drop later entries that repeat an earlier id, merging their aliases in. */
const dedupeById = (entries: KeyringEntry[]): KeyringEntry[] => {
  const byId = new Map<string, KeyringEntry>();
  for (const entry of entries) {
    const existing = byId.get(entry.id);
    if (existing) {
      if (existing.secret !== entry.secret) {
        throw new Error(
          `Encryption key id "${entry.id}" is configured twice with different secrets (keyring vs single-key variable). Give the second key its own id.`,
        );
      }
      for (const alias of entry.aliases) {
        if (!existing.aliases.includes(alias)) existing.aliases.push(alias);
      }
      continue;
    }
    byId.set(entry.id, { ...entry, aliases: [...entry.aliases] });
  }
  return [...byId.values()];
};

const findEntry = (keyring: Keyring, ref: string | null | undefined) => {
  if (!ref) return null;
  return (
    keyring.entries.find(
      (entry) => entry.id === ref || entry.aliases.includes(ref),
    ) ?? null
  );
};

/**
 * Candidate keys to try, in order: the hinted one first, then everything else.
 * Trying the rest is safe — AES-GCM's auth tag rejects the wrong key — and it
 * means a stale or missing `encryptionKeyRef` degrades to a slower decrypt
 * rather than a hard failure.
 */
const candidateEntries = (keyring: Keyring, ref: string | null | undefined) => {
  const hinted = findEntry(keyring, ref);
  if (!hinted) return keyring.entries;
  return [hinted, ...keyring.entries.filter((entry) => entry !== hinted)];
};

export const encryptEnvelope = (
  keyring: Keyring,
  prefix: string,
  info: string,
  plaintext: Buffer,
): { encoded: string; keyId: string } => {
  const entry = keyring.current;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(entry, info), iv);
  cipher.setAAD(Buffer.from(`${prefix}:${entry.id}`, "utf8"));

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const keyId = Buffer.from(entry.id, "ascii");

  const envelope = Buffer.concat([
    Buffer.from([ENVELOPE_VERSION, keyId.length]),
    keyId,
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]);

  return { encoded: `${prefix}:${envelope.toString("base64url")}`, keyId: entry.id };
};

export const decryptEnvelope = (
  keyring: Keyring,
  prefix: string,
  info: string,
  encoded: string,
): { plaintext: Buffer; keyId: string } => {
  const body = encoded.slice(prefix.length + 1);
  const envelope = Buffer.from(body, "base64url");

  if (envelope.length < 2) throw new Error("Encrypted envelope is truncated.");
  if (envelope[0] !== ENVELOPE_VERSION) {
    throw new Error(`Unsupported envelope version ${String(envelope[0])}.`);
  }

  const keyIdLength = envelope[1] ?? 0;
  const ivStart = 2 + keyIdLength;
  if (keyIdLength < 1 || envelope.length < ivStart + IV_BYTES + TAG_BYTES) {
    throw new Error("Encrypted envelope is truncated.");
  }

  const storedKeyId = envelope.subarray(2, ivStart).toString("ascii");
  const iv = envelope.subarray(ivStart, ivStart + IV_BYTES);
  const tag = envelope.subarray(ivStart + IV_BYTES, ivStart + IV_BYTES + TAG_BYTES);
  const ciphertext = envelope.subarray(ivStart + IV_BYTES + TAG_BYTES);

  // The AAD pins the key id, so only the entry actually named in the envelope
  // can verify. Looking it up by id is therefore the whole search space.
  const entry = findEntry(keyring, storedKeyId);
  if (!entry) {
    throw new Error(
      `No encryption key configured for key id "${storedKeyId}". Keep the retired key in the keyring until every row has been rotated.`,
    );
  }

  const decipher = createDecipheriv("aes-256-gcm", deriveKey(entry, info), iv);
  decipher.setAAD(Buffer.from(`${prefix}:${entry.id}`, "utf8"));
  decipher.setAuthTag(tag);

  return {
    plaintext: Buffer.concat([decipher.update(ciphertext), decipher.final()]),
    keyId: entry.id,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// Sync credential keyring
// ═══════════════════════════════════════════════════════════════════════════

/** Key id used for the pre-P48-16 AUTH_SECRET-derived fallback key. */
export const LEGACY_AUTH_SECRET_KEY_ID = "legacy";

/** What pre-P48-16 rows encrypted under the AUTH_SECRET fallback stored. */
const LEGACY_AUTH_SECRET_KEY_REF = "env:AUTH_SECRET:fallback";

/** What pre-P48-16 rows stored when SYNC_CREDENTIAL_ENCRYPTION_KEY_ID was unset. */
const LEGACY_DEDICATED_KEY_REF = "env:SYNC_CREDENTIAL_ENCRYPTION_KEY";

/** Default id for a single dedicated key that has no explicit id. */
const DEFAULT_DEDICATED_KEY_ID = "k1";

type SyncCredentialEncryptionStatus = {
  available: boolean;
  keyRef: string | null;
  mode: "dedicated" | "auth-secret-fallback" | "missing";
};

/** Read an env var, treating blank/whitespace-only as unset. */
const readEnv = (name: string): string | null => {
  const value = process.env[name]?.trim();
  if (!value) return null;
  return value;
};

/**
 * Build the sync credential keyring from the environment, current key first:
 *
 *   1. `SYNC_CREDENTIAL_ENCRYPTION_KEYS` — "id:hex64,id:hex64", first is current.
 *   2. `SYNC_CREDENTIAL_ENCRYPTION_KEY` (+ optional `_KEY_ID`, default "k1") —
 *      the pre-keyring single-key form. Kept so an existing deployment can adopt
 *      the keyring without re-encrypting anything first; when (1) is also set it
 *      is retained as a decrypt-only key.
 *   3. The AUTH_SECRET-derived fallback, always registered decrypt-only under id
 *      "legacy" so rows written before a dedicated key existed still open. It
 *      only becomes the *current* key when nothing else is configured, which
 *      preserves the old dev behaviour (production requires a dedicated key —
 *      see `assertProductionEnv` in src/env.js).
 *
 * Read from `process.env` rather than the validated `env` object so a rotation
 * script (or a test) can change keys without reloading the module graph.
 */
export const buildSyncCredentialKeyring = (): Keyring | null => {
  const entries: KeyringEntry[] = [];

  const keyringVar = readEnv("SYNC_CREDENTIAL_ENCRYPTION_KEYS");
  if (keyringVar) {
    entries.push(...parseKeyringVar(keyringVar, "SYNC_CREDENTIAL_ENCRYPTION_KEYS"));
  }

  const singleKey = readEnv("SYNC_CREDENTIAL_ENCRYPTION_KEY");
  if (singleKey) {
    const id = readEnv("SYNC_CREDENTIAL_ENCRYPTION_KEY_ID") ?? DEFAULT_DEDICATED_KEY_ID;
    entries.push({ id, secret: singleKey, aliases: [id, LEGACY_DEDICATED_KEY_REF] });
  }

  const authSecret = readEnv("AUTH_SECRET");
  if (authSecret) {
    entries.push({
      id: LEGACY_AUTH_SECRET_KEY_ID,
      secret: authSecret,
      aliases: [LEGACY_AUTH_SECRET_KEY_ID, LEGACY_AUTH_SECRET_KEY_REF],
    });
  }

  const deduped = dedupeById(entries);
  const current = deduped[0];
  if (!current) return null;

  return { current, entries: deduped };
};

const requireKeyring = (): Keyring => {
  const keyring = buildSyncCredentialKeyring();
  if (!keyring) {
    throw new Error(
      "Credential encryption is not configured. Set SYNC_CREDENTIAL_ENCRYPTION_KEYS (or SYNC_CREDENTIAL_ENCRYPTION_KEY, or AUTH_SECRET).",
    );
  }
  return keyring;
};

export const getSyncCredentialEncryptionStatus = (): SyncCredentialEncryptionStatus => {
  const keyring = buildSyncCredentialKeyring();

  if (!keyring) return { available: false, keyRef: null, mode: "missing" };

  return {
    available: true,
    keyRef: keyring.current.id,
    mode:
      keyring.current.id === LEGACY_AUTH_SECRET_KEY_ID
        ? "auth-secret-fallback"
        : "dedicated",
  };
};

// ── Legacy (pre-P48-16) sync envelope ────────────────────────────────────────
// `kontax-sync-v1:<base64url(JSON{iv,tag,payload})>`, key = sha256(secret), a
// fixed AAD and no key id. Decrypt-only: nothing writes this format any more.

const decodeLegacyEnvelope = (reference: string) => {
  const [prefix, encoded] = reference.split(":", 2);

  if (prefix !== LEGACY_ENVELOPE_PREFIX || !encoded) {
    throw new Error("Credential reference is not a valid Kontax sync envelope.");
  }

  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<
    string,
    string
  >;
};

const decryptLegacyCredentialJson = (
  keyring: Keyring,
  credentialReference: string,
  encryptionKeyRef: string | null | undefined,
): { plaintext: string; keyId: string } => {
  const envelope = decodeLegacyEnvelope(credentialReference);

  if (!envelope.iv || !envelope.tag || !envelope.payload) {
    throw new Error("Credential envelope is missing required encrypted fields.");
  }

  let lastError: unknown = null;

  for (const entry of candidateEntries(keyring, encryptionKeyRef)) {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        createHash("sha256").update(entry.secret).digest(),
        Buffer.from(envelope.iv, "base64url"),
      );
      decipher.setAAD(Buffer.from(LEGACY_AAD_CONTEXT, "utf8"));
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));

      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.payload, "base64url")),
        decipher.final(),
      ]).toString("utf8");

      return { plaintext, keyId: entry.id };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Stored credentials could not be decrypted with any configured key${
      lastError instanceof Error ? ` (${lastError.message})` : ""
    }.`,
  );
};

// ── Core envelope over an arbitrary JSON-serialisable credential payload ─────
// Provider-specific wrappers below give callers a typed surface.

const encryptCredentialJson = (payload: unknown) => {
  const keyring = requireKeyring();
  const { encoded, keyId } = encryptEnvelope(
    keyring,
    ENVELOPE_PREFIX,
    HKDF_INFO,
    Buffer.from(JSON.stringify(payload), "utf8"),
  );

  return { credentialReference: encoded, encryptionKeyRef: keyId };
};

export type DecryptedSyncCredential<T> = {
  payload: T;
  /** Id of the key the row was actually encrypted under. */
  keyId: string;
  /** True when the row is not on the current key / current envelope version. */
  stale: boolean;
};

/**
 * Decrypt by the key the envelope names, falling back to the stored
 * `encryptionKeyRef` hint for legacy v1 rows that carry no embedded key id.
 */
const decryptCredentialJsonWithMeta = <T>(
  credentialReference: string,
  encryptionKeyRef?: string | null,
): DecryptedSyncCredential<T> => {
  const keyring = requireKeyring();

  if (credentialReference.startsWith(`${ENVELOPE_PREFIX}:`)) {
    const { plaintext, keyId } = decryptEnvelope(
      keyring,
      ENVELOPE_PREFIX,
      HKDF_INFO,
      credentialReference,
    );
    return {
      payload: JSON.parse(plaintext.toString("utf8")) as T,
      keyId,
      stale: keyId !== keyring.current.id,
    };
  }

  const { plaintext, keyId } = decryptLegacyCredentialJson(
    keyring,
    credentialReference,
    encryptionKeyRef,
  );

  // Always stale: even under the current key, a v1 row should be upgraded to
  // the v2 envelope (HKDF-derived key, key id + version bound into the AAD).
  return { payload: JSON.parse(plaintext) as T, keyId, stale: true };
};

const decryptCredentialJson = <T>(
  credentialReference: string,
  encryptionKeyRef?: string | null,
): T => decryptCredentialJsonWithMeta<T>(credentialReference, encryptionKeyRef).payload;

/**
 * Read a credential and, if it is not on the current key/envelope, produce the
 * re-encrypted columns to persist. Throws when the row cannot be decrypted at
 * all — the rotation script needs to tell "already current" apart from
 * "unreadable", which a null return cannot express.
 *
 * Deliberately side-effect free: the caller owns the DB write, so this stays
 * usable from the sync runner, the rotation script and tests alike.
 */
export const rotateSyncCredential = (
  credentialReference: string,
  encryptionKeyRef?: string | null,
): {
  rotated: boolean;
  /** The key the row was read under. */
  previousKeyId: string;
  credentialReference: string;
  encryptionKeyRef: string;
} => {
  const decrypted = decryptCredentialJsonWithMeta<unknown>(
    credentialReference,
    encryptionKeyRef,
  );

  if (!decrypted.stale) {
    return {
      rotated: false,
      previousKeyId: decrypted.keyId,
      credentialReference,
      encryptionKeyRef: decrypted.keyId,
    };
  }

  const reencrypted = encryptCredentialJson(decrypted.payload);
  return { rotated: true, previousKeyId: decrypted.keyId, ...reencrypted };
};

/**
 * Lazy-rotation convenience for hot paths: the columns to persist, or `null`
 * when the row is already current — or cannot be read, in which case the
 * caller's own decrypt surfaces the real error.
 */
export const reencryptSyncCredentialIfStale = (
  credentialReference: string,
  encryptionKeyRef?: string | null,
): { credentialReference: string; encryptionKeyRef: string } | null => {
  try {
    const result = rotateSyncCredential(credentialReference, encryptionKeyRef);
    if (!result.rotated) return null;
    return {
      credentialReference: result.credentialReference,
      encryptionKeyRef: result.encryptionKeyRef,
    };
  } catch {
    return null;
  }
};

export const encryptSyncCredentialPayload = (payload: SyncCredentialPayload) =>
  encryptCredentialJson(payload);

export const decryptSyncCredentialPayload = (
  credentialReference: string,
  encryptionKeyRef?: string | null,
): SyncCredentialPayload =>
  decryptCredentialJson<SyncCredentialPayload>(credentialReference, encryptionKeyRef);

// P27-01: Google OAuth token envelope wrappers.
export const encryptGoogleSyncCredential = (payload: GoogleSyncCredentialPayload) =>
  encryptCredentialJson(payload);

export const decryptGoogleSyncCredential = (
  credentialReference: string,
  encryptionKeyRef?: string | null,
): GoogleSyncCredentialPayload =>
  decryptCredentialJson<GoogleSyncCredentialPayload>(credentialReference, encryptionKeyRef);

// P27-04: Microsoft OAuth token envelope wrappers.
export const encryptMicrosoftSyncCredential = (payload: MicrosoftSyncCredentialPayload) =>
  encryptCredentialJson(payload);

export const decryptMicrosoftSyncCredential = (
  credentialReference: string,
  encryptionKeyRef?: string | null,
): MicrosoftSyncCredentialPayload =>
  decryptCredentialJson<MicrosoftSyncCredentialPayload>(credentialReference, encryptionKeyRef);
