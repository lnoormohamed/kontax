import assert from "node:assert/strict";
import { test, mock, beforeEach } from "node:test";

import { createFakePrisma } from "./_fake-prisma";

/**
 * P49A-07 — two of the admin hardening fixes in src/app/actions/admin.ts:
 *
 *   A-27: "schedule deletion" (adminDeleteAccount) must invalidate the DAV
 *   credential cache the same way the suspend path already does — otherwise
 *   a device keeps syncing CardDAV for up to the cache's 10-minute TTL after
 *   the account is locked for deletion.
 *
 *   Admin hardening: the broadcast action had no server-side length cap on
 *   title/body — the UI enforces one, but a direct call could send an
 *   arbitrarily long message to every matched user.
 *
 * admin.ts is a "use server" action module gated by `assertAdmin()` and
 * backed by Postgres, Redis and email. Every one of those boundaries is
 * mocked so these tests drive the real action bodies without touching a
 * network, Postgres, or Redis.
 */

mock.module("~/server/admin/guard", {
  namedExports: {
    assertAdmin: async () => ({
      adminId: "admin_1",
      name: "Admin One",
      email: "admin@example.invalid",
      tier: "GOVERNANCE",
      tierLabel: "Governance admin",
      policySource: "default",
      // Every capability check in admin.ts is a plain bracket lookup — a
      // Proxy that always answers "true" exercises the action bodies without
      // hard-coding every capability key this file doesn't test.
      capabilities: new Proxy({}, { get: () => true }),
    }),
    AdminForbiddenError: class AdminForbiddenError extends Error {
      capability?: string;
      constructor(capability?: string) {
        super("FORBIDDEN");
        this.name = "AdminForbiddenError";
        this.capability = capability;
      }
    },
  },
});

let currentDb: unknown;
mock.module("~/server/db", {
  namedExports: {
    db: new Proxy(
      {},
      {
        get(_target, prop) {
          return (currentDb as Record<string, unknown>)[prop as string];
        },
      },
    ),
  },
});

const davInvalidations: string[] = [];
mock.module("~/server/app-passwords", {
  namedExports: {
    invalidateDavCredentialCacheForUser: async (userId: string) => {
      davInvalidations.push(userId);
    },
  },
});

mock.module("~/server/session-validation-cache", {
  namedExports: {
    invalidateSessionValidation: async () => undefined,
  },
});

mock.module("~/server/billing-emails", {
  namedExports: {
    sendAccountSuspendedEmail: async () => undefined,
  },
});

mock.module("~/server/sync-provider-capabilities", {
  namedExports: {
    coerceCardDavCapabilityProfileOverrideId: (value: unknown) => (typeof value === "string" ? value : null),
  },
});

mock.module("~/server/admin/impersonation", {
  namedExports: {
    setImpersonation: async () => undefined,
    clearImpersonation: async () => undefined,
    readImpersonation: async () => null,
  },
});

type SaveDraftArgs = { title: string; body: string; status: string };
const saveDraftCalls: SaveDraftArgs[] = [];
mock.module("~/server/admin/broadcasts", {
  namedExports: {
    saveAdminBroadcastDraft: async (args: SaveDraftArgs) => {
      saveDraftCalls.push(args);
      return { id: "broadcast_1", previewRecipientCount: 0 };
    },
    sendAdminBroadcast: async () => ({ id: "broadcast_1", title: "x", deliveredRecipientCount: 0 }),
    listAdminBroadcasts: async () => [],
    processScheduledAdminBroadcasts: async () => undefined,
    retractAdminBroadcast: async () => null,
    resolveBroadcastAudience: async () => ({ count: 0, sample: [] }),
  },
});

const { adminDeleteAccount, saveProductBroadcast } = await import("../../src/app/actions/admin");

let fake: ReturnType<typeof createFakePrisma>;

beforeEach(() => {
  fake = createFakePrisma({
    defaults: { user: { role: "USER", lifecycleState: "ACTIVE", scheduledDeleteAt: null } },
  });
  currentDb = fake.client;
  davInvalidations.length = 0;
  saveDraftCalls.length = 0;
});

// ─── A-27 ─────────────────────────────────────────────────────────────────────

test("schedule-deletion invalidates the DAV credential cache, same as the lock/suspend path", async () => {
  fake.seed("user", { id: "user_1", email: "user1@example.invalid" });

  const result = await adminDeleteAccount({ userId: "user_1", reason: "policy violation" });

  assert.deepEqual(result, { success: true });
  assert.deepEqual(
    davInvalidations,
    ["user_1"],
    "a cached DAV credential must be rejected immediately, not after its TTL",
  );

  const updated = fake.rows("user").find((u) => u.id === "user_1")!;
  assert.equal(updated.lifecycleState, "LOCKED");
  assert.ok(updated.scheduledDeleteAt instanceof Date);
});

test("schedule-deletion refuses to schedule an admin account (and never touches the DAV cache for it)", async () => {
  fake.seed("user", { id: "admin_target", email: "admin2@example.invalid", role: "ADMIN" });

  const result = await adminDeleteAccount({ userId: "admin_target", reason: "test" });

  assert.deepEqual(result, { error: "CANNOT_DELETE_ADMIN" });
  assert.deepEqual(davInvalidations, []);
});

// ─── Broadcast title/body length caps ────────────────────────────────────────

test("a too-long broadcast title is rejected before a draft is ever saved", async () => {
  const result = await saveProductBroadcast({
    title: "x".repeat(121),
    body: "A short body.",
    status: "DRAFT",
  });
  assert.deepEqual(result, { error: "TITLE_TOO_LONG" });
  assert.equal(saveDraftCalls.length, 0, "must not persist a draft once title length is rejected");
});

test("a too-long broadcast body is rejected before a draft is ever saved", async () => {
  const result = await saveProductBroadcast({
    title: "New feature",
    body: "x".repeat(2001),
    status: "DRAFT",
  });
  assert.deepEqual(result, { error: "BODY_TOO_LONG" });
  assert.equal(saveDraftCalls.length, 0);
});

test("a broadcast title/body exactly at the cap is accepted", async () => {
  const result = await saveProductBroadcast({
    title: "x".repeat(120),
    body: "x".repeat(2000),
    status: "DRAFT",
  });
  assert.deepEqual(result, { success: true, recipients: 0, broadcastId: "broadcast_1" });
  assert.equal(saveDraftCalls.length, 1);
});
