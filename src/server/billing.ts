import { cache } from "react";

import { type Prisma, type SubscriptionPlan } from "../../generated/prisma";

import { db } from "~/server/db";
import {
  assertContactCapacityTx,
  ContactLimitReachedError,
  contactLimitMessage,
  type EffectivePlan,
  getContactCapacity,
  loadEffectivePlan,
  lockUserRowForPlanCheck,
  PLAN_DEFAULTS,
  PLAN_LABELS,
  PLAN_RANK,
  type PlanEntitlements,
  type TeamEntitlement,
} from "~/server/dav/plan-entitlements.mjs";
import { SYNC_ACCOUNT_HISTORICAL_STATUSES } from "~/lib/sync-account-status";

// P49A-06: the plan matrix (PLAN_DEFAULTS) and effective-plan resolution live
// in src/server/dav/plan-entitlements.mjs so the plain-ESM CardDAV server
// (server.mjs) enforces the same limits. Re-exported for app code.
export { ContactLimitReachedError, contactLimitMessage, PLAN_DEFAULTS, PLAN_LABELS, PLAN_RANK };

export type BillingLifecycleState = "ACTIVE" | "TRIALING" | "GRACE" | "CANCELED" | "LOCKED";

type BillingContext = {
  lifecycleState: BillingLifecycleState;
  /** Effective plan: the highest of the user's personal plans and a live Teams membership. */
  plan: SubscriptionPlan;
  planLabel: string;
  /**
   * P49A-06: the highest plan from the user's OWN subscriptions (FREE if none).
   * Use this, not `plan` / `entitlements.teamsEnabled`, for "may this user run
   * their own team / legacy user-anchored Teams" checks: membership of someone
   * else's team grants Teams entitlements, not team ownership.
   */
  personalPlan: SubscriptionPlan;
  planSource: EffectivePlan["planSource"];
  /** Set when the effective Teams plan comes from a team membership. */
  teamEntitlement: TeamEntitlement | null;
  entitlements: PlanEntitlements;
  /**
   * P49A-19: the user's own higher plan that is held back because a payment
   * failed more than PAYMENT_GRACE_DAYS ago (null when not in that state).
   */
  paymentLapse: EffectivePlan["paymentLapse"];
};

type LifecycleAccessPolicy = {
  label: string;
  description: string;
  canWrite: boolean;
  canUseBasicExport: boolean;
  canAuthenticateExpected: boolean;
};

export const BILLING_PROVIDER_BOUNDARY = {
  providerLabel: "Stripe-first integration boundary",
  integrationShape: [
    "Checkout, upgrades, and customer portal entry points should call a dedicated billing service boundary instead of mutating subscription rows directly from product UI.",
    "Webhook handlers should be the only automated writers for provider customer IDs, provider subscription IDs, renewal timestamps, payment failure state, and cancellation transitions.",
    "Feature gating inside the app should read local entitlement state from Kontax, not make live provider API calls during ordinary product actions.",
  ],
  providerScopedFields: [
    "BillingProvider",
    "providerCustomerId",
    "providerSubscriptionId",
    "provider price or product mapping",
    "webhook event identifiers for idempotency",
  ],
} as const;

export const BILLING_AUDIT_REQUIREMENTS = [
  "subscription customer created or linked",
  "trial started or extended",
  "subscription renewed",
  "payment failed and grace started",
  "subscription canceled or cancellation reversed",
  "account moved to locked or reactivated state",
] as const;

export const BILLING_OPERATIONAL_JOBS = [
  "expire stale export artifacts on a shorter retention window than canonical contacts",
  "clean import upload artifacts after preview or commit windows close",
  "recalculate contact, import, and sync quota usage on a scheduled basis",
  "reconcile provider lifecycle changes into local subscription and user lifecycle state",
  "close or pause queued premium jobs when lifecycle state becomes canceled or locked",
] as const;

