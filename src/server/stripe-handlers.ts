import type {
  Prisma,
  PrismaClient,
  SubscriptionInterval,
  SubscriptionPlan,
  SubscriptionStatus,
} from "../../generated/prisma";
import type Stripe from "stripe";

import {
  sendPaymentFailedEmail,
  sendPlanChangedEmail,
  sendTrialEndingEmail,
} from "~/server/billing-emails";
import { db } from "~/server/db";
import {
  FAMILY_DISSOLVE_NOTICE_MS,
  type FamilyNoticeKind,
  notifyFamilyMember,
} from "~/server/family-lifecycle";
import { snapshotFamilyBookForUser } from "~/server/family-snapshot";
import { createNotification } from "~/server/notifications";
import { getStripeClient } from "~/server/stripe";
import { getPlanFromPriceIdAsync } from "~/server/stripe-prices";

type Tx = Prisma.TransactionClient;

// ─── Post-commit side effects ─────────────────────────────────────────────────
//
// P49A-05: emails and in-app notifications used to be fired (`void send…()`)
// from inside the webhook transaction, so a rolled-back event still emailed the
// customer — and emailed them again on every Stripe retry. Handlers now queue
// them here and the caller runs the queue only after the transaction commits.

export type AfterCommit = (() => Promise<unknown>)[];

/** Run queued side effects. Never rejects: each failure is logged on its own. */
export async function runAfterCommit(effects: AfterCommit): Promise<void> {
  await Promise.all(
    effects.map(async (effect) => {
      try {
        await effect();
      } catch (err) {
        console.error("[stripe] post-commit side effect failed:", err);
      }
    }),
  );
}

// ─── Status / plan helpers ────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
/** Payment-failure grace shown to the customer (lifecycle-policies.md §2b). */
const PAYMENT_GRACE_MS = 3 * DAY_MS;
/** Read-only window for a lapsed team (lifecycle-policies.md §3e). */
const TEAMS_GRACE_MS = 14 * DAY_MS;

function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status,
): SubscriptionStatus {
  const map: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "PAST_DUE",
    incomplete: "INCOMPLETE",
    incomplete_expired: "EXPIRED",
    paused: "PAUSED",
  };
  return map[stripeStatus] ?? "ACTIVE";
}

const PLAN_RANK: Record<SubscriptionPlan, number> = {
  FREE: 0,
  PRO: 1,
  FAMILY: 2,
  TEAMS: 3,
};
function planRank(plan: SubscriptionPlan): number {
  return PLAN_RANK[plan] ?? 0;
}

/**
 * Statuses that confer the plan's entitlements. Must match the filter in
 * `getUserBillingContext` (billing.ts) — anything else (INCOMPLETE, PAUSED,
 * EXPIRED, CANCELED) is a lapse back to Free.
 */
const ACTIVE_BILLING_STATUSES: SubscriptionStatus[] = ["ACTIVE", "TRIALING", "PAST_DUE"];

// P49A-07: also treat the legacy "admin-override-" placeholder id as a manual
// (never-Stripe) subscription — same reasoning as stripe-customers.ts.
const isLegacyManualSubscription = (subscriptionId: string | null | undefined) =>
  !!subscriptionId &&
  (subscriptionId.startsWith("manual_") || subscriptionId.startsWith("admin-override-"));

const fromUnix = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000) : null;

async function resolvePlan(
  stripeSubscription: Stripe.Subscription,
): Promise<{ plan: SubscriptionPlan; interval: SubscriptionInterval }> {
  const priceId = stripeSubscription.items.data[0]?.price.id;
  if (!priceId) throw new Error("Subscription has no price item");

  const planInfo = await getPlanFromPriceIdAsync(priceId);
  if (!planInfo) throw new Error(`Unknown price ID: ${priceId}`);
  return planInfo;
}

/** The Subscription columns mirrored from a Stripe subscription object. */
function subscriptionFields(
  stripeSubscription: Stripe.Subscription,
  planInfo: { plan: SubscriptionPlan; interval: SubscriptionInterval },
) {
  const status = mapStripeStatus(stripeSubscription.status);
  const cancelScheduled =
    stripeSubscription.cancel_at_period_end ||
    (stripeSubscription.cancel_at !== null && stripeSubscription.status !== "canceled");
  // current_period_start/end moved to the subscription item in Stripe API v2026+
  const item = stripeSubscription.items.data[0];
  // For TEAMS per-seat billing, Stripe's quantity is the authoritative seat count.
  const quantity = item?.quantity ?? 1;

  return {
    plan: planInfo.plan,
    status,
    interval: planInfo.interval,
    currentPeriodStart: fromUnix(item?.current_period_start),
    currentPeriodEnd: fromUnix(item?.current_period_end),
    trialEndsAt: fromUnix(stripeSubscription.trial_end),
    cancelAtPeriodEnd: cancelScheduled,
    canceledAt: fromUnix(stripeSubscription.canceled_at),
    // Grace only exists while PAST_DUE. Leaving it set after recovery would keep
    // the grace banner/countdown alive; a PAST_DUE deadline is stamped once by
    // ensureGraceDeadline and never pushed back by later retry failures.
    ...(status === "PAST_DUE" ? {} : { graceEndsAt: null }),
    ...(planInfo.plan === "TEAMS" ? { memberSlotsLimit: quantity } : {}),
  };
}

