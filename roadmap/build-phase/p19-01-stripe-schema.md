# P19-01 — Stripe Schema Additions

## Purpose

The `SubscriptionCustomer` and `Subscription` models from Phase 2/11 capture the local billing state. This ticket adds the missing pieces that Stripe integration specifically requires: a webhook event idempotency table, a price-ID-to-plan mapping utility, and the `stripe` package itself. Without idempotency tracking, replayed webhooks can double-apply state changes (e.g., downgrade a plan twice). Without a price ID map, the checkout flow cannot translate a user's plan selection into a Stripe API call.

## Background

The existing schema already has `SubscriptionCustomer.providerCustomerId` (the Stripe customer ID) and `Subscription.providerSubscriptionId` (the Stripe subscription ID). The `BillingProvider` enum has `STRIPE`. The `SubscriptionStatus` enum maps to Stripe's subscription statuses. What is missing is the infrastructure to safely consume Stripe webhook events and to produce Stripe API calls with the correct price IDs.

## Scope

**In scope:**
- Install `stripe` npm package
- `StripeWebhookEvent` Prisma model for idempotency
- `STRIPE_PRICE_MAP` utility — maps `SubscriptionPlan + interval` to `STRIPE_PRICE_ID_*` env vars
- `getStripeClient()` singleton — creates a Stripe client from `STRIPE_SECRET_KEY`
- Validate all required env vars exist at startup (extend `src/env.js`)

**Out of scope:**
- Any Stripe API calls (those are in P19-02 and P19-03)
- UI changes

---

## Design / Implementation Spec

### Install Stripe SDK

```bash
npm install stripe
```

Use the official `stripe` npm package. Pin to a recent stable major version. The Stripe SDK is TypeScript-native.

### `StripeWebhookEvent` model

Add to `prisma/schema.prisma`:

```prisma
model StripeWebhookEvent {
    id          String   @id @default(cuid())
    stripeEventId String @unique
    type        String
    processedAt DateTime @default(now())
    error       String?

    @@index([stripeEventId])
    @@index([processedAt])
}
```

Run: `prisma migrate dev --name add-stripe-webhook-event`

**Usage:** before processing any webhook event, check if `stripeEventId` already exists in this table. If it does, return 200 immediately without re-processing. If it does not, process the event and then insert the row. Use a DB transaction wrapping both the event processing and the idempotency row insert so a crash mid-processing does not leave a partial state.

### Stripe client singleton

`src/server/stripe.ts`:

```typescript
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20", // pin to a specific API version
      typescript: true,
    });
  }
  return _stripe;
}
```

### Price ID map

`src/server/stripe-prices.ts`:

```typescript
import { SubscriptionPlan, SubscriptionInterval } from "../../generated/prisma";

export type PriceKey = `${SubscriptionPlan}_${SubscriptionInterval}`;

const PRICE_MAP: Record<PriceKey, string | undefined> = {
  PRO_MONTHLY:    process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
  PRO_YEARLY:     process.env.STRIPE_PRICE_ID_PRO_YEARLY,
  FAMILY_MONTHLY: process.env.STRIPE_PRICE_ID_FAMILY_MONTHLY,
  FAMILY_YEARLY:  process.env.STRIPE_PRICE_ID_FAMILY_YEARLY,
  TEAMS_MONTHLY:  process.env.STRIPE_PRICE_ID_TEAMS_MONTHLY,
  TEAMS_YEARLY:   process.env.STRIPE_PRICE_ID_TEAMS_YEARLY,
  // FREE has no price — cannot be "purchased"
  FREE_MONTHLY:   undefined,
  FREE_YEARLY:    undefined,
};

export function getStripePriceId(
  plan: SubscriptionPlan,
  interval: SubscriptionInterval,
): string {
  const key: PriceKey = `${plan}_${interval}`;
  const priceId = PRICE_MAP[key];
  if (!priceId) {
    throw new Error(`No Stripe price ID configured for ${key}. Set STRIPE_PRICE_ID_${key} in env.`);
  }
  return priceId;
}

export function getPlanFromPriceId(priceId: string): {
  plan: SubscriptionPlan;
  interval: SubscriptionInterval;
} | null {
  for (const [key, id] of Object.entries(PRICE_MAP)) {
    if (id === priceId) {
      const [plan, interval] = key.split("_") as [SubscriptionPlan, SubscriptionInterval];
      return { plan, interval };
    }
  }
  return null;
}
```

### `src/env.js` additions

Add Stripe env vars to the server schema in `src/env.js`:

```javascript
STRIPE_SECRET_KEY: z.string().min(1),
STRIPE_WEBHOOK_SECRET: z.string().min(1),
STRIPE_PRICE_ID_PRO_MONTHLY: z.string().min(1),
STRIPE_PRICE_ID_PRO_YEARLY: z.string().min(1),
STRIPE_PRICE_ID_FAMILY_MONTHLY: z.string().min(1),
STRIPE_PRICE_ID_FAMILY_YEARLY: z.string().min(1),
STRIPE_PRICE_ID_TEAMS_MONTHLY: z.string().min(1),
STRIPE_PRICE_ID_TEAMS_YEARLY: z.string().min(1),
```

Mark all as optional with `.optional()` in development to allow the app to start without Stripe configured — billing features should degrade gracefully when keys are absent, not crash the entire app.

---

## Acceptance Criteria

- `stripe` package is installed and listed in `package.json`.
- `StripeWebhookEvent` model exists in the schema with a `@unique` constraint on `stripeEventId`; migration applied.
- `getStripeClient()` returns a configured Stripe instance; throws a clear error if `STRIPE_SECRET_KEY` is not set.
- `getStripePriceId(plan, interval)` returns the correct price ID from env vars; throws if the price ID is not configured.
- `getPlanFromPriceId(priceId)` returns the correct plan/interval pair for a given price ID.
- All 8 Stripe env vars are documented in `.env.example` and validated in `src/env.js`.
- The app starts and functions normally when Stripe env vars are absent (billing actions fail gracefully with a "billing not configured" error, not a startup crash).

---

## Risks and Open Questions

- **API version pinning:** Stripe occasionally makes breaking changes to their API. Pinning to a specific `apiVersion` in the client constructor ensures behaviour doesn't change when Stripe updates their API. Update the pin deliberately when upgrading.
- **Price ID management:** Stripe price IDs are immutable once created. If a price needs to change (e.g., a different billing amount), a new Stripe price must be created and the env var updated. Do not reuse price IDs across pricing changes.
- **Free plan in PRICE_MAP:** Free is included in the map with `undefined` values to make the type exhaustive. `getStripePriceId` must never be called with `FREE` — the checkout flow must gate this before calling the function.
