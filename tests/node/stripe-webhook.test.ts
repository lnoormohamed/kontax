import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import type Stripe from "stripe";

import { createFakePrisma } from "./_fake-prisma";

/**
 * P49A-05 — Stripe webhook retry, ordering and billing lifecycle.
 *
 * Drives the real processor (src/server/stripe-webhook.ts) and handlers
 * (src/server/stripe-handlers.ts) against an in-memory Prisma fake and a fake
 * Stripe client. No network, no database.
 */

process.env.STRIPE_PRICE_ID_PRO_MONTHLY = "price_pro_m";
process.env.STRIPE_PRICE_ID_FAMILY_MONTHLY = "price_family_m";
process.env.STRIPE_PRICE_ID_TEAMS_MONTHLY = "price_teams_m";

const { processStripeWebhookEvent } = await import("../../src/server/stripe-webhook");
const { isEligibleForProTrial } = await import("../../src/server/billing-trial");

type WebhookDeps = Parameters<typeof processStripeWebhookEvent>[1];

const DAY = 24 * 60 * 60 * 1000;
const NOW_S = Math.floor(Date.now() / 1000);
const PERIOD_END_S = NOW_S + 20 * 24 * 60 * 60;

// ─── Fakes ────────────────────────────────────────────────────────────────────

let fake: ReturnType<typeof createFakePrisma>;
let stripeSubs: Map<string, Stripe.Subscription>;
let effectsRun: number;
let deps: WebhookDeps;
let eventSeq = 0;