async function ensureGraceDeadline(
  subscriptionRowId: string,
  status: SubscriptionStatus,
  tx: Tx,
): Promise<void> {
  if (status !== "PAST_DUE") return;
  await tx.subscription.updateMany({
    where: { id: subscriptionRowId, graceEndsAt: null },
    data: { graceEndsAt: new Date(Date.now() + PAYMENT_GRACE_MS) },
  });
}

/**
 * The personal subscription that currently decides a user's entitlements —
 * the same query shape as `getUserBillingContext` so the webhook's idea of
 * "what plan is this user on" can never disagree with what enforcement reads.
 */
async function getEffectivePersonalSubscription(userId: string, tx: Tx) {
  return tx.subscription.findFirst({
    where: { userId, status: { in: ACTIVE_BILLING_STATUSES } },
    orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
    select: { plan: true, status: true },
  });
}

async function getEffectivePersonalPlan(userId: string, tx: Tx): Promise<SubscriptionPlan> {
  return (await getEffectivePersonalSubscription(userId, tx))?.plan ?? "FREE";
}

/**
 * After a personal subscription row changed, bring the user in line with their
 * new *effective* plan: lifecycle state, downgrade clean-up, Teams re-upgrade.
 *
 * P49A-05 (A-24): this compares effective plans before/after the write rather
 * than the event's own plan, so
 *   · a lapse on the same price (→ paused / incomplete_expired / canceled) runs
 *     the downgrade clean-up — it used to be skipped because the plan column
 *     didn't change rank;
 *   · a late event for an old subscription can't downgrade a user who has since
 *     moved to a new one (the effective plan is unchanged);
 *   · an admin-LOCKED account is never flipped back to ACTIVE/GRACE.
 */
async function reconcileUserPlan(
  userId: string,
  before: SubscriptionPlan,
  tx: Tx,
  effects: AfterCommit,
  opts: { periodEnd: Date | null; notify: boolean },
): Promise<void> {
  const effective = await getEffectivePersonalSubscription(userId, tx);
  const after: SubscriptionPlan = effective?.plan ?? "FREE";

  await tx.user.updateMany({
    // LOCKED is admin-only (lifecycle-policies.md §7) — billing never clears it.
    where: { id: userId, lifecycleState: { not: "LOCKED" } },
    data: { lifecycleState: effective?.status === "PAST_DUE" ? "GRACE" : "ACTIVE" },
  });

  if (planRank(after) < planRank(before)) {
    await applyDowngrade(userId, before, after, tx, opts.periodEnd);
  }

  // Re-upgrading to TEAMS lifts any active grace lock on the owned team group.
  if (after === "TEAMS" && before !== "TEAMS") {
    await tx.group.updateMany({
      where: { ownerId: userId, type: "TEAM", teamsGraceEndsAt: { not: null } },
      data: { teamsGraceEndsAt: null },
    });
  }

  // Notify on any plan change (P20-08).
  if (opts.notify && before !== after) {
    effects.push(() => sendPlanChangedEmail({ userId, fromPlan: before, toPlan: after }));
  }
}

// ─── Core upsert ─────────────────────────────────────────────────────────────

async function upsertSubscription(
  userId: string,
  stripeSubscription: Stripe.Subscription,
  tx: Tx,
  effects: AfterCommit,
): Promise<void> {
  const planInfo = await resolvePlan(stripeSubscription);
  const subscriptionData = subscriptionFields(stripeSubscription, planInfo);

  const before = await getEffectivePersonalPlan(userId, tx);

  const existing = await tx.subscription.findFirst({
    where: { userId, providerSubscriptionId: stripeSubscription.id },
    select: { id: true },
  });

  // P49A-05: did *this* write flip the scheduled-cancellation flag? true =
  // now ending at period end, false = resumed, null = unchanged. Claimed with a
  // conditional update so a retry, a replay, or a concurrent billing-return
  // sync that already applied the flip sees count 0 and notifies nobody.
  let endingFlip: boolean | null = null;
  let rowId: string;
  if (existing) {
    const ending = subscriptionData.cancelAtPeriodEnd;
    const { count } = await tx.subscription.updateMany({
      where: { id: existing.id, cancelAtPeriodEnd: !ending },
      data: { cancelAtPeriodEnd: ending },
    });
    if (count > 0) endingFlip = ending;
    await tx.subscription.update({
      where: { id: existing.id },
      data: subscriptionData,
    });
    rowId = existing.id;
  } else {
    const subCustomer = await tx.subscriptionCustomer.findUniqueOrThrow({
      where: { userId },
    });
    const created = await tx.subscription.create({
      data: {
        userId,
        subscriptionCustomerId: subCustomer.id,
        provider: "STRIPE",
        providerSubscriptionId: stripeSubscription.id,
        ...subscriptionData,
      },
      select: { id: true },
    });
    rowId = created.id;
    if (subscriptionData.cancelAtPeriodEnd) endingFlip = true;
  }
  await ensureGraceDeadline(rowId, subscriptionData.status, tx);

  // Family owner scheduled (or withdrew) cancellation: tell the members now,
  // not at period end (lifecycle-policies.md §1a / §3a notification 1).
  if (
    endingFlip !== null &&
    planInfo.plan === "FAMILY" &&
    ACTIVE_BILLING_STATUSES.includes(subscriptionData.status)
  ) {
    await queueFamilyNotices(
      userId,
      endingFlip ? "ending-scheduled" : "ending-cancelled",
      subscriptionData.currentPeriodEnd,
      tx,
      effects,
    );
  }

  // A live Stripe subscription supersedes any legacy manual (pre-Stripe) one.
  // Only when live: an abandoned / expired checkout must not cancel a comp plan.
  if (ACTIVE_BILLING_STATUSES.includes(subscriptionData.status)) {
    await tx.subscription.updateMany({
      where: {
        userId,
        OR: [
          { providerSubscriptionId: { startsWith: "manual_" } },
          { providerSubscriptionId: { startsWith: "admin-override-" } },
        ],
        status: { in: ACTIVE_BILLING_STATUSES },
      },
      data: {
        status: "CANCELED",
        cancelAtPeriodEnd: false,
        canceledAt: new Date(),
        endedAt: new Date(),
      },
    });
  }

  await reconcileUserPlan(userId, before, tx, effects, {
    periodEnd: subscriptionData.currentPeriodEnd,
    notify: true,
  });
}

