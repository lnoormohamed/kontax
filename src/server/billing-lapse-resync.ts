import type { PrismaClient } from "../../generated/prisma";

import { REAL_STRIPE_SUBSCRIPTION_WHERE } from "~/server/billing-placeholders";

// P49A-19 (Fable review, item 3): self-heal for a lost recovery webhook.
//
// Since the 3-day payment grace is enforced, a PAST_DUE row past `graceEndsAt`
// is a customer-visible downgrade to Free. If the customer pays but
// `invoice.payment_succeeded` / `customer.subscription.updated` never reaches
// us, nothing re-reads Stripe until the billing-portal return or the next
// event — possibly a month later. This nightly pass (run from
// /api/cron/delete-accounts, no new crontab entry) re-reads every such
// subscription from Stripe and applies its current state. A subscription
// still unpaid is re-applied unchanged (idempotent; the grace deadline can't
// move later); a paid one comes back to ACTIVE with the plan restored.
//
// Bounded (RESYNC_BATCH_LIMIT per night, least recently updated first — each
// resync rewrites the row, so a long unpaid tail rotates through), paced
// (RESYNC_DELAY_MS between Stripe calls) and fault-isolated: one failure is
// logged and reported, never thrown, and the rest of the batch still runs.

export const RESYNC_BATCH_LIMIT = 100;
export const RESYNC_DELAY_MS = 250;

type ResyncDb = Pick<PrismaClient, "subscription">;

/** Real Stripe subscriptions unpaid past their payment grace, least recently updated first. */
export async function findLapsedPaymentSubscriptions(
  client: ResyncDb,
  now: Date,
  limit = RESYNC_BATCH_LIMIT,
): Promise<string[]> {
  const rows = await client.subscription.findMany({
    where: {
      status: "PAST_DUE",
      graceEndsAt: { lt: now },
      provider: "STRIPE",
      ...REAL_STRIPE_SUBSCRIPTION_WHERE,
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { providerSubscriptionId: true },
  });
  return [...new Set(rows.map((row) => row.providerSubscriptionId).filter((id) => id !== ""))];
}

export type LapseResyncResult = { scanned: number; synced: number; errors: string[] };

export async function resyncLapsedPaymentSubscriptions(deps: {
  db: ResyncDb;
  /** Re-read one subscription from Stripe and apply it (stripe-handlers `syncStripeSubscriptionById`). */
  syncSubscription: (providerSubscriptionId: string) => Promise<unknown>;
  now?: Date;
  limit?: number;
  delayMs?: number;
}): Promise<LapseResyncResult> {
  const { db, syncSubscription, now = new Date(), limit = RESYNC_BATCH_LIMIT, delayMs = RESYNC_DELAY_MS } = deps;
  const ids = await findLapsedPaymentSubscriptions(db, now, limit);
  const errors: string[] = [];
  let synced = 0;
  for (const [index, id] of ids.entries()) {
    if (index > 0 && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      await syncSubscription(id);
      synced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[billing] lapsed-payment resync failed for ${id}:`, err);
      errors.push(`${id}: ${message}`);
    }
  }
  return { scanned: ids.length, synced, errors };
}
