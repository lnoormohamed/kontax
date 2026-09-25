import assert from "node:assert/strict";
import { test, mock, beforeEach } from "node:test";

import { createFakePrisma } from "./_fake-prisma";
import type { OverrideDb } from "../../src/server/admin/plan-override";

/**
 * P49A-07 (A-11) — admin plan override without poisoning Stripe.
 *
 * Before this ticket, `overridePlan` (src/app/actions/admin.ts) upserted
 * `SubscriptionCustomer.providerCustomerId = "admin-override-<userId>"` — a
 * fake id that checkout/portal then handed straight to the Stripe API, and
 * that `syncStripeBillingState` tried to list real Stripe subscriptions for.
 *
 * The fix (src/server/admin/plan-override.ts) makes the override a comp
 * *personal* Subscription row using the same "manual_"-prefixed placeholder
 * convention as the pre-Stripe comp subscriptions — recognized by the
 * existing `ensureStripeCustomer` (stripe-customers.ts) and
 * `syncStripeBillingState` (stripe-handlers.ts) placeholder checks, which
 * this ticket additionally widened to also treat the legacy
 * "admin-override-" prefix as a placeholder (prod has no such rows today,
 * but a stale one must never be treated as a real Stripe customer).
 *
 * These tests drive the real `ensureStripeCustomer` / `syncStripeBillingState`
 * / `overridePlanForUser` / `removePlanOverrideForUser` against an in-memory
 * Prisma fake and a fake Stripe client — no network, no database. `~/server/db`
 * and `~/server/stripe` are mocked once at module scope (their bindings are
 * captured at import time by the modules under test), so each test points a
 * shared, swappable `current` reference at a fresh fixture instead of
 * re-registering the mock.
 */

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

let currentStripe: unknown;
mock.module("~/server/stripe", {
  namedExports: {
    getStripeClient: () => currentStripe,
  },
});

process.env.STRIPE_PRICE_ID_PRO_MONTHLY = "price_pro_m";

const { ensureStripeCustomer } = await import("../../src/server/stripe-customers");
const { syncStripeBillingState } = await import("../../src/server/stripe-handlers");
const { overridePlanForUser, removePlanOverrideForUser, isPlaceholderProviderId } = await import(
  "../../src/server/admin/plan-override"
);

const asOverrideDb = (client: unknown): OverrideDb => client as OverrideDb;

let fake: ReturnType<typeof createFakePrisma>;
let stripeCustomersCreated: Array<{ id: string; email?: string }>;
let stripeSubscriptionsListCalls: number;
let stripeSubscriptionsRetrieveCalls: number;

function newFake() {
  return createFakePrisma({
    defaults: {
      subscriptionCustomer: { groupId: null, billingEmail: null },
      subscription: {
        groupId: null,
        interval: "MONTHLY",
        cancelAtPeriodEnd: false,
        canceledAt: null,
        endedAt: null,
        currentPeriodEnd: null,
      },
      user: { lifecycleState: "ACTIVE" },
    },
  });
}

beforeEach(() => {
  fake = newFake();
  currentDb = fake.client;
  stripeCustomersCreated = [];
  stripeSubscriptionsListCalls = 0;
  stripeSubscriptionsRetrieveCalls = 0;
  currentStripe = {
    customers: {
      create: async (args: { email?: string; name?: string }) => {
        const customer = { id: `cus_new_${stripeCustomersCreated.length + 1}`, ...args };
        stripeCustomersCreated.push(customer);
        return customer;
      },
    },
    subscriptions: {
      list: async () => {
        stripeSubscriptionsListCalls++;
        return { data: [] };
      },
      retrieve: async (id: string) => {
        stripeSubscriptionsRetrieveCalls++;
        throw Object.assign(new Error(`No such subscription: ${id}`), { statusCode: 404 });
      },
    },
  };
});

// ─── isPlaceholderProviderId ──────────────────────────────────────────────────