// ─── Downgrade side-effects ───────────────────────────────────────────────────

async function applyDowngrade(
  userId: string,
  fromPlan: SubscriptionPlan,
  toPlan: SubscriptionPlan,
  tx: Tx,
  currentPeriodEnd?: Date | null,
): Promise<void> {
  // 1. Pause over-limit sync accounts — Free allows 1; keep oldest active, pause rest
  if (toPlan === "FREE") {
    const syncAccounts = await tx.syncAccount.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
    const toPause = syncAccounts.slice(1);
    if (toPause.length > 0) {
      await tx.syncAccount.updateMany({
        where: { id: { in: toPause.map((s) => s.id) } },
        data: { status: "PAUSED" },
      });
    }
  }

  // 2. Convert outbound live shares to static (lifecycle-policies.md §4a)
  if (!["PRO", "FAMILY", "TEAMS"].includes(toPlan)) {
    await tx.contactShare.updateMany({
      where: { ownerUserId: userId, shareType: "LIVE_SYNC", status: "ACTIVE" },
      data: { shareType: "STATIC_COPY" },
    });
  }

  // 3. Convert inbound live shares to static (user can no longer receive live updates)
  if (!["PRO", "FAMILY", "TEAMS"].includes(toPlan)) {
    await tx.contactShare.updateMany({
      where: {
        recipientUserId: userId,
        shareType: "LIVE_SYNC",
        status: "ACTIVE",
        recipientContactId: { not: null },
      },
      data: { shareType: "STATIC_COPY" },
    });
  }

  // 4. Teams downgrade → start 14-day grace period on the owned team group.
  // Members keep read access; all writes are blocked after grace expires.
  // Re-upgrading to TEAMS clears the field (handled in reconcileUserPlan).
  if (fromPlan === "TEAMS" && toPlan !== "TEAMS") {
    const graceBase = currentPeriodEnd ?? new Date();
    const teamsGraceEndsAt = new Date(graceBase.getTime() + TEAMS_GRACE_MS);
    await tx.group.updateMany({
      where: { ownerId: userId, type: "TEAM", teamsGraceEndsAt: null },
      data: { teamsGraceEndsAt },
    });
  }

  // 5. Family lapse → the family group gets a 7-day notice period AFTER this
  // transaction commits (reconcileFamilyLapseForCustomer), then dissolves.
  // Copying a large shared book per member used to run in here and could
  // time out the whole webhook transaction, rolling back the lapse itself.
}

// ─── Family plan end-of-life (P49A-05) ────────────────────────────────────────
//
// lifecycle-policies.md §1a / §3a. A lapsed Family group is not dissolved on
// the spot: `Group.familyDissolveAt` is stamped now + 7 days and members are
// told; they keep the shared book until then (family access is membership
// based and never reads the owner's plan). Re-subscribing clears the date. The
// nightly sweep (sweepDueFamilyDissolutions, run by /api/cron/delete-accounts)
// and every later webhook for the owner dissolve groups whose date has passed.

/** Per-member dissolution transaction: one member's book copy + removal. */
const FAMILY_MEMBER_TX_TIMEOUT_MS = 60_000;

// Thrown inside a member's transaction to roll back its book copy when the
// membership was already removed by a concurrent or earlier run.
class FamilyMemberAlreadyRemoved extends Error {}

// Thrown when the owner regained Family while a member's copy was being made:
// the copy is rolled back and the member stays.
class FamilyDissolutionCancelled extends Error {}

export type FamilyLapseDb = Pick<PrismaClient, "$transaction">;

