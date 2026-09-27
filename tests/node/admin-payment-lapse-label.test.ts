import assert from "node:assert/strict";
import { mock, test } from "node:test";

/**
 * P49A-19 (Fable review, item 5): admin / support views show a payment lapse
 * instead of the raw plan, and the team billing summary flags an org whose
 * payment grace is over.
 */

const DAY = 24 * 60 * 60 * 1000;
const lapsedAt = new Date("2026-01-03T09:00:00Z"); // in the past

const state = { users: [] as unknown[], group: null as unknown };
const stub = {
  user: { findMany: async () => state.users },
  group: { findUnique: async () => state.group },
};
mock.module("~/server/db", { namedExports: { db: stub } });

const { adminPlanLabel, searchUsers } = await import("~/server/admin/users");
const { getTeamBillingSummary } = await import("~/server/team-access");

test("adminPlanLabel names the held-back plan and when the account moved", () => {
  assert.equal(adminPlanLabel("PRO", null), "Pro");
  assert.equal(
    adminPlanLabel("FREE", { plan: "PRO", graceEndedAt: lapsedAt }),
    "Pro — payment lapsed, on Free since Jan 3, 2026",
  );
});

test("the admin user list resolves the plan like enforcement (grace applied, comp wins)", async () => {
  const row = (id: string, subscriptions: unknown[]) => ({
    id,
    name: id,
    email: `${id}@example.invalid`,
    lifecycleState: "GRACE",
    scheduledDeleteAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    subscriptions,
  });
  state.users = [
    row("lapsed", [{ plan: "PRO", memberSlotsLimit: null, status: "PAST_DUE", graceEndsAt: lapsedAt }]),
    row("in_grace", [{ plan: "PRO", memberSlotsLimit: null, status: "PAST_DUE", graceEndsAt: new Date(Date.now() + DAY) }]),
    row("comp", [
      { plan: "PRO", memberSlotsLimit: null, status: "PAST_DUE", graceEndsAt: lapsedAt },
      { plan: "PRO", memberSlotsLimit: null, status: "ACTIVE", graceEndsAt: null },
    ]),
  ];
  const rows = await searchUsers({ query: "", view: "all" });
  assert.deepEqual(
    rows.map((r) => [r.id, r.plan]),
    [
      ["lapsed", "Pro — payment lapsed, on Free since Jan 3, 2026"],
      ["in_grace", "Pro"],
      ["comp", "Pro"],
    ],
  );
});

test("team billing summary flags an org past its payment grace", async () => {
  const group = (sub: Record<string, unknown>) => ({
    teamsEnabled: true,
    teamsGraceEndsAt: null,
    owner: { name: "Owner", email: "o@example.invalid" },
    subscriptions: [{ plan: "TEAMS", memberSlotsLimit: 5, currentPeriodEnd: null, cancelAtPeriodEnd: false, ...sub }],
    _count: { members: 3 },
  });
  state.group = group({ status: "PAST_DUE", graceEndsAt: lapsedAt });
  assert.equal((await getTeamBillingSummary("team_1"))?.paymentLapsedSince?.getTime(), lapsedAt.getTime());
  state.group = group({ status: "PAST_DUE", graceEndsAt: new Date(Date.now() + DAY) });
  assert.equal((await getTeamBillingSummary("team_1"))?.paymentLapsedSince, null);
  state.group = group({ status: "ACTIVE", graceEndsAt: null });
  assert.equal((await getTeamBillingSummary("team_1"))?.paymentLapsedSince, null);
});