test("isPlaceholderProviderId recognizes both the manual_ and legacy admin-override- prefixes, never a real cus_ id", () => {
  assert.equal(isPlaceholderProviderId("manual_admin-override-user_1"), true);
  assert.equal(isPlaceholderProviderId("admin-override-user_1"), true);
  assert.equal(isPlaceholderProviderId("cus_live_abc123"), false);
  assert.equal(isPlaceholderProviderId(null), false);
  assert.equal(isPlaceholderProviderId(undefined), false);
});

// ─── Acceptance: override FREE→PRO then checkout creates a real Stripe customer ──

test("override FREE→PRO then Checkout creates a real Stripe customer (never a fake id)", async () => {
  fake.seed("user", { id: "user_1", email: "user1@example.invalid", name: "User One" });

  const overrideResult = await overridePlanForUser(asOverrideDb(fake.client), { targetUserId: "user_1", plan: "PRO" });
  assert.equal(overrideResult.usedPlaceholderCustomer, true);
  assert.match(overrideResult.providerCustomerId, /^manual_/);
  assert.equal(overrideResult.providerSubscriptionId, "manual_admin-override-user_1");

  const customerRowAfterOverride = fake
    .rows("subscriptionCustomer")
    .find((row) => row.userId === "user_1");
  assert.ok(customerRowAfterOverride);
  assert.match(customerRowAfterOverride.providerCustomerId as string, /^manual_/);

  const overrideSubRow = fake
    .rows("subscription")
    .find((row) => row.providerSubscriptionId === "manual_admin-override-user_1");
  assert.equal(overrideSubRow?.plan, "PRO");
  assert.equal(overrideSubRow?.status, "ACTIVE");

  // Checkout's ensureStripeCustomer must see the placeholder and mint a real
  // Stripe customer — never send "manual_admin-override-user_1" to Stripe.
  const stripeCustomerId = await ensureStripeCustomer("user_1");
  assert.match(stripeCustomerId, /^cus_/);
  assert.equal(stripeCustomersCreated.length, 1, "exactly one real Stripe customer is created");

  const customerRowAfterCheckout = fake
    .rows("subscriptionCustomer")
    .find((row) => row.userId === "user_1");
  assert.equal(customerRowAfterCheckout?.id, customerRowAfterOverride.id, "same row, updated in place");
  assert.equal(customerRowAfterCheckout?.providerCustomerId, stripeCustomerId);

  // The comp override Subscription row is untouched by ensureStripeCustomer —
  // only stripe-handlers.ts's own real-subscription-supersedes-manual sweep
  // (exercised elsewhere) retires it once a real subscription goes active.
  const overrideSubRowAfterCheckout = fake
    .rows("subscription")
    .find((row) => row.providerSubscriptionId === "manual_admin-override-user_1");
  assert.equal(overrideSubRowAfterCheckout?.status, "ACTIVE");
});

// ─── Acceptance: overriding a paying user leaves their real customer intact ──────

test("overriding a user who has a real cus_ customer leaves that id intact and doesn't touch their real subscription", async () => {
  const customer = fake.seed("subscriptionCustomer", {
    userId: "user_2",
    provider: "STRIPE",
    providerCustomerId: "cus_live_real123",
  });
  fake.seed("user", { id: "user_2", email: "user2@example.invalid" });
  // A real, paying PRO subscription already anchored to that real customer.
  const realSub = fake.seed("subscription", {
    userId: "user_2",
    subscriptionCustomerId: customer.id,
    provider: "STRIPE",
    providerSubscriptionId: "sub_real_789",
    plan: "PRO",
    status: "ACTIVE",
  });

  // An admin grants a (redundant, or perhaps a different) FAMILY override.
  const result = await overridePlanForUser(asOverrideDb(fake.client), { targetUserId: "user_2", plan: "FAMILY" });
  assert.equal(result.usedPlaceholderCustomer, false);
  assert.equal(result.providerCustomerId, "cus_live_real123", "the real Stripe customer id is never overwritten");

  const customerRows = fake.rows("subscriptionCustomer").filter((row) => row.userId === "user_2");
  assert.equal(customerRows.length, 1, "no duplicate customer row is created");
  assert.equal(customerRows[0]!.providerCustomerId, "cus_live_real123");

  // The real subscription row is completely untouched — the ticket's
  // resolution rule ("highest plan wins" between this comp row and any real
  // active subscription) is implemented in getUserBillingContext (P49A-06,
  // out of scope here / never edited by this change): asserting these two
  // independent rows both exist, unmodified relative to each other, is what
  // makes that resolution possible instead of one silently clobbering the
  // other.
  const realSubAfter = fake.rows("subscription").find((row) => row.id === realSub.id);
  assert.equal(realSubAfter?.plan, "PRO");
  assert.equal(realSubAfter?.status, "ACTIVE");
  assert.equal(realSubAfter?.providerSubscriptionId, "sub_real_789");

  const overrideSub = fake
    .rows("subscription")
    .find((row) => row.providerSubscriptionId === "manual_admin-override-user_2");
  assert.equal(overrideSub?.plan, "FAMILY");
  assert.equal(overrideSub?.status, "ACTIVE");
  assert.equal(overrideSub?.subscriptionCustomerId, customer.id);
});