/** Family or above keeps the family group (Family → Teams is an upgrade, not a lapse). */
const hasFamilyEntitlement = (plan: SubscriptionPlan) => planRank(plan) >= planRank("FAMILY");

type FamilyGroupRef = { id: string; name: string; defaultAddressBookId: string | null };

/** A queued member notice. `label` lets tests see what was queued without running it. */
function familyNoticeEffect(
  userId: string,
  kind: FamilyNoticeKind,
  groupName: string,
  date: Date | null,
) {
  return Object.assign(() => notifyFamilyMember({ userId, kind, groupName, date }), {
    label: `family:${kind}:${userId}`,
  });
}

/** Accepted non-owner members of one family group. */
async function acceptedFamilyMembers(groupId: string, ownerId: string, tx: Tx) {
  const rows = await tx.groupMember.findMany({
    where: { groupId, inviteStatus: "ACCEPTED", role: { not: "OWNER" } },
    select: { userId: true },
  });
  return rows.flatMap((m) => (m.userId && m.userId !== ownerId ? [m.userId] : []));
}

/** Queue a notice for every accepted member of the owner's family group(s). */
async function queueFamilyNotices(
  ownerId: string,
  kind: FamilyNoticeKind,
  date: Date | null,
  tx: Tx,
  effects: AfterCommit,
): Promise<void> {
  const groups = await tx.group.findMany({
    where: { ownerId, type: "FAMILY" },
    select: { id: true, name: true },
  });
  for (const group of groups) {
    for (const userId of await acceptedFamilyMembers(group.id, ownerId, tx)) {
      effects.push(familyNoticeEffect(userId, kind, group.name, date));
    }
  }
}

/**
 * Bring one owner's family group(s) in line with their current plan, in one
 * short transaction:
 *   · entitled (Family or above) → clear any pending dissolution and tell the
 *     members the group continues;
 *   · not entitled, group still has members, no date yet → start the notice
 *     period and tell the members when it ends;
 *   · not entitled and the date has passed → returned as due for dissolution.
 * Each stamp/clear is a conditional update, so a retry or a concurrent run
 * finds nothing left to change and queues no second notice.
 */
async function reconcileFamilyNoticeForOwner(
  ownerId: string,
  now: Date,
  tx: Tx,
  effects: AfterCommit,
): Promise<FamilyGroupRef[]> {
  const entitled = hasFamilyEntitlement(await getEffectivePersonalPlan(ownerId, tx));
  const groups = await tx.group.findMany({
    where: { ownerId, type: "FAMILY" },
    select: { id: true, name: true, defaultAddressBookId: true, familyDissolveAt: true },
  });
  const due: FamilyGroupRef[] = [];

  for (const group of groups) {
    const { familyDissolveAt, ...ref } = group;
    if (entitled) {
      if (familyDissolveAt === null) continue;
      const { count } = await tx.group.updateMany({
        where: { id: group.id, familyDissolveAt: { not: null } },
        data: { familyDissolveAt: null },
      });
      if (count === 0) continue;
      for (const userId of await acceptedFamilyMembers(group.id, ownerId, tx)) {
        effects.push(familyNoticeEffect(userId, "continues", group.name, null));
      }
      continue;
    }

    if (familyDissolveAt !== null) {
      if (familyDissolveAt.getTime() <= now.getTime()) due.push(ref);
      continue;
    }
    // Pending invites count too: they are withdrawn at dissolution.
    const others = await tx.groupMember.findMany({
      where: { groupId: group.id, role: { not: "OWNER" } },
      select: { userId: true },
    });
    if (!others.some((m) => m.userId !== ownerId)) continue;
    const dissolveAt = new Date(now.getTime() + FAMILY_DISSOLVE_NOTICE_MS);
    const { count } = await tx.group.updateMany({
      where: { id: group.id, familyDissolveAt: null },
      data: { familyDissolveAt: dissolveAt },
    });
    if (count === 0) continue;
    for (const userId of await acceptedFamilyMembers(group.id, ownerId, tx)) {
      effects.push(familyNoticeEffect(userId, "lapsed", group.name, dissolveAt));
    }
  }
  return due;
}

/**
 * Dissolve one family group whose notice period is over: every other member
 * gets a private copy of the shared book (`snapshotFamilyBookForUser`, the
 * same copy they'd get by leaving) and is removed; pending invites are
 * withdrawn. The group, its book and the shared contacts stay with the owner —
 * they already own those contacts — so re-subscribing to Family only needs
 * members to be re-invited.
 *
 * Idempotent and safe to re-run:
 *   · each member is handled in its own transaction that first re-checks the
 *     owner's plan and the group's date (a re-subscribe in between stops it),
 *     snapshots the book while the membership row still exists (the P48-07
 *     projection reads the member's sharingPolicy from it), then claims the
 *     member by deleting it — count 0 means a concurrent run got there first,
 *     and the copy is rolled back, so a member is removed-with-copy or
 *     untouched, never copied twice;
 *   · a failing member doesn't stop the others; failures are rethrown at the
 *     end so the caller can log / retry.
 * Once no members are left the date is cleared (null = nothing pending), so a
 * later lapse after a re-subscribe starts a fresh notice period.
 *
 * Differs from lifecycle-policies.md §3a in one deliberate way, recorded in
 * P49A-05: the book is not archived (it is the owner's only view of those
 * contacts).
 */
