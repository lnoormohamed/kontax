import assert from "node:assert/strict";
import crypto from "node:crypto";
import { beforeEach, mock, test } from "node:test";

import bcrypt from "bcryptjs";

import { createFakePrisma } from "./_fake-prisma";

/**
 * P49A-13 (A-28) — durable credentials need a real step-up, and a password
 * change / reset revokes API tokens.
 *
 *   - `createApiToken` refuses without the password (and with a wrong one), and
 *     mints a token with it. An account with no password hash is refused —
 *     the helper fails closed unless a caller opts in (Fable review).
 *   - `changePassword` and `resetPassword` revoke every live API token in the
 *     same transaction as the password write, and report how many.
 *   - `resetPassword` claims its token atomically (two concurrent submits of
 *     one link: one wins).
 *   - The step-up bucket only counts wrong passwords: a correct password gives
 *     its point back, five wrong ones still lock the check.
 *
 * The real action bodies, step-up helper and (in-memory) rate limiter run;
 * the session, DB, billing and email boundaries are mocked.
 */

const USER_ID = "user_1";
const PASSWORD = "correct horse battery staple";
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

let currentDb: unknown;
mock.module("~/server/db", {
  namedExports: {
    db: new Proxy({}, { get: (_t, prop) => (currentDb as Record<string, unknown>)[prop as string] }),
  },
});

let sessionUserId = USER_ID;
mock.module("~/server/auth/require-session", {
  namedExports: {
    requireUserId: async () => sessionUserId,
    requireSession: async () => ({ user: { id: sessionUserId, email: "u@example.invalid" } }),
    isSessionError: () => false,
  },
});

mock.module("~/server/auth", {
  namedExports: {
    auth: async () => ({ user: { id: sessionUserId } }),
    signOut: async () => undefined,
  },
});

mock.module("~/server/billing", {
  namedExports: {
    getUserBillingContext: async () => ({ entitlements: { apiAccessEnabled: true } }),
  },
});

mock.module("next/cache", {
  namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined },
});
mock.module("next/headers", {
  namedExports: { headers: async () => new Headers() },
});
mock.module("~/server/session-validation-cache", {
  namedExports: { invalidateSessionValidation: async () => undefined },
});
const davCacheInvalidations: string[] = [];
mock.module("~/server/app-passwords", {
  namedExports: {
    invalidateDavCredentialCacheForUser: async (userId: string) => {
      davCacheInvalidations.push(userId);
    },
    formatAppPasswordToken: (t: string) => t,
    generateAppPasswordToken: () => "token",
    hashAppPassword: async () => "hash",
    listUserAppPasswords: async () => [],
    revokeUserAppPassword: async () => true,
  },
});
mock.module("~/server/billing-emails", {
  namedExports: { sendAccountDeletionScheduledEmail: async () => undefined },
});
mock.module("~/server/email-change-revert", {
  namedExports: {
    EMAIL_CHANGE_REVERT_HOURS: 72,
    REVERT_FIELDS_CLEARED: {},
    sendEmailChangeNotice: async () => undefined,
  },
});
mock.module("~/server/email-verification", {
  namedExports: {
    sendVerificationEmail: async () => undefined,
    generateVerificationToken: () => ({ plaintext: "p", hash: "h" }),
  },
});
mock.module("~/server/email", { namedExports: { sendEmail: async () => ({ success: true }) } });
mock.module("~/server/render-email", {
  namedExports: { renderEmail: async () => ({ html: "", text: "" }) },
});
mock.module("~/emails/password-reset", { defaultExport: () => null });

const { createApiToken } = await import("../../src/app/actions/api-tokens");
const { changePassword } = await import("../../src/app/actions/account");
const { resetPassword } = await import("../../src/app/actions/auth");
const { verifyStepUpPassword } = await import("../../src/server/auth/step-up");
const { signOutAllDevices } = await import("../../src/app/actions/app-passwords");

let fake: ReturnType<typeof createFakePrisma>;
let userSeq = 0;

/** A fresh user id per test: the real in-memory step-up bucket is per user. */
const seedUser = (password: string = PASSWORD_HASH) => {
  sessionUserId = `user_${++userSeq}`;
  fake.seed("user", { id: sessionUserId, email: `${sessionUserId}@example.invalid`, password, sessionVersion: 1 });
  return sessionUserId;
};

const liveTokens = (userId: string) =>
  fake.rows("apiToken").filter((r) => r.userId === userId && r.revokedAt == null);

