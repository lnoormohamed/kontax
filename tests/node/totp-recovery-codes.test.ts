import assert from "node:assert/strict";
import crypto from "node:crypto";
import { beforeEach, mock, test } from "node:test";

import bcrypt from "bcryptjs";

import { createFakePrisma } from "./_fake-prisma";

/**
 * P49A-19 item 1 — "Regenerating 2FA recovery codes discards the new codes" —
 * and P49A-13 (step-up + recovery-code hardening).
 *
 * The settings UI called `regenerateRecoveryCodes()`, which replaced the stored
 * set, and then ignored `result.recoveryCodes`: the old codes stopped working
 * and the new ones were never shown. These tests pin the server half of the
 * contract the fixed UI relies on:
 *
 *   - the codes regenerate returns are exactly the codes stored, and the old
 *     codes stop working;
 *   - a failed regenerate leaves the old codes working;
 *   - a recovery code redeems once only, including under concurrency;
 *   - a second enrolment confirm can't silently replace the codes just shown.
 *
 * P49A-13 adds:
 *   - enrolment and regeneration refuse without the password step-up, and
 *     regeneration also needs a current, unreplayed TOTP code;
 *   - a pending-enrolment token only confirms for the account it was minted for
 *     (after the step-up) — pre-P49A-13 tokens without a user id are refused;
 *   - new codes are 16 base32 characters stored as salted scrypt, and codes in
 *     the old 10-character / unsalted SHA-256 form still redeem.
 *
 * totp.ts is a "use server" module; its session, rate-limit, crypto and DB
 * boundaries are mocked so the real action bodies run without Postgres/Redis.
 * The step-up helper and the recovery-code module are the real ones.
 */

const USER_ID = "user_1";
const PASSWORD = "correct horse battery staple";
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

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
    refundRateLimit: async () => undefined,
    rateLimiters: { totpChallenge: {}, totpRecovery: {}, stepUpVerify: {} },
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

const { confirmTotpEnrolment, redeemTotpRecoveryCode, regenerateRecoveryCodes, startTotpEnrolment, getTotpStatus } =
  await import("../../src/app/actions/totp");
const { findMatchingRecoveryCode, newRecoveryCodeSet } = await import("../../src/server/totp-recovery-codes");

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

const NEW_FORMAT = /^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/;

let fake: ReturnType<typeof createFakePrisma>;

const storedRows = () =>
  fake
    .rows("totpRecoveryCode")
    .filter((r) => r.userId === USER_ID)
    .map((r) => ({ id: r.id as string, codeHash: r.codeHash as string }));

const storedHashes = () => storedRows().map((r) => r.codeHash).sort();

/** Each shown code matches a distinct stored row, and nothing else is stored. */
const assertStoredSetIs = async (codes: string[]) => {
  const rows = storedRows();
  assert.equal(rows.length, codes.length, "one stored row per shown code");
  const matched = new Set<string>();
  for (const code of codes) {
    const id = await findMatchingRecoveryCode(code, rows);
    assert.ok(id, `shown code ${code} is stored`);
    matched.add(id);
  }
  assert.equal(matched.size, codes.length, "codes map to distinct rows");
};

const seedEnabledUserWithLegacyCodes = (codes: string[]) => {
  fake.seed("user", {
    id: USER_ID,
    email: "u@example.invalid",
    password: PASSWORD_HASH,
    totpEnabled: true,
    totpSecret: "enc:SECRET",
    lastTotpCounter: null,
  });
  for (const c of codes) fake.seed("totpRecoveryCode", { userId: USER_ID, codeHash: sha256(c), usedAt: null });
};

const OLD_CODES = ["AAAAAAAAA1", "AAAAAAAAA2", "AAAAAAAAA3"];

const regenerate = () => regenerateRecoveryCodes({ currentPassword: PASSWORD, totpCode: VALID_TOTP });

beforeEach(() => {
  fake = createFakePrisma();
  currentDb = fake.client;
});

// ── recovery-code format ─────────────────────────────────────────────────────

