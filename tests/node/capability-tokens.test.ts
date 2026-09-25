import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  calTokenColumns,
  decryptDisplayToken,
  displayTokenKeyStatus,
  encryptDisplayToken,
  findMemberByInviteToken,
  findShareByToken,
  findUserByCalToken,
  hashToken,
  inviteTokenColumns,
  resolveDisplayToken,
  shareTokenColumns,
} from "../../src/server/capability-tokens";
import { encryptSyncCredentialPayload } from "../../src/server/sync-credentials";

// P48-18: calendar, share and invite tokens are stored as sha256 hashes (plus
// an encrypted display copy for the two the UI shows again). These cases pin
// the hash format, the display-copy envelope, and the hash-first / legacy
// fallback order of the lookup helpers.

const K1 = "11".repeat(32);
const K2 = "22".repeat(32);

const KEY_VARS = [
  "SYNC_CREDENTIAL_ENCRYPTION_KEYS",
  "SYNC_CREDENTIAL_ENCRYPTION_KEY",
  "SYNC_CREDENTIAL_ENCRYPTION_KEY_ID",
  "AUTH_SECRET",
] as const;

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

const TOKEN = "Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0"; // shape of randomBytes(24).base64url

test("hashToken is lowercase-hex SHA-256 of the exact string", () => {
  assert.equal(hashToken(TOKEN), createHash("sha256").update(TOKEN, "utf8").digest("hex"));
  assert.match(hashToken(TOKEN), /^[0-9a-f]{64}$/);
  assert.notEqual(hashToken(TOKEN), hashToken(`${TOKEN} `));
  // Known vector.
  assert.equal(hashToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("display copy round-trips, uses its own prefix, and never contains the token", () => {
  withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k1:${K1}` }, () => {
    const encrypted = encryptDisplayToken(TOKEN);
    assert.ok(encrypted.startsWith("kontax-tok-v1:"));
    assert.ok(!encrypted.includes(TOKEN));
    assert.notEqual(encryptDisplayToken(TOKEN), encrypted, "random IV per encryption");
    assert.equal(decryptDisplayToken(encrypted), TOKEN);
  });
});

test("display copy survives key rotation while the old key stays in the keyring", () => {
  const encrypted = withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k1:${K1}` }, () =>
    encryptDisplayToken(TOKEN),
  );
  withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k2:${K2},k1:${K1}` }, () => {
    assert.equal(decryptDisplayToken(encrypted), TOKEN);
  });
});

test("decryptDisplayToken returns null (never throws) when the key is retired or input is bad", () => {
  const encrypted = withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k1:${K1}` }, () =>
    encryptDisplayToken(TOKEN),
  );
  withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k2:${K2}` }, () => {
    assert.equal(decryptDisplayToken(encrypted), null);
    assert.equal(decryptDisplayToken("kontax-tok-v1:not-base64-envelope"), null);
    assert.equal(decryptDisplayToken(null), null);
    assert.equal(decryptDisplayToken(""), null);
  });
  withEnv({}, () => {
    assert.equal(decryptDisplayToken(encrypted), null, "no keyring at all");
  });
});

test("a sync-credential envelope is not accepted as a display copy (distinct prefix + HKDF label)", () => {
  withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k1:${K1}` }, () => {
    const { credentialReference } = encryptSyncCredentialPayload({
      provider: "CARDDAV",
      version: 1,
      username: "u",
      password: TOKEN,
    });
    assert.equal(decryptDisplayToken(credentialReference), null);
    // Even relabelled with the display prefix, the HKDF label + AAD differ.
    const relabelled = credentialReference.replace(/^kontax-sync-v2:/, "kontax-tok-v1:");
    assert.equal(decryptDisplayToken(relabelled), null);
  });
});

test("encryptDisplayToken throws when no key is configured", () => {
  withEnv({}, () => {
    assert.throws(() => encryptDisplayToken(TOKEN), /not configured/);
  });
});