const LIFECYCLE_ACCESS_POLICIES: Record<BillingLifecycleState, LifecycleAccessPolicy> = {
  ACTIVE: {
    label: "Active",
    description: "Full read/write access with normal entitlement checks.",
    canWrite: true,
    canUseBasicExport: true,
    canAuthenticateExpected: true,
  },
  TRIALING: {
    label: "Trialing",
    description: "Full product access during the active trial window.",
    canWrite: true,
    canUseBasicExport: true,
    canAuthenticateExpected: true,
  },
  GRACE: {
    label: "Grace",
    description:
      "Writes continue during recovery from billing issues, but billing follow-up is expected before lockout.",
    canWrite: true,
    canUseBasicExport: true,
    canAuthenticateExpected: true,
  },
  CANCELED: {
    label: "Canceled",
    description:
      "Account becomes read-only, but owned contacts remain visible and basic export stays available for portability.",
    canWrite: false,
    canUseBasicExport: true,
    canAuthenticateExpected: true,
  },
  LOCKED: {
    label: "Locked",
    description:
      "Account is restricted until billing recovery or administrative intervention clears the lock.",
    canWrite: false,
    canUseBasicExport: false,
    canAuthenticateExpected: false,
  },
};

export const getLifecycleAccessPolicy = (state: BillingLifecycleState) =>
  LIFECYCLE_ACCESS_POLICIES[state];