test("new recovery codes: 8 distinct 16-char base32 codes, stored as salted scrypt", async () => {
  const { codes, hashes } = await newRecoveryCodeSet();
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  for (const c of codes) assert.match(c, NEW_FORMAT);
  for (const h of hashes) {
    assert.match(h, /^s1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/);
    assert.ok(!codes.some((c) => h.includes(c.replace(/-/g, ""))), "no plaintext in the stored value");
  }
  // Same code, different set → different salt → different stored value.
  const other = await newRecoveryCodeSet();
  assert.notEqual(hashes[0]!.split("$")[1], other.hashes[0]!.split("$")[1]);
});

test("redemption input is forgiving about case, spaces, dashes and 0/1/8 look-alikes", async () => {
  const { codes, hashes } = await newRecoveryCodeSet();
  const rows = hashes.map((codeHash, i) => ({ id: `r${i}`, codeHash }));
  const code = codes[2]!;
  assert.equal(await findMatchingRecoveryCode(code, rows), "r2");
  assert.equal(await findMatchingRecoveryCode(code.toLowerCase(), rows), "r2");
  assert.equal(await findMatchingRecoveryCode(` ${code.replace(/-/g, " ")} `, rows), "r2");
  assert.equal(await findMatchingRecoveryCode(code.replace(/-/g, ""), rows), "r2");
  const lookalike = code.replace(/O/g, "0").replace(/I/g, "1").replace(/B/g, "8");
  assert.equal(await findMatchingRecoveryCode(lookalike, rows), "r2");
  assert.equal(await findMatchingRecoveryCode("AAAA-AAAA-AAAA-AAAA", rows), null);
  assert.equal(await findMatchingRecoveryCode("", rows), null);
  assert.equal(await findMatchingRecoveryCode("x".repeat(65), rows), null);
});

test("legacy (10-char, unsalted SHA-256) codes still redeem alongside new ones", async () => {
  const { hashes } = await newRecoveryCodeSet();
  const rows = [
    { id: "legacy", codeHash: sha256("0A1B2C3D4E") },
    ...hashes.map((codeHash, i) => ({ id: `r${i}`, codeHash })),
  ];
  assert.equal(await findMatchingRecoveryCode("0a1b2c3d4e", rows), "legacy");
  assert.equal(await findMatchingRecoveryCode(" 0A1B2C3D4E ", rows), "legacy");
  assert.equal(await findMatchingRecoveryCode("0A1B2C3D4F", rows), null);
});

// ── regenerate ───────────────────────────────────────────────────────────────

test("regenerate returns exactly the codes it stores, and the old codes stop working", async () => {
  seedEnabledUserWithLegacyCodes(OLD_CODES);

  const result = await regenerate();
  assert.ok("success" in result, JSON.stringify(result));
  const codes = result.recoveryCodes;

  assert.equal(codes.length, 8);
  for (const c of codes) assert.match(c, NEW_FORMAT);
  await assertStoredSetIs(codes);

  // Through the real redemption path: an old code is refused, a new one works.
  assert.deepEqual(await redeemTotpRecoveryCode(OLD_CODES[0]!), { error: "INVALID_RECOVERY_CODE" });
  assert.deepEqual(await redeemTotpRecoveryCode(codes[3]!.toLowerCase()), { success: true, remaining: 7 });
});

test("regenerate refuses without the password step-up, and stores nothing", async () => {
  seedEnabledUserWithLegacyCodes(OLD_CODES);
  const before = storedHashes();

  assert.deepEqual(await regenerateRecoveryCodes({ totpCode: VALID_TOTP }), { error: "STEP_UP_REQUIRED" });
  assert.deepEqual(await regenerateRecoveryCodes({ currentPassword: "nope", totpCode: VALID_TOTP }), {
    error: "WRONG_PASSWORD",
  });
  assert.deepEqual(await regenerateRecoveryCodes(), { error: "STEP_UP_REQUIRED" });
  assert.deepEqual(storedHashes(), before);
});

test("regenerate refuses without a valid, unreplayed TOTP code", async () => {
  seedEnabledUserWithLegacyCodes(OLD_CODES);
  const before = storedHashes();

  assert.deepEqual(await regenerateRecoveryCodes({ currentPassword: PASSWORD }), { error: "TOTP_CODE_REQUIRED" });
  assert.deepEqual(await regenerateRecoveryCodes({ currentPassword: PASSWORD, totpCode: "000000" }), {
    error: "INVALID_TOTP_CODE",
  });
  assert.deepEqual(storedHashes(), before);

  assert.ok("success" in (await regenerate()));
  // Same 30-second step again: the code has been spent.
  assert.deepEqual(await regenerate(), { error: "TOTP_CODE_ALREADY_USED" });
});