test("resolveDisplayToken: encrypted copy, legacy fallback, unavailable, none", () => {
  withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k1:${K1}` }, () => {
    const encrypted = encryptDisplayToken(TOKEN);
    const hash = hashToken(TOKEN);

    assert.deepEqual(resolveDisplayToken({ hash, encrypted, legacy: null }), {
      status: "ok",
      token: TOKEN,
    });
    // Not-yet-backfilled legacy row.
    assert.deepEqual(resolveDisplayToken({ hash: null, encrypted: null, legacy: TOKEN }), {
      status: "ok",
      token: TOKEN,
    });
    // Display copy that belongs to a different token than the lookup hash.
    assert.deepEqual(
      resolveDisplayToken({ hash: hashToken("something-else"), encrypted, legacy: null }),
      { status: "unavailable" },
    );
    // Hash but no display copy.
    assert.deepEqual(resolveDisplayToken({ hash, encrypted: null, legacy: null }), {
      status: "unavailable",
    });
    assert.deepEqual(resolveDisplayToken({ hash: null, encrypted: null, legacy: null }), {
      status: "none",
    });
  });

  // Key retired → unavailable, not a throw.
  const encrypted = withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k1:${K1}` }, () =>
    encryptDisplayToken(TOKEN),
  );
  withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k2:${K2}` }, () => {
    assert.deepEqual(resolveDisplayToken({ hash: hashToken(TOKEN), encrypted, legacy: null }), {
      status: "unavailable",
    });
  });
});

test("write column sets store the hash, never the plaintext, and null the legacy column", () => {
  withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k1:${K1}` }, () => {
    const cal = calTokenColumns(TOKEN);
    assert.equal(cal.calTokenHash, hashToken(TOKEN));
    assert.equal(cal.calToken, null);
    assert.equal(decryptDisplayToken(cal.calTokenEncrypted), TOKEN);

    const share = shareTokenColumns(TOKEN);
    assert.equal(share.tokenHash, hashToken(TOKEN));
    assert.equal(share.token, null);
    assert.equal(decryptDisplayToken(share.tokenEncrypted), TOKEN);

    const invite = inviteTokenColumns(TOKEN);
    assert.deepEqual(invite, { inviteTokenHash: hashToken(TOKEN), inviteToken: null });

    for (const columns of [cal, share, invite]) {
      assert.ok(!JSON.stringify(columns).includes(TOKEN), "no plaintext in any written column");
    }
  });
});

/** A fake finder over an in-memory "table", recording every `where` it was asked. */
const fakeFinder = <Row extends Record<string, unknown>>(rows: Row[]) => {
  const calls: Record<string, unknown>[] = [];
  const find = async (where: Record<string, unknown>) => {
    calls.push(where);
    const [[column, value]] = Object.entries(where) as [[string, unknown]];
    return rows.find((row) => row[column] === value) ?? null;
  };
  return { calls, find };
};

test("lookup helpers try the hash column first and fall back to the legacy plaintext column", async () => {
  const hashed = { id: "hashed", calTokenHash: hashToken("new-token-xxxxxxxxxxxxxxxxxxxxxx"), calToken: null };
  const legacy = { id: "legacy", calTokenHash: null, calToken: "old-token-xxxxxxxxxxxxxxxxxxxxxx" };

  const byHash = fakeFinder([hashed, legacy]);
  assert.equal((await findUserByCalToken("new-token-xxxxxxxxxxxxxxxxxxxxxx", byHash.find))?.id, "hashed");
  assert.deepEqual(byHash.calls, [{ calTokenHash: hashToken("new-token-xxxxxxxxxxxxxxxxxxxxxx") }]);

  const byLegacy = fakeFinder([hashed, legacy]);
  assert.equal((await findUserByCalToken("old-token-xxxxxxxxxxxxxxxxxxxxxx", byLegacy.find))?.id, "legacy");
  assert.deepEqual(byLegacy.calls, [
    { calTokenHash: hashToken("old-token-xxxxxxxxxxxxxxxxxxxxxx") },
    { calToken: "old-token-xxxxxxxxxxxxxxxxxxxxxx" },
  ]);

  const miss = fakeFinder([hashed, legacy]);
  assert.equal(await findUserByCalToken("wrong-xxxxxxxxxxxxxxxxxxxxxxxxxx", miss.find), null);

  // The hash itself is not a usable credential: presenting it is hashed again.
  const hashAsToken = fakeFinder([hashed]);
  assert.equal(await findUserByCalToken(hashed.calTokenHash, hashAsToken.find), null);
});