async function dissolveFamilyGroup(
  database: FamilyLapseDb,
  ownerId: string,
  group: FamilyGroupRef,
  now: Date,
  effects: AfterCommit,
): Promise<number> {
  const members = await database.$transaction((tx) =>
    tx.groupMember.findMany({
      where: { groupId: group.id, role: { not: "OWNER" } },
      select: { id: true, userId: true, inviteStatus: true },
    }),
  );

  const failures: unknown[] = [];
  let removed = 0;
  for (const member of members) {
    if (member.userId === ownerId) continue;
    const memberUserId = member.userId;
    const accepted = member.inviteStatus === "ACCEPTED" && memberUserId !== null;
    try {
      const done = await database
        .$transaction(
          async (tx) => {
            if (hasFamilyEntitlement(await getEffectivePersonalPlan(ownerId, tx))) return false;
            const stillDue = await tx.group.findFirst({
              where: { id: group.id, familyDissolveAt: { lte: now } },
              select: { id: true },
            });
            if (!stillDue) return false;
            const stillMember = await tx.groupMember.findFirst({
              where: { id: member.id, groupId: group.id },
              select: { id: true },
            });
            if (!stillMember) return false;
            if (accepted && group.defaultAddressBookId) {
              await snapshotFamilyBookForUser(tx, {
                bookId: group.defaultAddressBookId,
                targetUserId: memberUserId,
                groupName: group.name,
              });
            }
            // The copy can take a while; a re-subscribe that committed
            // meanwhile must still stop the removal (READ COMMITTED sees it
            // now). Roll the copy back rather than remove the member.
            if (hasFamilyEntitlement(await getEffectivePersonalPlan(ownerId, tx))) {
              throw new FamilyDissolutionCancelled();
            }
            const stillDueNow = await tx.group.findFirst({
              where: { id: group.id, familyDissolveAt: { lte: now } },
              select: { id: true },
            });
            if (!stillDueNow) throw new FamilyDissolutionCancelled();
            const { count } = await tx.groupMember.deleteMany({
              where: { id: member.id, groupId: group.id },
            });
            if (count === 0) throw new FamilyMemberAlreadyRemoved();
            return true;
          },
          { timeout: FAMILY_MEMBER_TX_TIMEOUT_MS },
        )
        .catch((err: unknown) => {
          if (err instanceof FamilyMemberAlreadyRemoved || err instanceof FamilyDissolutionCancelled) {
            return false;
          }
          throw err;
        });
      if (!done) continue;
      removed++;
      if (accepted) {
        effects.push(familyNoticeEffect(memberUserId, "dissolved", group.name, null));
      }
    } catch (err) {
      console.error(
        `[family] dissolution failed for member ${member.id} of group ${group.id}:`,
        err,
      );
      failures.push(err);
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Family dissolution incomplete for group ${group.id}: ${failures.length} member(s) failed`,
    );
  }

  // Everyone is out: clear the marker (only if nobody slipped back in).
  await database.$transaction(async (tx) => {
    const left = await tx.groupMember.count({
      where: { groupId: group.id, role: { not: "OWNER" } },
    });
    if (left > 0) return;
    await tx.group.updateMany({
      where: { id: group.id, familyDissolveAt: { lte: now } },
      data: { familyDissolveAt: null },
    });
  });
  return removed;
}

/**
 * The owner-level step shared by the webhook and the sweep: reconcile the
 * notice period (one transaction; its notices are queued only once it
 * commits), then dissolve any group whose date has passed.
 */
async function reconcileFamilyForOwner(
  database: FamilyLapseDb,
  ownerId: string,
  now: Date,
  effects: AfterCommit,
): Promise<{ removed: number }> {
  const queued: AfterCommit = [];
  const due = await database.$transaction((tx) =>
    reconcileFamilyNoticeForOwner(ownerId, now, tx, queued),
  );
  effects.push(...queued);

  const failures: unknown[] = [];
  let removed = 0;
  for (const group of due) {
    try {
      removed += await dissolveFamilyGroup(database, ownerId, group, now, effects);
    } catch (err) {
      failures.push(err);
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, `Family dissolution incomplete for owner ${ownerId}`);
  }
  return { removed };
}

/**
 * Post-commit step after every personal subscription/invoice event (and the
 * billing-return sync): state-driven, so it is safe on any event, retry or
 * replay. A lapse starts the 7-day notice period (members are NOT removed); a
 * re-subscribe ends it; a notice period that has already run out is
 * dissolved here too, without waiting for the nightly sweep. A failure is
 * rethrown so the webhook flags the event and Stripe retries it.
 */
export async function reconcileFamilyLapseForCustomer(
  database: FamilyLapseDb,
  stripeCustomerId: string,
  effects: AfterCommit,
  now: Date = new Date(),
): Promise<{ removed: number }> {
  const ownerId = await database.$transaction(async (tx) => {
    const customer = await findStripeCustomer(stripeCustomerId, tx);
    // Teams (org) customers have no personal family group.
    return customer?.userId && !customer.groupId ? customer.userId : null;
  });
  if (!ownerId) return { removed: 0 };
  return reconcileFamilyForOwner(database, ownerId, now, effects);
}

/**
 * Nightly sweep (run from /api/cron/delete-accounts): dissolve every family
 * group whose notice period has run out while its owner is still below
 * Family. An owner found entitled again (a re-subscribe whose webhook never
 * landed) has the date cleared instead. One owner's failure doesn't stop the
 * rest; it is reported and retried on the next run.
 */
export async function sweepDueFamilyDissolutions(
  database: FamilyLapseDb,
  effects: AfterCommit,
  now: Date = new Date(),
): Promise<{ owners: number; removed: number; errors: string[] }> {
  const due = await database.$transaction((tx) =>
    tx.group.findMany({
      where: { type: "FAMILY", familyDissolveAt: { lte: now } },
      select: { ownerId: true },
    }),
  );
  const owners = [...new Set(due.map((g) => g.ownerId))];
  const errors: string[] = [];
  let removed = 0;
  for (const ownerId of owners) {
    try {
      removed += (await reconcileFamilyForOwner(database, ownerId, now, effects)).removed;
    } catch (err) {
      console.error(`[family] dissolution sweep failed for owner ${ownerId}:`, err);
      errors.push(`${ownerId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { owners: owners.length, removed, errors };
}

// ─── Org-anchored upsert (P34F-02) ────────────────────────────────────────────
//
// The Teams counterpart to upsertSubscription. The subscription row is owned by
// the Group (groupId set, userId null) and team capability lives on the Group
// (teamsEnabled / teamsGraceEndsAt / seat count). Per P34F-DB01 §07 this is NOT a
// copy of upsertSubscription: it deliberately does NOT run applyDowngrade's
// personal side-effects (sync-account pause, share conversion — meaningless for
// an org) and does NOT write lifecycleState (an org isn't a user).
async function upsertGroupSubscription(
  groupId: string,
  stripeSubscription: Stripe.Subscription,
  tx: Tx,
): Promise<void> {
  const planInfo = await resolvePlan(stripeSubscription);
  const subscriptionData = subscriptionFields(stripeSubscription, planInfo);
  const { status } = subscriptionData;
  // Stripe quantity is the authoritative seat count for Teams.
  const quantity = stripeSubscription.items.data[0]?.quantity ?? 1;

  const subCustomer = await tx.subscriptionCustomer.findUniqueOrThrow({
    where: { groupId },
  });

  const existing = await tx.subscription.findFirst({
    where: { groupId, providerSubscriptionId: stripeSubscription.id },
    select: { id: true },
  });

  let subscriptionId: string;
  if (existing) {
    await tx.subscription.update({ where: { id: existing.id }, data: subscriptionData });
    subscriptionId = existing.id;
  } else {
    const created = await tx.subscription.create({
      data: {
        groupId,
        subscriptionCustomerId: subCustomer.id,
        provider: "STRIPE",
        providerSubscriptionId: stripeSubscription.id,
        ...subscriptionData,
      },
      select: { id: true },
    });
    subscriptionId = created.id;
  }
  await ensureGraceDeadline(subscriptionId, status, tx);

  const group = await tx.group.findUnique({
    where: { id: groupId },
    select: { subscriptionId: true, teamsEnabled: true, teamsGraceEndsAt: true },
  });
  if (!group) return;

  // Org entitlement (P34F §08): the team's "is Teams active" is read off the
  // Group, not the owner. An active Teams sub enables the team and clears any
  // grace (covers re-upgrade); seat count flows to the group's capacity.
  const teamsActive =
    planInfo.plan === "TEAMS" && ACTIVE_BILLING_STATUSES.includes(status);

  if (teamsActive) {
    await tx.group.update({
      where: { id: groupId },
      data: {
        subscriptionId,
        teamsEnabled: true,
        teamsGraceEndsAt: null,
        maxMembers: quantity,
        memberSlotsLimit: quantity,
      },
    });
    return;
  }

  // A non-active subscription only speaks for the team when it is the team's
  // current one — a late event for a superseded subscription must not disable
  // a team that has since re-subscribed.
  if (group.subscriptionId && group.subscriptionId !== subscriptionId) return;

  // P49A-05: a lapse (paused / incomplete_expired / canceled) opens the same
  // 14-day read-only window as a deletion — but only for a team that was
  // actually active (a pending team whose first checkout expired has nothing
  // to wind down).
  const opensGrace = group.teamsEnabled && group.teamsGraceEndsAt === null;
  const graceBase = subscriptionData.currentPeriodEnd ?? new Date();
  await tx.group.update({
    where: { id: groupId },
    data: {
      subscriptionId,
      teamsEnabled: false,
      ...(opensGrace
        ? { teamsGraceEndsAt: new Date(graceBase.getTime() + TEAMS_GRACE_MS) }
        : {}),
    },
  });
}

// ─── Public handlers (called by the webhook processor) ────────────────────────
//
// P49A-05 (A-24): every handler that changes plan state takes the subscription
// as it is in Stripe *now* (re-fetched by the caller, see stripe-webhook.ts),
// never the event payload. Stripe delivers events out of order and retries old
// ones, so the payload can be older than what's already applied; the current
// object cannot be.

async function findStripeCustomer(stripeCustomerId: string, tx: Tx) {
  return tx.subscriptionCustomer.findFirst({
    where: { provider: "STRIPE", providerCustomerId: stripeCustomerId },
    select: { userId: true, groupId: true },
  });
}

const customerIdOf = (customer: string | { id: string } | null) =>
  typeof customer === "string" ? customer : customer?.id ?? null;

/**
 * Apply a subscription's current Stripe state: canceled → the deletion path,
 * anything else → upsert.
 */
export async function applySubscriptionState(
  current: Stripe.Subscription,
  tx: Tx,
  effects: AfterCommit,
): Promise<void> {
  if (current.status === "canceled") {
    await handleSubscriptionDeleted(current, tx, effects);
  } else {
    await handleSubscriptionUpserted(current, tx, effects);
  }
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  current: Stripe.Subscription | null,
  tx: Tx,
  effects: AfterCommit,
): Promise<void> {
  if (session.mode !== "subscription") return;

  const stripeCustomerId = customerIdOf(session.customer);
  const customer = stripeCustomerId ? await findStripeCustomer(stripeCustomerId, tx) : null;
  if (!customer) {
    throw new Error(
      `No SubscriptionCustomer found for Stripe customer ${stripeCustomerId}`,
    );
  }
  if (!current) throw new Error(`Checkout session ${session.id} has no subscription`);

  await applySubscriptionState(current, tx, effects);
}

export async function handleSubscriptionUpserted(
  stripeSubscription: Stripe.Subscription,
  tx: Tx,
  effects: AfterCommit,
): Promise<void> {
  const stripeCustomerId = customerIdOf(stripeSubscription.customer);
  const customer = stripeCustomerId ? await findStripeCustomer(stripeCustomerId, tx) : null;
  if (!customer) return;

  // P34F-02: Teams customers route to the Group; personal to the User.
  if (customer.groupId) {
    await upsertGroupSubscription(customer.groupId, stripeSubscription, tx);
  } else if (customer.userId) {
    await upsertSubscription(customer.userId, stripeSubscription, tx, effects);
  }
}

export async function handleSubscriptionDeleted(
  stripeSubscription: Stripe.Subscription,
  tx: Tx,
  effects: AfterCommit,
): Promise<void> {
  const stripeCustomerId = customerIdOf(stripeSubscription.customer);
  const customer = stripeCustomerId ? await findStripeCustomer(stripeCustomerId, tx) : null;
  if (!customer) return;

  const endedAt = fromUnix(stripeSubscription.ended_at) ?? new Date();
  const canceledAt = fromUnix(stripeSubscription.canceled_at) ?? endedAt;

  // P34F-02: org-anchored cancellation → disable the team and open the 14-day
  // grace window on the Group (read-only until expiry, then locked). No user
  // lifecycle to touch — the org isn't a user.
  if (customer.groupId) {
    const groupSub = await tx.subscription.findFirst({
      where: {
        groupId: customer.groupId,
        providerSubscriptionId: stripeSubscription.id,
      },
      select: { id: true, currentPeriodEnd: true },
    });
    if (groupSub) {
      await tx.subscription.update({
        where: { id: groupSub.id },
        data: { status: "CANCELED", canceledAt, endedAt, cancelAtPeriodEnd: false, graceEndsAt: null },
      });
    }
    const group = await tx.group.findUnique({
      where: { id: customer.groupId },
      select: { subscriptionId: true, teamsGraceEndsAt: true },
    });
    // Only the team's current subscription can end the team (a superseded one
    // being deleted late must not lock a team that re-subscribed), and a
    // replayed deletion must not push an existing grace deadline back.
    const isCurrent = !group?.subscriptionId || group.subscriptionId === groupSub?.id;
    if (group && isCurrent) {
      const graceBase = groupSub?.currentPeriodEnd ?? new Date();
      await tx.group.update({
        where: { id: customer.groupId },
        data: {
          teamsEnabled: false,
          ...(group.teamsGraceEndsAt === null
            ? { teamsGraceEndsAt: new Date(graceBase.getTime() + TEAMS_GRACE_MS) }
            : {}),
        },
      });
    }
    return;
  }
  if (!customer.userId) return;
  const userId = customer.userId;

  const before = await getEffectivePersonalPlan(userId, tx);

  const existing = await tx.subscription.findFirst({
    where: { userId, providerSubscriptionId: stripeSubscription.id },
    select: { id: true },
  });
  if (existing) {
    await tx.subscription.update({
      where: { id: existing.id },
      data: {
        plan: "FREE",
        status: "CANCELED",
        cancelAtPeriodEnd: false,
        graceEndsAt: null,
        canceledAt,
        endedAt,
      },
    });
  }

  // FREE is an active (not locked) state — reconcileUserPlan sets ACTIVE
  // (unless admin-LOCKED) and runs the downgrade clean-up.
  await reconcileUserPlan(userId, before, tx, effects, { periodEnd: null, notify: false });
}

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  current: Stripe.Subscription | null,
  tx: Tx,
  effects: AfterCommit,
): Promise<void> {
  if (!current) {
    console.log(`[stripe-webhook] invoice ${invoice.id} has no subscription; ignoring payment failure`);
    return;
  }

  // Status (PAST_DUE), GRACE lifecycle and the grace deadline all follow from
  // the subscription's current state.
  await applySubscriptionState(current, tx, effects);

  // A stale failure for a subscription that has since recovered or ended must
  // not tell the customer their payment failed.
  if (current.status !== "past_due" && current.status !== "unpaid") return;

  const customer = await findStripeCustomer(customerIdOf(invoice.customer) ?? "", tx);
  // P34F-02: org-anchored payment failure — no single user to notify;
  // billing-manager dunning is a later ticket.
  if (!customer?.userId) return;
  const userId = customer.userId;

  const row = await tx.subscription.findFirst({
    where: { userId, providerSubscriptionId: current.id },
    select: { plan: true, graceEndsAt: true },
  });
  if (!row?.graceEndsAt) return;
  const graceEndsAt = row.graceEndsAt;

  // Prompt the user to update their payment method before grace ends (P20-08).
  effects.push(() =>
    sendPaymentFailedEmail({ userId, graceEndsAt, planName: row.plan }),
  );

  // P22-DB05: in-app BILLING notification (always-on / locked category).
  effects.push(() =>
    createNotification({
      userId,
      category: "BILLING",
      title: "Payment failed",
      body: "We couldn't process your payment. Update your payment method before your grace period ends.",
      actionUrl: "/settings",
    }),
  );
}

export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  current: Stripe.Subscription | null,
  tx: Tx,
  effects: AfterCommit,
): Promise<void> {
  if (!current) return;
  // Recovery (PAST_DUE → ACTIVE, grace cleared, lifecycle ACTIVE unless LOCKED)
  // follows from the subscription's current state.
  await applySubscriptionState(current, tx, effects);
}

// Queue a trial-ending email (Phase 20 / P20-08). Looks up the user email so
// the P20 email transport layer can send the reminder without a second DB query.
export async function handleTrialWillEnd(
  subscription: Stripe.Subscription,
  tx: Tx,
  effects: AfterCommit,
): Promise<void> {
  const customer = await tx.subscriptionCustomer.findFirst({
    where: {
      provider: "STRIPE",
      providerCustomerId: customerIdOf(subscription.customer) ?? "",
    },
    select: { user: { select: { id: true } } },
  });
  if (!customer) return;
  // P34F-02: a group (Teams) customer has no single user to email a trial
  // reminder to; billing-manager notifications are a later ticket. Skip.
  if (!customer.user) return;
  const userId = customer.user.id;

  const trialEndsAt = fromUnix(subscription.trial_end);
  if (!trialEndsAt) return;

  const daysLeft = Math.max(
    1,
    Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000),
  );

  // Remind the user to add a payment method before the trial ends (P20-08).
  effects.push(() => sendTrialEndingEmail({ userId, daysLeft, trialEndsAt }));
}

