import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";

import { createFakePrisma } from "./_fake-prisma";

/**
 * P49A-19 (Fable review, item 3): nightly self-heal for a lost recovery
 * webhook. Every real Stripe subscription that is PAST_DUE past its payment
 * grace is re-read from Stripe; a failure is reported, never thrown, and the
 * rest of the batch still runs.
 */

const { findLapsedPaymentSubscriptions, resyncLapsedPaymentSubscriptions } = await import(
  "../../src/server/billing-lapse-resync"
);

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-10T02:00:00Z");
let fake: ReturnType<typeof createFakePrisma>;
type ResyncDb = Parameters<typeof findLapsedPaymentSubscriptions>[0];
const db = () => fake.client as unknown as ResyncDb;

const seed = (id: string, overrides: Record<string, unknown>) =>
  fake.seed("subscription", {
    id,
    providerSubscriptionId: id,
    provider: "STRIPE",
    userId: "user_1",
    groupId: null,
    plan: "PRO",
    status: "PAST_DUE",
    graceEndsAt: new Date(now.getTime() - DAY),
    updatedAt: new Date(now.getTime() - 2 * DAY),
    ...overrides,
  });

beforeEach(() => {
  fake = createFakePrisma({});
});

test("selects real Stripe subscriptions PAST_DUE past the grace — personal and org alike", async () => {
  seed("sub_lapsed", {});
  seed("sub_team_lapsed", { userId: null, groupId: "team_1", plan: "TEAMS" });
  seed("sub_in_grace", { graceEndsAt: new Date(now.getTime() + DAY) });
  seed("sub_no_deadline", { graceEndsAt: null });
  seed("sub_active", { status: "ACTIVE", graceEndsAt: null });
  seed("sub_canceled", { status: "CANCELED" });
  seed("manual_admin-override-user_1", { status: "PAST_DUE" });

  const ids = await findLapsedPaymentSubscriptions(db(), now);
  assert.deepEqual(ids.sort(), ["sub_lapsed", "sub_team_lapsed"]);
});

test("bounded, least recently updated first", async () => {
  seed("sub_new", { updatedAt: new Date(now.getTime() - 1 * DAY) });
  seed("sub_old", { updatedAt: new Date(now.getTime() - 9 * DAY) });
  seed("sub_mid", { updatedAt: new Date(now.getTime() - 5 * DAY) });
  assert.deepEqual(await findLapsedPaymentSubscriptions(db(), now, 2), ["sub_old", "sub_mid"]);
});

test("one failure is logged and reported; the rest of the batch still syncs", async () => {
  seed("sub_a", { updatedAt: new Date(1) });
  seed("sub_b", { updatedAt: new Date(2) });
  seed("sub_c", { updatedAt: new Date(3) });
  const calls: string[] = [];

  const result = await resyncLapsedPaymentSubscriptions({
    db: db(),
    now,
    delayMs: 0,
    syncSubscription: async (id) => {
      calls.push(id);
      if (id === "sub_b") throw new Error("Stripe 503");
    },
  });

  assert.deepEqual(calls, ["sub_a", "sub_b", "sub_c"]);
  assert.equal(result.scanned, 3);
  assert.equal(result.synced, 2);
  assert.deepEqual(result.errors, ["sub_b: Stripe 503"]);
});

test("nothing lapsed → no Stripe calls", async () => {
  seed("sub_ok", { status: "ACTIVE", graceEndsAt: null });
  let called = false;
  const result = await resyncLapsedPaymentSubscriptions({
    db: db(),
    now,
    syncSubscription: async () => {
      called = true;
    },
  });
  assert.equal(called, false);
  assert.deepEqual(result, { scanned: 0, synced: 0, errors: [] });
});

test("runs from the nightly delete-accounts cron behind the cron secret, with the real Stripe resync", () => {
  const route = readFileSync(new URL("../../src/app/api/cron/delete-accounts/route.ts", import.meta.url), "utf8");
  assert.match(route, /assertCronSecret\(req\)/);
  assert.match(route, /resyncLapsedPaymentSubscriptions\(\{\s*db,\s*syncSubscription: syncStripeSubscriptionById,/);
});