test("share and invite lookups use their own columns", async () => {
  const share = fakeFinder([{ id: "s1", tokenHash: hashToken("s-new-xxxxxxxxxxxxxxxxxxxxxxxxxx"), token: null }, { id: "s2", tokenHash: null, token: "s-old-xxxxxxxxxxxxxxxxxxxxxxxxxx" }]);
  assert.equal((await findShareByToken("s-new-xxxxxxxxxxxxxxxxxxxxxxxxxx", share.find))?.id, "s1");
  assert.equal((await findShareByToken("s-old-xxxxxxxxxxxxxxxxxxxxxxxxxx", share.find))?.id, "s2");
  assert.deepEqual(share.calls.at(-1), { token: "s-old-xxxxxxxxxxxxxxxxxxxxxxxxxx" });

  const invite = fakeFinder([
    { id: "m1", inviteTokenHash: hashToken("i-new-xxxxxxxxxxxxxxxxxxxxxxxxxx"), inviteToken: null },
    { id: "m2", inviteTokenHash: null, inviteToken: "i-old-xxxxxxxxxxxxxxxxxxxxxxxxxx" },
  ]);
  assert.equal((await findMemberByInviteToken("i-new-xxxxxxxxxxxxxxxxxxxxxxxxxx", invite.find))?.id, "m1");
  assert.equal((await findMemberByInviteToken("i-old-xxxxxxxxxxxxxxxxxxxxxxxxxx", invite.find))?.id, "m2");
  assert.deepEqual(invite.calls.at(-1), { inviteToken: "i-old-xxxxxxxxxxxxxxxxxxxxxxxxxx" });
});

test("lookup helpers short-circuit on empty or oversized tokens without querying", async () => {
  const finder = fakeFinder([{ id: "x", calToken: "" }]);
  assert.equal(await findUserByCalToken("", finder.find), null);
  assert.equal(await findUserByCalToken(null, finder.find), null);
  assert.equal(await findUserByCalToken(undefined, finder.find), null);
  assert.equal(await findUserByCalToken("a".repeat(257), finder.find), null);
  // Shape: real tokens are base64url (or legacy hex), >= 16 chars. Anything else
  // is rejected before a query, so a NUL byte cannot reach Postgres as a 500.
  assert.equal(await findUserByCalToken("abc", finder.find), null);
  assert.equal(await findUserByCalToken(`${"a".repeat(20)}\u0000`, finder.find), null);
  assert.equal(await findUserByCalToken(`${"a".repeat(20)}/../x`, finder.find), null);
  assert.deepEqual(finder.calls, []);
});

test("displayTokenKeyStatus tracks key rotation: current → stale → unreadable", () => {
  const written = withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k1:${K1}` }, () => {
    const enc = encryptDisplayToken("cal-token-abc");
    assert.equal(displayTokenKeyStatus(enc), "current");
    return enc;
  });

  withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k2:${K2},k1:${K1}` }, () => {
    // k1 retired but still configured: readable, needs re-encryption.
    assert.equal(displayTokenKeyStatus(written), "stale");
    const reencrypted = encryptDisplayToken(decryptDisplayToken(written)!);
    assert.equal(displayTokenKeyStatus(reencrypted), "current");
    assert.equal(decryptDisplayToken(reencrypted), "cal-token-abc");
  });

  withEnv({ SYNC_CREDENTIAL_ENCRYPTION_KEYS: `k2:${K2}` }, () => {
    // k1 removed before rotation: the old copy can no longer be opened.
    assert.equal(displayTokenKeyStatus(written), "unreadable");
  });

  assert.equal(displayTokenKeyStatus("not-an-envelope"), "unreadable");
});
