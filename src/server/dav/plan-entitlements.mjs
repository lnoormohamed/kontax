// P49A-06: the plan entitlement matrix and effective-plan resolution, shared by
// the Next app (`src/server/billing.ts` re-exports / wraps everything here) and
// the plain-ESM CardDAV server (`server.mjs`), so the DAV write paths enforce
// exactly the same contact cap as the web app without a second copy of the
// matrix.
//
// Why here: `server.mjs` is run directly by Node (not bundled by Next) and the
// production image ships only `src/server/dav/` next to it (see Dockerfile), so
// anything server.mjs imports at runtime must live in this directory and be
// plain JavaScript (JSDoc types, checked by tsc via `checkJs`).
//
// Effective plan (A-10): the HIGHEST-ranked of
//   · every active personal subscription (ACTIVE / TRIALING / PAST_DUE) — a
//     user can hold more than one (e.g. a paid plan plus an admin comp plan,
//     P49A-07), so this is max-by-rank, never "latest period end"; and
//   · Teams, when the user is an accepted member of a TEAM group whose org
//     entitlement is on (`teamsEnabled`) or still inside its lapse grace
//     window (`teamsGraceEndsAt` in the future). Teams billing is org-anchored
//     (Subscription.userId = null, groupId set), so it never shows up in
//     `user.subscriptions`.
// Family is NOT inherited by family members: a member of someone else's
// Family group keeps their own personal plan (the owner's plan covers the
// shared book, whose contacts are owned by the owner). Decision recorded in
// roadmap/build-phase/p49a-06-entitlements-teams-caps-locks.md.

/** @typedef {"FREE" | "PRO" | "FAMILY" | "TEAMS"} PlanName */

/**
 * @typedef {object} PlanEntitlements
 * @property {number | null} contactsLimit  null = unlimited.
 * @property {number | null} monthlyImportLimit
 * @property {number} syncAccountsLimit
 * @property {number} appPasswordsLimit
 * @property {boolean} advancedMergeEnabled
 * @property {boolean} premiumExportEnabled
 * @property {boolean} cardDavSyncEnabled
 * @property {boolean} familyGroupEnabled
 * @property {boolean} teamsEnabled
 * @property {number | null} sharedAddressBooksLimit
 * @property {number | null} memberSlotsLimit
 * @property {number | null} activityLogRetentionDays
 * @property {number} historyFloorPerContact  The N most recent events per contact always KEPT (P11-05).
 * @property {number | null} historyDisplayCap  Per-contact History tab cap; null = show all.
 * @property {boolean} liveShareEnabled
 * @property {boolean} staticShareEnabled
 * @property {boolean} apiAccessEnabled
 */

/** Subscription statuses that grant a plan. */
export const ACTIVE_SUBSCRIPTION_STATUSES = /** @type {const} */ (["ACTIVE", "TRIALING", "PAST_DUE"]);

/** @type {Record<PlanName, number>} */
export const PLAN_RANK = { FREE: 0, PRO: 1, FAMILY: 2, TEAMS: 3 };

/** @type {Record<PlanName, string>} */
export const PLAN_LABELS = { FREE: "Free", PRO: "Pro", FAMILY: "Family", TEAMS: "Teams" };

// Per-plan default entitlements (P11-01 matrix). Family/Teams mirror Pro's
// personal-library limits (their group/sharing entitlements are the net-new
// flags below).
const PRO_PERSONAL = {
  contactsLimit: null,
  monthlyImportLimit: null,
  syncAccountsLimit: 5,
  appPasswordsLimit: 5,
  advancedMergeEnabled: true,
  premiumExportEnabled: true,
  cardDavSyncEnabled: true,
  historyFloorPerContact: 20,
  historyDisplayCap: null,
  liveShareEnabled: true,
  staticShareEnabled: true,
  apiAccessEnabled: true,
};

