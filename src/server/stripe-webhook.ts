import type Stripe from "stripe";

import type { Prisma, PrismaClient } from "../../generated/prisma";
import {
  type AfterCommit,
  applySubscriptionState,
  handleCheckoutSessionCompleted,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
  handleTrialWillEnd,
  reconcileFamilyLapseForCustomer,
  runAfterCommit,
} from "~/server/stripe-handlers";

// P49A-05: Stripe webhook processing, split out of the route so it can be
// tested (and later re-driven from an admin "reprocess" action) without HTTP.
//
// Guarantees:
//   · Exactly-once *success*. A StripeWebhookEvent row with `error = null` marks
//     an event as applied; only those are skipped. A failed attempt leaves a row
//     with `error` set, and Stripe's retry reprocesses it (A-09: the retry used
//     to see the error row and skip it forever).
//   · Concurrent deliveries of one event: the success marker is written inside
//     the same transaction as the state change, so the loser hits the unique
//     index (P2002) or finds the error row already cleared, rolls back, and
//     re-reads the winner's row instead of recording a failure.
//   · Order-independence (A-24): subscription and invoice events apply the
//     subscription as it is in Stripe *now* (re-fetched below), never the event
//     payload, so an old event delivered late cannot regress newer state.
//   · Family follow-up runs after the commit (Fable review): a Family lapse
//     commits the subscription/entitlement change first, then
//     reconcileFamilyLapseForCustomer starts the group's 7-day notice period
//     (or clears it on a re-subscribe) and dissolves any group whose notice has
//     already run out, member by member, each in its own transaction. That step
//     is idempotent and state-driven; if it fails, the event row gets its error
//     back and the 500 makes Stripe retry — the retry re-applies the
//     (unchanged) state and re-runs it for whatever is still left.

type Tx = Prisma.TransactionClient;

export type WebhookDb = Pick<PrismaClient, "stripeWebhookEvent" | "$transaction">;

export type WebhookDeps = {
  db: WebhookDb;
  stripe: Stripe;
  /** Receives the post-commit side effects. Default: run them, fire-and-forget. */
  afterCommit?: (effects: AfterCommit) => void;
};

export type WebhookOutcome =
  | { status: "processed" }
  | { status: "skipped" }
  | { status: "failed"; error: string };

/** State changes only — the Family follow-up runs post-commit in its own transactions. */
const TX_TIMEOUT_MS = 30_000;
const MAX_ERROR_LENGTH = 2000;

class AlreadyProcessedError extends Error {
  constructor() {
    super("Stripe event was processed by a concurrent delivery");
  }
}

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";

const isStripeNotFound = (err: unknown) =>
  typeof err === "object" &&
  err !== null &&
  ((err as { statusCode?: unknown }).statusCode === 404 ||
    (err as { code?: unknown }).code === "resource_missing");

const idOf = (ref: string | { id: string } | null | undefined) =>
  typeof ref === "string" ? ref : ref?.id ?? null;

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription);
}

/**
 * The subscription an event concerns, as it is in Stripe now. Runs before the
 * DB transaction so no network call holds a transaction open.
 */
async function loadCurrentSubscription(
  event: Stripe.Event,
  stripe: Stripe,
): Promise<Stripe.Subscription | null> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription") return null;
      const id = idOf(session.subscription);
      return id ? stripe.subscriptions.retrieve(id) : null;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const payload = event.data.object;
      try {
        return await stripe.subscriptions.retrieve(payload.id);
      } catch (err) {
        if (!isStripeNotFound(err)) throw err;
        // Gone from Stripe entirely: a deletion is terminal, so its payload is
        // safe to apply; any other event for a vanished subscription is moot.
        return event.type === "customer.subscription.deleted" ? payload : null;
      }
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const id = invoiceSubscriptionId(event.data.object);
      return id ? stripe.subscriptions.retrieve(id) : null;
    }
    default:
      return null;
  }
}

async function applyWebhookEvent(
  event: Stripe.Event,
  current: Stripe.Subscription | null,
  tx: Tx,
  effects: AfterCommit,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object, current, tx, effects);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      if (current) await applySubscriptionState(current, tx, effects);
      break;
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(event.data.object, current, tx, effects);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object, current, tx, effects);
      break;
    case "customer.subscription.trial_will_end":
      await handleTrialWillEnd(event.data.object, tx, effects);
      break;
    default:
      console.log(`[stripe-webhook] unhandled event type: ${event.type}`);
  }
}

