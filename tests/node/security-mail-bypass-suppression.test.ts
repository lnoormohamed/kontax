import assert from "node:assert/strict";
import { test, mock } from "node:test";

// P49A-08 — a bounce/complaint suppression on a user's address must never be
// the thing that locks them out of recovering their own account: password
// reset (src/app/actions/auth.ts) and email verification
// (src/server/email-verification.ts, used for both signup and email-change)
// must both send with `bypassSuppression: true` regardless of the address's
// current emailStatus.
//
// next/headers is mocked because requestPasswordReset reads request headers
// (for rate-limit IP scoping) via next/headers, which throws "invariant"
// errors outside a real Next.js request — same reason the shared
// node-test-loader.mjs already stubs next/cache for every test in this repo.
mock.module("next/headers", {
  namedExports: {
    headers: async () => new Headers(),
    cookies: async () => ({
      get: () => undefined,
      set: () => undefined,
      delete: () => undefined,
    }),
  },
});

// Not mocked: session-validation-cache only touches Redis via getRedis(),
// which safely returns null when REDIS_URL is unset (as it is in this test
// process) — its real implementation already no-ops instead of failing.

type SendEmailArgs = { to: string; subject: string; bypassSuppression?: boolean };

const sendEmailCalls: SendEmailArgs[] = [];
mock.module("~/server/email", {
  namedExports: {
    sendEmail: async (args: SendEmailArgs) => {
      sendEmailCalls.push(args);
      return { success: true, messageId: "mock" };
    },
    SES_CONFIGURED: false,
    appUrl: () => "http://localhost:3000",
  },
});

// Both requestPasswordReset (auth.ts) and sendVerificationEmail
// (email-verification.ts) import the same `~/server/db` singleton. The route
// module graph is only ever loaded ONCE per process — the ESM cache returns
// the same instance on every later `await import(...)` — so rather than
// re-mocking "~/server/db" per test (which wouldn't reach an already-bound
// import), each method below is a stable wrapper forwarding to a swappable
// closure, letting each test control its own fixture independently.
let findUniqueImpl: (args: unknown) => Promise<unknown> = async () => null;
let findUniqueOrThrowImpl: (args: unknown) => Promise<unknown> = async () => {
  throw new Error("no fixture set");
};
mock.module("~/server/db", {
  namedExports: {
    db: {
      user: {
        findUnique: (args: unknown) => findUniqueImpl(args),
        findUniqueOrThrow: (args: unknown) => findUniqueOrThrowImpl(args),
      },
      passwordResetToken: {
        updateMany: async () => ({ count: 0 }),
        create: async () => ({}),
      },
      emailVerificationToken: {
        updateMany: async () => ({ count: 0 }),
        create: async () => ({}),
      },
    },
  },
});

test("requestPasswordReset sends with bypassSuppression: true", async () => {
  sendEmailCalls.length = 0;
  findUniqueImpl = async () => ({ id: "user-1" });

  const { requestPasswordReset } = await import("../../src/app/actions/auth");
  const res = await requestPasswordReset("bounced-user@example.com");

  assert.equal(res.success, true);
  assert.equal(sendEmailCalls.length, 1);
  assert.equal(sendEmailCalls[0]?.bypassSuppression, true);
  assert.match(sendEmailCalls[0]?.subject ?? "", /reset/i);
});

test("sendVerificationEmail (signup) sends with bypassSuppression: true", async () => {
  sendEmailCalls.length = 0;
  findUniqueOrThrowImpl = async () => ({ id: "user-1", email: "complained-user@example.com" });

  const { sendVerificationEmail } = await import("../../src/server/email-verification");
  await sendVerificationEmail("user-1", "SIGNUP");

  assert.equal(sendEmailCalls.length, 1);
  assert.equal(sendEmailCalls[0]?.bypassSuppression, true);
  assert.equal(sendEmailCalls[0]?.to, "complained-user@example.com");
});

test("sendVerificationEmail (email change) also sends with bypassSuppression: true", async () => {
  sendEmailCalls.length = 0;
  findUniqueOrThrowImpl = async () => ({ id: "user-1", email: "old@example.com" });

  const { sendVerificationEmail } = await import("../../src/server/email-verification");
  await sendVerificationEmail("user-1", "EMAIL_CHANGE", "new-address@example.com");

  assert.equal(sendEmailCalls.length, 1);
  assert.equal(sendEmailCalls[0]?.bypassSuppression, true);
  assert.equal(sendEmailCalls[0]?.to, "new-address@example.com");
});
