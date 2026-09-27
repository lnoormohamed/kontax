import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, mock, test } from "node:test";

/**
 * P49A-19 item 4 (owner decision 2026-09-27) — the 3-day failed-payment grace
 * is enforced on entitlements, identically for the web app (billing.ts) and
 * the CardDAV server (server.mjs → plan-entitlements.mjs).
 *
 * The webhook side (grace start from Stripe's invoice data, idempotency,
 * ordering) is covered in stripe-webhook.test.ts. Here: the read-time rule,
 * through `loadEffectivePlan` / the contact cap (what server.mjs calls) and
 * `getUserBillingContext` (what the Next app calls), against one programmable
 * Prisma stub. No network, no database.
 */

const DAY = 24 * 60 * 60 * 1000;

type Sub = {
  plan: "FREE" | "PRO" | "FAMILY" | "TEAMS";
  memberSlotsLimit: number | null;
  status: string;
  graceEndsAt: Date | null;
};

const state = {
  subscriptions: [] as Sub[],
  teamGroups: [] as Record<string, unknown>[],
  contacts: 0,
};

const stub = {
  user: {
    findUnique: async () => ({
      lifecycleState: "GRACE",
      subscriptions: state.subscriptions,
      groupMemberships: state.teamGroups.map((group) => ({ group })),
    }),
  },
  contact: { count: async () => state.contacts },
  $queryRaw: async () => [],
};

mock.module("~/server/db", { namedExports: { db: stub } });

const entitlements = await import("../../src/server/dav/plan-entitlements.mjs");
const { getUserBillingContext } = await import("../../src/server/billing");

const pastDue = (plan: Sub["plan"], graceEndsAt: Date | null): Sub => ({
  plan,
  memberSlotsLimit: null,
  status: "PAST_DUE",
  graceEndsAt,
});
const active = (plan: Sub["plan"]): Sub => ({ plan, memberSlotsLimit: null, status: "ACTIVE", graceEndsAt: null });

beforeEach(() => {
  state.subscriptions = [];
  state.teamGroups = [];
  state.contacts = 0;
});

describe("subscriptionGrantsPlan", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  test("ACTIVE / TRIALING grant; PAST_DUE grants until graceEndsAt; other statuses never", () => {
    const { subscriptionGrantsPlan } = entitlements;
    assert.equal(subscriptionGrantsPlan({ status: "ACTIVE" }, now), true);
    assert.equal(subscriptionGrantsPlan({ status: "TRIALING" }, now), true);
    assert.equal(subscriptionGrantsPlan({ status: "PAST_DUE", graceEndsAt: new Date(now.getTime() + 1) }, now), true);
    assert.equal(subscriptionGrantsPlan({ status: "PAST_DUE", graceEndsAt: now }, now), false, "the deadline itself is over");
    assert.equal(subscriptionGrantsPlan({ status: "PAST_DUE", graceEndsAt: null }, now), true, "no failure time: fail open");
    for (const status of ["CANCELED", "PAUSED", "EXPIRED", "INCOMPLETE"]) {
      assert.equal(subscriptionGrantsPlan({ status }, now), false, status);
    }
  });

  test("the grace is 3 days", () => {
    assert.equal(entitlements.PAYMENT_GRACE_DAYS, 3);
    assert.equal(entitlements.PAYMENT_GRACE_MS, 3 * DAY);
  });
});