/** Write the success marker inside the processing transaction. */
async function markProcessed(tx: Tx, event: Stripe.Event, retrying: boolean): Promise<void> {
  if (retrying) {
    // Clear the error only if it's still set: a concurrent delivery that already
    // succeeded has cleared it, and then this attempt must roll back.
    const { count } = await tx.stripeWebhookEvent.updateMany({
      where: { stripeEventId: event.id, error: { not: null } },
      data: { error: null, processedAt: new Date() },
    });
    if (count === 0) throw new AlreadyProcessedError();
    return;
  }
  // P2002 here means a concurrent delivery committed first.
  await tx.stripeWebhookEvent.create({
    data: { stripeEventId: event.id, type: event.type },
  });
}

/** Record a failed attempt without clobbering a concurrent success. */
async function recordFailure(db: WebhookDb, event: Stripe.Event, message: string): Promise<void> {
  try {
    const { count } = await db.stripeWebhookEvent.updateMany({
      where: { stripeEventId: event.id, error: { not: null } },
      data: { error: message, processedAt: new Date() },
    });
    if (count > 0) return;
    await db.stripeWebhookEvent.create({
      data: { stripeEventId: event.id, type: event.type, error: message },
    });
  } catch (err) {
    // P2002: a concurrent delivery succeeded first — its row stands.
    if (!isUniqueViolation(err)) {
      console.error(`[stripe-webhook] could not record failure for ${event.id}:`, err);
    }
  }
}

/** A committed event whose post-commit step failed: flag it for reprocessing. */
async function markPostCommitFailure(db: WebhookDb, event: Stripe.Event, message: string) {
  try {
    await db.stripeWebhookEvent.updateMany({
      where: { stripeEventId: event.id },
      data: { error: message, processedAt: new Date() },
    });
  } catch (err) {
    console.error(`[stripe-webhook] could not record post-commit failure for ${event.id}:`, err);
  }
}

async function isAlreadyProcessed(db: WebhookDb, eventId: string): Promise<boolean> {
  const row = await db.stripeWebhookEvent.findUnique({
    where: { stripeEventId: eventId },
    select: { error: true },
  });
  return row !== null && row.error === null;
}

export async function processStripeWebhookEvent(
  event: Stripe.Event,
  deps: WebhookDeps,
): Promise<WebhookOutcome> {
  const { db } = deps;

  const existing = await db.stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
    select: { error: true },
  });
  // Only a successful row is final; an errored one is reprocessed.
  if (existing?.error === null) return { status: "skipped" };

  const effects: AfterCommit = [];
  let current: Stripe.Subscription | null = null;
  try {
    current = await loadCurrentSubscription(event, deps.stripe);
    const subscription = current;
    await db.$transaction(
      async (tx) => {
        await applyWebhookEvent(event, subscription, tx, effects);
        await markProcessed(tx, event, existing !== null);
      },
      { timeout: TX_TIMEOUT_MS },
    );
  } catch (err) {
    if (
      (err instanceof AlreadyProcessedError || isUniqueViolation(err)) &&
      (await isAlreadyProcessed(db, event.id))
    ) {
      return { status: "skipped" };
    }
    console.error(`[stripe-webhook] failed to process ${event.type} ${event.id}:`, err);
    const message = String(err).slice(0, MAX_ERROR_LENGTH);
    // Visible in the DB (and to a future admin reprocess action); Stripe
    // retries on the 500 the caller returns, and the retry reprocesses.
    await recordFailure(db, event, message);
    return { status: "failed", error: message };
  }

  let outcome: WebhookOutcome = { status: "processed" };
  const customerId = current ? idOf(current.customer) : null;
  if (customerId) {
    try {
      await reconcileFamilyLapseForCustomer(db, customerId, effects);
    } catch (err) {
      // The state change is committed; only the family follow-up is incomplete.
      // Put the error back on the event so Stripe's retry reprocesses it.
      console.error(`[stripe-webhook] post-commit family reconcile failed for ${event.id}:`, err);
      const message = `post-commit: ${String(err)}`.slice(0, MAX_ERROR_LENGTH);
      await markPostCommitFailure(db, event, message);
      outcome = { status: "failed", error: message };
    }
  }

  // Effects queued so far belong to committed work (the state change, and each
  // member removed before any failure), so they run either way.
  if (deps.afterCommit) {
    deps.afterCommit(effects);
  } else {
    void runAfterCommit(effects);
  }
  return outcome;
}