test("regenerate accepts an unused recovery code instead of a TOTP code (lost phone)", async () => {
  seedEnabledUserWithLegacyCodes(OLD_CODES);
  await redeemTotpRecoveryCode(OLD_CODES[0]!); // used to sign in

  // A used code, or a wrong one, is not a second factor.
  assert.deepEqual(await regenerateRecoveryCodes({ currentPassword: PASSWORD, totpCode: OLD_CODES[0]! }), {
    error: "INVALID_TOTP_CODE",
  });
  assert.deepEqual(await regenerateRecoveryCodes({ currentPassword: PASSWORD, totpCode: "ZZZZ-ZZZZ-ZZZZ-ZZZZ" }), {
    error: "INVALID_TOTP_CODE",
  });
  // Still needs the password too.
  assert.deepEqual(await regenerateRecoveryCodes({ totpCode: OLD_CODES[1]! }), { error: "STEP_UP_REQUIRED" });

  const result = await regenerateRecoveryCodes({ currentPassword: PASSWORD, totpCode: OLD_CODES[1]! });
  assert.ok("success" in result, JSON.stringify(result));
  await assertStoredSetIs(result.recoveryCodes);
  assert.deepEqual(await redeemTotpRecoveryCode(OLD_CODES[2]!), { error: "INVALID_RECOVERY_CODE" }, "old set gone");
});

test("a failed regenerate leaves the old codes working", async () => {
  seedEnabledUserWithLegacyCodes(OLD_CODES);
  const before = storedHashes();

  // Fail the write of the new set, after the old set was deleted in the same
  // transaction — the transaction must roll the delete back.
  const delegate = (fake.client as Record<string, Record<string, unknown>>).totpRecoveryCode!;
  delegate.createMany = async () => {
    throw new Error("simulated DB failure");
  };
  const silence = mock.method(console, "error", () => undefined);
  try {
    const result = await regenerate();
    assert.deepEqual(result, { error: "REGENERATE_FAILED" });
    assert.equal(silence.mock.callCount(), 1, "the failure is logged");
  } finally {
    silence.mock.restore();
  }

  assert.deepEqual(storedHashes(), before, "old hashes untouched");
  assert.deepEqual(await redeemTotpRecoveryCode(OLD_CODES[1]!), { success: true, remaining: 2 });
});

test("regenerate refuses when 2FA is off and stores nothing", async () => {
  fake.seed("user", { id: USER_ID, email: "u@example.invalid", password: PASSWORD_HASH, totpEnabled: false });
  assert.deepEqual(await regenerate(), { error: "TOTP_NOT_ENABLED" });
  assert.equal(fake.rows("totpRecoveryCode").length, 0);
});

test("status flags a set that still holds legacy codes", async () => {
  seedEnabledUserWithLegacyCodes(OLD_CODES);
  let status = await getTotpStatus();
  assert.equal(status.hasLegacyCodes, true);
  assert.equal(status.remainingCodes, 3);

  assert.ok("success" in (await regenerate()));
  status = await getTotpStatus();
  assert.equal(status.hasLegacyCodes, false);
  assert.equal(status.remainingCodes, 8);
});

// ── redeem ───────────────────────────────────────────────────────────────────

test("a recovery code redeems once only", async () => {
  seedEnabledUserWithLegacyCodes(OLD_CODES);
  assert.deepEqual(await redeemTotpRecoveryCode(OLD_CODES[0]!), { success: true, remaining: 2 });
  assert.deepEqual(await redeemTotpRecoveryCode(OLD_CODES[0]!), { error: "INVALID_RECOVERY_CODE" });
});