// ─── Acceptance: syncStripeBillingState skips placeholder customers ─────────────

test("syncStripeBillingState skips a manual_ placeholder customer — no Stripe calls at all", async () => {
  fake.seed("user", { id: "user_3", email: "user3@example.invalid" });
  fake.seed("subscriptionCustomer", {
    userId: "user_3",
    provider: "STRIPE",
    providerCustomerId: "manual_admin-override-user_3",
  });

  const changed = await syncStripeBillingState("user_3");
  assert.equal(changed, false);
  assert.equal(stripeSubscriptionsListCalls, 0);
  assert.equal(stripeSubscriptionsRetrieveCalls, 0);
});

test("syncStripeBillingState also skips the legacy admin-override- placeholder (safety net for stale rows)", async () => {
  fake.seed("user", { id: "user_4", email: "user4@example.invalid" });
  fake.seed("subscriptionCustomer", {
    userId: "user_4",
    provider: "STRIPE",
    providerCustomerId: "admin-override-user_4",
  });

  const changed = await syncStripeBillingState("user_4");
  assert.equal(changed, false);
  assert.equal(stripeSubscriptionsListCalls, 0);
  assert.equal(stripeSubscriptionsRetrieveCalls, 0);
});

// ─── "Remove override" ───────────────────────────────────────────────────────

test("removePlanOverrideForUser cancels only the comp row, leaves a real subscription alone, and is idempotent", async () => {
  const customer = fake.seed("subscriptionCustomer", {
    userId: "user_5",
    provider: "STRIPE",
    providerCustomerId: "cus_live_real555",
  });
  const realSub = fake.seed("subscription", {
    userId: "user_5",
    subscriptionCustomerId: customer.id,
    provider: "STRIPE",
    providerSubscriptionId: "sub_real_555",
    plan: "PRO",
    status: "ACTIVE",
  });
  await overridePlanForUser(asOverrideDb(fake.client), { targetUserId: "user_5", plan: "FAMILY" });

  const removed = await removePlanOverrideForUser(asOverrideDb(fake.client), { targetUserId: "user_5" });
  assert.equal(removed, true);

  const overrideSub = fake
    .rows("subscription")
    .find((row) => row.providerSubscriptionId === "manual_admin-override-user_5");
  assert.equal(overrideSub?.status, "CANCELED");
  assert.ok(overrideSub?.canceledAt);
  assert.ok(overrideSub?.endedAt);

  const realSubAfter = fake.rows("subscription").find((row) => row.id === realSub.id);
  assert.equal(realSubAfter?.status, "ACTIVE", "removing the override never cancels a real subscription");

  const removedAgain = await removePlanOverrideForUser(asOverrideDb(fake.client), { targetUserId: "user_5" });
  assert.equal(removedAgain, false, "nothing left to remove the second time");
});

test("removePlanOverrideForUser returns false when there was never an override", async () => {
  fake.seed("user", { id: "user_6", email: "user6@example.invalid" });
  const removed = await removePlanOverrideForUser(asOverrideDb(fake.client), { targetUserId: "user_6" });
  assert.equal(removed, false);
});