/** @type {Record<PlanName, PlanEntitlements>} */
export const PLAN_DEFAULTS = {
  FREE: {
    contactsLimit: 500,
    monthlyImportLimit: 3,
    // Free includes 1 CardDAV sync account; Pro+ raises the cap to 5. The whole
    // feature is enabled (cardDavSyncEnabled) and the ceiling is enforced by
    // syncAccountsLimit, so the UI shows a 1-account cap with an upgrade nudge
    // rather than a blanket upsell.
    syncAccountsLimit: 1,
    appPasswordsLimit: 1,
    // Merge (field-level, bulk, 30-day undo) is included on every plan.
    advancedMergeEnabled: true,
    premiumExportEnabled: false,
    cardDavSyncEnabled: true,
    familyGroupEnabled: false,
    teamsEnabled: false,
    sharedAddressBooksLimit: 0,
    memberSlotsLimit: null,
    activityLogRetentionDays: 0,
    historyFloorPerContact: 10,
    historyDisplayCap: 3,
    liveShareEnabled: false,
    staticShareEnabled: false,
    apiAccessEnabled: false,
  },
  PRO: {
    ...PRO_PERSONAL,
    familyGroupEnabled: false,
    teamsEnabled: false,
    sharedAddressBooksLimit: 0,
    memberSlotsLimit: null,
    activityLogRetentionDays: 365,
  },
  FAMILY: {
    ...PRO_PERSONAL,
    // The developer API is a Pro/Teams feature; Family inherits Pro's personal
    // limits but not API access (P49 decision, 2026-09-25).
    apiAccessEnabled: false,
    familyGroupEnabled: true,
    teamsEnabled: false,
    sharedAddressBooksLimit: 1,
    memberSlotsLimit: 6,
    // Retention is the one exception to "everything in Pro per member": Family
    // personal history is 90d vs Pro's 365d (per-seat economics). Family's value
    // is seats + the shared book, not retention depth. The last-20-per-contact
    // floor (PRO_PERSONAL) still applies, so recent history is never lost.
    activityLogRetentionDays: 90,
  },
  TEAMS: {
    ...PRO_PERSONAL,
    familyGroupEnabled: false,
    teamsEnabled: true,
    sharedAddressBooksLimit: null,
    memberSlotsLimit: 25,
    activityLogRetentionDays: null,
  },
};

/**
 * @typedef {object} TeamGroupInput
 * @property {string} id
 * @property {string} ownerId
 * @property {boolean} teamsEnabled
 * @property {Date | null} teamsGraceEndsAt
 * @property {number | null} [memberSlotsLimit]
 * @property {Array<{ memberSlotsLimit: number | null }>} [subscriptions]  The org's active Teams subscription(s).
 */

/**
 * @typedef {object} TeamEntitlement
 * @property {string} groupId
 * @property {string} ownerId
 * @property {"active" | "grace"} state
 */

/**
 * @typedef {object} EffectivePlan
 * @property {PlanName} plan  The effective plan (max rank).
 * @property {string} planLabel
 * @property {PlanName} personalPlan  Highest plan from the user's OWN subscriptions (FREE if none).
 * @property {"personal" | "team" | "none"} planSource
 * @property {TeamEntitlement | null} teamEntitlement  Set when Teams comes from a team membership.
 * @property {PlanEntitlements} entitlements
 */

/**
 * Is this team's org entitlement live for its members right now? `teamsEnabled`
 * (paid) or inside the post-lapse grace window. A pending team (never paid:
 * teamsEnabled false, no grace date) grants nothing.
 *
 * @param {{ teamsEnabled: boolean, teamsGraceEndsAt: Date | null }} group
 * @param {Date} [now]
 * @returns {"active" | "grace" | null}
 */
export const teamEntitlementState = (group, now = new Date()) => {
  if (group.teamsEnabled) return "active";
  if (group.teamsGraceEndsAt != null && group.teamsGraceEndsAt > now) return "grace";
  return null;
};

/**
 * Pure resolution of the effective plan. See the header comment for the rules.
 *
 * @param {{
 *   userId: string,
 *   subscriptions: Array<{ plan: PlanName, memberSlotsLimit: number | null }>,
 *   teamGroups: TeamGroupInput[],
 *   now?: Date,
 * }} input  `subscriptions` must already be filtered to ACTIVE_SUBSCRIPTION_STATUSES.
 * @returns {EffectivePlan}
 */
