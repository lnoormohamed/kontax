import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { db } from "~/server/db";
import { getStripeClient } from "~/server/stripe";
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
  handleSubscriptionDeleted,
  handleSubscriptionUpserted,
  handleTrialWillEnd,
} from "~/server/stripe-handlers";
import type { Prisma } from "../../../../../generated/prisma";

export const dynamic = "force-dynamic";

type Tx = Prisma.TransactionClient;

async function routeWebhookEvent(event: Stripe.Event, tx: Tx): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object, tx);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpserted(event.data.object, tx);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, tx);
      break;
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(event.data.object, tx);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object, tx);
      break;
    case "customer.subscription.trial_will_end":
      await handleTrialWillEnd(event.data.object, tx);
      break;
    default:
      console.log(`[stripe-webhook] unhandled event type: ${event.type}`);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency check — return 200 so Stripe doesn't retry an already-processed event
  const existing = await db.stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (existing) {
    return NextResponse.json({ received: true, skipped: true });
  }

  try {
    await db.$transaction(async (tx) => {
      await routeWebhookEvent(event, tx);
      await tx.stripeWebhookEvent.create({
        data: { stripeEventId: event.id, type: event.type },
      });
    });
  } catch (err) {
    console.error(`[stripe-webhook] failed to process ${event.type} ${event.id}:`, err);
    // Record the error so it's visible in the admin panel (P21), then return 500
    // so Stripe retries with exponential backoff.
    await db.stripeWebhookEvent.upsert({
      where: { stripeEventId: event.id },
      update: { error: String(err) },
      create: { stripeEventId: event.id, type: event.type, error: String(err) },
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
