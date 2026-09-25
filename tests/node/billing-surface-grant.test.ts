import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { matchWhere } from "./_fake-prisma";

/**
 * P49A-06/07 (Fable review) — the Plan & billing card for a plan the user
 * doesn't pay for.
 *
 * A Teams *member* (Teams via an org-billed team) and a user on a Kontax comp
 * / admin override with no real subscription used to get the paid "active"
 * card, whose "Manage billing" / "Cancel plan" CTAs open the wrong (or a
 * placeholder) Stripe customer. They now get "teamMember" / "comp" states with
 * a grant and no price/renewal; the component renders no cancel/manage CTA for
 * the granted plan.
 *
 * Drives the real getBillingSurface (and getUserPlanSummary /
 * plan-entitlements.mjs underneath) against a programmable Prisma stub.
 */

type Row = Record<string, unknown>;
const state = {
  subscriptions: [] as Row[],
  teamGroups: [] as Row[],
  groups: new Map<string, { name: string }>(),
};

const ACTIVE = ["ACTIVE", "TRIALING", "PAST_DUE"];

const stub = {
  user: {
    findUnique: async () => ({
      lifecycleState: "ACTIVE",
      subscriptions: state.subscriptions
        .filter((s) => ACTIVE.includes(s.status as string))
        .map((s) => ({ plan: s.plan, memberSlotsLimit: null })),
      groupMemberships: state.teamGroups.map((group) => ({ group })),
    }),
  },
  subscription: {
    findMany: async ({ where }: { where: Record<string, unknown> }) =>
      state.subscriptions.filter((row) => matchWhere(row, where)),
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      state.subscriptions.find((row) => matchWhere(row, where)) ?? null,
  },
  group: {
    findUnique: async ({ where }: { where: { id: string } }) => state.groups.get(where.id) ?? null,
  },
  groupMember: { findFirst: async () => null },
  contact: { count: async () => 42 },
  importJob: { aggregate: async () => ({ _sum: { importedCount: 0 } }) },
  syncAccount: { count: async () => 0 },
  appPassword: { count: async () => 0 },
};

mock.module("~/server/db", { namedExports: { db: stub } });
mock.module("~/server/stripe-catalog", { namedExports: { getStripeCatalog: async () => null } });

const { getBillingSurface } = await import("~/server/billing-surface");

const teamGroup = (overrides: Row = {}) => ({
  id: "team_1",
  ownerId: "owner_1",
  teamsEnabled: true,
  teamsGraceEndsAt: null,
  memberSlotsLimit: 10,
  subscriptions: [{ memberSlotsLimit: 10 }],
  ...overrides,
});

const sub = (overrides: Row) => ({
  userId: "user_1",
  status: "ACTIVE",
  interval: "MONTHLY",
  currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
  trialEndsAt: null,
  graceEndsAt: null,
  cancelAtPeriodEnd: false,
  canceledAt: null,
  ...overrides,
});

beforeEach(() => {
  state.subscriptions = [];
  state.teamGroups = [];
  state.groups = new Map([["team_1", { name: "Acme" }]]);
});

test("a Teams member with no personal subscription gets the member view, not the paid active card", async () => {
  state.teamGroups = [teamGroup()];

  const surface = await getBillingSurface("user_1");

  assert.equal(surface.state, "teamMember");
  assert.equal(surface.plan, "TEAMS");
  assert.deepEqual(surface.grant, { source: "team", teamName: "Acme", isOwner: false, teamState: "active" });
  assert.equal(surface.price, null, "no price: the member pays nothing");
  assert.equal(surface.renewalDate, null);
  assert.equal(surface.personalSubscription, null, "no personal portal to offer");
  assert.ok(surface.usage, "usage grid still shown");
});

test("a Teams member who still pays for their own Pro is offered that subscription's portal only", async () => {
  state.teamGroups = [teamGroup()];
  state.subscriptions = [sub({ providerSubscriptionId: "sub_pro", plan: "PRO" })];

  const surface = await getBillingSurface("user_1");

  assert.equal(surface.state, "teamMember");
  assert.deepEqual(surface.personalSubscription, { planLabel: "Pro" });
});

test("the org owner (Teams billed to the team) gets the team view flagged as owner", async () => {
  state.teamGroups = [teamGroup({ ownerId: "user_1" })];
  const surface = await getBillingSurface("user_1");
  assert.equal(surface.state, "teamMember");
  assert.equal(surface.grant?.source === "team" && surface.grant.isOwner, true);
});

test("an admin override with no real subscription shows 'Plan granted by Kontax' (comp)", async () => {
  state.subscriptions = [sub({ providerSubscriptionId: "manual_admin-override-user_1", plan: "PRO", currentPeriodEnd: null, interval: null })];

  const surface = await getBillingSurface("user_1");

  assert.equal(surface.state, "comp");
  assert.equal(surface.plan, "PRO");
  assert.deepEqual(surface.grant, { source: "kontax" });
  assert.equal(surface.price, null);
  assert.equal(surface.intervalLabel, null);
  assert.equal(surface.personalSubscription, null);
});

test("a comp above a paid plan shows the comp view and keeps the paid plan's portal", async () => {
  state.subscriptions = [
    sub({ providerSubscriptionId: "manual_admin-override-user_1", plan: "TEAMS", currentPeriodEnd: null }),
    sub({ providerSubscriptionId: "sub_pro", plan: "PRO" }),
  ];
  const surface = await getBillingSurface("user_1");
  assert.equal(surface.state, "comp");
  assert.equal(surface.plan, "TEAMS");
  assert.deepEqual(surface.personalSubscription, { planLabel: "Pro" });
});

test("a paying user (real subscription at the effective plan) keeps the normal active card", async () => {
  state.subscriptions = [
    sub({ providerSubscriptionId: "manual_admin-override-user_1", plan: "PRO", currentPeriodEnd: null }),
    sub({ providerSubscriptionId: "sub_fam", plan: "FAMILY" }),
  ];
  const surface = await getBillingSurface("user_1");
  assert.equal(surface.plan, "FAMILY");
  assert.notEqual(surface.state, "comp");
  assert.notEqual(surface.state, "teamMember");
  assert.equal(surface.grant, null);
  assert.equal(surface.intervalLabel, "Monthly", "interval from the real subscription, not the comp row");
});
