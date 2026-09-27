import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";

import { createFakePrisma } from "./_fake-prisma";

/**
 * P49A-19 (Fable review, item 2): with the payment grace enforced, a customer
 * whose invoice is unpaid past the grace resolves to Free — but their Stripe
 * subscription is still alive. A new checkout must be refused server-side
 * (USE_CUSTOMER_PORTAL) so they fix the card instead of starting a second
 * subscription that would also charge.
 */

const { CHECKOUT_BLOCKING_STATUSES, findCheckoutBlockingSubscription } = await import(
  "../../src/server/billing-checkout-guard"
);

let fake: ReturnType<typeof createFakePrisma>;
type GuardDb = Parameters<typeof findCheckoutBlockingSubscription>[0];
const db = () => fake.client as unknown as GuardDb;

beforeEach(() => {
  fake = createFakePrisma({});
});

const seedSub = (overrides: Record<string, unknown>) =>
  fake.seed("subscription", {
    userId: "user_1",
    groupId: null,
    plan: "PRO",
    status: "ACTIVE",
    providerSubscriptionId: "sub_1",
    graceEndsAt: null,
    ...overrides,
  });

test("PAST_DUE (Stripe past_due / unpaid) blocks a new checkout, in or past the grace", async () => {
  assert.deepEqual(CHECKOUT_BLOCKING_STATUSES, ["ACTIVE", "TRIALING", "PAST_DUE"]);
  seedSub({ status: "PAST_DUE", graceEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });
  for (const plan of ["PRO", "FAMILY"] as const) {
    const blocking = await findCheckoutBlockingSubscription(db(), "user_1", plan);
    assert.equal(blocking?.status, "PAST_DUE", plan);
  }
});

test("active and trialing still block; ended subscriptions don't", async () => {
  seedSub({ status: "TRIALING" });
  assert.ok(await findCheckoutBlockingSubscription(db(), "user_1", "PRO"));

  fake = createFakePrisma({});
  for (const status of ["CANCELED", "EXPIRED", "PAUSED", "INCOMPLETE"]) {
    seedSub({ status, providerSubscriptionId: `sub_${status}` });
  }
  assert.equal(await findCheckoutBlockingSubscription(db(), "user_1", "PRO"), null);
});

test("a comp / admin-override row never blocks, even next to nothing else", async () => {
  seedSub({ providerSubscriptionId: "manual_admin-override-user_1", status: "ACTIVE" });
  seedSub({ providerSubscriptionId: "admin-override-legacy", status: "PAST_DUE" });
  assert.equal(await findCheckoutBlockingSubscription(db(), "user_1", "PRO"), null);
});

test("Teams: the owned team's PAST_DUE org subscription blocks a new Teams checkout", async () => {
  fake.seed("group", { id: "team_1", ownerId: "user_1", type: "TEAM" });
  seedSub({ userId: null, groupId: "team_1", plan: "TEAMS", status: "PAST_DUE", providerSubscriptionId: "sub_team" });
  const blocking = await findCheckoutBlockingSubscription(db(), "user_1", "TEAMS");
  assert.equal(blocking?.status, "PAST_DUE");
  assert.equal(await findCheckoutBlockingSubscription(db(), "someone_else", "TEAMS"), null);
});

test("createCheckoutSession routes through the guard", () => {
  const action = readFileSync(new URL("../../src/app/actions/billing.ts", import.meta.url), "utf8");
  assert.match(action, /if \(await findCheckoutBlockingSubscription\(db, userId, plan\)\) \{\s*return \{ error: "USE_CUSTOMER_PORTAL" \};/);
  assert.doesNotMatch(action, /status: \{ in: \["ACTIVE", "TRIALING"\] \}/, "no private, grace-blind status list");
});
