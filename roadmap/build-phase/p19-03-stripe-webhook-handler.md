# P19-03 — Stripe Webhook Handler

## Purpose

Stripe communicates subscription lifecycle changes — payment success, failure, plan changes, cancellations — by POSTing webhook events to a URL on the Kontax server. This ticket implements the webhook endpoint, signature verification, and idempotent event routing. Without this, Stripe has no way to tell Kontax that a payment succeeded or failed, and plan state would never update after checkout.

## Background

Stripe webhooks are HTTP POST requests with a JSON body and an `Stripe-Signature` header that allows the server to verify the payload came from Stripe and not an attacker. The `StripeWebhookEvent` table from P19-01 provides idempotency. The Stripe client from P19-01 provides the `stripe.webhooks.constructEvent()` method for signature verification.

## Scope

**In scope:**
- `POST /api/stripe/webhook` route handler
- Stripe signature verification using `STRIPE_WEBHOOK_SECRET`
- Idempotency check against `StripeWebhookEvent`
- Event routing to handler functions for each relevant event type
- Handler stubs for all events (P19-04 fills in the plan sync logic)

**Events handled:**
- `checkout.session.completed` — new subscription created after checkout
- `customer.subscription.created` — subscription created (may fire alongside checkout.session.completed)
- `customer.subscription.updated` — plan change, renewal, status change
- `customer.subscription.deleted` — subscription cancelled/expired
- `invoice.payment_succeeded` — payment confirmed; subscription active
- `invoice.payment_failed` — payment failed; start grace period
- `customer.subscription.trial_will_end` — trial ending in 3 days (send email warning)

**Out of scope:**
- The actual plan sync logic (P19-04)
- Email notifications for billing events (Phase 20)

---

## Design / Implementation Spec

### Webhook route

`src/app/api/stripe/webhook/route.ts`:

```typescript
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "~/server/stripe";
import { db } from "~/server/db";

export async function POST(req: NextRequest) {
  const body = await req.text(); // must read as raw text for signature verification
  const sig = headers().get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency check
  const existing = await db.stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (existing) {
    return NextResponse.json({ received: true, skipped: true });
  }

  // Process the event in a transaction with idempotency row
  try {
    await db.$transaction(async (tx) => {
      await routeWebhookEvent(event, tx);
      await tx.stripeWebhookEvent.create({
        data: { stripeEventId: event.id, type: event.type },
      });
    });
  } catch (err) {
    // Log the error but return 500 so Stripe retries
    console.error(`[stripe-webhook] failed to process ${event.type} ${event.id}:`, err);
    await db.stripeWebhookEvent.upsert({
      where: { stripeEventId: event.id },
      update: { error: String(err) },
      create: { stripeEventId: event.id, type: event.type, error: String(err) },
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

### Event router

```typescript
async function routeWebhookEvent(
  event: Stripe.Event,
  tx: PrismaTransactionClient,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, tx);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpserted(event.data.object as Stripe.Subscription, tx);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, tx);
      break;
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, tx);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, tx);
      break;
    case "customer.subscription.trial_will_end":
      await handleTrialWillEnd(event.data.object as Stripe.Subscription, tx);
      break;
    default:
      // Unknown event type — log and ignore
      console.log(`[stripe-webhook] unhandled event type: ${event.type}`);
  }
}
```

### Handler stubs (filled in by P19-04)

Each handler receives the Stripe object and the Prisma transaction client. They are implemented as separate functions in `src/server/stripe-handlers.ts`. P19-03 ships the stubs with `console.log` bodies; P19-04 fills in the real logic.

```typescript
// src/server/stripe-handlers.ts

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  tx: PrismaTransactionClient,
): Promise<void> {
  // Implemented in P19-04
  console.log("[stripe-webhook] checkout.session.completed", session.id);
}

export async function handleSubscriptionUpserted(
  subscription: Stripe.Subscription,
  tx: PrismaTransactionClient,
): Promise<void> {
  // Implemented in P19-04
  console.log("[stripe-webhook] subscription upserted", subscription.id);
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  tx: PrismaTransactionClient,
): Promise<void> {
  // Implemented in P19-04
  console.log("[stripe-webhook] subscription deleted", subscription.id);
}

export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  tx: PrismaTransactionClient,
): Promise<void> {
  // Implemented in P19-04
  console.log("[stripe-webhook] invoice.payment_succeeded", invoice.id);
}

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  tx: PrismaTransactionClient,
): Promise<void> {
  // Implemented in P19-04
  console.log("[stripe-webhook] invoice.payment_failed", invoice.id);
}

export async function handleTrialWillEnd(
  subscription: Stripe.Subscription,
  tx: PrismaTransactionClient,
): Promise<void> {
  // Queue a trial-ending email (Phase 20 / P20-08)
  console.log("[stripe-webhook] trial_will_end", subscription.id);
}
```

### Webhook endpoint registration

In the Stripe dashboard (or via Stripe CLI for local development), register the webhook endpoint:

- URL: `{APP_URL}/api/stripe/webhook`
- Events to listen to: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.trial_will_end`

For local development, use Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This outputs a webhook signing secret (`whsec_...`) — use it as `STRIPE_WEBHOOK_SECRET` locally.

### Middleware exclusion

The webhook route must be excluded from CSRF protection and session auth middleware (P18-10). It uses its own Stripe signature for authentication. Add `/api/stripe/webhook` to the `PUBLIC_PATHS` list in `src/middleware.ts`.

---

## Acceptance Criteria

- `POST /api/stripe/webhook` accepts a valid Stripe event and returns 200.
- Invalid signatures are rejected with 400.
- A duplicate event (same `stripeEventId`) is acknowledged with 200 and not re-processed.
- A processing error returns 500 so Stripe retries and logs the error to `StripeWebhookEvent.error`.
- All 7 event types are routed to their handler functions.
- The route is excluded from session auth middleware.
- Stripe CLI can successfully forward local events to the development server.
- Unit tests: valid signature accepted, invalid signature rejected, duplicate event skipped, processing error returns 500.

---

## Risks and Open Questions

- **Raw body requirement:** Next.js route handlers parse the request body by default. Stripe signature verification requires the raw body string. Using `req.text()` before any JSON parsing is critical — if the body is parsed first, signature verification fails. Never use `req.json()` in this handler.
- **Transaction size:** wrapping the event handler and idempotency insert in a single DB transaction means a long-running handler delays the idempotency commit. For the current event types this is fine. If any handler becomes slow, consider committing idempotency first and handling asynchronously.
- **Stripe retry behaviour:** if the endpoint returns 5xx, Stripe retries with exponential backoff for up to 3 days. A persistent 5xx (e.g., a DB bug) will cause repeated retries. Monitor `StripeWebhookEvent.error` in the admin panel (Phase 21).
