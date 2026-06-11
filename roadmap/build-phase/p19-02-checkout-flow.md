# P19-02 — Checkout Flow

## Purpose

Users need a way to purchase a paid plan. This ticket implements the upgrade path: a server action creates a Stripe Checkout session, the user is redirected to Stripe's hosted checkout page, and after payment they are redirected back to Kontax where the webhook handler (P19-03) will have already updated their plan. Using Stripe's hosted Checkout keeps Kontax outside PCI scope — no card data ever touches Kontax servers.

## Background

The pricing page (`/pricing`) exists with a comparison component (`pricing-comparison.tsx`) but upgrade buttons are currently placeholders. `SubscriptionCustomer` and `Subscription` models from Phase 11 hold the billing state. The Stripe client singleton and price ID map from P19-01 provide the API surface this ticket calls.

## Scope

**In scope:**
- `createCheckoutSession` server action — creates a Stripe Checkout session and returns the session URL
- `ensureStripeCustomer` utility — creates a Stripe customer if one does not exist for the user; returns `providerCustomerId`
- Redirect to Stripe Checkout on plan selection
- Success redirect back to `/settings?billing=success` with a confirmation banner
- Cancel redirect back to `/pricing` with no state change
- Handle the case where the user already has a Stripe subscription (upgrade/downgrade via Stripe's `subscription_update` mode or via the Customer Portal)

**Out of scope:**
- The webhook handler that confirms the plan after payment (P19-03)
- The Customer Portal link (P19-05)
- Promo codes (P19-09)

---

## Design / Implementation Spec

### `ensureStripeCustomer`

`src/server/stripe-customers.ts`:

```typescript
export async function ensureStripeCustomer(userId: string): Promise<string> {
  const stripe = getStripeClient();

  // Check if customer already exists
  const existing = await db.subscriptionCustomer.findUnique({
    where: { userId },
    select: { providerCustomerId: true },
  });
  if (existing) return existing.providerCustomerId;

  // Fetch user details for the customer record
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true },
  });

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { kontaxUserId: userId },
  });

  // Persist
  await db.subscriptionCustomer.create({
    data: {
      userId,
      provider: "STRIPE",
      providerCustomerId: customer.id,
      billingEmail: user.email,
    },
  });

  return customer.id;
}
```

### `createCheckoutSession` server action

`src/app/actions/billing.ts`:

```typescript
export async function createCheckoutSession(input: {
  plan: SubscriptionPlan;
  interval: SubscriptionInterval;
}): Promise<{ url: string } | { error: string }>
```

Steps:
1. Assert authenticated session.
2. Validate that `input.plan !== 'FREE'` — cannot checkout to Free.
3. Check if the user already has an active paid subscription — if so, they should use the Customer Portal (P19-05) to change plans, not a new Checkout session. Return `{ error: 'USE_CUSTOMER_PORTAL' }`.
4. Call `ensureStripeCustomer(userId)` to get or create the Stripe customer ID.
5. Get the Stripe price ID: `getStripePriceId(input.plan, input.interval)`.
6. Create a Stripe Checkout session:

```typescript
const session = await stripe.checkout.sessions.create({
  customer: stripeCustomerId,
  mode: "subscription",
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${process.env.APP_URL}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.APP_URL}/pricing?cancelled=1`,
  subscription_data: {
    metadata: { kontaxUserId: userId, plan: input.plan },
  },
  allow_promotion_codes: true, // enables promo code field at checkout (P19-09 configures codes)
  billing_address_collection: "auto",
});
```

7. Return `{ url: session.url }`.

### Client-side redirect

On the pricing page or upgrade prompt, clicking an upgrade CTA:
1. Calls `createCheckoutSession({ plan, interval })`.
2. On success: `window.location.href = result.url` (hard redirect to Stripe's hosted page).
3. On `USE_CUSTOMER_PORTAL`: redirect to the Customer Portal (P19-05) instead.
4. Show a loading spinner while the server action runs.

### Success landing

On return to `/settings?billing=success`:
- Show a dismissable banner: "You're now on the [Plan] plan. Welcome!"
- The plan display in settings should already reflect the new plan because P19-03/P19-04 will have processed the `checkout.session.completed` webhook before the user returns.
- If the webhook hasn't fired yet (race condition), show the banner anyway — the plan UI will update on next load.

### Already-subscribed users

Users who already have an active Stripe subscription cannot go through Checkout again — Stripe will error. Detect this on the client before calling `createCheckoutSession`:
- If `user.plan !== FREE`, show "Manage subscription" which links to the Customer Portal (P19-05) instead of "Upgrade".
- The server action also guards this and returns `USE_CUSTOMER_PORTAL` as a safety net.

---

## Acceptance Criteria

- `ensureStripeCustomer` creates a Stripe customer and `SubscriptionCustomer` row on first call; returns the existing `providerCustomerId` on subsequent calls.
- `createCheckoutSession` returns a valid Stripe Checkout session URL for a valid plan/interval combination.
- Clicking an upgrade CTA on the pricing page redirects to Stripe Checkout.
- After successful payment, the user is redirected to `/settings?billing=success` and sees a confirmation banner.
- After cancelling at Stripe, the user is redirected to `/pricing` with no plan change.
- Users with an active subscription receive `USE_CUSTOMER_PORTAL` and are not offered a second Checkout session.
- Promo code input is visible at checkout (Stripe handles code entry; P19-09 creates the codes).

---

## Risks and Open Questions

- **Webhook race condition on return:** the user returns from Stripe before the webhook fires. The `billing=success` banner is shown optimistically. If the webhook is delayed, the settings page may still show "Free" for a few seconds. Acceptable — do not poll for the webhook; it will fire within seconds in normal operation.
- **Test vs live mode:** `STRIPE_SECRET_KEY` starting with `sk_test_` means all customers, products, and sessions are in Stripe's test environment. Never mix test and live data. When going to production, create new Stripe products/prices in live mode and update the env vars.
- **Customer deduplication:** a user who signs up twice (unlikely but possible with OAuth) could get two `SubscriptionCustomer` rows. The `@unique` constraint on `userId` in `SubscriptionCustomer` prevents this at the DB level. `ensureStripeCustomer` uses `findUnique` which respects this.
