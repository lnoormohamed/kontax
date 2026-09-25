import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, mock, test } from "node:test";

/**
 * P49A-06 — entitlements (A-10), the contact cap on every create path (A-25)
 * and the team lapse lock (A-26).
 *
 * Drives the real code (src/server/dav/plan-entitlements.mjs, billing.ts,
 * team-access.ts and the createContact / inviteTeamMember server actions)
 * against a small programmable Prisma stub installed as `globalThis.prisma`
 * (which src/server/db.ts reuses). No network, no database.
 */

// ─── Prisma stub ──────────────────────────────────────────────────────────────

type Sub = { plan: "FREE" | "PRO" | "FAMILY" | "TEAMS"; memberSlotsLimit: number | null };
type TeamGroup = {
  id: string;
  ownerId: string;
  name?: string;
  type?: "TEAM";
  teamsEnabled: boolean;
  teamsGraceEndsAt: Date | null;
  memberSlotsLimit: number | null;
  subscriptions: Array<{ memberSlotsLimit: number | null }>;
  /** Legacy user-anchored teams: the owner's personal Teams subscription(s). */
  owner?: { subscriptions: Array<{ memberSlotsLimit: number | null }> };
};
type UserState = { subscriptions: Sub[]; teamGroups: TeamGroup[] };

const DAY = 24 * 60 * 60 * 1000;

const state = {
  users: new Map<string, UserState>(),
  contactCounts: new Map<string, number>(),
  /** Legacy (user-anchored) personal Teams subscriptions, by owner id. */
  legacyTeamsOwners: new Set<string>(),
  familyMembership: null as null | Record<string, unknown>,
  familyGroupOwner: null as null | string,
  manageableTeam: null as null | { role: "OWNER" | "ADMIN"; group: TeamGroup },
  teamMembership: null as null | { id: string; groupId: string; role: string; group: { name: string } },
  teamBook: null as null | { id: string; group: TeamGroup },
  locks: [] as string[],
  contactCreates: [] as Array<Record<string, unknown>>,
  userQueries: [] as string[],
};

const userState = (id: string): UserState => state.users.get(id) ?? { subscriptions: [], teamGroups: [] };

const stub = {
  user: {
    findUnique: async ({ where, select }: { where: { id: string }; select?: Record<string, unknown> }) => {
      state.userQueries.push(where.id);
      if (select && "autoFillPhoneticNames" in select) return { autoFillPhoneticNames: false };
      const u = userState(where.id);
      return {
        lifecycleState: "ACTIVE",
        subscriptions: u.subscriptions,
        groupMemberships: u.teamGroups.map((group) => ({ group })),
      };
    },
  },
  contact: {
    count: async ({ where }: { where: { userId: string } }) => state.contactCounts.get(where.userId) ?? 0,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      state.contactCreates.push(data);
      return { id: `contact_${state.contactCreates.length}`, ...data };
    },
  },
  importJob: { aggregate: async () => ({ _sum: { importedCount: 0 } }) },
  syncAccount: { count: async () => 0 },
  appPassword: { count: async () => 0 },
  subscription: {
    findFirst: async ({ where }: { where: { userId: string; plan: string } }) =>
      where.plan === "TEAMS" && state.legacyTeamsOwners.has(where.userId) ? { id: "legacy_sub" } : null,
  },
  groupMember: {
    findFirst: async ({ where }: { where: { role?: unknown; group?: { type?: string } } }) => {
      if (where.group?.type === "FAMILY") return state.familyMembership;
      if (where.role) return state.manageableTeam;
      return state.teamMembership;
    },
  },
  group: {
    findUnique: async () => (state.familyGroupOwner ? { ownerId: state.familyGroupOwner } : null),
  },
  groupAddressBook: {
    findFirst: async () => state.teamBook,
  },
  groupContact: { create: async () => ({ id: "gc_1" }) },
  activityEvent: { create: async () => ({ id: "ev_1" }) },
  $queryRaw: async (_strings: TemplateStringsArray, userId: string) => {
    state.locks.push(userId);
    return [];
  },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(stub),
};
(globalThis as unknown as { prisma: unknown }).prisma = stub;

// Server-action plumbing that only exists inside a real Next.js request.
let sessionUserId = "user_1";
mock.module("~/server/auth/require-session", {
  namedExports: {
    requireUserId: async () => sessionUserId,
    requireSession: async () => ({ user: { id: sessionUserId } }),
    isSessionError: () => false,
    SessionError: class SessionError extends Error {},
  },
});
class RedirectSignal extends Error {}
mock.module("next/navigation", {
  namedExports: {
    redirect: (url: string) => {
      throw new RedirectSignal(url);
    },
    notFound: () => {
      throw new Error("notFound");
    },
  },
});