export const resolveEffectivePlan = ({ userId, subscriptions, teamGroups, now = new Date() }) => {
  // Highest personal plan; among equal-rank TEAMS rows, the larger seat count.
  /** @type {{ plan: PlanName, memberSlotsLimit: number | null } | null} */
  let personal = null;
  for (const sub of subscriptions) {
    if (!(sub.plan in PLAN_RANK)) continue;
    if (
      !personal ||
      PLAN_RANK[sub.plan] > PLAN_RANK[personal.plan] ||
      (sub.plan === personal.plan && (sub.memberSlotsLimit ?? 0) > (personal.memberSlotsLimit ?? 0))
    ) {
      personal = sub;
    }
  }
  const personalPlan = personal?.plan ?? "FREE";

  // Best live team: active beats grace, then a team the user owns, then seats.
  /** @type {{ group: TeamGroupInput, state: "active" | "grace", slots: number | null } | null} */
  let team = null;
  for (const group of teamGroups) {
    const state = teamEntitlementState(group, now);
    if (!state) continue;
    const slots = group.subscriptions?.[0]?.memberSlotsLimit ?? group.memberSlotsLimit ?? null;
    const better =
      !team ||
      (state === "active" && team.state === "grace") ||
      (state === team.state &&
        ((group.ownerId === userId && team.group.ownerId !== userId) ||
          ((group.ownerId === userId) === (team.group.ownerId === userId) &&
            (slots ?? 0) > (team.slots ?? 0))));
    if (better) team = { group, state, slots };
  }

  const teamWins = team !== null && PLAN_RANK.TEAMS > PLAN_RANK[personalPlan];
  const plan = teamWins ? "TEAMS" : personalPlan;
  const entitlements = { ...PLAN_DEFAULTS[plan] };

  // TEAMS memberSlotsLimit is per-seat (Stripe quantity), stored on the
  // subscription row (personal/legacy) or the org's subscription / group.
  if (plan === "TEAMS") {
    const slots = teamWins ? team?.slots : personal?.memberSlotsLimit;
    if (slots != null) entitlements.memberSlotsLimit = slots;
  }

  // Plans are ranked but not strictly nested: TEAMS has no family group. A
  // user who pays for Family (or is comped it) must not lose their family
  // group because a higher plan also applies.
  if (!entitlements.familyGroupEnabled && subscriptions.some((s) => PLAN_DEFAULTS[s.plan]?.familyGroupEnabled)) {
    entitlements.familyGroupEnabled = true;
  }

  return {
    plan,
    planLabel: PLAN_LABELS[plan],
    personalPlan,
    planSource: teamWins ? "team" : personal ? "personal" : "none",
    teamEntitlement:
      teamWins && team ? { groupId: team.group.id, ownerId: team.group.ownerId, state: team.state } : null,
    entitlements,
  };
};

const effectivePlanUserSelect = {
  lifecycleState: true,
  subscriptions: {
    where: { status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } },
    select: { plan: true, memberSlotsLimit: true },
  },
  groupMemberships: {
    where: { inviteStatus: "ACCEPTED", group: { type: "TEAM" } },
    select: {
      group: {
        select: {
          id: true,
          ownerId: true,
          teamsEnabled: true,
          teamsGraceEndsAt: true,
          memberSlotsLimit: true,
          subscriptions: {
            where: { plan: "TEAMS", status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { memberSlotsLimit: true },
          },
        },
      },
    },
  },
};

/**
 * Load and resolve a user's effective plan. `client` is the Prisma client or a
 * transaction client (typed loosely: this file is shared with plain-JS
 * server.mjs). Returns null when the user does not exist.
 *
 * @param {any} client
 * @param {string} userId
 * @param {Date} [now]
 * @returns {Promise<(EffectivePlan & { lifecycleState: "ACTIVE" | "TRIALING" | "GRACE" | "CANCELED" | "LOCKED" }) | null>}
 */
