import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { test } from "node:test";

import {
  decryptSyncCredentialPayload,
  encryptSyncCredentialPayload,
  getSyncCredentialEncryptionStatus,
  rotateSyncCredential,
  type SyncCredentialPayload,
} from "../../src/server/sync-credentials";
import { decryptTotp, encryptTotp, isTotpCiphertextStale } from "../../src/server/totp-crypto";

// P48-16: provider credentials and TOTP secrets are encrypted under a keyring
// so a key can be rotated without a maintenance window. These cases pin the
// three things that make that safe: old keys keep decrypting, the current key
// is the one that writes, and every pre-keyring ciphertext still opens.

const K1 = "11".repeat(32);
const K2 = "22".repeat(32);
const AUTH_SECRET = "test-auth-secret-value-at-least-32-chars";

const PAYLOAD: SyncCredentialPayload = {
  provider: "CARDDAV",
  version: 1,
  username: "dav-user",
  password: "dav-password",
  note: "fastmail",
};

const KEY_VARS = [
  "SYNC_CREDENTIAL_ENCRYPTION_KEYS",
  "SYNC_CREDENTIAL_ENCRYPTION_KEY",
  "SYNC_CREDENTIAL_ENCRYPTION_KEY_ID",
  "TOTP_ENCRYPTION_KEYS",
  "TOTP_ENCRYPTION_KEY",
  "AUTH_SECRET",
] as const;

/** Run `fn` with exactly the given key vars set; everything else cleared. */
const withEnv = <T>(vars: Partial<Record<(typeof KEY_VARS)[number], string>>, fn: () => T): T => {
  const saved = new Map<string, string | undefined>();
  for (const name of KEY_VARS) {
    saved.set(name, process.env[name]);
    const next = vars[name];
    if (next === undefined) delete process.env[name];
    else process.env[name] = next;
  }
  try {
    return fn();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
};

/** Build a pre-P48-16 `kontax-sync-v1` envelope: sha256(secret), fixed AAD. */
const legacyV1Envelope = (secret: string, payload: unknown): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), iv);
  cipher.setAAD(Buffer.from("kontax-sync-credentials", "utf8"));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const body = {
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    payload: encrypted.toString("base64url"),
  };
  return `kontax-sync-v1:${Buffer.from(JSON.stringify(body), "utf8").toString("base64url")}`;
};

test("encrypting uses the first keyring entry and records its id", () => {
  withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k1:${K1}` }, () => {
    const status = getSyncCredentialEncryptionStatus();
    assert.equal(status.available, true);
    assert.equal(status.keyRef, "k1");
    assert.equal(status.mode, "dedicated");

    const encrypted = encryptSyncCredentialPayload(PAYLOAD);
    assert.equal(encrypted.encryptionKeyRef, "k1");
    assert.ok(encrypted.credentialReference.startsWith("kontax-sync-v2:"));
    assert.deepEqual(decryptSyncCredentialPayload(encrypted.credentialReference), PAYLOAD);
  });
});

test("adding a new current key keeps old rows readable and rotates them on demand", () => {
  const written = withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k1:${K1}` }, () =>
    encryptSyncCredentialPayload(PAYLOAD),
  );

  // k2 prepended → k2 is now current, k1 retained for decryption.
  const rotated = withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k2:${K2},k1:${K1}` }, () => {
    assert.deepEqual(
      decryptSyncCredentialPayload(written.credentialReference, written.encryptionKeyRef),
      PAYLOAD,
      "a row on the retired key must still decrypt",
    );

    const result = rotateSyncCredential(written.credentialReference, written.encryptionKeyRef);
    assert.equal(result.rotated, true);
    assert.equal(result.previousKeyId, "k1");
    assert.equal(result.encryptionKeyRef, "k2");
    assert.deepEqual(decryptSyncCredentialPayload(result.credentialReference), PAYLOAD);

    // Already on the current key — rotating again is a no-op.
    assert.equal(rotateSyncCredential(result.credentialReference).rotated, false);
    return result;
  });

  // Once every row is rotated, the old key can be dropped.
  withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k2:${K2}` }, () => {
    assert.deepEqual(decryptSyncCredentialPayload(rotated.credentialReference), PAYLOAD);
    assert.throws(
      () => decryptSyncCredentialPayload(written.credentialReference, written.encryptionKeyRef),
      /No encryption key configured for key id "k1"/,
      "dropping a key that still has rows must fail loudly, not silently",
    );
  });
});