const entitlements = await import("../../src/server/dav/plan-entitlements.mjs");
const billing = await import("~/server/billing");
const teamAccess = await import("~/server/team-access");
const { createContact } = await import("~/app/actions/contacts");
const { inviteTeamMember } = await import("~/app/actions/teams");

beforeEach(() => {
  state.users.clear();
  state.contactCounts.clear();
  state.legacyTeamsOwners.clear();
  state.familyMembership = null;
  state.familyGroupOwner = null;
  state.manageableTeam = null;
  state.teamMembership = null;
  state.teamBook = null;
  state.locks = [];
  state.contactCreates = [];
  state.userQueries = [];
  sessionUserId = "user_1";
});

const team = (overrides: Partial<TeamGroup> = {}): TeamGroup => ({
  id: "team_1",
  ownerId: "owner_1",
  name: "Acme",
  type: "TEAM",
  teamsEnabled: true,
  teamsGraceEndsAt: null,
  memberSlotsLimit: 10,
  subscriptions: [{ memberSlotsLimit: 12 }],
  ...overrides,
});

// ─── A-10: effective plan ─────────────────────────────────────────────────────

describe("A-10 effective plan", () => {
  test("a Teams member with no personal subscription gets Teams entitlements (API, unlimited contacts)", async () => {
    state.users.set("member_1", { subscriptions: [], teamGroups: [team()] });

    const ctx = await billing.getUserBillingContext("member_1");

    assert.equal(ctx.plan, "TEAMS");
    assert.equal(ctx.planSource, "team");
    assert.equal(ctx.personalPlan, "FREE");
    assert.equal(ctx.entitlements.apiAccessEnabled, true);
    assert.equal(ctx.entitlements.contactsLimit, null);
    assert.equal(ctx.entitlements.syncAccountsLimit, 5);
    assert.equal(ctx.entitlements.memberSlotsLimit, 12, "seat count from the org's Teams subscription");
    assert.deepEqual(ctx.teamEntitlement, { groupId: "team_1", ownerId: "owner_1", state: "active" });
    // A member may not run a team of their own on the strength of membership.
    assert.equal(billing.canRunOwnTeam(ctx, "member_1"), false);
  });

  test("the org owner is entitled via the org subscription and may run the team", async () => {
    state.users.set("owner_1", { subscriptions: [], teamGroups: [team()] });
    const ctx = await billing.getUserBillingContext("owner_1");
    assert.equal(ctx.plan, "TEAMS");
    assert.equal(billing.canRunOwnTeam(ctx, "owner_1"), true);
  });

  test("seat count falls back to the group when the org subscription has none", () => {
    const r = entitlements.resolveEffectivePlan({
      userId: "m",
      subscriptions: [],
      teamGroups: [team({ subscriptions: [], memberSlotsLimit: 7 })],
    });
    assert.equal(r.entitlements.memberSlotsLimit, 7);
  });

  test("grace keeps Teams; past grace and pending (never paid) teams grant nothing", () => {
    const now = new Date();
    const grace = entitlements.resolveEffectivePlan({
      userId: "m",
      subscriptions: [],
      teamGroups: [team({ teamsEnabled: false, teamsGraceEndsAt: new Date(now.getTime() + DAY) })],
      now,
    });
    assert.equal(grace.plan, "TEAMS");
    assert.equal(grace.teamEntitlement?.state, "grace");

    const lapsed = entitlements.resolveEffectivePlan({
      userId: "m",
      subscriptions: [],
      teamGroups: [team({ teamsEnabled: false, teamsGraceEndsAt: new Date(now.getTime() - DAY) })],
      now,
    });
    assert.equal(lapsed.plan, "FREE");
    assert.equal(lapsed.entitlements.contactsLimit, 500);

    const pending = entitlements.resolveEffectivePlan({
      userId: "m",
      subscriptions: [],
      teamGroups: [team({ teamsEnabled: false, teamsGraceEndsAt: null })],
      now,
    });
    assert.equal(pending.plan, "FREE");
  });

  test("legacy user-anchored team: members are credited while the OWNER holds a personal Teams plan (Fable review)", async () => {
    const legacy = team({
      teamsEnabled: false,
      teamsGraceEndsAt: null,
      subscriptions: [],
      memberSlotsLimit: 4,
      owner: { subscriptions: [{ memberSlotsLimit: 8 }] },
    });
    state.users.set("member_1", { subscriptions: [], teamGroups: [legacy] });

    const ctx = await billing.getUserBillingContext("member_1");
    assert.equal(ctx.plan, "TEAMS");
    assert.equal(ctx.planSource, "team");
    assert.deepEqual(ctx.teamEntitlement, { groupId: "team_1", ownerId: "owner_1", state: "active" });
    assert.equal(ctx.entitlements.memberSlotsLimit, 8, "seats from the owner's legacy subscription");
    assert.equal(ctx.entitlements.contactsLimit, null);
    assert.equal(billing.canRunOwnTeam(ctx, "member_1"), false);

    // Same rule as isTeamLocked: a past grace date doesn't lock a team whose
    // owner still pays personally — so it doesn't strip its members either.
    const pastGrace = entitlements.resolveEffectivePlan({
      userId: "member_1",
      subscriptions: [],
      teamGroups: [{ ...legacy, teamsGraceEndsAt: new Date(Date.now() - DAY) }],
    });
    assert.equal(pastGrace.plan, "TEAMS");

    // Owner's personal Teams plan gone → nothing (a pending / lapsed team).
    const gone = entitlements.resolveEffectivePlan({
      userId: "member_1",
      subscriptions: [],
      teamGroups: [{ ...legacy, owner: { subscriptions: [] } }],
    });
    assert.equal(gone.plan, "FREE");
  });

  test("two active personal subscriptions resolve to the higher plan, whatever their order", async () => {
    for (const subscriptions of [
      [
        { plan: "PRO", memberSlotsLimit: null },
        { plan: "FAMILY", memberSlotsLimit: null },
      ],
      [
        { plan: "FAMILY", memberSlotsLimit: null },
        { plan: "PRO", memberSlotsLimit: null },
      ],
    ] satisfies Sub[][]) {
      state.users.set("u", { subscriptions, teamGroups: [] });
      const ctx = await billing.getUserBillingContext("u");
      assert.equal(ctx.plan, "FAMILY");
      assert.equal(ctx.personalPlan, "FAMILY");
    }
  });

  test("a paid plan plus a higher comp plan (P49A-07) resolves to the comp; a lower comp never masks the paid plan", () => {
    const up = entitlements.resolveEffectivePlan({
      userId: "u",
      subscriptions: [
        { plan: "FAMILY", memberSlotsLimit: null },
        { plan: "TEAMS", memberSlotsLimit: 30 },
      ],
      teamGroups: [],
    });
    assert.equal(up.plan, "TEAMS");
    assert.equal(up.entitlements.memberSlotsLimit, 30);
    assert.equal(up.entitlements.familyGroupEnabled, true, "a Family payer keeps their family group");

    const down = entitlements.resolveEffectivePlan({
      userId: "u",
      subscriptions: [
        { plan: "PRO", memberSlotsLimit: null },
        { plan: "FREE", memberSlotsLimit: null },
      ],
      teamGroups: [],
    });
    assert.equal(down.plan, "PRO");
  });

  test("a personal Teams subscription wins ties with a team membership (legacy / own plan)", () => {
    const r = entitlements.resolveEffectivePlan({
      userId: "u",
      subscriptions: [{ plan: "TEAMS", memberSlotsLimit: 5 }],
      teamGroups: [team()],
    });
    assert.equal(r.planSource, "personal");
    assert.equal(r.teamEntitlement, null);
    assert.equal(r.entitlements.memberSlotsLimit, 5);
  });

  test("Family members do not inherit the owner's Family plan (documented decision)", async () => {
    // Family membership is not an input to the resolver at all: a member of
    // someone else's family group keeps their own (here: Free) plan.
    state.users.set("fam_member", { subscriptions: [], teamGroups: [] });
    const ctx = await billing.getUserBillingContext("fam_member");
    assert.equal(ctx.plan, "FREE");
  });
});

