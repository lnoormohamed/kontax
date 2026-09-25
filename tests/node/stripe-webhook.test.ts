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
const { sweepDueFamilyDissolutions } = await import("../../src/server/stripe-handlers");
const { familyInviteBlockedReason, familyJoinBlockedReason } = await import(
  "../../src/server/family-lifecycle"
);
const { isEligibleForProTrial } = await import("../../src/server/billing-trial");

type WebhookDeps = Parameters<typeof processStripeWebhookEvent>[1];

const DAY = 24 * 60 * 60 * 1000;
const NOW_S = Math.floor(Date.now() / 1000);
const PERIOD_END_S = NOW_S + 20 * 24 * 60 * 60;

// ─── Fakes ────────────────────────────────────────────────────────────────────

let fake: ReturnType<typeof createFakePrisma>;
let stripeSubs: Map<string, Stripe.Subscription>;
let effectsRun: number;
/** Labels of queued effects (family notices carry `family:<kind>:<userId>`). */
let effectLabels: string[];
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
      group: {
        teamsEnabled: false,
        teamsGraceEndsAt: null,
        subscriptionId: null,
        familyDissolveAt: null,
      },
    },
  });
}

beforeEach(() => {
  fake = newFake();
  stripeSubs = new Map();
  effectsRun = 0;
  effectLabels = [];
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
      effectLabels.push(...effects.map((e) => (e as { label?: string }).label ?? "other"));
    },
  };
});

type SubOpts = {
  status?: Stripe.Subscription.Status;
  price?: string;
  customer?: string;
  quantity?: number;
  periodEnd?: number;
  cancelAtPeriodEnd?: boolean;
};