test("legacy single-key rows decrypt and rotate onto the keyring", () => {
  const dedicated = "a-dedicated-sync-key-of-at-least-32-chars";

  // Written before P48-16 with SYNC_CREDENTIAL_ENCRYPTION_KEY and no key id:
  // encryptionKeyRef was the literal "env:SYNC_CREDENTIAL_ENCRYPTION_KEY".
  const reference = legacyV1Envelope(dedicated, PAYLOAD);

  withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEY: dedicated }, () => {
    assert.deepEqual(
      decryptSyncCredentialPayload(reference, "env:SYNC_CREDENTIAL_ENCRYPTION_KEY"),
      PAYLOAD,
    );

    const result = rotateSyncCredential(reference, "env:SYNC_CREDENTIAL_ENCRYPTION_KEY");
    assert.equal(result.rotated, true, "a v1 envelope is always due for an upgrade");
    assert.equal(result.encryptionKeyRef, "k1", "default id for an unlabelled single key");
    assert.ok(result.credentialReference.startsWith("kontax-sync-v2:"));
    assert.deepEqual(decryptSyncCredentialPayload(result.credentialReference), PAYLOAD);
  });
});

test("legacy AUTH_SECRET-derived rows decrypt under the 'legacy' key id", () => {
  const reference = legacyV1Envelope(AUTH_SECRET, PAYLOAD);

  // A deployment that has since adopted a dedicated key: AUTH_SECRET stays in
  // the ring as a decrypt-only entry so pre-existing rows still open.
  withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k1:${K1}`, AUTH_SECRET }, () => {
    assert.equal(getSyncCredentialEncryptionStatus().mode, "dedicated");

    const result = rotateSyncCredential(reference, "env:AUTH_SECRET:fallback");
    assert.equal(result.previousKeyId, "legacy");
    assert.equal(result.rotated, true);
    assert.equal(result.encryptionKeyRef, "k1");
    assert.deepEqual(decryptSyncCredentialPayload(result.credentialReference), PAYLOAD);
  });

  // With no dedicated key at all, AUTH_SECRET is still the current key — the
  // pre-P48-16 dev behaviour. Production forbids this via assertProductionEnv.
  withEnv({ AUTH_SECRET }, () => {
    const status = getSyncCredentialEncryptionStatus();
    assert.equal(status.mode, "auth-secret-fallback");
    assert.equal(status.keyRef, "legacy");
    assert.deepEqual(decryptSyncCredentialPayload(reference), PAYLOAD);
  });
});

test("a missing keyring is reported rather than silently defaulting", () => {
  withEnv({}, () => {
    assert.deepEqual(getSyncCredentialEncryptionStatus(), {
      available: false,
      keyRef: null,
      mode: "missing",
    });
    assert.throws(
      () => encryptSyncCredentialPayload(PAYLOAD),
      /Credential encryption is not configured/,
    );
  });
});

test("a malformed keyring variable fails loudly", () => {
  withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k1:${K1},k2:not-hex` }, () => {
    assert.throws(
      () => encryptSyncCredentialPayload(PAYLOAD),
      /must be a 64-char hex string/,
    );
  });
});

test("TOTP secrets share the envelope and keyring, and legacy blobs still open", () => {
  const secret = "JBSWY3DPEHPK3PXP";

  // Pre-P48-16 TOTP format: bare base64url of iv|tag|ciphertext under the raw
  // key bytes, no AAD, no key id.
  const legacyTotpBlob = withEnv({ TOTP_ENCRYPTION_KEY: K1 }, () => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(K1, "hex"), iv);
    const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
  });

  withEnv({ TOTP_ENCRYPTION_KEY: K1 }, () => {
    assert.equal(decryptTotp(legacyTotpBlob), secret, "legacy TOTP blob must still decrypt");
    assert.equal(isTotpCiphertextStale(legacyTotpBlob), true);

    const fresh = encryptTotp(secret);
    assert.ok(fresh.startsWith("kontax-totp-v2:"));
    assert.equal(decryptTotp(fresh), secret);
    assert.equal(isTotpCiphertextStale(fresh), false);
  });

  // Rotate: t2 current, t1 retained. Old ciphertext still reads, new writes use t2.
  withEnv({ TOTP_ENCRYPTION_KEYS: `t2:${K2},t1:${K1}`, TOTP_ENCRYPTION_KEY: K1 }, () => {
    assert.equal(decryptTotp(legacyTotpBlob), secret);
    assert.equal(decryptTotp(encryptTotp(secret)), secret);
  });
});
