import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { createFakePrisma } from "./_fake-prisma";

/**
 * P49A-07 (Fable review) — placeholder billing ids never reach Stripe.
 *
 * An admin plan override is a comp Subscription row "manual_admin-override-
 * <userId>", and when the user had no SubscriptionCustomer yet the customer row
 * gets the same placeholder id. The billing portal, checkout, and account
 * deletion must treat those (and legacy "admin-override-" ids) as "nothing in
 * Stripe" instead of sending them to the Stripe API.
 *
 * Drives the real server actions / billing-lifecycle against an in-memory
 * Prisma fake and a recording Stripe fake. No network, no database.
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
  namedExports: { getStripeClient: () => currentStripe },
});

mock.module("~/server/auth/require-session", {
  namedExports: {
    requireUserId: async () => "user_1",
    requireSession: async () => ({ user: { id: "user_1" } }),
    isSessionError: () => false,
    SessionError: class SessionError extends Error {},
  },
});

mock.module("~/server/auth/step-up", {
  namedExports: { verifyStepUpPassword: async () => "OK" },
});

const { createBillingPortalSession, createCheckoutSession } = await import("~/app/actions/billing");
const { cancelBillingForDeletedUser } = await import("~/server/billing-lifecycle");
const { isPlaceholderProviderId } = await import("~/server/billing-placeholders");

let fake: ReturnType<typeof createFakePrisma>;
let portalCalls: string[];
let canceledSubs: string[];
let deletedCustomers: string[];

beforeEach(() => {
  fake = createFakePrisma({
    defaults: {
      subscriptionCustomer: { groupId: null, billingEmail: null },
      subscription: { groupId: null, currentPeriodEnd: null },
    },
  });
  fake.seed("user", { id: "user_1", email: "u@example.invalid", password: "hash" });
  currentDb = fake.client;
  portalCalls = [];
  canceledSubs = [];
  deletedCustomers = [];
  currentStripe = {
    billingPortal: {
      sessions: {
        create: async ({ customer }: { customer: string }) => {
          portalCalls.push(customer);
          return { url: `https://billing.example.invalid/${customer}` };
        },
      },
    },
    subscriptions: {
      cancel: async (id: string) => {
        canceledSubs.push(id);
        return { id };
      },
    },
    customers: {
      del: async (id: string) => {
        deletedCustomers.push(id);
        return { id, deleted: true };
      },
    },
  };
});

const seedCustomer = (providerCustomerId: string) =>
  fake.seed("subscriptionCustomer", {
    id: "sc_1",
    userId: "user_1",
    provider: "STRIPE",
    providerCustomerId,
  });

test("the billing portal refuses a comp / admin-override placeholder customer (NO_BILLING_ACCOUNT)", async () => {
  for (const placeholder of ["manual_admin-override-user_1", "admin-override-user_1", "manual_legacy"]) {
    fake = createFakePrisma();
    fake.seed("user", { id: "user_1", email: "u@example.invalid", password: "hash" });
    currentDb = fake.client;
    seedCustomer(placeholder);

    const result = await createBillingPortalSession({ currentPassword: "pw" });
    assert.deepEqual(result, { error: "NO_BILLING_ACCOUNT" }, placeholder);
  }
  assert.deepEqual(portalCalls, [], "no placeholder id was sent to Stripe");
});

test("the billing portal still opens for a real Stripe customer (even with an admin comp row)", async () => {
  seedCustomer("cus_real");
  fake.seed("subscription", {
    userId: "user_1",
    subscriptionCustomerId: "sc_1",
    provider: "STRIPE",
    providerSubscriptionId: "manual_admin-override-user_1",
    plan: "TEAMS",
    status: "ACTIVE",
  });

  const result = await createBillingPortalSession({ currentPassword: "pw" });
  assert.ok("url" in result);
  assert.deepEqual(portalCalls, ["cus_real"]);
});

test("checkout: a comp row found first does not hide a paid subscription (no duplicate checkout)", async () => {
  seedCustomer("cus_real");
  const base = { userId: "user_1", subscriptionCustomerId: "sc_1", provider: "STRIPE", status: "ACTIVE" };
  fake.seed("subscription", { ...base, providerSubscriptionId: "manual_admin-override-user_1", plan: "TEAMS" });
  fake.seed("subscription", { ...base, providerSubscriptionId: "sub_paid", plan: "PRO" });

  const result = await createCheckoutSession({ plan: "PRO", interval: "MONTHLY" });
  assert.deepEqual(result, { error: "USE_CUSTOMER_PORTAL" });
});

test("account deletion never cancels a comp subscription id in Stripe, and skips a placeholder customer", async () => {
  const stubDb = (customer: unknown) => ({
    subscriptionCustomer: { findUnique: async () => customer },
    group: { findMany: async () => [] },
    groupMember: { findMany: async () => [] },
  });

  currentDb = stubDb({
    provider: "STRIPE",
    providerCustomerId: "cus_real",
    subscriptions: [
      { providerSubscriptionId: "manual_admin-override-user_1", status: "ACTIVE" },
      { providerSubscriptionId: "sub_paid", status: "ACTIVE" },
    ],
  });
  const real = await cancelBillingForDeletedUser("user_1");
  assert.deepEqual(canceledSubs, ["sub_paid"]);
  assert.deepEqual(deletedCustomers, ["cus_real"]);
  assert.deepEqual(real.errors, []);
  assert.ok(real.skipped.some((s) => s.includes("manual_admin-override-user_1")));

  canceledSubs = [];
  deletedCustomers = [];
  currentDb = stubDb({
    provider: "STRIPE",
    providerCustomerId: "admin-override-user_1",
    subscriptions: [{ providerSubscriptionId: "admin-override-user_1", status: "ACTIVE" }],
  });
  await cancelBillingForDeletedUser("user_1");
  assert.deepEqual(canceledSubs, []);
  assert.deepEqual(deletedCustomers, []);
});

test("isPlaceholderProviderId: manual_ / admin-override- only, never a real id", () => {
  assert.equal(isPlaceholderProviderId("manual_admin-override-u"), true);
  assert.equal(isPlaceholderProviderId("admin-override-u"), true);
  assert.equal(isPlaceholderProviderId("manual_x"), true);
  assert.equal(isPlaceholderProviderId("cus_123"), false);
  assert.equal(isPlaceholderProviderId("sub_123"), false);
  assert.equal(isPlaceholderProviderId(null), false);
});
