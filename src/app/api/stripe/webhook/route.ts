import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { db } from "~/server/db";
import { getStripeClient } from "~/server/stripe";
import { processStripeWebhookEvent } from "~/server/stripe-webhook";

export const dynamic = "force-dynamic";

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

  const stripe = getStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // P49A-05: idempotency, retry-after-failure, concurrent deliveries and
  // out-of-order events are all handled in processStripeWebhookEvent.
  const outcome = await processStripeWebhookEvent(event, { db, stripe });

  if (outcome.status === "failed") {
    // 500 so Stripe retries with exponential backoff; the retry reprocesses.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  if (outcome.status === "skipped") {
    return NextResponse.json({ received: true, skipped: true });
  }
  return NextResponse.json({ received: true });
}