describe("one effective plan for the web app and the CardDAV server", () => {
  const failedAt = Date.now() - 1 * DAY;
  const deadline = new Date(failedAt + 3 * DAY);

  test("inside the grace: paid entitlements on both paths, contact cap lifted", async () => {
    state.subscriptions = [pastDue("PRO", deadline)];
    state.contacts = 900;

    const dav = await entitlements.loadEffectivePlan(stub, "user_1");
    const web = await getUserBillingContext("user_1");
    assert.equal(dav?.plan, "PRO");
    assert.equal(web.plan, "PRO");
    assert.equal(web.paymentLapse, null);
    // server.mjs guards every DAV create with assertContactCapacityTx.
    const capacity = await entitlements.assertContactCapacityTx(stub, "user_1", 1);
    assert.equal(capacity.limit, null);
  });

  test("after the grace: Free on both paths; the DAV create path refuses over the Free cap; nothing deleted", async () => {
    state.subscriptions = [pastDue("PRO", new Date(Date.now() - 60_000))];
    state.contacts = 900;

    const dav = await entitlements.loadEffectivePlan(stub, "user_1");
    const web = await getUserBillingContext("user_1");
    assert.equal(dav?.plan, "FREE");
    assert.equal(web.plan, "FREE");
    assert.deepEqual(web.entitlements, dav?.entitlements);
    assert.equal(web.entitlements.contactsLimit, 500);
    assert.equal(web.paymentLapse?.plan, "PRO");

    await assert.rejects(
      entitlements.assertContactCapacityTx(stub, "user_1", 1),
      (err: Error) => err.name === "ContactLimitReachedError",
    );
    const capacity = await entitlements.getContactCapacity(stub, "user_1");
    assert.equal(capacity.used, 900, "over-limit contacts stay");
  });

  test("paid again: the row is ACTIVE with no deadline and the plan is back at once", async () => {
    state.subscriptions = [active("PRO")];
    assert.equal((await entitlements.loadEffectivePlan(stub, "user_1"))?.plan, "PRO");
    assert.equal((await getUserBillingContext("user_1")).paymentLapse, null);
  });

  test("an admin comp keeps its plan while a paid plan is unpaid past the grace", async () => {
    state.subscriptions = [pastDue("FAMILY", new Date(Date.now() - DAY)), active("PRO")];
    const effective = await entitlements.loadEffectivePlan(stub, "user_1");
    assert.equal(effective?.plan, "PRO", "the comp Pro still applies");
    assert.equal(effective?.entitlements.familyGroupEnabled, false, "the unpaid Family grants nothing");
    assert.equal(effective?.paymentLapse?.plan, "FAMILY", "the higher unpaid plan is reported");
  });

  test("server.mjs resolves plans only through plan-entitlements.mjs", () => {
    const source = readFileSync(new URL("../../server.mjs", import.meta.url), "utf8");
    assert.match(source, /from "\.\/src\/server\/dav\/plan-entitlements\.mjs"/);
    assert.match(source, /assertContactCapacityTx/);
    assert.doesNotMatch(source, /status:\s*\{\s*in:\s*\[\s*"ACTIVE"/, "no private subscription-status filter");
  });
});

describe("Teams billed to the org", () => {
  const team = (subscription: Partial<Sub> | null, overrides: Record<string, unknown> = {}) => ({
    id: "team_1",
    ownerId: "owner_1",
    teamsEnabled: true,
    teamsGraceEndsAt: null,
    memberSlotsLimit: 10,
    subscriptions: subscription ? [{ memberSlotsLimit: 10, ...subscription }] : [],
    ...overrides,
  });

  test("members keep Teams through the org's payment grace", async () => {
    state.teamGroups = [team({ status: "PAST_DUE", graceEndsAt: new Date(Date.now() + DAY) })];
    const effective = await entitlements.loadEffectivePlan(stub, "member_1");
    assert.equal(effective?.plan, "TEAMS");
    assert.equal(effective?.teamEntitlement?.state, "active");
  });

  test("after the org's grace members fall back to their own plan; the team is not locked", async () => {
    const group = team({ status: "PAST_DUE", graceEndsAt: new Date(Date.now() - DAY) });
    state.teamGroups = [group];
    state.subscriptions = [active("PRO")];
    const effective = await entitlements.loadEffectivePlan(stub, "member_1");
    assert.equal(effective?.plan, "PRO", "own Pro");
    assert.equal(effective?.teamEntitlement, null);
    assert.equal(effective?.paymentLapse, null, "not the member's own payment");
    // The 14-day read-only window only opens when Stripe ends the subscription.
    assert.equal(await entitlements.isTeamLocked(stub, group as never), false);
  });

  test("a legacy owner-billed Teams subscription past its grace grants nothing", () => {
    const legacy = team(null, {
      teamsEnabled: false,
      owner: { subscriptions: [{ memberSlotsLimit: 5, status: "PAST_DUE", graceEndsAt: new Date(Date.now() - DAY) }] },
    });
    assert.equal(entitlements.teamEntitlementState(legacy as never), null);
    const inGrace = team(null, {
      teamsEnabled: false,
      owner: { subscriptions: [{ memberSlotsLimit: 5, status: "PAST_DUE", graceEndsAt: new Date(Date.now() + DAY) }] },
    });
    assert.equal(entitlements.teamEntitlementState(inGrace as never), "active");
  });
});