function stripeSub(id: string, opts: SubOpts = {}): Stripe.Subscription {
  return {
    id,
    object: "subscription",
    customer: opts.customer ?? "cus_1",
    status: opts.status ?? "active",
    cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
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
const familyNotices = () => effectLabels.filter((l) => l.startsWith("family:"));

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

  test("Family lapse commits even when a member copy fails; the retry finishes without re-copying", async () => {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", plan: "FAMILY" });
    // The notice period already ran out (e.g. the nightly sweep hasn't run
    // yet): the webhook dissolves opportunistically.
    fake.seed("group", {
      id: "fam_1",
      ownerId: "user_1",
      type: "FAMILY",
      name: "Smith Family",
      defaultAddressBookId: "gab_1",
      familyDissolveAt: new Date(Date.now() - DAY),
    });
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
    assert.deepEqual(familyNotices(), ["family:dissolved:user_2"], "gm_2's notice still goes out");

    const retry = await processStripeWebhookEvent(evt, deps);
    assert.equal(retry.status, "processed");
    assert.equal(webhookRow(evt.id)!.error, null);
    assert.deepEqual(fake.rows("groupMember").map((m) => m.id), ["gm_owner"]);
    assert.equal(copies.length, 2, "one copy per member — gm_2 is not copied again");
    assert.deepEqual(familyNotices(), ["family:dissolved:user_2", "family:dissolved:user_3"]);
    assert.equal(fake.rows("group")[0]!.familyDissolveAt, null, "marker cleared once everyone is out");

    assert.equal((await processStripeWebhookEvent(evt, deps)).status, "skipped");
  });

  test("a lapse already applied elsewhere (billing-return sync) still starts the notice on the webhook", async () => {
    seedUser();
    // State already says Free — the webhook sees no plan transition.
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", plan: "FREE", status: "CANCELED" });
    fake.seed("group", { id: "fam_1", ownerId: "user_1", type: "FAMILY", name: "F", defaultAddressBookId: null });
    fake.seed("groupMember", { id: "gm_owner", groupId: "fam_1", userId: "user_1", role: "OWNER", inviteStatus: "ACCEPTED" });
    fake.seed("groupMember", { id: "gm_2", groupId: "fam_1", userId: "user_2", role: "MEMBER", inviteStatus: "ACCEPTED" });
    stripeNow(stripeSub("sub_1", { status: "canceled", price: "price_family_m" }));

    await processStripeWebhookEvent(event("customer.subscription.deleted", stripeSub("sub_1")), deps);
    assert.ok(fake.rows("group")[0]!.familyDissolveAt instanceof Date);
    assert.equal(fake.rows("groupMember").length, 2, "nobody removed yet");
  });

  test("Family → paused starts the notice; Family → Teams does not", async () => {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", plan: "FAMILY" });
    fake.seed("group", { id: "fam_1", ownerId: "user_1", type: "FAMILY", name: "F", defaultAddressBookId: null });
    fake.seed("groupMember", { id: "gm_owner", groupId: "fam_1", userId: "user_1", role: "OWNER", inviteStatus: "ACCEPTED" });
    fake.seed("groupMember", { id: "gm_2", groupId: "fam_1", userId: "user_2", role: "MEMBER", inviteStatus: "ACCEPTED" });

    stripeNow(stripeSub("sub_1", { price: "price_teams_m", quantity: 3 }));
    await processStripeWebhookEvent(event("customer.subscription.updated", stripeSub("sub_1")), deps);
    assert.equal(fake.rows("group")[0]!.familyDissolveAt, null, "upgrade keeps the family");

    stripeNow(stripeSub("sub_1", { price: "price_family_m" }));
    await processStripeWebhookEvent(event("customer.subscription.updated", stripeSub("sub_1")), deps);
    stripeNow(stripeSub("sub_1", { price: "price_family_m", status: "paused" }));
    await processStripeWebhookEvent(event("customer.subscription.updated", stripeSub("sub_1")), deps);
    assert.ok(fake.rows("group")[0]!.familyDissolveAt instanceof Date);
    assert.equal(fake.rows("groupMember").length, 2);
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

// ─── Admin comp durability (P49A-07, Fable review) ────────────────────────────

describe("admin plan override vs the customer's own Stripe billing", () => {
  const activePersonalPlans = (userId = "user_1") =>
    fake
      .rows("subscription")
      .filter((s) => s.userId === userId && ["ACTIVE", "TRIALING", "PAST_DUE"].includes(s.status as string))
      .map((s) => ({ plan: s.plan as "FREE" | "PRO" | "FAMILY" | "TEAMS", memberSlotsLimit: null }));

  test("comp PRO → TEAMS on a paying user survives renewals: row stays ACTIVE, plan stays TEAMS, no downgrade", async () => {
    // A paying Pro customer who owns a (legacy, user-anchored) team, with two
    // sync accounts and a live share — everything applyDowngrade would touch.
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", plan: "PRO" });
    fake.seed("group", { id: "team_1", ownerId: "user_1", type: "TEAM", name: "Acme", teamsGraceEndsAt: null });
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

    const { overridePlanForUser } = await import("../../src/server/admin/plan-override");
    const { resolveEffectivePlan } = await import("../../src/server/dav/plan-entitlements.mjs");
    const override = await overridePlanForUser(fake.client as never, { targetUserId: "user_1", plan: "TEAMS" });
    assert.equal(override.providerSubscriptionId, "manual_admin-override-user_1");
    assert.equal(override.providerCustomerId, "cus_1", "the real customer row is reused, untouched");

    // Renewal: the paid Pro subscription rolls into a new period.
    const renewed = stripeSub("sub_1", { periodEnd: PERIOD_END_S + 30 * 24 * 60 * 60 });
    stripeNow(renewed);
    await processStripeWebhookEvent(event("customer.subscription.updated", renewed), deps);
    await processStripeWebhookEvent(event("invoice.payment_succeeded", invoice("sub_1")), deps);

    assert.equal(subRow("manual_admin-override-user_1")?.status, "ACTIVE", "the comp row is not swept");
    assert.equal(subRow("sub_1")?.status, "ACTIVE");
    assert.equal(resolveEffectivePlan({ userId: "user_1", subscriptions: activePersonalPlans(), teamGroups: [] }).plan, "TEAMS");
    // No applyDowngrade: sync accounts, shares and the owned team untouched.
    assert.deepEqual(
      fake.rows("syncAccount").map((s) => s.status),
      ["ACTIVE", "ACTIVE"],
    );
    assert.equal(fake.rows("contactShare")[0]!.shareType, "LIVE_SYNC");
    assert.equal(fake.rows("group")[0]!.teamsGraceEndsAt, null, "no Teams grace opened on the owned team");
    assert.equal(effectsRun, 0, "no plan-changed email: the effective plan never moved");
    assert.equal(user().lifecycleState, "ACTIVE");
  });

  test("a live Stripe subscription still supersedes a genuine legacy manual_ comp plan", async () => {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "manual_comp", plan: "PRO", status: "ACTIVE", currentPeriodEnd: null });
    stripeNow(stripeSub("sub_new"));

    await processStripeWebhookEvent(event("customer.subscription.created", stripeSub("sub_new")), deps);

    assert.equal(subRow("sub_new")?.status, "ACTIVE");
    assert.equal(subRow("manual_comp")?.status, "CANCELED");
  });

  test("a legacy admin-override- row is an admin grant too and is not swept", async () => {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "admin-override-user_1", plan: "FAMILY", currentPeriodEnd: null });
    stripeNow(stripeSub("sub_new"));

    await processStripeWebhookEvent(event("customer.subscription.created", stripeSub("sub_new")), deps);

    assert.equal(subRow("admin-override-user_1")?.status, "ACTIVE");
  });
});