export const loadEffectivePlan = async (client, userId, now = new Date()) => {
  /** @type {any} */
  const user = await client.user.findUnique({ where: { id: userId }, select: effectivePlanUserSelect });
  if (!user) return null;
  /** @type {TeamGroupInput[]} */
  const teamGroups = (user.groupMemberships ?? []).map((/** @type {any} */ m) => m.group);
  return {
    lifecycleState: user.lifecycleState,
    ...resolveEffectivePlan({ userId, subscriptions: user.subscriptions ?? [], teamGroups, now }),
  };
};

// ── Contact cap (A-25) ─────────────────────────────────────────────────────────

/**
 * Serialise concurrent cap checks for one account (P48-17): lock the account's
 * User row. Must be the first statement of the transaction that inserts.
 *
 * @param {any} tx
 * @param {string} userId
 * @returns {Promise<unknown>}
 */
export const lockUserRowForPlanCheck = (tx, userId) =>
  tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

/**
 * @param {string} planLabel
 * @param {number} limit
 */
export const contactLimitMessage = (planLabel, limit) =>
  `${planLabel} plan limit reached. You can store up to ${limit} contacts on this plan.`;

export class ContactLimitReachedError extends Error {
  /**
   * @param {string} planLabel
   * @param {number} limit
   */
  constructor(planLabel, limit) {
    super(contactLimitMessage(planLabel, limit));
    this.name = "ContactLimitReachedError";
    this.code = "CONTACT_LIMIT_REACHED";
    this.planLabel = planLabel;
    this.limit = limit;
  }
}

/**
 * How many more contacts `userId` (the account the contacts are created UNDER —
 * the book owner for family/team books) may create. Counts the same rows the
 * web app counts (`getUserPlanSummary`: every Contact row owned by the user).
 * Pass `{ lock: true }` inside the inserting transaction.
 *
 * @param {any} client
 * @param {string} userId
 * @param {{ lock?: boolean }} [options]
 * @returns {Promise<{ plan: PlanName, planLabel: string, limit: number | null, used: number, remaining: number | null }>}
 */
export const getContactCapacity = async (client, userId, options = {}) => {
  if (options.lock) await lockUserRowForPlanCheck(client, userId);
  const effective = await loadEffectivePlan(client, userId);
  if (!effective) throw new Error("User account could not be found.");
  const limit = effective.entitlements.contactsLimit;
  if (limit === null) {
    return { plan: effective.plan, planLabel: effective.planLabel, limit, used: 0, remaining: null };
  }
  /** @type {number} */
  const used = await client.contact.count({ where: { userId } });
  return {
    plan: effective.plan,
    planLabel: effective.planLabel,
    limit,
    used,
    remaining: Math.max(limit - used, 0),
  };
};

/**
 * Lock + check inside the inserting transaction; throws ContactLimitReachedError
 * when `incoming` more contacts would exceed the cap.
 *
 * @param {any} tx
 * @param {string} userId
 * @param {number} [incoming]
 */
export const assertContactCapacityTx = async (tx, userId, incoming = 1) => {
  const capacity = await getContactCapacity(tx, userId, { lock: true });
  if (capacity.remaining !== null && capacity.limit !== null && capacity.remaining < incoming) {
    throw new ContactLimitReachedError(capacity.planLabel, capacity.limit);
  }
  return capacity;
};

// ── Team lapse lock (A-26) ─────────────────────────────────────────────────────

/**
 * Is this team locked (read-only) because its Teams plan lapsed and the grace
 * window has passed? Mirrors `getTeamGraceState` (team-access.ts): a team with
 * no grace date (active, or a pending never-paid team) is not locked. Teams not
 * yet on org billing (P34F-03) fall back to the owner's personal Teams
 * subscription.
 *
 * @param {any} client
 * @param {{ ownerId: string, teamsEnabled: boolean, teamsGraceEndsAt: Date | null }} group
 * @param {Date} [now]
 * @returns {Promise<boolean>}
 */
export const isTeamLocked = async (client, group, now = new Date()) => {
  if (group.teamsEnabled) return false;
  if (group.teamsGraceEndsAt == null || group.teamsGraceEndsAt > now) return false;
  const legacy = await client.subscription.findFirst({
    where: {
      userId: group.ownerId,
      plan: "TEAMS",
      status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] },
    },
    select: { id: true },
  });
  return !legacy;
};
