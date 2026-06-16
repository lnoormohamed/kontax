import type { GroupRole } from "../../generated/prisma";

import { db } from "~/server/db";

// P34F-01: org-anchored billing helpers.
//
// A SubscriptionCustomer / Subscription belongs to *exactly one* owner: a User
// (personal plans — FREE/PRO/FAMILY) or a Group (Teams, org-anchored). The
// invariant is enforced two ways (belt & braces, per P34F-DB01 §09):
//   1. A raw-SQL CHECK constraint — scripts/sql/p34f-billing-owner-checks.sql
//      (Prisma does not generate CHECK constraints, so it is applied after
//      `prisma db push`).
//   2. assertSingleBillingOwner() below, for a cheaper error before the DB round
//      trip and to guard any write path the CHECK can't (e.g. dry-runs).

export type BillingOwner =
  | { kind: "user"; userId: string }
  | { kind: "group"; groupId: string };

/** Throw unless exactly one of userId / groupId is set. */
export function assertSingleBillingOwner(owner: {
  userId?: string | null;
  groupId?: string | null;
}): void {
  const hasUser = Boolean(owner.userId);
  const hasGroup = Boolean(owner.groupId);
  if (hasUser === hasGroup) {
    throw new Error(
      "Billing record must belong to exactly one of a user or a group.",
    );
  }
}

/** Normalise a row's owner columns to a BillingOwner (or null if malformed). */
export function toBillingOwner(owner: {
  userId?: string | null;
  groupId?: string | null;
}): BillingOwner | null {
  if (owner.groupId) return { kind: "group", groupId: owner.groupId };
  if (owner.userId) return { kind: "user", userId: owner.userId };
  return null;
}

export const getGroupBillingCustomer = (groupId: string) =>
  db.subscriptionCustomer.findUnique({
    where: { groupId },
    include: { subscriptions: true },
  });

export const getUserBillingCustomer = (userId: string) =>
  db.subscriptionCustomer.findUnique({
    where: { userId },
    include: { subscriptions: true },
  });

// Owner is always a billing manager (DB01 §09 backstop — prevents org lockout);
// any other member needs the explicit canManageBilling flag.
export const canManageGroupBilling = (member: {
  role: GroupRole;
  canManageBilling: boolean;
}): boolean => member.role === "OWNER" || member.canManageBilling;
