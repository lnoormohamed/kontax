import type Stripe from "stripe";

import { isPlaceholderProviderId } from "~/server/billing-placeholders";
import { db } from "~/server/db";
import { getStripeClient } from "~/server/stripe";

// P48-14: stop billing before a user row is hard-deleted.
//
// SubscriptionCustomer.user and Subscription.user both cascade, so
// `db.user.delete` silently erases every local trace of the plan while Stripe
// keeps charging the card — the local record is gone, the invoice is not. This
// module closes that gap by calling Stripe *before* the delete.
//
// Design rules:
//   · Best-effort. It NEVER throws — a Stripe outage must not block or
//     half-complete an account deletion the user already confirmed. Every
//     failure is logged with enough detail to reconcile by hand in the Stripe
//     dashboard.
//   · No-op when Stripe is not configured (local dev, CI, self-hosted without
//     billing): getStripeClient() throws on a missing key, so that is caught
//     and reported as a skip rather than an error.
//   · Teams billing is ORG-anchored (P34F). A member leaving — even a billing
//     manager — must not touch the org's subscription. Only the deletion of the
//     user who is still `Group.ownerId` cancels it, because `Group.owner`
//     cascades: that group (and its SubscriptionCustomer) is about to be
//     deleted along with the user. A completed ownership transfer
//     (transferTeamOwnership) has already moved `ownerId` to someone else, so
//     this function correctly leaves that org's billing alone.

/** Stripe statuses we treat as already-finished — nothing left to cancel. */
const TERMINAL_STATUSES = new Set(["CANCELED", "EXPIRED"]);

/**
 * Placeholder ids (pre-Stripe "manual_" comps, P49A-07 admin overrides, legacy
 * "admin-override-") — nothing in Stripe; see billing-placeholders.ts.
 */
const isLegacyManualStripeCustomer = isPlaceholderProviderId;

export type BillingCancellationOutcome = {
  /** Stripe subscription ids successfully cancelled. */
  canceledSubscriptions: string[];
  /** Stripe customer ids successfully deleted. */
  deletedCustomers: string[];
  /** Human-readable reasons a record was intentionally left alone. */
  skipped: string[];
  /** Human-readable failures — deletion still proceeds, reconcile by hand. */
  errors: string[];
};

const emptyOutcome = (): BillingCancellationOutcome => ({
  canceledSubscriptions: [],
  deletedCustomers: [],
  skipped: [],
  errors: [],
});

/**
 * Cancel one SubscriptionCustomer's Stripe records: every live subscription,
 * then the customer object itself.
 */