const getMonthStart = (now = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

/** Start of the next UTC calendar month — when the monthly import allowance resets. */
export const getImportResetDate = (now = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

/** "1 October" — the reset date in UK English, in UTC like the month boundary. */
export const formatImportResetDate = (now = new Date()) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    getImportResetDate(now),
  );

/**
 * P49A-19 (owner decision 2026-09-26): `monthlyImportLimit` counts import RUNS
 * — CSV / vCard commits and Kontax archive imports from the Import & export
 * page — not contacts. A run counts once it has created at least one contact
 * (`importedCount > 0`), whatever its final status:
 *   - previews (PENDING jobs), failed runs and empty runs create nothing, so
 *     they never count;
 *   - a run cut short by the contact cap (P49A-06 partial import) counts as 1;
 *   - a run later undone via rollback still counts (it was used);
 *   - a retried job id is the same row, so it can only ever count once.
 * The month is the UTC calendar month of `committedAt` (not `createdAt`, so a
 * preview made last month and committed this month counts this month). Every
 * import path sets `importedCount` + `committedAt` INSIDE the inserting
 * transaction, under `lockUserForPlanCheck`, so a concurrent import for the
 * same user sees it once it takes the lock. Rows without `committedAt` (the
 * legacy in-app action before P49A-19) fall back to `createdAt`.
 */
export const importsThisMonthWhere = (
  userId: string,
  now = new Date(),
): Prisma.ImportJobWhereInput => {
  const monthStart = getMonthStart(now);
  return {
    userId,
    importedCount: { gt: 0 },
    OR: [
      { committedAt: { gte: monthStart } },
      { committedAt: null, createdAt: { gte: monthStart } },
    ],
  };
};

export const importLimitMessage = (planLabel: string, limit: number, now = new Date()) =>
  `You've used your ${limit} import${limit === 1 ? "" : "s"} this month on the ${planLabel} plan. Upgrade for unlimited imports, or wait until ${formatImportResetDate(now)}.`;

/** Thrown when the monthly import-run allowance is used up (P49A-19). */
export class ImportLimitReachedError extends Error {
  readonly code = "IMPORT_LIMIT_REACHED";
  readonly planLabel: string;
  readonly limit: number;
  constructor(planLabel: string, limit: number) {
    super(importLimitMessage(planLabel, limit));
    this.name = "ImportLimitReachedError";
    this.planLabel = planLabel;
    this.limit = limit;
  }
}

const toBillingContext = (
  effective: Awaited<ReturnType<typeof loadEffectivePlan>>,
): BillingContext => {
  if (!effective) {
    throw new Error("User account could not be found.");
  }
  return {
    lifecycleState: effective.lifecycleState,
    plan: effective.plan,
    planLabel: effective.planLabel,
    personalPlan: effective.personalPlan,
    planSource: effective.planSource,
    teamEntitlement: effective.teamEntitlement,
    entitlements: effective.entitlements,
    paymentLapse: effective.paymentLapse,
  };
};

// P38-04: read-only per-user context getters used by both pages and
// layout-level slots (BillingBannerSlot etc.) are wrapped in React cache()
// so one request computes them once. cache() scopes per RSC render / server
// action invocation, so a mutation followed by revalidation reads fresh.
// Do NOT call these after a write inside the same action — audit note in
// roadmap/build-phase/p38-04-request-scoped-billing-context-cache.md.
//
// P49A-06 (A-10): the effective plan is the max rank of EVERY active personal
// subscription (a paid plan and an admin comp row resolve to the higher) and a
// live Teams membership (Teams billing is org-anchored, so it never appears in
// user.subscriptions). See src/server/dav/plan-entitlements.mjs.
export const getUserBillingContext = cache(
  async (userId: string): Promise<BillingContext> =>
    toBillingContext(await loadEffectivePlan(db, userId)),
);

/**
 * P49A-06: true when the user's OWN billing lets them run a team — a personal
 * (legacy user-anchored) Teams subscription, or an active Teams org they own.
 * Being a member of someone else's team grants Teams entitlements but not this.
 */
export const canRunOwnTeam = (context: BillingContext, userId: string) =>
  context.personalPlan === "TEAMS" ||
  (context.teamEntitlement?.ownerId === userId && context.teamEntitlement.state === "active");

const assertWritableAccount = (context: BillingContext) => {
  const policy = getLifecycleAccessPolicy(context.lifecycleState);

  if (!policy.canWrite) {
    if (context.lifecycleState === "CANCELED") {
      throw new Error(
        "This account is canceled and currently read-only. Export your contacts or reactivate billing to resume changes.",
      );
    }

    throw new Error("This account is locked. Update billing before making changes.");
  }
};

const assertExportableAccount = (context: BillingContext) => {
  const policy = getLifecycleAccessPolicy(context.lifecycleState);

  if (!policy.canUseBasicExport) {
    throw new Error("This account is locked. Update billing before exporting contacts.");
  }
};

export const getUserPlanSummary = cache(async (userId: string) => {
  const context = await getUserBillingContext(userId);

  const [contactsUsed, importsThisMonth, syncAccountsUsed, appPasswordsUsed] =
    await Promise.all([
      // P49A-12: a permanently deleted contact awaiting purge no longer counts.
      db.contact.count({ where: { userId, deletedAt: null } }),
      db.importJob.count({ where: importsThisMonthWhere(userId) }),
      countLiveSyncAccountSlots(userId),
      db.appPassword.count({ where: { userId } }),
    ]);

  return {
    ...context,
    lifecyclePolicy: getLifecycleAccessPolicy(context.lifecycleState),
    contactsUsed,
    // null = unlimited (Pro/Family/Teams) → no finite "remaining".
    contactsRemaining:
      context.entitlements.contactsLimit === null
        ? null
        : Math.max(context.entitlements.contactsLimit - contactsUsed, 0),
    /** Import runs this UTC month (not contacts) — see `importsThisMonthWhere`. */
    importsThisMonth,
    syncAccountsUsed,
    appPasswordsUsed,
  };
});

export const assertCanCreateContacts = async (userId: string, incomingCount = 1) => {
  const summary = await getUserPlanSummary(userId);
  assertWritableAccount(summary);

  const limit = summary.entitlements.contactsLimit;
  if (limit !== null && summary.contactsUsed + incomingCount > limit) {
    throw new Error(
      `${summary.planLabel} plan limit reached. You can store up to ${limit} contacts on this plan.`,
    );
  }

  return summary;
};

/**
 * P49A-19: throws `ImportLimitReachedError` when the monthly import-run
 * allowance is used up (null limit = unlimited). One more run is allowed while
 * `importsThisMonth < monthlyImportLimit`, whatever its size — the contact cap
 * is checked separately.
 */
const assertImportRunAvailable = (summary: {
  planLabel: string;
  entitlements: PlanEntitlements;
  importsThisMonth: number;
}) => {
  const limit = summary.entitlements.monthlyImportLimit;
  if (limit !== null && summary.importsThisMonth >= limit) {
    throw new ImportLimitReachedError(summary.planLabel, limit);
  }
};

export const assertCanImportContacts = async (userId: string, incomingCount: number) => {
  const summary = await assertCanCreateContacts(userId, incomingCount);
  assertImportRunAvailable(summary);
  return summary;
};

export const assertCanUsePremiumExport = async (userId: string) => {
  const summary = await getUserPlanSummary(userId);
  assertExportableAccount(summary);

  if (!summary.entitlements.premiumExportEnabled) {
    throw new Error("vCard export is available on the Pro plan.");
  }

  return summary;
};

export const assertCanUseCardDavSync = async (userId: string) => {
  const summary = await getUserPlanSummary(userId);
  assertWritableAccount(summary);

  if (!summary.entitlements.cardDavSyncEnabled) {
    throw new Error("CardDAV sync is available on the Pro plan.");
  }

  return summary;
};

const liveSyncAccountWhere = (
  userId: string,
  excludingSyncAccountIds: string[] = [],
): Prisma.SyncAccountWhereInput => ({
  userId,
  status: { notIn: [...SYNC_ACCOUNT_HISTORICAL_STATUSES] },
  ...(excludingSyncAccountIds.length > 0 ? { id: { notIn: excludingSyncAccountIds } } : {}),
});

export const countLiveSyncAccountSlots = (
  userId: string,
  excludingSyncAccountIds: string[] = [],
) =>
  db.syncAccount.count({
    // Historical rows stay in the database for restore/audit purposes, but they
    // do not represent a current live connection or consume a sync slot.
    where: liveSyncAccountWhere(userId, excludingSyncAccountIds),
  });

export const assertHasAvailableSyncAccountSlot = async (
  userId: string,
  options?: { excludingSyncAccountIds?: string[] },
) => {
  const summary = await assertCanUseCardDavSync(userId);
  const syncAccountsUsed = await countLiveSyncAccountSlots(
    userId,
    options?.excludingSyncAccountIds ?? [],
  );

  if (syncAccountsUsed + 1 > summary.entitlements.syncAccountsLimit) {
    throw new Error(
      `${summary.planLabel} plan sync limit reached. You can connect up to ${summary.entitlements.syncAccountsLimit} sync account${summary.entitlements.syncAccountsLimit === 1 ? "" : "s"} on this plan.`,
    );
  }

  return {
    ...summary,
    syncAccountsUsed,
    syncAccountsRemaining: Math.max(summary.entitlements.syncAccountsLimit - syncAccountsUsed, 0),
  };
};

export const assertCanCreateSyncAccount = async (userId: string) =>
  assertHasAvailableSyncAccountSlot(userId);

// ── P48-17: transactional cap-check variants ─────────────────────────────────
//
// The read-only helpers above (`getUserPlanSummary`, `assertCanCreateContacts`,
// etc.) count usage and enforce the plan cap as two separate round-trips, with
// the insert as a third, later one — a classic check-then-act race. Two
// concurrent requests can both read "499 of 500 contacts used" and both
// proceed, landing 501.
//
// The fix is to run the count and the insert inside the same `db.$transaction`,
// after first serialising concurrent callers with a row lock. Postgres has no
// advisory-lock-by-string-key requirement here — locking the caller's own
// `User` row with `SELECT ... FOR UPDATE` is enough: a second transaction for
// the same user blocks at the lock until the first commits, and (under the
// default READ COMMITTED isolation) its own count re-read after the lock then
// sees the first transaction's committed insert.
//
// Callers: `db.$transaction(async (tx) => { await lockUserForPlanCheck(tx,
// userId); const summary = await assertCanCreateContactsTx(tx, userId, n);
// await tx.contact.create(...); })`.
type TxClient = Prisma.TransactionClient;

/**
 * Must be the FIRST statement inside the `$transaction` callback, before the
 * cap check and the insert — see the note above.
 */
export const lockUserForPlanCheck = (tx: TxClient, userId: string) =>
  lockUserRowForPlanCheck(tx, userId);

/**
 * P49A-06 (A-25): remaining contact capacity for the account contacts are
 * created UNDER (null = unlimited). Plan + count only (no import/sync/app-password
 * aggregates), for bulk create paths (sync import). Unlocked read by default;
 * pass `{ lock: true }` as the first statement of the inserting transaction.
 */
export const getContactCapacityFor = (
  client: TxClient | typeof db,
  userId: string,
  options?: { lock?: boolean },
) => getContactCapacity(client, userId, options);

/**
 * P49A-06 (A-25): lock + cap check inside the inserting transaction; throws
 * `ContactLimitReachedError` when `incoming` more contacts would exceed the cap.
 * Unlike `assertCanCreateContactsTx` it does not check account lifecycle.
 */
export const assertContactCapacityForTx = (tx: TxClient, userId: string, incoming = 1) =>
  assertContactCapacityTx(tx, userId, incoming);

const getUserBillingContextTx = async (tx: TxClient, userId: string): Promise<BillingContext> =>
  toBillingContext(await loadEffectivePlan(tx, userId));

const getUserPlanSummaryTx = async (tx: TxClient, userId: string) => {
  const context = await getUserBillingContextTx(tx, userId);

  const [contactsUsed, importsThisMonth, syncAccountsUsed, appPasswordsUsed] =
    await Promise.all([
      tx.contact.count({ where: { userId, deletedAt: null } }),
      tx.importJob.count({ where: importsThisMonthWhere(userId) }),
      tx.syncAccount.count({ where: liveSyncAccountWhere(userId) }),
      tx.appPassword.count({ where: { userId } }),
    ]);

  return {
    ...context,
    lifecyclePolicy: getLifecycleAccessPolicy(context.lifecycleState),
    contactsUsed,
    contactsRemaining:
      context.entitlements.contactsLimit === null
        ? null
        : Math.max(context.entitlements.contactsLimit - contactsUsed, 0),
    /** Import runs this UTC month (not contacts) — see `importsThisMonthWhere`. */
    importsThisMonth,
    syncAccountsUsed,
    appPasswordsUsed,
  };
};

/** Transactional twin of `assertCanCreateContacts` — call after `lockUserForPlanCheck`. */
export const assertCanCreateContactsTx = async (
  tx: TxClient,
  userId: string,
  incomingCount = 1,
) => {
  const summary = await getUserPlanSummaryTx(tx, userId);
  assertWritableAccount(summary);

  const limit = summary.entitlements.contactsLimit;
  if (limit !== null && summary.contactsUsed + incomingCount > limit) {
    throw new Error(
      `${summary.planLabel} plan limit reached. You can store up to ${limit} contacts on this plan.`,
    );
  }

  return summary;
};

/**
 * P49A-06 (Fable review): file imports (CSV/vCard commit, Kontax archive)
 * create only what fits under the contact cap and report the rest as skipped,
 * instead of failing the whole import. Checks the account can write and has an
 * import run left this month (P49A-19: `ImportLimitReachedError` otherwise),
 * and throws `ContactLimitReachedError` only when not even one contact fits.
 * The run itself is only counted once the caller records `importedCount` /
 * `committedAt` on its ImportJob inside the same locked transaction — see
 * `importsThisMonthWhere`.
 */
export type ImportCapacity = {
  /** How many of the incoming contacts to create (the first N). */
  toCreate: number;
  /** Incoming contacts left out because the contact cap was reached. */
  capSkipped: number;
  /** User-facing cap message when `capSkipped > 0`, else null. */
  limitMessage: string | null;
};

const planImportCapacity = (
  summary: Awaited<ReturnType<typeof getUserPlanSummary>>,
  incomingCount: number,
): ImportCapacity => {
  assertWritableAccount(summary);
  assertImportRunAvailable(summary);

  const contactsLimit = summary.entitlements.contactsLimit;
  const remaining = summary.contactsRemaining;
  const incoming = Math.max(incomingCount, 0);
  const toCreate = remaining === null ? incoming : Math.min(incoming, remaining);
  if (contactsLimit !== null && incoming > 0 && toCreate === 0) {
    throw new ContactLimitReachedError(summary.planLabel, contactsLimit);
  }

  const capSkipped = incoming - toCreate;
  return {
    toCreate,
    capSkipped,
    limitMessage:
      capSkipped > 0 && contactsLimit !== null
        ? contactLimitMessage(summary.planLabel, contactsLimit)
        : null,
  };
};

/** Unlocked pre-check for an import (cheap, before parsing). See `ImportCapacity`. */
export const getImportCapacity = async (userId: string, incomingCount: number) =>
  planImportCapacity(await getUserPlanSummary(userId), incomingCount);

/**
 * Authoritative import capacity inside the inserting transaction — call after
 * `lockUserForPlanCheck(tx, userId)`, then create only the first `toCreate`.
 */
export const getImportCapacityTx = async (tx: TxClient, userId: string, incomingCount: number) =>
  planImportCapacity(await getUserPlanSummaryTx(tx, userId), incomingCount);

/**
 * P49A-19: the import-run allowance alone (no contact-cap or sync aggregates),
 * for imports that land in several transactions (Kontax archive chunks). Call
 * after `lockUserForPlanCheck` in the transaction that lands the run's first
 * contacts, and record `importedCount` / `committedAt` on the job in that same
 * transaction. Throws `ImportLimitReachedError`.
 */
export const assertImportRunAvailableTx = async (tx: TxClient, userId: string) => {
  const [context, importsThisMonth] = await Promise.all([
    getUserBillingContextTx(tx, userId),
    tx.importJob.count({ where: importsThisMonthWhere(userId) }),
  ]);
  assertImportRunAvailable({ ...context, importsThisMonth });
};

/** Transactional twin of `assertCanImportContacts` — call after `lockUserForPlanCheck`. */
export const assertCanImportContactsTx = async (
  tx: TxClient,
  userId: string,
  incomingCount: number,
) => {
  const summary = await assertCanCreateContactsTx(tx, userId, incomingCount);
  assertImportRunAvailable(summary);
  return summary;
};

const assertCanUseCardDavSyncTx = async (tx: TxClient, userId: string) => {
  const summary = await getUserPlanSummaryTx(tx, userId);
  assertWritableAccount(summary);

  if (!summary.entitlements.cardDavSyncEnabled) {
    throw new Error("CardDAV sync is available on the Pro plan.");
  }

  return summary;
};

/** Transactional twin of `assertHasAvailableSyncAccountSlot` — call after `lockUserForPlanCheck`. */
export const assertHasAvailableSyncAccountSlotTx = async (
  tx: TxClient,
  userId: string,
  options?: { excludingSyncAccountIds?: string[] },
) => {
  const summary = await assertCanUseCardDavSyncTx(tx, userId);
  const syncAccountsUsed = await tx.syncAccount.count({
    where: liveSyncAccountWhere(userId, options?.excludingSyncAccountIds ?? []),
  });

  if (syncAccountsUsed + 1 > summary.entitlements.syncAccountsLimit) {
    throw new Error(
      `${summary.planLabel} plan sync limit reached. You can connect up to ${summary.entitlements.syncAccountsLimit} sync account${summary.entitlements.syncAccountsLimit === 1 ? "" : "s"} on this plan.`,
    );
  }

  return {
    ...summary,
    syncAccountsUsed,
    syncAccountsRemaining: Math.max(summary.entitlements.syncAccountsLimit - syncAccountsUsed, 0),
  };
};

/** Transactional twin of `assertCanCreateSyncAccount` — call after `lockUserForPlanCheck`. */
export const assertCanCreateSyncAccountTx = (tx: TxClient, userId: string) =>
  assertHasAvailableSyncAccountSlotTx(tx, userId);

// --- Activity log & sharing gates (P11-03) -----------------------------------

// The global activity feed is gated by retention: Free has retention 0 (no feed);
// Pro (90), Family (365), and Teams (unlimited/null) all qualify. Using the
// retention entitlement instead of a plan-name list means new paid tiers are
// included automatically.
export const isActivityLogEnabled = (entitlements: PlanEntitlements) =>
  entitlements.activityLogRetentionDays !== 0;

export const assertCanUseActivityLog = async (userId: string) => {
  const context = await getUserBillingContext(userId);
  if (!isActivityLogEnabled(context.entitlements)) {
    throw new Error("The activity log is available on the Pro plan and above.");
  }
  return context;
};

// Sharing gates — stubbed now (P11-03) so Phases 12–14 can call them directly.
// Live/static Kontax-to-Kontax sharing requires Pro and above on the sender side.
export const assertCanLiveShare = async (userId: string) => {
  const context = await getUserBillingContext(userId);
  if (!context.entitlements.liveShareEnabled) {
    throw new Error("Live contact sharing is available on the Pro plan and above.");
  }
  return context;
};

export const assertCanStaticShare = async (userId: string) => {
  const context = await getUserBillingContext(userId);
  if (!context.entitlements.staticShareEnabled) {
    throw new Error("Contact sharing is available on the Pro plan and above.");
  }
  return context;
};

// Shared address books exist only on Family (1) and Teams (unlimited).
export const assertCanUseSharedAddressBooks = async (userId: string) => {
  const context = await getUserBillingContext(userId);
  const limit = context.entitlements.sharedAddressBooksLimit;
  if (limit === 0) {
    throw new Error("Shared address books are available on the Family and Teams plans.");
  }
  return context;
};