/**
 * Pull the latest Stripe subscription state for a user into Kontax outside the
 * webhook path. This is used sparingly on high-signal return points like
 * Checkout success and Billing Portal return so Settings reflects plan changes
 * immediately even if the webhook arrives a moment later.
 */
export async function syncStripeBillingState(userId: string): Promise<boolean> {
  const customer = await db.subscriptionCustomer.findUnique({
    where: { userId },
    select: { provider: true, providerCustomerId: true },
  });
  if (customer?.provider !== "STRIPE") return false;
  if (isLegacyManualSubscription(customer.providerCustomerId)) return false;

  const stripe = getStripeClient();

  const localSubscription = await db.subscription.findFirst({
    where: {
      userId,
      provider: "STRIPE",
      providerSubscriptionId: { not: "" },
    },
    orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
    select: { providerSubscriptionId: true },
  });

  let stripeSubscription: Stripe.Subscription | null = null;

  if (localSubscription?.providerSubscriptionId) {
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(localSubscription.providerSubscriptionId);
    } catch {
      stripeSubscription = null;
    }
  }

  if (!stripeSubscription) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.providerCustomerId,
      status: "all",
      limit: 10,
    });

    stripeSubscription =
      subscriptions.data.find((subscription) => subscription.status !== "incomplete_expired")
      ?? subscriptions.data[0]
      ?? null;
  }

  if (!stripeSubscription) return false;
  const current = stripeSubscription;

  const effects: AfterCommit = [];
  await db.$transaction((tx) => applySubscriptionState(current, tx, effects));
  // A lapse applied here (rather than by the webhook) still starts the family
  // notice period; a failure is logged and healed by the webhook's own run.
  try {
    await reconcileFamilyLapseForCustomer(db, customer.providerCustomerId, effects);
  } catch (err) {
    console.error(`[stripe] family reconcile after billing sync failed for ${userId}:`, err);
  }
  void runAfterCommit(effects);

  return true;
}
