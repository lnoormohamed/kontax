import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import bcrypt from "bcryptjs";

import { createFakePrisma } from "./_fake-prisma";

/**
 * P49A-13 (A-28): adding a CardDAV connection (`createSyncAccount`) or swapping
 * its credentials (`attachSyncCredentials`) decides where contacts are exported
 * to, so both require the Kontax password, verified server-side before any
 * outbound request or write. Without it a hijacked session could repoint a
 * two-way sync at an attacker's server.
 *
 * The real actions run against the in-memory Prisma stand-in; discovery and
 * credential encryption are captured instead of performed.
 */

const USER = "user_1";
const PASSWORD = "correct horse battery staple";

let currentDb: unknown;
mock.module("~/server/db", {
  namedExports: {
    db: new Proxy({}, { get: (_t, prop) => (currentDb as Record<string, unknown>)[prop as string] }),
  },
});
mock.module("~/server/auth/require-session", {
  namedExports: {
    requireUserId: async () => USER,
    requireSession: async () => ({ user: { id: USER } }),
    isSessionError: () => false,
    sessionErrorMessage: () => "",
    SessionError: class SessionError extends Error {},
  },
});
mock.module("~/server/billing", {
  namedExports: {
    assertCanCreateContactsTx: async () => undefined,
    assertCanCreateSyncAccount: async () => undefined,
    assertCanCreateSyncAccountTx: async () => undefined,
    assertCanUseCardDavSync: async () => undefined,
    lockUserForPlanCheck: async () => undefined,
  },
});
const discoveries: unknown[] = [];
mock.module("~/server/carddav", {
  namedExports: {
    CardDavPreflightError: class CardDavPreflightError extends Error {},
    discoverCardDavAccount: async (args: unknown) => {
      discoveries.push(args);
      throw new Error("discovery reached (step-up passed)");
    },
    pushCardDavContact: async () => ({ href: "/x.vcf", etag: null }),
  },
});
mock.module("~/server/sync-credentials", {
  namedExports: {
    decryptSyncCredentialPayload: () => ({ username: "u", password: "p" }),
    encryptSyncCredentialPayload: () => ({ credentialReference: "enc", encryptionKeyRef: "k1" }),
    getSyncCredentialEncryptionStatus: () => ({ available: true }),
  },
});
// The step-up also grants the 15-minute sync re-auth, so the first-sync
// setup right after doesn't ask for the password again (Fable re-check, A).
const elevations: Array<{ userId: string; jti: string }> = [];
const realElevation = await import("~/server/sync-elevation");
mock.module("~/server/sync-elevation", {
  namedExports: {
    ...realElevation,
    getCurrentElevationContext: async () => ({ userId: USER, jti: "jti_1" }),
    issueSyncSettingsElevation: async (userId: string, jti: string) => {
      elevations.push({ userId, jti });
    },
  },
});
mock.module("next/cache", {
  namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined },
});

const { attachSyncCredentials, createSyncAccount } = await import("~/app/actions/sync");

let fake: ReturnType<typeof createFakePrisma>;

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

const PREV = { ok: false, error: null };

const seed = (password: string) => {
  fake.seed("user", { id: USER, email: "u@example.invalid", password });
  fake.seed("syncAccount", {
    id: "acct_1",
    userId: USER,
    status: "ACTIVE",
    provider: "CARDDAV",
    retiredAt: null,
    credentialReference: "old-enc",
    credentialVersion: 1,
  });
};

beforeEach(() => {
  fake = createFakePrisma();
  currentDb = fake.client;
  discoveries.length = 0;
  elevations.length = 0;
});

const credentialFields = { syncAccountId: "acct_1", username: "attacker@example.invalid", password: "remote-app-pw" };

test("attachSyncCredentials refuses without / with a wrong Kontax password and changes nothing", async () => {
  seed(bcrypt.hashSync(PASSWORD, 4));

  const missing = await attachSyncCredentials(PREV, form(credentialFields));
  assert.equal(missing.ok, false);
  assert.match(missing.error ?? "", /Kontax password/);

  const wrong = await attachSyncCredentials(PREV, form({ ...credentialFields, currentPassword: "guess" }));
  assert.equal(wrong.ok, false);
  assert.match(wrong.error ?? "", /incorrect/);

  const account = fake.rows("syncAccount")[0]!;
  assert.equal(account.credentialReference, "old-enc", "credentials untouched");
  assert.equal(account.status, "ACTIVE");
});

test("attachSyncCredentials with the Kontax password saves the new credentials", async () => {
  seed(bcrypt.hashSync(PASSWORD, 4));
  const result = await attachSyncCredentials(PREV, form({ ...credentialFields, currentPassword: PASSWORD }));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(fake.rows("syncAccount")[0]!.credentialReference, "enc");
  assert.deepEqual(elevations, [{ userId: USER, jti: "jti_1" }], "the step-up counts as the sync re-auth");
});

test("a wrong Kontax password grants no sync re-auth", async () => {
  seed(bcrypt.hashSync(PASSWORD, 4));
  await attachSyncCredentials(PREV, form({ ...credentialFields, currentPassword: "guess" }));
  assert.deepEqual(elevations, []);
});

const createFields = {
  label: "My server",
  baseUrl: "https://dav.example.com/",
  username: "me@example.invalid",
  password: "remote-app-pw",
  syncDirection: "TWO_WAY",
};

test("createSyncAccount refuses without the Kontax password before any discovery request", async () => {
  seed(bcrypt.hashSync(PASSWORD, 4));

  const missing = await createSyncAccount(PREV, form(createFields));
  assert.equal(missing.ok, false);
  assert.match(missing.error ?? "", /Kontax password/);
  const wrong = await createSyncAccount(PREV, form({ ...createFields, currentPassword: "guess" }));
  assert.equal(wrong.ok, false);
  assert.equal(discoveries.length, 0, "no outbound request was made");
  assert.equal(fake.rows("syncAccount").length, 1, "nothing created");

  // With the password it gets as far as discovery (stubbed to fail here).
  const ok = await createSyncAccount(PREV, form({ ...createFields, currentPassword: PASSWORD }));
  assert.equal(discoveries.length, 1, JSON.stringify(ok));
});

test("an account with no password hash is refused (step-up fails closed)", async () => {
  seed("");
  const result = await attachSyncCredentials(PREV, form(credentialFields));
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /Set a Kontax password/);
  assert.equal(fake.rows("syncAccount")[0]!.credentialReference, "old-enc");
});
