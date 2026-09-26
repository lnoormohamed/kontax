import assert from "node:assert/strict";
import crypto from "node:crypto";
import { beforeEach, mock, test } from "node:test";

import { createFakePrisma } from "./_fake-prisma";

/**
 * P49A-19 item 1 — "Regenerating 2FA recovery codes discards the new codes".
 *
 * The settings UI called `regenerateRecoveryCodes()`, which replaced the stored
 * set, and then ignored `result.recoveryCodes`: the old codes stopped working
 * and the new ones were never shown. These tests pin the server half of the
 * contract the fixed UI relies on:
 *
 *   - the codes regenerate returns are exactly the codes whose hashes are
 *     stored, and the old codes stop working;
 *   - a failed regenerate leaves the old codes working;
 *   - a recovery code redeems once only, including under concurrency;
 *   - a second enrolment confirm can't silently replace the codes just shown.
 *
 * totp.ts is a "use server" module; its session, rate-limit, crypto and DB
 * boundaries are mocked so the real action bodies run without Postgres/Redis.
 */

const USER_ID = "user_1";

let currentDb: unknown;
mock.module("~/server/db", {
  namedExports: {
    db: new Proxy(
      {},
      { get: (_t, prop) => (currentDb as Record<string, unknown>)[prop as string] },
    ),
  },
});

let pendingJti = 0;
mock.module("~/server/auth", {
  namedExports: {
    auth: async () => ({ user: { id: USER_ID } }),
    authIncludingPendingTotp: async () => ({
      user: { id: USER_ID },
      pendingTotp: true,
      jti: `jti_${++pendingJti}`,
    }),
  },
});

mock.module("~/server/auth/require-session", {
  namedExports: {
    requireSession: async () => ({ user: { id: USER_ID } }),
    isSessionError: () => false,
  },
});

mock.module("~/server/rate-limit", {
  namedExports: {
    checkRateLimit: async () => ({ allowed: true }),
    rateLimiters: { totpChallenge: {}, totpRecovery: {} },
  },
});

const VALID_TOTP = "123456";
mock.module("~/server/totp-crypto", {
  namedExports: {
    createTotpSecret: () => "SECRET",
    generateTotpUri: () => "otpauth://totp/test",
    encryptPayload: (p: unknown) => JSON.stringify(p),
    decryptPayload: (t: string) => JSON.parse(t) as unknown,
    encryptTotp: (s: string) => `enc:${s}`,
    decryptTotp: (s: string) => s.replace(/^enc:/, ""),
    verifyTotpToken: (_secret: string, code: string) => code === VALID_TOTP,
  },
});

const { confirmTotpEnrolment, redeemTotpRecoveryCode, regenerateRecoveryCodes } = await import(
  "../../src/app/actions/totp"
);

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

let fake: ReturnType<typeof createFakePrisma>;

const storedHashes = () =>
  fake
    .rows("totpRecoveryCode")
    .filter((r) => r.userId === USER_ID)
    .map((r) => r.codeHash as string)
    .sort();

const seedEnabledUserWithCodes = (codes: string[]) => {
  fake.seed("user", { id: USER_ID, email: "u@example.invalid", totpEnabled: true, totpSecret: "enc:SECRET" });
  for (const c of codes) fake.seed("totpRecoveryCode", { userId: USER_ID, codeHash: sha256(c), usedAt: null });
};

const OLD_CODES = ["AAAAAAAAA1", "AAAAAAAAA2", "AAAAAAAAA3"];

beforeEach(() => {
  fake = createFakePrisma();
  currentDb = fake.client;
});

test("regenerate returns exactly the codes whose hashes are stored, and the old codes stop working", async () => {
  seedEnabledUserWithCodes(OLD_CODES);

  const result = await regenerateRecoveryCodes();
  assert.ok("success" in result, JSON.stringify(result));
  const codes = result.recoveryCodes;

  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8, "codes are distinct");
  for (const c of codes) assert.match(c, /^[0-9A-F]{10}$/);
  assert.deepEqual(storedHashes(), codes.map(sha256).sort(), "stored set == shown set");

  // Through the real redemption path: an old code is refused, a new one works.
  assert.deepEqual(await redeemTotpRecoveryCode(OLD_CODES[0]!), { error: "INVALID_RECOVERY_CODE" });
  assert.deepEqual(await redeemTotpRecoveryCode(codes[3]!.toLowerCase()), { success: true, remaining: 7 });
});

