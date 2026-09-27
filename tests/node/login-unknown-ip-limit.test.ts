import assert from "node:assert/strict";
import { mock, test } from "node:test";

import bcrypt from "bcryptjs";

import { createFakePrisma } from "./_fake-prisma";

/**
 * P49A-13 (Fable review, item 4): in production only CF-Connecting-IP is
 * trusted, so a request without it has no client IP — and the credentials
 * `authorize` used to skip the per-IP login limiter entirely when the IP was
 * null. It now uses one shared "unknown" bucket (200 / 15 min) instead, so the
 * no-IP path is never weaker than having one. The real `authorize`, rate
 * limiter (in-memory) and client-IP helper run; DB and side effects are mocked.
 */

const fake = createFakePrisma();
mock.module("~/server/db", { namedExports: { db: fake.client } });
mock.module("~/server/notifications", {
  namedExports: { detectNewDeviceSignIn: async () => undefined, recordFailedLogin: async () => undefined },
});
mock.module("~/server/session-validation-cache", {
  namedExports: { readSessionValidation: async () => null, writeSessionValidation: async () => undefined },
});
mock.module("~/server/preferences", { namedExports: { getPreferences: async () => ({}) } });

const { authConfig } = await import("../../src/server/auth/config");

type Authorize = (credentials: unknown, request: Request) => Promise<unknown>;
const provider = (authConfig.providers as Array<{ options?: { authorize?: Authorize } }>)[0]!;
const authorize = provider.options!.authorize!;

const PASSWORD = "correct horse battery staple";
let userSeq = 0;
const seedUser = () => {
  const email = `user${++userSeq}@example.invalid`;
  fake.seed("user", { id: `u${userSeq}`, email, password: bcrypt.hashSync(PASSWORD, 4), lifecycleState: "ACTIVE" });
  return email;
};

// No CF-Connecting-IP; a spoofed X-Forwarded-For that must not be used.
const noIpRequest = () =>
  new Request("https://app.example.com/api/auth/callback/credentials", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.1" },
  });

test("production login without a client IP uses a shared, capped IP bucket (not no limit)", async () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = { NODE_ENV: env.NODE_ENV, KONTAX_DEPLOY_ENV: env.KONTAX_DEPLOY_ENV };
  env.NODE_ENV = "production";
  delete env.KONTAX_DEPLOY_ENV;
  const warn = mock.method(console, "warn", () => undefined);
  try {
    // 200 wrong passwords, spread over many accounts so the per-email bucket
    // (5 / 15 min) never trips first.
    for (let i = 0; i < 40; i++) {
      const email = seedUser();
      for (let j = 0; j < 5; j++) {
        assert.equal(await authorize({ email, password: "wrong password" }, noIpRequest()), null);
      }
    }
    // The shared bucket is now exhausted: even the right password is refused.
    const fresh = seedUser();
    assert.equal(await authorize({ email: fresh, password: PASSWORD }, noIpRequest()), null);

    // With a real client IP, the per-IP bucket applies instead.
    const withIp = new Request("https://app.example.com/", {
      method: "POST",
      headers: { "cf-connecting-ip": "198.51.100.7" },
    });
    const ok = (await authorize({ email: fresh, password: PASSWORD }, withIp)) as { id?: string } | null;
    assert.ok(ok?.id, "a request with its own IP is unaffected");
  } finally {
    warn.mock.restore();
    env.NODE_ENV = saved.NODE_ENV;
    if (saved.KONTAX_DEPLOY_ENV === undefined) delete env.KONTAX_DEPLOY_ENV;
    else env.KONTAX_DEPLOY_ENV = saved.KONTAX_DEPLOY_ENV;
  }
});