function newFake() {
  return createFakePrisma({
    unique: { stripeWebhookEvent: ["stripeEventId"] },
    defaults: {
      stripeWebhookEvent: { error: null, processedAt: new Date() },
      subscription: {
        provider: "STRIPE",
        graceEndsAt: null,
        trialEndsAt: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
      user: { lifecycleState: "ACTIVE" },
      group: { teamsEnabled: false, teamsGraceEndsAt: null, subscriptionId: null },
    },
  });
}

beforeEach(() => {
  fake = newFake();
  stripeSubs = new Map();
  effectsRun = 0;
  const stripe = {
    subscriptions: {
      retrieve: async (id: string) => {
        const sub = stripeSubs.get(id);
        if (!sub) {
          throw Object.assign(new Error(`No such subscription: ${id}`), {
            statusCode: 404,
            code: "resource_missing",
          });
        }
        return structuredClone(sub);
      },
    },
  } as unknown as Stripe;
  deps = {
    db: fake.client as unknown as WebhookDeps["db"],
    stripe,
    afterCommit: (effects) => {
      effectsRun += effects.length;
    },
  };
});

type SubOpts = {
  status?: Stripe.Subscription.Status;
  price?: string;
  customer?: string;
  quantity?: number;
  periodEnd?: number;
};

function stripeSub(id: string, opts: SubOpts = {}): Stripe.Subscription {
  return {
    id,
    object: "subscription",
    customer: opts.customer ?? "cus_1",
    status: opts.status ?? "active",
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: opts.status === "canceled" ? NOW_S : null,
    ended_at: opts.status === "canceled" ? NOW_S : null,
    trial_end: null,
    items: {
      data: [
        {
          price: { id: opts.price ?? "price_pro_m" },
          quantity: opts.quantity ?? 1,
          current_period_start: NOW_S,
          current_period_end: opts.periodEnd ?? PERIOD_END_S,
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

/** Set the subscription's *current* state in (fake) Stripe. */
function stripeNow(sub: Stripe.Subscription) {
  stripeSubs.set(sub.id, sub);
  return sub;
}

function event(type: string, object: unknown, id = `evt_${++eventSeq}`): Stripe.Event {
  return { id, object: "event", type, data: { object } } as unknown as Stripe.Event;
}

function invoice(subscriptionId: string, customer = "cus_1") {
  return {
    id: `in_${++eventSeq}`,
    object: "invoice",
    customer,
    parent: { subscription_details: { subscription: subscriptionId } },
  };
}

function seedUser(id = "user_1", customer = "cus_1", lifecycleState = "ACTIVE") {
  fake.seed("user", { id, email: `${id}@example.invalid`, lifecycleState });
  return fake.seed("subscriptionCustomer", {
    id: `sc_${id}`,
    userId: id,
    groupId: null,
    provider: "STRIPE",
    providerCustomerId: customer,
  });
}

function seedSubscriptionRow(overrides: Record<string, unknown>) {
  return fake.seed("subscription", {
    userId: "user_1",
    groupId: null,
    subscriptionCustomerId: "sc_user_1",
    provider: "STRIPE",
    plan: "PRO",
    status: "ACTIVE",
    interval: "MONTHLY",
    currentPeriodEnd: new Date(PERIOD_END_S * 1000),
    ...overrides,
  });
}

const user = (id = "user_1") => fake.rows("user").find((u) => u.id === id)!;
const subRow = (providerSubscriptionId: string) =>
  fake.rows("subscription").find((s) => s.providerSubscriptionId === providerSubscriptionId);
const webhookRow = (stripeEventId: string) =>
  fake.rows("stripeWebhookEvent").find((r) => r.stripeEventId === stripeEventId);

// ─── A-09: retry after failure ────────────────────────────────────────────────

describe("webhook retry (A-09)", () => {
  test("first delivery throws → error row; Stripe's retry reprocesses and succeeds", async () => {
    // Checkout completes before the SubscriptionCustomer row is visible.
    fake.seed("user", { id: "user_1", email: "u@example.invalid" });
    stripeNow(stripeSub("sub_1"));
    const evt = event("checkout.session.completed", {
      id: "cs_1",
      mode: "subscription",
      customer: "cus_1",
      subscription: "sub_1",
    });

    const first = await processStripeWebhookEvent(evt, deps);
    assert.equal(first.status, "failed");
    assert.match(webhookRow(evt.id)!.error as string, /No SubscriptionCustomer/);
    assert.equal(fake.rows("subscription").length, 0, "failed attempt rolled back");

    fake.seed("subscriptionCustomer", {
      id: "sc_user_1",
      userId: "user_1",
      groupId: null,
      provider: "STRIPE",
      providerCustomerId: "cus_1",
    });

    const retry = await processStripeWebhookEvent(evt, deps);
    assert.equal(retry.status, "processed");
    assert.equal(webhookRow(evt.id)!.error, null, "error cleared on success");
    assert.equal(fake.rows("stripeWebhookEvent").length, 1);
    assert.equal(subRow("sub_1")?.plan, "PRO");
    assert.equal(subRow("sub_1")?.status, "ACTIVE");

    const replay = await processStripeWebhookEvent(evt, deps);
    assert.equal(replay.status, "skipped", "a successful event is applied once");
  });

  test("a transient Stripe error is recorded and retried, not skipped", async () => {
    seedUser();
    const evt = event("customer.subscription.updated", stripeSub("sub_1"));
    const retrieve = deps.stripe.subscriptions.retrieve.bind(deps.stripe.subscriptions);
    let calls = 0;
    (deps.stripe.subscriptions as { retrieve: unknown }).retrieve = async (id: string) => {
      if (++calls === 1) throw Object.assign(new Error("Stripe 503"), { statusCode: 503 });
      return retrieve(id);
    };
    stripeNow(stripeSub("sub_1"));

    assert.equal((await processStripeWebhookEvent(evt, deps)).status, "failed");
    assert.ok(webhookRow(evt.id)!.error);
    assert.equal((await processStripeWebhookEvent(evt, deps)).status, "processed");
    assert.equal(webhookRow(evt.id)!.error, null);
    assert.equal(subRow("sub_1")?.status, "ACTIVE");
  });

  test("concurrent delivery that commits first → P2002 is re-read as skipped, not failed", async () => {
    seedUser();
    stripeNow(stripeSub("sub_1"));
    const evt = event("customer.subscription.updated", stripeSub("sub_1"));

    // The other delivery commits its success row while this one is processing.
    fake.hooks.beforeTransaction = () => {
      fake.hooks.beforeTransaction = undefined;
      fake.seed("stripeWebhookEvent", { stripeEventId: evt.id, type: evt.type, error: null });
    };

    const outcome = await processStripeWebhookEvent(evt, deps);
    assert.equal(outcome.status, "skipped");
    assert.equal(fake.rows("stripeWebhookEvent").length, 1);
    assert.equal(webhookRow(evt.id)!.error, null, "the winner's success row is not overwritten");
    assert.equal(effectsRun, 0, "the loser's side effects are dropped");
  });

  test("concurrent retry of an errored event: the second to commit rolls back as skipped", async () => {
    seedUser();
    stripeNow(stripeSub("sub_1"));
    const evt = event("customer.subscription.updated", stripeSub("sub_1"));
    fake.seed("stripeWebhookEvent", { stripeEventId: evt.id, type: evt.type, error: "boom" });

    fake.hooks.beforeTransaction = () => {
      fake.hooks.beforeTransaction = undefined;
      webhookRow(evt.id)!.error = null; // the other retry succeeded first
    };

    assert.equal((await processStripeWebhookEvent(evt, deps)).status, "skipped");
    assert.equal(webhookRow(evt.id)!.error, null);
  });
});

// ─── A-24: ordering ───────────────────────────────────────────────────────────

describe("event ordering (A-24)", () => {
  test("a stale customer.subscription.updated cannot resurrect a canceled subscription", async () => {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", plan: "FREE", status: "CANCELED" });
    // Stripe's current state: canceled. The late event's payload says active Pro.
    stripeNow(stripeSub("sub_1", { status: "canceled" }));

    const stale = event("customer.subscription.updated", stripeSub("sub_1", { status: "active" }));
    assert.equal((await processStripeWebhookEvent(stale, deps)).status, "processed");

    assert.equal(subRow("sub_1")?.status, "CANCELED");
    assert.equal(subRow("sub_1")?.plan, "FREE");
    assert.equal(user().lifecycleState, "ACTIVE");
  });

  test("a stale plan change is ignored in favour of Stripe's current plan", async () => {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", plan: "FAMILY" });
    stripeNow(stripeSub("sub_1", { price: "price_family_m" }));

    const stale = event("customer.subscription.updated", stripeSub("sub_1", { price: "price_pro_m" }));
    await processStripeWebhookEvent(stale, deps);
    assert.equal(subRow("sub_1")?.plan, "FAMILY");
  });

  test("a late deletion of a superseded subscription does not downgrade the user", async () => {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "sub_old", plan: "PRO", status: "ACTIVE" });
    seedSubscriptionRow({ providerSubscriptionId: "sub_new", plan: "PRO", status: "ACTIVE" });
    fake.seed("syncAccount", { id: "sa_1", userId: "user_1", status: "ACTIVE", createdAt: new Date(1) });
    fake.seed("syncAccount", { id: "sa_2", userId: "user_1", status: "ACTIVE", createdAt: new Date(2) });
    stripeNow(stripeSub("sub_old", { status: "canceled" }));

    await processStripeWebhookEvent(event("customer.subscription.deleted", stripeSub("sub_old")), deps);

    assert.equal(subRow("sub_old")?.status, "CANCELED");
    assert.deepEqual(
      fake.rows("syncAccount").map((s) => s.status),
      ["ACTIVE", "ACTIVE"],
      "still Pro via sub_new — no downgrade clean-up",
    );
  });

  test("payment_failed delivered after recovery changes nothing and emails no one", async () => {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", status: "ACTIVE" });
    stripeNow(stripeSub("sub_1", { status: "active" }));

    await processStripeWebhookEvent(event("invoice.payment_failed", invoice("sub_1")), deps);
    assert.equal(subRow("sub_1")?.status, "ACTIVE");
    assert.equal(subRow("sub_1")?.graceEndsAt, null);
    assert.equal(user().lifecycleState, "ACTIVE");
    assert.equal(effectsRun, 0);
  });
});

// ─── A-24: lifecycle transitions ──────────────────────────────────────────────

describe("billing lifecycle (A-24)", () => {
  function seedProUserWithSyncAndShares() {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", plan: "PRO" });
    fake.seed("syncAccount", { id: "sa_1", userId: "user_1", status: "ACTIVE", createdAt: new Date(1) });
    fake.seed("syncAccount", { id: "sa_2", userId: "user_1", status: "ACTIVE", createdAt: new Date(2) });
    fake.seed("contactShare", {
      id: "share_1",
      ownerUserId: "user_1",
      recipientUserId: "user_2",
      recipientContactId: null,
      shareType: "LIVE_SYNC",
      status: "ACTIVE",
    });
  }

  const assertDowngradedToFree = () => {
    assert.deepEqual(
      fake.rows("syncAccount").map((s) => [s.id, s.status]),
      [
        ["sa_1", "ACTIVE"],
        ["sa_2", "PAUSED"],
      ],
    );
    assert.equal(fake.rows("contactShare")[0]!.shareType, "STATIC_COPY");
  };

  test("Pro → Free (subscription deleted)", async () => {
    seedProUserWithSyncAndShares();
    stripeNow(stripeSub("sub_1", { status: "canceled" }));

    await processStripeWebhookEvent(event("customer.subscription.deleted", stripeSub("sub_1")), deps);

    assert.equal(subRow("sub_1")?.status, "CANCELED");
    assert.equal(subRow("sub_1")?.plan, "FREE");
    assert.equal(user().lifecycleState, "ACTIVE");
    assertDowngradedToFree();
  });

  test("Pro → paused runs the downgrade clean-up", async () => {
    seedProUserWithSyncAndShares();
    stripeNow(stripeSub("sub_1", { status: "paused" }));

    await processStripeWebhookEvent(event("customer.subscription.updated", stripeSub("sub_1")), deps);

    assert.equal(subRow("sub_1")?.status, "PAUSED");
    assert.equal(user().lifecycleState, "ACTIVE");
    assertDowngradedToFree();
    assert.equal(effectsRun, 1, "plan-changed email queued (Pro → Free)");
  });

  test("incomplete_expired runs the downgrade clean-up for a row that was live", async () => {
    seedProUserWithSyncAndShares();
    stripeNow(stripeSub("sub_1", { status: "incomplete_expired" }));

    await processStripeWebhookEvent(event("customer.subscription.updated", stripeSub("sub_1")), deps);

    assert.equal(subRow("sub_1")?.status, "EXPIRED");
    assertDowngradedToFree();
  });

  test("an expired first checkout neither downgrades nor cancels a legacy comp plan", async () => {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "manual_comp", plan: "PRO", status: "ACTIVE" });
    stripeNow(stripeSub("sub_new", { status: "incomplete_expired" }));

    await processStripeWebhookEvent(event("customer.subscription.updated", stripeSub("sub_new")), deps);

    assert.equal(subRow("sub_new")?.status, "EXPIRED");
    assert.equal(subRow("manual_comp")?.status, "ACTIVE");
  });

  test("Family lapse dissolves the family group: members get a copy and are removed", async () => {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", plan: "FAMILY" });
    fake.seed("group", { id: "fam_1", ownerId: "user_1", type: "FAMILY", name: "Smith Family", defaultAddressBookId: "gab_1" });
    fake.seed("groupMember", { id: "gm_owner", groupId: "fam_1", userId: "user_1", role: "OWNER", inviteStatus: "ACCEPTED" });
    fake.seed("groupMember", { id: "gm_2", groupId: "fam_1", userId: "user_2", role: "MEMBER", inviteStatus: "ACCEPTED" });
    fake.seed("groupMember", { id: "gm_3", groupId: "fam_1", userId: null, invitedEmail: "x@example.invalid", role: "MEMBER", inviteStatus: "PENDING" });
    stripeNow(stripeSub("sub_1", { status: "canceled", price: "price_family_m" }));

    await processStripeWebhookEvent(event("customer.subscription.deleted", stripeSub("sub_1")), deps);

    assert.deepEqual(fake.rows("groupMember").map((m) => m.id), ["gm_owner"]);
    assert.equal(fake.rows("group").length, 1, "group + book stay with the owner");
    const snapshotReads = fake.calls.filter(
      (c) => c.model === "groupContact" && c.op === "findMany",
    );
    assert.equal(snapshotReads.length, 1, "one snapshot for the one accepted member");
    assert.equal(effectsRun, 1, "the removed member is notified after commit");
  });

  test("Family lapse commits even when a member copy fails; the retry finishes without re-copying", async () => {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", plan: "FAMILY" });
    fake.seed("group", { id: "fam_1", ownerId: "user_1", type: "FAMILY", name: "Smith Family", defaultAddressBookId: "gab_1" });
    fake.seed("groupMember", { id: "gm_owner", groupId: "fam_1", userId: "user_1", role: "OWNER", inviteStatus: "ACCEPTED" });
    fake.seed("groupMember", { id: "gm_2", groupId: "fam_1", userId: "user_2", role: "MEMBER", inviteStatus: "ACCEPTED" });
    fake.seed("groupMember", { id: "gm_3", groupId: "fam_1", userId: "user_3", role: "MEMBER", inviteStatus: "ACCEPTED" });
    stripeNow(stripeSub("sub_1", { status: "canceled", price: "price_family_m" }));

    // snapshotFamilyBookForUser reads the shared book once per member copy;
    // the second copy (gm_3) fails once — e.g. a timeout on a big book.
    const groupContact = (fake.client as Record<string, { findMany: (a: unknown) => Promise<unknown> }>)
      .groupContact!;
    const copies: number[] = [];
    let reads = 0;
    let failNext = 2;
    groupContact.findMany = async () => {
      reads++;
      if (reads === failNext) {
        failNext = -1;
        throw new Error("copy timed out");
      }
      copies.push(reads);
      return [];
    };

    const evt = event("customer.subscription.deleted", stripeSub("sub_1"));
    const first = await processStripeWebhookEvent(evt, deps);

    assert.equal(first.status, "failed", "Stripe is asked to retry");
    assert.equal(subRow("sub_1")?.status, "CANCELED", "the lapse itself is committed");
    assert.equal(subRow("sub_1")?.plan, "FREE", "the owner does not keep Family");
    assert.match(webhookRow(evt.id)!.error as string, /post-commit/);
    assert.deepEqual(
      fake.rows("groupMember").map((m) => m.id),
      ["gm_owner", "gm_3"],
      "gm_2 is done; gm_3's removal rolled back with its failed copy",
    );
    assert.equal(copies.length, 1);
    assert.equal(effectsRun, 1, "gm_2's notice still goes out");

    const retry = await processStripeWebhookEvent(evt, deps);
    assert.equal(retry.status, "processed");
    assert.equal(webhookRow(evt.id)!.error, null);
    assert.deepEqual(fake.rows("groupMember").map((m) => m.id), ["gm_owner"]);
    assert.equal(copies.length, 2, "one copy per member — gm_2 is not copied again");
    assert.equal(effectsRun, 2);

    assert.equal((await processStripeWebhookEvent(evt, deps)).status, "skipped");
  });

  test("a lapse already applied elsewhere (billing-return sync) still dissolves on the webhook", async () => {
    seedUser();
    // State already says Free — the webhook sees no plan transition.
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", plan: "FREE", status: "CANCELED" });
    fake.seed("group", { id: "fam_1", ownerId: "user_1", type: "FAMILY", name: "F", defaultAddressBookId: null });
    fake.seed("groupMember", { id: "gm_owner", groupId: "fam_1", userId: "user_1", role: "OWNER", inviteStatus: "ACCEPTED" });
    fake.seed("groupMember", { id: "gm_2", groupId: "fam_1", userId: "user_2", role: "MEMBER", inviteStatus: "ACCEPTED" });
    stripeNow(stripeSub("sub_1", { status: "canceled", price: "price_family_m" }));

    await processStripeWebhookEvent(event("customer.subscription.deleted", stripeSub("sub_1")), deps);
    assert.deepEqual(fake.rows("groupMember").map((m) => m.id), ["gm_owner"]);
  });

  test("Family → paused also dissolves; Family → Teams does not", async () => {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", plan: "FAMILY" });
    fake.seed("group", { id: "fam_1", ownerId: "user_1", type: "FAMILY", name: "F", defaultAddressBookId: null });
    fake.seed("groupMember", { id: "gm_owner", groupId: "fam_1", userId: "user_1", role: "OWNER", inviteStatus: "ACCEPTED" });
    fake.seed("groupMember", { id: "gm_2", groupId: "fam_1", userId: "user_2", role: "MEMBER", inviteStatus: "ACCEPTED" });

    stripeNow(stripeSub("sub_1", { price: "price_teams_m", quantity: 3 }));
    await processStripeWebhookEvent(event("customer.subscription.updated", stripeSub("sub_1")), deps);
    assert.equal(fake.rows("groupMember").length, 2, "upgrade keeps the family");

    stripeNow(stripeSub("sub_1", { price: "price_family_m" }));
    await processStripeWebhookEvent(event("customer.subscription.updated", stripeSub("sub_1")), deps);
    stripeNow(stripeSub("sub_1", { price: "price_family_m", status: "paused" }));
    await processStripeWebhookEvent(event("customer.subscription.updated", stripeSub("sub_1")), deps);
    assert.deepEqual(fake.rows("groupMember").map((m) => m.id), ["gm_owner"]);
  });

  test("Teams lapse (org-anchored, paused) disables the team and opens a 14-day grace", async () => {
    fake.seed("group", {
      id: "team_1",
      ownerId: "user_1",
      type: "TEAM",
      name: "Acme",
      teamsEnabled: true,
      teamsGraceEndsAt: null,
    });
    fake.seed("subscriptionCustomer", {
      id: "sc_team_1",
      userId: null,
      groupId: "team_1",
      provider: "STRIPE",
      providerCustomerId: "cus_team",
    });
    stripeNow(stripeSub("sub_t", { customer: "cus_team", price: "price_teams_m", quantity: 5 }));
    await processStripeWebhookEvent(event("customer.subscription.created", stripeSub("sub_t")), deps);
    const group = () => fake.rows("group")[0]!;
    assert.equal(group().teamsEnabled, true);
    assert.equal(group().memberSlotsLimit, 5);

    stripeNow(stripeSub("sub_t", { customer: "cus_team", price: "price_teams_m", status: "paused" }));
    await processStripeWebhookEvent(event("customer.subscription.updated", stripeSub("sub_t")), deps);
    assert.equal(group().teamsEnabled, false);
    assert.equal(
      (group().teamsGraceEndsAt as Date).getTime(),
      PERIOD_END_S * 1000 + 14 * DAY,
    );

    // A replayed deletion must not push the deadline back.
    const deadline = (group().teamsGraceEndsAt as Date).getTime();
    stripeNow(stripeSub("sub_t", { customer: "cus_team", price: "price_teams_m", status: "canceled" }));
    await processStripeWebhookEvent(event("customer.subscription.deleted", stripeSub("sub_t")), deps);
    assert.equal((group().teamsGraceEndsAt as Date).getTime(), deadline);
  });

  test("an admin-LOCKED user stays LOCKED through every billing event", async () => {
    seedUser("user_1", "cus_1", "LOCKED");
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", status: "PAST_DUE" });

    stripeNow(stripeSub("sub_1", { status: "active" }));
    await processStripeWebhookEvent(event("invoice.payment_succeeded", invoice("sub_1")), deps);
    assert.equal(subRow("sub_1")?.status, "ACTIVE", "the subscription itself still updates");
    assert.equal(user().lifecycleState, "LOCKED");

    stripeNow(stripeSub("sub_1", { status: "past_due" }));
    await processStripeWebhookEvent(event("invoice.payment_failed", invoice("sub_1")), deps);
    assert.equal(user().lifecycleState, "LOCKED");

    stripeNow(stripeSub("sub_1", { status: "canceled" }));
    await processStripeWebhookEvent(event("customer.subscription.deleted", stripeSub("sub_1")), deps);
    assert.equal(user().lifecycleState, "LOCKED");
  });

  test("payment failure: GRACE with a grace deadline that retries don't extend; recovery clears it", async () => {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", status: "ACTIVE" });
    stripeNow(stripeSub("sub_1", { status: "past_due" }));

    await processStripeWebhookEvent(event("invoice.payment_failed", invoice("sub_1")), deps);
    assert.equal(subRow("sub_1")?.status, "PAST_DUE");
    assert.equal(user().lifecycleState, "GRACE");
    const deadline = subRow("sub_1")!.graceEndsAt as Date;
    assert.ok(Math.abs(deadline.getTime() - (Date.now() + 3 * DAY)) < 60_000);
    assert.equal(effectsRun, 2, "email + in-app notification, after commit");

    await processStripeWebhookEvent(event("invoice.payment_failed", invoice("sub_1")), deps);
    assert.equal((subRow("sub_1")!.graceEndsAt as Date).getTime(), deadline.getTime());

    stripeNow(stripeSub("sub_1", { status: "active" }));
    await processStripeWebhookEvent(event("invoice.payment_succeeded", invoice("sub_1")), deps);
    assert.equal(subRow("sub_1")?.status, "ACTIVE");
    assert.equal(subRow("sub_1")?.graceEndsAt, null);
    assert.equal(user().lifecycleState, "ACTIVE");
  });
});

// ─── A-24: one Pro trial per customer ─────────────────────────────────────────

describe("Pro trial eligibility (A-24)", () => {
  const eligible = () =>
    isEligibleForProTrial("user_1", fake.client as unknown as Parameters<typeof isEligibleForProTrial>[1]);

  test("a new customer, or one who only abandoned checkout, gets the trial", async () => {
    assert.equal(await eligible(), true);
    seedSubscriptionRow({ providerSubscriptionId: "sub_a", status: "INCOMPLETE" });
    seedSubscriptionRow({ providerSubscriptionId: "sub_b", status: "EXPIRED" });
    seedSubscriptionRow({ providerSubscriptionId: "manual_x", status: "ACTIVE" });
    assert.equal(await eligible(), true);
  });

  test("a canceled Pro subscription (row rewritten to plan FREE) blocks a second trial", async () => {
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", plan: "FREE", status: "CANCELED" });
    assert.equal(await eligible(), false);
  });

  test("a former Family subscriber doesn't get a Pro trial either", async () => {
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", plan: "FAMILY", status: "CANCELED" });
    assert.equal(await eligible(), false);
  });
});
