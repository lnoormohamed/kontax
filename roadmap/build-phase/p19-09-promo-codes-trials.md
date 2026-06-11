# P19-09 — Promo Codes & Trial Periods

## Purpose

Promo codes let Kontax run discount campaigns (launch offers, partnerships, referrals) without engineering changes. Trial periods let new users experience paid features before committing. Both are configured in Stripe and passed through at checkout — this ticket ensures the checkout flow and onboarding handle them correctly.

## Background

P19-02 already passes `allow_promotion_codes: true` to the Stripe Checkout session creation, which shows a promo code input at the Stripe-hosted checkout page. This ticket formalises the configuration, adds trial period support for new signups, and ensures the webhook handler and UI handle trial state correctly.

## Scope

**In scope:**
- Stripe promo code / coupon configuration guide (documented, not code)
- Trial period: `trial_period_days` in checkout session for new users upgrading to Pro
- `TRIALING` subscription status handling in the UI (banner, settings plan display)
- `customer.subscription.trial_will_end` webhook handler fills in the email stub (Phase 20 wires the actual email)
- `/register?plan=pro` query param pre-selects Pro in the register flow with trial messaging

**Out of scope:**
- Creating or managing promo codes in Stripe (dashboard-side)
- Referral programme mechanics (post-v1)

---

## Design / Implementation Spec

### Trial period for new signups

When a Free user upgrades to Pro for the first time, offer a 14-day trial. Detect "first time Pro" by checking that the user has no prior `Subscription` row with `plan = PRO`.

In `createCheckoutSession` (P19-02), add:

```typescript
const isFirstPro =
  targetPlan === "PRO" &&
  !(await db.subscription.findFirst({
    where: { userId, plan: "PRO", status: { not: "INCOMPLETE" } },
  }));

const session = await stripe.checkout.sessions.create({
  // ... existing fields ...
  subscription_data: {
    trial_period_days: isFirstPro ? 14 : undefined,
    metadata: { kontaxUserId: userId, plan: targetPlan },
  },
});
```

### TRIALING status in the UI

When `Subscription.status = TRIALING`, the settings billing section shows:

```
Plan: Pro (Trial)
Trial ends: July 25, 2026 (14 days remaining)

[Add payment method to continue after trial →]  (links to Customer Portal)
```

The "Add payment method" CTA links to the Customer Portal (P19-05) where the user can add a card before the trial ends.

### Trial ending webhook

`handleTrialWillEnd` in `src/server/stripe-handlers.ts` (stub from P19-03):

```typescript
export async function handleTrialWillEnd(
  subscription: Stripe.Subscription,
  tx: PrismaTransactionClient,
): Promise<void> {
  const customer = await tx.subscriptionCustomer.findUnique({
    where: { providerCustomerId: subscription.customer as string },
    select: { userId: true },
  });
  if (!customer) return;

  // Phase 20 will send the trial-ending email here.
  // For now: log and the user will see the banner on next login.
  console.log(`[stripe-webhook] trial ending for user ${customer.userId}`);
}
```

### `/register?plan=pro` pre-selection

When a user lands on `/register?plan=pro`, the register page shows:

```
Start your 14-day free trial of Kontax Pro
No credit card required.
[Create account →]
```

After registration, the onboarding flow (Phase 26) routes to checkout with the trial pre-configured. The `plan` query param is persisted through the registration flow via session storage.

### Promo codes (dashboard-configured)

Promo codes are created in the Stripe dashboard under **Coupons**. The checkout session already has `allow_promotion_codes: true` from P19-02. No code changes are needed — users simply enter a code at the Stripe checkout page.

Document in `.env.example` as a comment:
```
# Stripe promo codes are configured in the Stripe dashboard under Products > Coupons.
# No env vars needed — allow_promotion_codes: true is set in createCheckoutSession.
```

---

## Acceptance Criteria

- A Free user upgrading to Pro for the first time receives a 14-day trial with no credit card required.
- A user who has previously been on Pro does not receive a second trial.
- The settings billing section shows trial status and days remaining when `status = TRIALING`.
- The "Add payment method" CTA in the trial banner links to the Customer Portal.
- `handleTrialWillEnd` logs the event; Phase 20 wires the email.
- `/register?plan=pro` shows trial messaging and routes through to checkout post-registration.
- Promo codes entered at Stripe checkout apply correctly (Stripe handles this; verify in test mode).

---

## Risks and Open Questions

- **Trial abuse:** a user could create multiple accounts to repeatedly get trials. Mitigation: trial eligibility checks `providerCustomerId` history in Stripe, not just the local `Subscription` table. Stripe's own fraud detection also flags suspicious patterns. Accept this risk for v1.
- **Family/Teams trials:** this ticket only implements trials for Pro. Family and Teams trials are post-v1 — they require more nuanced handling (member invitations during trial, group dissolution if trial ends without payment).
