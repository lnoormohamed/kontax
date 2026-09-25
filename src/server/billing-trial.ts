import type { PrismaClient } from "../../generated/prisma";
import { db } from "~/server/db";

type SubscriptionReader = Pick<PrismaClient, "subscription">;

/**
 * P49A-05 (A-24): the 14-day Pro trial is for customers who have never had a
 * Kontax subscription. The old check looked for a prior row with
 * `plan = "PRO"`, but a canceled subscription's row is rewritten to
 * `plan = "FREE"` (handleSubscriptionDeleted) and a Pro→Family change rewrites
 * it to FAMILY — so cancel-and-resubscribe earned a second trial.
 *
 * Any prior personal Stripe subscription that got past checkout (or ever had a
 * trial) disqualifies, whatever plan it is on now. Abandoned checkouts
 * (INCOMPLETE / EXPIRED = incomplete_expired) and legacy manual comp rows don't.
 */
export async function isEligibleForProTrial(
  userId: string,
  client: SubscriptionReader = db,
): Promise<boolean> {
  const prior = await client.subscription.findFirst({
    where: {
      userId,
      provider: "STRIPE",
      NOT: { providerSubscriptionId: { startsWith: "manual_" } },
      OR: [
        { trialEndsAt: { not: null } },
        { status: { notIn: ["INCOMPLETE", "EXPIRED"] } },
      ],
    },
    select: { id: true },
  });
  return prior === null;
}