// ─── Family plan end-of-life: 7-day notice (lifecycle-policies.md §1a / §3a) ──

describe("Family 7-day notice before dissolution", () => {
  /** Owner user_1 on Family; accepted member user_2; a pending invite. */
  function seedFamilyOwner(subOverrides: Record<string, unknown> = {}) {
    seedUser();
    seedSubscriptionRow({ providerSubscriptionId: "sub_1", plan: "FAMILY", ...subOverrides });
    fake.seed("group", {
      id: "fam_1",
      ownerId: "user_1",
      type: "FAMILY",
      name: "Smith Family",
      defaultAddressBookId: "gab_1",
    });
    fake.seed("groupMember", { id: "gm_owner", groupId: "fam_1", userId: "user_1", role: "OWNER", inviteStatus: "ACCEPTED" });
    fake.seed("groupMember", { id: "gm_2", groupId: "fam_1", userId: "user_2", role: "MEMBER", inviteStatus: "ACCEPTED" });
    fake.seed("groupMember", { id: "gm_3", groupId: "fam_1", userId: null, invitedEmail: "x@example.invalid", role: "MEMBER", inviteStatus: "PENDING" });
  }

  const group = () => fake.rows("group").find((g) => g.id === "fam_1")!;
  const memberIds = () => fake.rows("groupMember").map((m) => m.id);

  async function lapse() {
    stripeNow(stripeSub("sub_1", { status: "canceled", price: "price_family_m" }));
    return processStripeWebhookEvent(event("customer.subscription.deleted", stripeSub("sub_1")), deps);
  }

  /** The shared book holds one contact; the snapshot copies it for real. */
  function stubSharedBook() {
    const groupContact = (fake.client as Record<string, { findMany: (a: unknown) => Promise<unknown> }>)
      .groupContact!;
    groupContact.findMany = async () => [{ contact: { fullName: "Ann Smith", email: "ann@example.invalid" } }];
  }

  const sweep = async (now: Date) => {
    const effects: Parameters<typeof sweepDueFamilyDissolutions>[1] = [];
    const result = await sweepDueFamilyDissolutions(
      fake.client as unknown as Parameters<typeof sweepDueFamilyDissolutions>[0],
      effects,
      now,
    );
    effectLabels.push(...effects.map((e) => (e as { label?: string }).label ?? "other"));
    return result;
  };

  test("scheduling cancellation notifies accepted members once; a retry doesn't re-notify", async () => {
    seedFamilyOwner();
    stripeNow(stripeSub("sub_1", { price: "price_family_m", cancelAtPeriodEnd: true }));
    const evt = event("customer.subscription.updated", stripeSub("sub_1", { price: "price_family_m" }));

    // First delivery fails inside the transaction (after the flip was
    // written): everything rolls back, nothing is sent.
    const events = (fake.client as Record<string, { create: (a: { data: { error?: string } }) => Promise<unknown> }>)
      .stripeWebhookEvent!;
    const create = events.create.bind(events);
    let blip = true;
    events.create = async (a) => {
      if (blip && !a.data.error) {
        blip = false;
        throw new Error("db blip");
      }
      return create(a);
    };
    assert.equal((await processStripeWebhookEvent(evt, deps)).status, "failed");
    assert.equal(subRow("sub_1")?.cancelAtPeriodEnd, false, "rolled back");
    assert.deepEqual(familyNotices(), []);

    assert.equal((await processStripeWebhookEvent(evt, deps)).status, "processed");
    assert.equal(subRow("sub_1")?.cancelAtPeriodEnd, true);
    assert.deepEqual(
      familyNotices(),
      ["family:ending-scheduled:user_2"],
      "the accepted member only — not the owner, not the pending invite",
    );

    // Replays, and later events carrying the same state, notify nobody again.
    assert.equal((await processStripeWebhookEvent(evt, deps)).status, "skipped");
    await processStripeWebhookEvent(event("invoice.payment_succeeded", invoice("sub_1")), deps);
    await processStripeWebhookEvent(event("customer.subscription.updated", stripeSub("sub_1")), deps);
    assert.deepEqual(familyNotices(), ["family:ending-scheduled:user_2"]);
    assert.equal(group().familyDissolveAt, null, "still active until period end");
    assert.deepEqual(memberIds(), ["gm_owner", "gm_2", "gm_3"]);

    // The owner resumes: a short "continues" notice, once.
    stripeNow(stripeSub("sub_1", { price: "price_family_m", cancelAtPeriodEnd: false }));
    await processStripeWebhookEvent(event("customer.subscription.updated", stripeSub("sub_1")), deps);
    await processStripeWebhookEvent(event("customer.subscription.updated", stripeSub("sub_1")), deps);
    assert.deepEqual(familyNotices(), ["family:ending-scheduled:user_2", "family:ending-cancelled:user_2"]);
  });

  test("a lapse starts a 7-day notice: date set, nobody removed, members told once", async () => {
    seedFamilyOwner({ cancelAtPeriodEnd: true });
    const before = Date.now();
    await lapse();

    assert.equal(subRow("sub_1")?.plan, "FREE", "the owner's own plan drops immediately");
    const dissolveAt = group().familyDissolveAt as Date;
    assert.ok(dissolveAt instanceof Date);
    assert.ok(Math.abs(dissolveAt.getTime() - (before + 7 * DAY)) < 60_000);
    assert.deepEqual(memberIds(), ["gm_owner", "gm_2", "gm_3"], "nobody removed");
    assert.deepEqual(familyNotices(), ["family:lapsed:user_2"]);

    // Later events for the owner neither move the date nor re-notify.
    stripeNow(stripeSub("sub_1", { status: "canceled", price: "price_family_m" }));
    await processStripeWebhookEvent(event("customer.subscription.updated", stripeSub("sub_1")), deps);
    assert.equal((group().familyDissolveAt as Date).getTime(), dissolveAt.getTime());
    assert.deepEqual(familyNotices(), ["family:lapsed:user_2"]);
  });

  test("during the window members keep access, the sweep waits, and invites/joins are blocked", async () => {
    seedFamilyOwner();
    assert.equal(familyInviteBlockedReason(group() as { familyDissolveAt: Date | null }, "FAMILY"), null);
    assert.equal(familyJoinBlockedReason(group() as { familyDissolveAt: Date | null }), null);

    await lapse();

    // Family book access is membership-based (web: family-access.ts, CardDAV:
    // getFamilyBookForUser in server.mjs) — the accepted row and book stay.
    const member = fake.rows("groupMember").find((m) => m.id === "gm_2")!;
    assert.equal(member.inviteStatus, "ACCEPTED");
    assert.equal(group().defaultAddressBookId, "gab_1");

    const early = await sweep(new Date(Date.now() + 6 * DAY));
    assert.equal(early.removed, 0, "not due yet");
    assert.deepEqual(memberIds(), ["gm_owner", "gm_2", "gm_3"]);

    const windingDown = group() as { familyDissolveAt: Date | null };
    assert.match(familyInviteBlockedReason(windingDown, "FREE") ?? "", /closes on/);
    assert.match(familyInviteBlockedReason(windingDown, "FAMILY") ?? "", /closes on/);
    assert.ok(familyJoinBlockedReason(windingDown));
    assert.ok(familyInviteBlockedReason({ familyDissolveAt: null }, "PRO"), "no invites without Family");
  });

  test("re-subscribing within 7 days clears the notice and nobody is removed", async () => {
    seedFamilyOwner();
    await lapse();
    assert.ok(group().familyDissolveAt);

    stripeNow(stripeSub("sub_2", { price: "price_family_m" }));
    await processStripeWebhookEvent(event("customer.subscription.created", stripeSub("sub_2")), deps);

    assert.equal(group().familyDissolveAt, null);
    assert.deepEqual(familyNotices(), ["family:lapsed:user_2", "family:continues:user_2"]);

    const late = await sweep(new Date(Date.now() + 8 * DAY));
    assert.equal(late.removed, 0);
    assert.deepEqual(memberIds(), ["gm_owner", "gm_2", "gm_3"]);
  });

  test("the sweep clears a stale date if the owner is entitled again (missed webhook)", async () => {
    seedFamilyOwner();
    group().familyDissolveAt = new Date(Date.now() - DAY); // owner still on Family

    const result = await sweep(new Date());
    assert.equal(result.removed, 0);
    assert.equal(group().familyDissolveAt, null);
    assert.deepEqual(memberIds(), ["gm_owner", "gm_2", "gm_3"]);
  });

  test("after 7 days the sweep dissolves: copies made, members removed; re-running is a no-op", async () => {
    seedFamilyOwner();
    await lapse();
    stubSharedBook();

    const result = await sweep(new Date(Date.now() + 7 * DAY + 60_000));
    assert.deepEqual(result, { owners: 1, removed: 2, errors: [] });
    assert.deepEqual(memberIds(), ["gm_owner"], "member removed, pending invite withdrawn");
    assert.equal(fake.rows("group").length, 1, "group + book stay with the owner");
    assert.equal(group().familyDissolveAt, null, "nothing pending any more");

    const books = fake.rows("addressBook");
    assert.equal(books.length, 1, "one private copy, for the accepted member");
    assert.equal(books[0]!.userId, "user_2");
    assert.equal(books[0]!.sourceGroupBookId, "gab_1");
    assert.equal(books[0]!.name, "Smith Family");
    const copies = fake.rows("contact");
    assert.equal(copies.length, 1);
    assert.equal(copies[0]!.userId, "user_2");
    assert.equal(copies[0]!.bookId, books[0]!.id);
    assert.equal(copies[0]!.fullName, "Ann Smith");
    assert.deepEqual(familyNotices(), ["family:lapsed:user_2", "family:dissolved:user_2"]);

    const again = await sweep(new Date(Date.now() + 8 * DAY));
    assert.deepEqual(again, { owners: 0, removed: 0, errors: [] });
    assert.equal(fake.rows("addressBook").length, 1, "no second copy");
    assert.deepEqual(familyNotices(), ["family:lapsed:user_2", "family:dissolved:user_2"]);
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