beforeEach(() => {
  fake = createFakePrisma({ unique: { apiToken: ["tokenHash"] } });
  currentDb = fake.client;
});

// ── API token creation ───────────────────────────────────────────────────────

test("createApiToken refuses without the password and mints nothing", async () => {
  const userId = seedUser();

  assert.deepEqual(await createApiToken({ name: "script", scope: "READ_WRITE" }), {
    ok: false,
    error: "STEP_UP_REQUIRED",
  });
  assert.deepEqual(await createApiToken({ name: "script", scope: "READ_WRITE", currentPassword: "" }), {
    ok: false,
    error: "STEP_UP_REQUIRED",
  });
  assert.deepEqual(await createApiToken({ name: "script", scope: "READ_WRITE", currentPassword: "guess" }), {
    ok: false,
    error: "WRONG_PASSWORD",
  });
  assert.equal(liveTokens(userId).length, 0);
});

test("createApiToken with the password mints a token whose hash is stored", async () => {
  const userId = seedUser();

  const result = await createApiToken({ name: "script", scope: "READ_ONLY", currentPassword: PASSWORD });
  assert.ok(result.ok, JSON.stringify(result));
  assert.match(result.token, /^ktx_live_/);

  const rows = liveTokens(userId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.tokenHash, crypto.createHash("sha256").update(result.token).digest("hex"));
  assert.equal(rows[0]!.scope, "READ_ONLY");
});

test("createApiToken validates its input server-side", async () => {
  seedUser();
  assert.deepEqual(await createApiToken({ name: "  ", scope: "READ_ONLY", currentPassword: PASSWORD }), {
    ok: false,
    error: "NAME_REQUIRED",
  });
  assert.deepEqual(
    await createApiToken({ name: "x", scope: "ADMIN" as "READ_ONLY", currentPassword: PASSWORD }),
    { ok: false, error: "INVALID_INPUT" },
  );
});

test("an account with no password hash is refused, not waved through on its session", async () => {
  const userId = seedUser("");
  assert.deepEqual(await createApiToken({ name: "script", scope: "READ_ONLY" }), {
    ok: false,
    error: "PASSWORD_NOT_SET",
  });
  assert.equal(liveTokens(userId).length, 0);
  // Only an explicit opt-in lets the session stand in for a password.
  assert.equal(await verifyStepUpPassword(userId, "", undefined), "PASSWORD_NOT_SET");
  assert.equal(await verifyStepUpPassword(userId, null, "x", { passwordless: "allow-session" }), "OK");
});

// ── step-up bucket ───────────────────────────────────────────────────────────

test("step-up: correct passwords don't use up the bucket; wrong ones do", async () => {
  const userId = seedUser();
  for (let i = 0; i < 10; i++) {
    assert.equal(await verifyStepUpPassword(userId, PASSWORD_HASH, PASSWORD), "OK", `attempt ${i + 1}`);
  }
  for (let i = 0; i < 5; i++) {
    assert.equal(await verifyStepUpPassword(userId, PASSWORD_HASH, "wrong"), "WRONG_PASSWORD");
  }
  // Locked now — even the right password is refused until the window passes.
  assert.equal(await verifyStepUpPassword(userId, PASSWORD_HASH, PASSWORD), "RATE_LIMIT_EXCEEDED");
});

// ── password change / reset revoke API tokens ────────────────────────────────

const seedTokens = (userId: string, n: number) => {
  for (let i = 0; i < n; i++) {
    fake.seed("apiToken", { userId, name: `t${i}`, tokenHash: `${userId}-h${i}`, revokedAt: null });
  }
};

const seedDevices = (userId: string, n: number) => {
  for (let i = 0; i < n; i++) fake.seed("appPassword", { userId, label: `device ${i}`, revokedAt: null });
};
const liveDevices = (userId: string) =>
  fake.rows("appPassword").filter((r) => r.userId === userId && r.revokedAt == null);

test("changePassword revokes every live API token and says how many", async () => {
  const userId = seedUser();
  seedTokens(userId, 3);
  fake.seed("apiToken", { userId, name: "old", tokenHash: `${userId}-old`, revokedAt: new Date(0) });
  seedTokens("someone_else", 1);

  const result = await changePassword({ currentPassword: PASSWORD, newPassword: "a brand new password" });
  assert.deepEqual(result, { success: true, revokedApiTokens: 3, activeAppPasswords: 0 });
  assert.equal(liveTokens(userId).length, 0);
  assert.equal(liveTokens("someone_else").length, 1, "other users' tokens untouched");
  assert.equal(
    fake.rows("apiToken").find((r) => r.name === "old")!.revokedAt!.valueOf(),
    new Date(0).valueOf(),
    "an already-revoked token keeps its revocation time",
  );
});