async function cancelCustomer(
  stripe: Stripe,
  customer: {
    providerCustomerId: string;
    provider: string;
    subscriptions: { providerSubscriptionId: string; status: string }[];
  },
  label: string,
  outcome: BillingCancellationOutcome,
): Promise<void> {
  if (customer.provider !== "STRIPE") {
    outcome.skipped.push(`${label}: provider is ${customer.provider}, not Stripe`);
    return;
  }
  if (isLegacyManualStripeCustomer(customer.providerCustomerId)) {
    outcome.skipped.push(
      `${label}: legacy manual customer ${customer.providerCustomerId} — nothing in Stripe`,
    );
    return;
  }

  for (const subscription of customer.subscriptions) {
    // An admin comp row can hang off a REAL customer (overridePlanForUser
    // reuses an existing cus_ row): its id is not a Stripe subscription.
    if (isPlaceholderProviderId(subscription.providerSubscriptionId)) {
      outcome.skipped.push(
        `${label}: comp subscription ${subscription.providerSubscriptionId} — nothing in Stripe`,
      );
      continue;
    }
    if (TERMINAL_STATUSES.has(subscription.status)) {
      outcome.skipped.push(
        `${label}: subscription ${subscription.providerSubscriptionId} already ${subscription.status}`,
      );
      continue;
    }
    try {
      // Immediate cancellation, NOT cancel_at_period_end — the account and all
      // of its data are being erased right now, so there is no remaining
      // period to serve. Stripe treats a repeat cancel of an already-cancelled
      // subscription as an error, hence the per-item try.
      await stripe.subscriptions.cancel(subscription.providerSubscriptionId);
      outcome.canceledSubscriptions.push(subscription.providerSubscriptionId);
    } catch (err) {
      outcome.errors.push(
        `${label}: failed to cancel subscription ${subscription.providerSubscriptionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  try {
    // Deleting the customer also detaches its payment methods, so no saved card
    // survives the account. Stripe keeps the invoice history for our records.
    await stripe.customers.del(customer.providerCustomerId);
    outcome.deletedCustomers.push(customer.providerCustomerId);
  } catch (err) {
    outcome.errors.push(
      `${label}: failed to delete customer ${customer.providerCustomerId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/**
 * Cancel every Stripe record that dies with this user, immediately before the
 * row is hard-deleted. Best-effort and non-throwing: inspect the returned
 * outcome (it is also logged) rather than relying on exceptions.
 */
export async function cancelBillingForDeletedUser(
  userId: string,
): Promise<BillingCancellationOutcome> {
  const outcome = emptyOutcome();

  let stripe: Stripe;
  try {
    stripe = getStripeClient();
  } catch {
    // STRIPE_SECRET_KEY unset — billing is not configured in this environment.
    outcome.skipped.push("Stripe is not configured (STRIPE_SECRET_KEY unset)");
    console.log(
      `[billing-lifecycle] Skipping Stripe cancellation for user ${userId}: billing not configured.`,
    );
    return outcome;
  }

  try {
    const customerSelect = {
      providerCustomerId: true,
      provider: true,
      subscriptions: {
        select: { providerSubscriptionId: true, status: true },
      },
    } as const;

    // --- Personal plan --------------------------------------------------
    const personal = await db.subscriptionCustomer.findUnique({
      where: { userId },
      select: customerSelect,
    });
    if (personal) {
      await cancelCustomer(stripe, personal, "personal", outcome);
    }

    // --- Teams (org-anchored, P34F) -------------------------------------
    // `Group.owner` is onDelete: Cascade, so every group this user still owns
    // is about to be deleted with them — its billing must go too. Groups where
    // ownership was transferred away are no longer matched here, which is the
    // "a transfer exists, so leave billing alone" case.
    const ownedBillingGroups = await db.group.findMany({
      where: { ownerId: userId, billingCustomer: { isNot: null } },
      select: {
        id: true,
        name: true,
        billingCustomer: { select: customerSelect },
      },
    });
    for (const group of ownedBillingGroups) {
      if (!group.billingCustomer) continue;
      await cancelCustomer(
        stripe,
        group.billingCustomer,
        `team ${group.id}`,
        outcome,
      );
    }

    // --- Teams the user pays attention to but does not own ---------------
    // A billing manager (or plain member) leaving must not cancel the org's
    // plan: the org survives them. Recorded as an explicit no-op so the log
    // shows the decision was made deliberately.
    const otherBillingGroups = await db.groupMember.findMany({
      where: {
        userId,
        canManageBilling: true,
        group: { ownerId: { not: userId }, billingCustomer: { isNot: null } },
      },
      select: { groupId: true },
    });
    for (const member of otherBillingGroups) {
      outcome.skipped.push(
        `team ${member.groupId}: user is a billing manager but not the owner — org billing is unaffected`,
      );
    }
  } catch (err) {
    // A DB failure here must not abort the deletion either.
    outcome.errors.push(
      `failed to enumerate billing records: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const summary = [
    `canceled=${outcome.canceledSubscriptions.length}`,
    `customersDeleted=${outcome.deletedCustomers.length}`,
    `skipped=${outcome.skipped.length}`,
    `errors=${outcome.errors.length}`,
  ].join(" ");
  if (outcome.errors.length > 0) {
    console.error(
      `[billing-lifecycle] Stripe cancellation for user ${userId} completed with errors (${summary}). Reconcile manually:`,
      outcome.errors,
    );
  } else {
    console.log(`[billing-lifecycle] Stripe cancellation for user ${userId}: ${summary}`);
  }
  if (outcome.skipped.length > 0) {
    console.log(`[billing-lifecycle] Skipped for user ${userId}:`, outcome.skipped);
  }

  return outcome;
}
