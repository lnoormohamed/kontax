# P19-05 — Customer Portal

## Purpose

Users with a paid subscription need to manage their billing without requiring Kontax to build payment method forms, invoice history pages, or cancellation flows. Stripe's hosted Customer Portal provides all of this out of the box. This ticket adds a server action that creates a portal session and a "Manage billing" button in settings that redirects users there.

## Background

Stripe's Customer Portal is a Stripe-hosted page where customers can: update their payment method, view invoice history, change their subscription plan, and cancel. Kontax enables the portal and lets Stripe handle all the sensitive billing UI.

## Scope

**In scope:**
- Portal configuration in Stripe dashboard (document required settings)
- `createPortalSession` server action — creates a Stripe Billing Portal session URL
- "Manage billing" button in `/settings` (billing section) and `/pricing` (for existing subscribers)
- Return URL configuration — user lands back on `/settings` after exiting the portal

**Out of scope:**
- Cancellation confirmation UI with data-loss warnings (P19-07) — that's Kontax-native, not the Stripe portal
- Any Stripe portal customisation beyond what's needed for v1

---

## Design / Implementation Spec

### Stripe portal configuration

In the Stripe dashboard under **Customer Portal** settings, configure:

- **Business information:** Kontax name and logo
- **Features enabled:**
  - Update payment methods: ✓
  - View invoice history: ✓
  - Cancel subscriptions: ✓ (Stripe handles the cancellation confirmation; Kontax adds its own warning in P19-07 before the user reaches the portal)
  - Update subscriptions (plan changes): ✓ — configure allowed plans and prices
- **Cancellation behaviour:** cancel at end of billing period (not immediately)
- **Return URL:** `{APP_URL}/settings?portal=returned`

Document these settings in `.env.example` as a comment — they are configured in the Stripe dashboard, not via env vars.

### `createPortalSession` server action

`src/app/actions/billing.ts`:

```typescript
export async function createPortalSession(): Promise<
  { url: string } | { error: string }
>
```

Steps:
1. Assert authenticated session.
2. Look up `SubscriptionCustomer` for the user. If not found, return `{ error: "NO_SUBSCRIPTION" }`.
3. Create a Stripe portal session:

```typescript
const session = await stripe.billingPortal.sessions.create({
  customer: subscriptionCustomer.providerCustomerId,
  return_url: `${process.env.APP_URL}/settings?portal=returned`,
});
return { url: session.url };
```

4. Return `{ url: session.url }`.

### Settings UI

In `/settings`, within the billing/plan section:

**For Free users:** Show the pricing page link instead — "Upgrade to Pro" CTA routes to `/pricing`.

**For paid users:**
```
Current plan: Pro (Monthly)
Next billing date: July 15, 2026

[Manage billing →]   (secondary button — opens Stripe portal in same tab)
```

"Manage billing" calls `createPortalSession()` and redirects to the returned URL. Show a loading spinner while the server action runs.

**On return from portal** (`?portal=returned` query param):
- Show a brief "Billing updated" banner if the subscription was changed.
- The plan display reflects any changes made in the portal (webhook will have fired).

### Pricing page — existing subscribers

Users who already have a paid subscription should see "Manage subscription" instead of "Upgrade" on the pricing page (detected by checking `session.user.plan !== 'FREE'`). Clicking "Manage subscription" routes to the portal.

---

## Acceptance Criteria

- `createPortalSession` returns a valid Stripe portal URL for a user with an active subscription.
- `createPortalSession` returns `NO_SUBSCRIPTION` error for users without a `SubscriptionCustomer` row.
- Clicking "Manage billing" in settings redirects the user to Stripe's hosted portal.
- After exiting the portal, the user lands back on `/settings?portal=returned`.
- Existing paid subscribers see "Manage subscription" on the pricing page, not "Upgrade".
- The portal is configured to allow payment method updates, invoice history, and cancellation.

---

## Risks and Open Questions

- **Portal configuration is dashboard-side:** unlike most Stripe features, the portal configuration lives in the Stripe dashboard, not in code. Document the exact settings that must be configured. A misconfigured portal (e.g., cancellation disabled) won't break anything but will confuse users.
- **Plan change via portal vs checkout:** if the portal allows plan upgrades, the webhook handler (P19-04) must handle the resulting `customer.subscription.updated` event correctly. This is already covered by `handleSubscriptionUpserted`. Confirm in testing that upgrading from Pro monthly to Family monthly via the portal triggers the correct entitlement update.