// ─── A-25: contact cap ────────────────────────────────────────────────────────

describe("A-25 contact cap", () => {
  test("DAV create helper: a Free user's contact #501 is refused (server.mjs answers 507)", async () => {
    state.contactCounts.set("free_1", 500);
    await assert.rejects(
      () => entitlements.assertContactCapacityTx(stub, "free_1"),
      (error: unknown) => {
        assert.ok(error instanceof entitlements.ContactLimitReachedError);
        assert.equal(error.limit, 500);
        assert.match(error.message, /Free plan limit reached\. You can store up to 500 contacts/);
        return true;
      },
    );
    assert.deepEqual(state.locks, ["free_1"], "the owner's User row is locked before counting");

    state.contactCounts.set("free_1", 499);
    const ok = await entitlements.assertContactCapacityTx(stub, "free_1");
    assert.equal(ok.remaining, 1, "contact #500 is still allowed");
  });

  test("DAV create helper: unlimited plans (incl. Teams via membership) are never capped", async () => {
    state.users.set("member_1", { subscriptions: [], teamGroups: [team()] });
    state.contactCounts.set("member_1", 50_000);
    const cap = await entitlements.assertContactCapacityTx(stub, "member_1");
    assert.equal(cap.remaining, null);
  });

  test("every CardDAV create path in server.mjs goes through the capped transaction", () => {
    const source = readFileSync(new URL("../../server.mjs", import.meta.url), "utf8");
    // No bare creates left: personal, family and team PUT-creates all use the helper.
    assert.equal(source.match(/prisma\.contact\.create\(/g)?.length ?? 0, 0);
    const capped = source.match(/createWithinContactCap\(res, (\w+(?:\.\w+)?)/g) ?? [];
    assert.deepEqual(capped.sort(), [
      "createWithinContactCap(res, access.ownerId",
      "createWithinContactCap(res, familyBook.ownerId",
      "createWithinContactCap(res, userId",
    ]);
    assert.match(source, /send\(res, 507,/);
    assert.match(source, /error instanceof ContactLimitReachedError/);
  });

  test("create into a family book whose (Free) owner is at the cap is refused", async () => {
    sessionUserId = "member_1";
    state.familyMembership = {
      groupId: "fam_1",
      role: "MEMBER",
      canEdit: true,
      group: { defaultAddressBookId: "fbook_1", name: "Smiths" },
    };
    state.familyGroupOwner = "owner_free";
    state.contactCounts.set("owner_free", 500);
    // The acting member has plenty of room — the owner's cap is what counts.
    state.users.set("member_1", { subscriptions: [{ plan: "PRO", memberSlotsLimit: null }], teamGroups: [] });

    const form = new FormData();
    form.set("firstName", "Ada");
    form.set("target", "family");
    await assert.rejects(() => createContact(form), /Free plan limit reached/);
    assert.deepEqual(state.locks, ["owner_free"], "checked and serialised on the book owner");
    assert.equal(state.contactCreates.length, 0);
  });

  test("create into a family book under the owner's cap still succeeds", async () => {
    sessionUserId = "member_1";
    state.familyMembership = {
      groupId: "fam_1",
      role: "MEMBER",
      canEdit: true,
      group: { defaultAddressBookId: "fbook_1", name: "Smiths" },
    };
    state.familyGroupOwner = "owner_free";
    state.contactCounts.set("owner_free", 10);

    const form = new FormData();
    form.set("firstName", "Ada");
    form.set("target", "family");
    await assert.rejects(() => createContact(form), RedirectSignal);
    assert.equal(state.contactCreates.length, 1);
    assert.equal(state.contactCreates[0]!.userId, "owner_free");
  });
});

// ─── A-26: team lapse lock ────────────────────────────────────────────────────

describe("A-26 team lock", () => {
  const lockedTeam = () =>
    team({ teamsEnabled: false, teamsGraceEndsAt: new Date(Date.now() - DAY), subscriptions: [] });

  test("a team ADMIN is blocked once the team is past its grace window", async () => {
    sessionUserId = "admin_1";
    state.manageableTeam = { role: "ADMIN", group: lockedTeam() };
    const form = new FormData();
    form.set("email", "new@example.com");
    await assert.rejects(() => inviteTeamMember(form), /This team is read-only/);
  });

  test("the lock does not apply during grace, or with the owner's legacy personal Teams plan", async () => {
    assert.equal(
      await entitlements.isTeamLocked(stub, team({ teamsEnabled: false, teamsGraceEndsAt: new Date(Date.now() + DAY) })),
      false,
    );
    assert.equal(await entitlements.isTeamLocked(stub, lockedTeam()), true);
    state.legacyTeamsOwners.add("owner_1");
    assert.equal(await entitlements.isTeamLocked(stub, lockedTeam()), false);
  });

  test("a locked team book is not editable (web create/add, and DAV getTeamBookAccess → 403)", async () => {
    state.teamMembership = { id: "gm_1", groupId: "team_1", role: "ADMIN", group: { name: "Acme" } };
    state.teamBook = { id: "tbook_1", group: team() };
    assert.equal(await teamAccess.canEditTeamBook("admin_1", "tbook_1"), true);

    state.teamBook = { id: "tbook_1", group: lockedTeam() };
    assert.equal(await teamAccess.canEditTeamBook("admin_1", "tbook_1"), false);

    // server.mjs is not importable (it starts the server); assert the DAV team
    // access resolver consults the same lock rule and folds it into canEdit,
    // which every team-book PUT/DELETE checks before writing (→ 403).
    const source = readFileSync(new URL("../../server.mjs", import.meta.url), "utf8");
    const body = source.slice(
      source.indexOf("const getTeamBookAccess = async"),
      source.indexOf("// All team books the user can access"),
    );
    assert.match(body, /teamsEnabled: true, teamsGraceEndsAt: true/);
    assert.match(body, /await isTeamLocked\(prisma, book\.group\)/);
    assert.match(body, /canEdit: perm === "EDIT" && !locked/);
  });
});