test("changePassword with the wrong current password revokes nothing", async () => {
  const userId = seedUser();
  seedTokens(userId, 2);
  const result = await changePassword({ currentPassword: "wrong", newPassword: "a brand new password" });
  assert.deepEqual(result, { error: "CURRENT_PASSWORD_INCORRECT" });
  assert.equal(liveTokens(userId).length, 2);
});

const RESET_TOKEN = "reset-token-plaintext";
const seedResetToken = (userId: string) =>
  fake.seed("passwordResetToken", {
    userId,
    tokenHash: crypto.createHash("sha256").update(RESET_TOKEN).digest("hex"),
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
  });

test("resetPassword revokes every live API token", async () => {
  const userId = seedUser();
  seedTokens(userId, 2);
  seedResetToken(userId);

  const result = await resetPassword({ plaintextToken: RESET_TOKEN, newPassword: "a brand new password" });
  assert.deepEqual(result, { success: true, revokedApiTokens: 2, revokedAppPasswords: 0 });
  assert.equal(liveTokens(userId).length, 0);
});

// ── app passwords (Fable review) ─────────────────────────────────────────────

test("resetPassword revokes every CardDAV app password and drops the DAV credential cache", async () => {
  const userId = seedUser();
  seedDevices(userId, 2);
  seedDevices("someone_else", 1);
  seedResetToken(userId);
  davCacheInvalidations.length = 0;

  const result = await resetPassword({ plaintextToken: RESET_TOKEN, newPassword: "a brand new password" });
  assert.deepEqual(result, { success: true, revokedApiTokens: 0, revokedAppPasswords: 2 });
  assert.equal(liveDevices(userId).length, 0);
  assert.equal(liveDevices("someone_else").length, 1, "other users' devices untouched");
  assert.deepEqual(davCacheInvalidations, [userId], "cached CardDAV verifications are dropped");
});

test("a failed reset (link already used) revokes no devices", async () => {
  const userId = seedUser();
  seedDevices(userId, 1);
  seedResetToken(userId);
  fake.rows("passwordResetToken")[0]!.usedAt = new Date();
  assert.deepEqual(
    await resetPassword({ plaintextToken: RESET_TOKEN, newPassword: "a brand new password" }),
    { error: "TOKEN_INVALID" },
  );
  assert.equal(liveDevices(userId).length, 1);
});

test("changePassword keeps devices working but reports how many are signed in", async () => {
  const userId = seedUser();
  seedDevices(userId, 2);
  const result = await changePassword({ currentPassword: PASSWORD, newPassword: "a brand new password" });
  assert.deepEqual(result, { success: true, revokedApiTokens: 0, activeAppPasswords: 2 });
  assert.equal(liveDevices(userId).length, 2);
});

test("signOutAllDevices revokes every app password and drops the DAV cache", async () => {
  const userId = seedUser();
  seedDevices(userId, 3);
  seedDevices("someone_else", 1);
  davCacheInvalidations.length = 0;

  assert.deepEqual(await signOutAllDevices(), { ok: true, revoked: 3 });
  assert.equal(liveDevices(userId).length, 0);
  assert.equal(liveDevices("someone_else").length, 1);
  assert.deepEqual(davCacheInvalidations, [userId]);
  assert.deepEqual(await signOutAllDevices(), { ok: true, revoked: 0 }, "idempotent");
});

test("resetPassword: two concurrent submits of one link — exactly one wins", async () => {
  const userId = seedUser();
  seedResetToken(userId);

  const results = await Promise.all([
    resetPassword({ plaintextToken: RESET_TOKEN, newPassword: "first new password" }),
    resetPassword({ plaintextToken: RESET_TOKEN, newPassword: "second new password" }),
  ]);
  assert.equal(results.filter((r) => "success" in r).length, 1, JSON.stringify(results));
  assert.ok(results.some((r) => "error" in r && r.error === "TOKEN_INVALID"));

  // The stored password is the winner's, not a blend of both requests.
  const winner = results.findIndex((r) => "success" in r);
  const stored = fake.rows("user").find((r) => r.id === userId)!.password as string;
  assert.ok(await bcrypt.compare(winner === 0 ? "first new password" : "second new password", stored));
});