test("two concurrent redemptions of the same code: exactly one succeeds", async () => {
  seedEnabledUserWithLegacyCodes(OLD_CODES);

  const results = await Promise.all([
    redeemTotpRecoveryCode(OLD_CODES[2]!),
    redeemTotpRecoveryCode(OLD_CODES[2]!),
  ]);

  // Prove the race was actually exercised: both lookups ran before either
  // claim, so a plain `update({ where: { id } })` would have let both through.
  const ops = fake.calls
    .filter((c) => c.model === "totpRecoveryCode" && (c.op === "findMany" || c.op === "updateMany"))
    .map((c) => c.op);
  assert.deepEqual(ops, ["findMany", "findMany", "updateMany", "updateMany"]);

  const ok = results.filter((r) => "success" in r);
  assert.equal(ok.length, 1, JSON.stringify(results));
  assert.ok(results.some((r) => "error" in r && r.error === "INVALID_RECOVERY_CODE"));
  assert.equal(fake.rows("totpRecoveryCode").filter((r) => r.usedAt !== null).length, 1);
});

test("two concurrent redemptions of the same new-format code: exactly one succeeds", async () => {
  seedEnabledUserWithLegacyCodes([]);
  const result = await regenerate();
  assert.ok("success" in result);
  const code = result.recoveryCodes[5]!;

  const results = await Promise.all([redeemTotpRecoveryCode(code), redeemTotpRecoveryCode(code)]);
  assert.equal(results.filter((r) => "success" in r).length, 1, JSON.stringify(results));
  assert.equal(fake.rows("totpRecoveryCode").filter((r) => r.usedAt != null).length, 1);
});

// ── enrolment ────────────────────────────────────────────────────────────────

const seedEnrollableUser = (password: string = PASSWORD_HASH) =>
  fake.seed("user", {
    id: USER_ID,
    email: "u@example.invalid",
    password,
    totpEnabled: false,
    emailVerified: new Date(),
  });

test("enrolment start refuses without the password step-up", async () => {
  seedEnrollableUser();
  assert.deepEqual(await startTotpEnrolment(), { error: "STEP_UP_REQUIRED" });
  assert.deepEqual(await startTotpEnrolment({ currentPassword: "wrong" }), { error: "WRONG_PASSWORD" });

  const ok = await startTotpEnrolment({ currentPassword: PASSWORD });
  assert.ok("pendingToken" in ok, JSON.stringify(ok));
  assert.equal((JSON.parse(ok.pendingToken) as { userId?: string }).userId, USER_ID, "token bound to the user");
});

test("an OAuth-only account (no password) enrols on its session alone", async () => {
  seedEnrollableUser("");
  const ok = await startTotpEnrolment();
  assert.ok("pendingToken" in ok, JSON.stringify(ok));
});

test("confirm refuses a pending token not minted for this account after step-up", async () => {
  seedEnrollableUser();
  const unbound = JSON.stringify({ secret: "SECRET", expiresAt: Date.now() + 60_000 });
  const foreign = JSON.stringify({ secret: "SECRET", expiresAt: Date.now() + 60_000, userId: "someone_else" });

  assert.deepEqual(await confirmTotpEnrolment({ totpCode: VALID_TOTP, pendingToken: unbound }), {
    error: "INVALID_PENDING_TOKEN",
  });
  assert.deepEqual(await confirmTotpEnrolment({ totpCode: VALID_TOTP, pendingToken: foreign }), {
    error: "INVALID_PENDING_TOKEN",
  });
  assert.equal(fake.rows("user")[0]!.totpEnabled, false);
  assert.equal(fake.rows("totpRecoveryCode").length, 0);
});

test("enrolment stores the codes it returns; a second confirm can't replace them", async () => {
  seedEnrollableUser();
  const started = await startTotpEnrolment({ currentPassword: PASSWORD });
  assert.ok("pendingToken" in started);
  const { pendingToken } = started;

  const first = await confirmTotpEnrolment({ totpCode: VALID_TOTP, pendingToken });
  assert.ok("success" in first, JSON.stringify(first));
  for (const c of first.recoveryCodes) assert.match(c, NEW_FORMAT);
  await assertStoredSetIs(first.recoveryCodes);
  const firstHashes = storedHashes();

  // Double submit / second tab / replay of the same still-valid pending token.
  const second = await confirmTotpEnrolment({ totpCode: VALID_TOTP, pendingToken });
  assert.deepEqual(second, { error: "TOTP_ALREADY_ENABLED" });
  assert.deepEqual(storedHashes(), firstHashes, "first set still stored");
});