test("a failed regenerate leaves the old codes working", async () => {
  seedEnabledUserWithCodes(OLD_CODES);
  const before = storedHashes();

  // Fail the write of the new set, after the old set was deleted in the same
  // transaction — the transaction must roll the delete back.
  const delegate = (fake.client as Record<string, Record<string, unknown>>).totpRecoveryCode!;
  delegate.createMany = async () => {
    throw new Error("simulated DB failure");
  };
  const silence = mock.method(console, "error", () => undefined);
  try {
    const result = await regenerateRecoveryCodes();
    assert.deepEqual(result, { error: "REGENERATE_FAILED" });
    assert.equal(silence.mock.callCount(), 1, "the failure is logged");
  } finally {
    silence.mock.restore();
  }

  assert.deepEqual(storedHashes(), before, "old hashes untouched");
  assert.deepEqual(await redeemTotpRecoveryCode(OLD_CODES[1]!), { success: true, remaining: 2 });
});

test("regenerate refuses when 2FA is off and stores nothing", async () => {
  fake.seed("user", { id: USER_ID, email: "u@example.invalid", totpEnabled: false });
  assert.deepEqual(await regenerateRecoveryCodes(), { error: "TOTP_NOT_ENABLED" });
  assert.equal(fake.rows("totpRecoveryCode").length, 0);
});

test("a recovery code redeems once only", async () => {
  seedEnabledUserWithCodes(OLD_CODES);
  assert.deepEqual(await redeemTotpRecoveryCode(OLD_CODES[0]!), { success: true, remaining: 2 });
  assert.deepEqual(await redeemTotpRecoveryCode(OLD_CODES[0]!), { error: "INVALID_RECOVERY_CODE" });
});

test("two concurrent redemptions of the same code: exactly one succeeds", async () => {
  seedEnabledUserWithCodes(OLD_CODES);

  const results = await Promise.all([
    redeemTotpRecoveryCode(OLD_CODES[2]!),
    redeemTotpRecoveryCode(OLD_CODES[2]!),
  ]);

  // Prove the race was actually exercised: both lookups ran before either
  // claim, so a plain `update({ where: { id } })` would have let both through.
  const ops = fake.calls
    .filter((c) => c.model === "totpRecoveryCode" && (c.op === "findFirst" || c.op === "updateMany"))
    .map((c) => c.op);
  assert.deepEqual(ops, ["findFirst", "findFirst", "updateMany", "updateMany"]);

  const ok = results.filter((r) => "success" in r);
  assert.equal(ok.length, 1, JSON.stringify(results));
  assert.ok(results.some((r) => "error" in r && r.error === "INVALID_RECOVERY_CODE"));
  assert.equal(fake.rows("totpRecoveryCode").filter((r) => r.usedAt !== null).length, 1);
});

test("enrolment stores the codes it returns; a second confirm can't replace them", async () => {
  fake.seed("user", { id: USER_ID, email: "u@example.invalid", totpEnabled: false, emailVerified: new Date() });
  const pendingToken = JSON.stringify({ secret: "SECRET", expiresAt: Date.now() + 60_000 });

  const first = await confirmTotpEnrolment({ totpCode: VALID_TOTP, pendingToken });
  assert.ok("success" in first, JSON.stringify(first));
  assert.deepEqual(storedHashes(), first.recoveryCodes.map(sha256).sort());

  // Double submit / second tab / replay of the same still-valid pending token.
  const second = await confirmTotpEnrolment({ totpCode: VALID_TOTP, pendingToken });
  assert.deepEqual(second, { error: "TOTP_ALREADY_ENABLED" });
  assert.deepEqual(storedHashes(), first.recoveryCodes.map(sha256).sort(), "first set still stored");
});
