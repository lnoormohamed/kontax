import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

// Incident 2026-09-27: seed scripts defaulted to the owner's real account and
// pushed demo contacts into their Google / iCloud / Fastmail. The guard every
// seed script now calls before writing anything.
const { assertSeedTarget } = (await import("../../scripts/seed-guard.mjs")) as {
  assertSeedTarget: (db: unknown, email: string | undefined | null) => Promise<{ id: string; email: string }>;
};

const fakeDb = (liveConnections: number, exists = true) => ({
  user: { findUnique: async () => (exists ? { id: "u1", email: "demo@example.test" } : null) },
  syncAccount: { count: async () => liveConnections },
});

const savedEnv = { deploy: process.env.KONTAX_DEPLOY_ENV, node: process.env.NODE_ENV };
const savedArgv = [...process.argv];
afterEach(() => {
  if (savedEnv.deploy === undefined) delete process.env.KONTAX_DEPLOY_ENV;
  else process.env.KONTAX_DEPLOY_ENV = savedEnv.deploy;
  process.argv.splice(0, process.argv.length, ...savedArgv);
});

test("refuses without an explicit target — there is no default user", async () => {
  process.env.KONTAX_DEPLOY_ENV = "staging";
  await assert.rejects(assertSeedTarget(fakeDb(0), undefined), /explicit --user/);
});

test("refuses production", async () => {
  process.env.KONTAX_DEPLOY_ENV = "production";
  await assert.rejects(assertSeedTarget(fakeDb(0), "demo@example.test"), /production/);
});

test("refuses an account with live sync connections unless --allow-synced-account", async () => {
  process.env.KONTAX_DEPLOY_ENV = "staging";
  await assert.rejects(assertSeedTarget(fakeDb(2), "demo@example.test"), /sync connection/);
  process.argv.push("--allow-synced-account");
  assert.equal((await assertSeedTarget(fakeDb(2), "demo@example.test")).id, "u1");
});

test("allows a dedicated demo account with no connections", async () => {
  process.env.KONTAX_DEPLOY_ENV = "staging";
  assert.equal((await assertSeedTarget(fakeDb(0), "DEMO@example.test")).email, "demo@example.test");
  await assert.rejects(assertSeedTarget(fakeDb(0, false), "nobody@example.test"), /User not found/);
});
