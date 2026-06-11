# P19-04 — Plan Entitlement Sync from Webhook

## Purpose

The webhook handler (P19-03) routes Stripe events to handler stubs. This ticket fills in those stubs with the real logic: translating each Stripe event into local `Subscription` and `User.lifecycleState` updates, and triggering the downgrade side-effects defined in `lifecycle-policies.md`. After this ticket, Kontax's local state is always consistent with Stripe's subscription state.

## Background

The `Subscription` and `SubscriptionCustomer` models hold local billing state. `billing.ts` reads this state to enforce entitlements. The `PLAN_DEFAULTS` map in `billing.ts` drives what each plan can do. This ticket writes to those models in response to Stripe events.

The `getPlanFromPriceId(priceId)` utility from P19-01 translates a Stripe price ID back to a `SubscriptionPlan + SubscriptionInterval` pair.

All downgrade data-fate decisions (contacts over-limit, sync account pausing, live share conversion, group dissolution triggers) are defined in `lifecycle-policies.md`. This ticket implements them.

## Scope

**In scope:**
- `handleCheckoutSessionCompleted` — create `Subscription` row on first purchase
- `handleSubscriptionUpserted` — sync plan, status, period dates on every update
- `handleSubscriptionDeleted` — downgrade to Free, apply lifecycle-policies.md downgrade rules
- `handleInvoicePaymentSucceeded` — clear GRACE state, restore ACTIVE
- `handleInvoicePaymentFailed` — set GRACE lifecycle state, record grace end date
- `applyDowngrade(userId, fromPlan, toPlan, tx)` — shared utility for downgrade side-effects

**Out of scope:**
- Group dissolution logic (Phase 13/14 owns that; this ticket calls a stub that Phase 13/14 wires up)
- Email notifications for billing events (Phase 20)
- The Customer Portal (P19-05)

---

## Design / Implementation Spec

### `handleCheckoutSessionCompleted`

Called when a user completes a Stripe Checkout session for the first time.

```typescript
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  tx: PrismaTransactionClient,
): Promise<void> {
  if (session.mode !== "subscription") return;

  const stripeCustomerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;

  // Find the Kontax user via SubscriptionCustomer
  const customer = await tx.subscriptionCustomer.findUnique({
    where: { providerCustomerId: stripeCustomerId },
    select: { userId: true },
  });
  if (!customer) {
    throw new Error(`No SubscriptionCustomer found for Stripe customer ${stripeCustomerId}`);
  }

  // Fetch the full Stripe subscription object
  const stripe = getStripeClient();
  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  await upsertSubscription(customer.userId, stripeSubscription, tx);
}
```

### `handleSubscriptionUpserted`

Called on `customer.subscription.created` and `customer.subscription.updated`. This is the primary sync handler — it reads the current state of the Stripe subscription and writes it locally.

```typescript
export async function handleSubscriptionUpserted(
  stripeSubscription: Stripe.Subscription,
  tx: PrismaTransactionClient,
): Promise<void> {
  const customer = await tx.subscriptionCustomer.findUnique({
    where: { providerCustomerId: stripeSubscription.customer as string },
    select: { userId: true },
  });
  if (!customer) return;

  await upsertSubscription(customer.userId, stripeSubscription, tx);
}
```

### `upsertSubscription` — core sync function

```typescript
async function upsertSubscription(
  userId: string,
  stripeSubscription: Stripe.Subscription,
  tx: PrismaTransactionClient,
): Promise<void> {
  const priceId = stripeSubscription.items.data[0]?.price.id;
  if (!priceId) throw new Error("Subscription has no price item");

  const planInfo = getPlanFromPriceId(priceId);
  if (!planInfo) throw new Error(`Unknown price ID: ${priceId}`);

  const status = mapStripeStatus(stripeSubscription.status);
  const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
  const trialEndsAt = stripeSubscription.trial_end
    ? new Date(stripeSubscription.trial_end * 1000)
    : null;

  // Find existing Subscription row
  const existingSubscription = await tx.subscription.findFirst({
    where: {
      userId,
      providerSubscriptionId: stripeSubscription.id,
    },
  });

  const fromPlan = existingSubscription?.plan ?? "FREE";

  const subscriptionData = {
    plan: planInfo.plan,
    status,
    interval: planInfo.interval,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd,
    trialEndsAt,
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    canceledAt: stripeSubscription.canceled_at
      ? new Date(stripeSubscription.canceled_at * 1000)
      : null,
  };

  if (existingSubscription) {
    await tx.subscription.update({
      where: { id: existingSubscription.id },
      data: subscriptionData,
    });
  } else {
    const subCustomer = await tx.subscriptionCustomer.findUniqueOrThrow({
      where: { userId },
    });
    await tx.subscription.create({
      data: {
        userId,
        subscriptionCustomerId: subCustomer.id,
        provider: "STRIPE",
        providerSubscriptionId: stripeSubscription.id,
        ...subscriptionData,
      },
    });
  }

  // Update User.lifecycleState
  const newLifecycleState = deriveLifecycleState(status, stripeSubscription);
  await tx.user.update({
    where: { id: userId },
    data: { lifecycleState: newLifecycleState },
  });

  // Apply downgrade side-effects if plan decreased
  if (planRank(planInfo.plan) < planRank(fromPlan)) {
    await applyDowngrade(userId, fromPlan, planInfo.plan, tx);
  }
}
```

### `handleSubscriptionDeleted`

Called when a subscription is fully cancelled/expired. Downgrades to Free.

```typescript
export async function handleSubscriptionDeleted(
  stripeSubscription: Stripe.Subscription,
  tx: PrismaTransactionClient,
): Promise<void> {
  const customer = await tx.subscriptionCustomer.findUnique({
    where: { providerCustomerId: stripeSubscription.customer as string },
    select: { userId: true },
  });
  if (!customer) return;

  const existing = await tx.subscription.findFirst({
    where: { userId: customer.userId, providerSubscriptionId: stripeSubscription.id },
  });

  if (existing) {
    await tx.subscription.update({
      where: { id: existing.id },
      data: {
        plan: "FREE",
        status: "CANCELED",
        canceledAt: new Date(),
        endedAt: new Date(),
      },
    });
    await applyDowngrade(customer.userId, existing.plan, "FREE", tx);
  }

  await tx.user.update({
    where: { id: customer.userId },
    data: { lifecycleState: "ACTIVE" }, // FREE is active, not locked
  });
}
```

### `handleInvoicePaymentFailed`

```typescript
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  tx: PrismaTransactionClient,
): Promise<void> {
  const customer = await tx.subscriptionCustomer.findUnique({
    where: { providerCustomerId: invoice.customer as string },
    select: { userId: true },
  });
  if (!customer) return;

  // Set grace period: 3 days from now
  const graceEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  await tx.user.update({
    where: { id: customer.userId },
    data: { lifecycleState: "GRACE" },
  });

  // Update the subscription grace end
  await tx.subscription.updateMany({
    where: { userId: customer.userId, status: { in: ["ACTIVE", "TRIALING"] } },
    data: { status: "PAST_DUE", graceEndsAt },
  });
}
```

### `handleInvoicePaymentSucceeded`

```typescript
export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  tx: PrismaTransactionClient,
): Promise<void> {
  const customer = await tx.subscriptionCustomer.findUnique({
    where: { providerCustomerId: invoice.customer as string },
    select: { userId: true },
  });
  if (!customer) return;

  await tx.user.update({
    where: { id: customer.userId },
    data: { lifecycleState: "ACTIVE" },
  });

  await tx.subscription.updateMany({
    where: { userId: customer.userId, status: "PAST_DUE" },
    data: { status: "ACTIVE", graceEndsAt: null },
  });
}
```

### `applyDowngrade` — side-effects utility

```typescript
async function applyDowngrade(
  userId: string,
  fromPlan: SubscriptionPlan,
  toPlan: SubscriptionPlan,
  tx: PrismaTransactionClient,
): Promise<void> {
  // 1. Pause over-limit sync accounts
  if (toPlan === "FREE") {
    const syncAccounts = await tx.syncAccount.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
    // Free allows 1 sync account — pause the rest
    const toKeep = syncAccounts.slice(0, 1);
    const toPause = syncAccounts.slice(1);
    if (toPause.length > 0) {
      await tx.syncAccount.updateMany({
        where: { id: { in: toPause.map((s) => s.id) } },
        data: { status: "PAUSED" },
      });
    }
  }

  // 2. Convert outbound live shares to static (lifecycle-policies.md §4a)
  if (!["PRO", "FAMILY", "TEAMS"].includes(toPlan)) {
    await tx.contactShare.updateMany({
      where: { ownerUserId: userId, shareType: "LIVE_SYNC", status: "ACTIVE" },
      data: { shareType: "STATIC_COPY" },
    });
  }

  // 3. Convert inbound live shares to static (user can no longer receive live)
  if (!["PRO", "FAMILY", "TEAMS"].includes(toPlan)) {
    await tx.contactShare.updateMany({
      where: {
        recipientUserId: userId,
        shareType: "LIVE_SYNC",
        status: "ACTIVE",
        recipientContactId: { not: null },
      },
      data: { shareType: "STATIC_COPY" },
    });
  }

  // 4. Group dissolution stub (lifecycle-policies.md §3b/3c)
  // Phase 13/14 registers a dissolution handler; call it here if registered.
  // For now: log and leave group handling to Phase 13/14.
  if (["FAMILY", "TEAMS"].includes(fromPlan) && !["FAMILY", "TEAMS"].includes(toPlan)) {
    console.warn(
      `[billing] TODO(Phase13/14): dissolve group for user ${userId} on downgrade from ${fromPlan} to ${toPlan}`,
    );
  }
}
```

### Helper utilities

```typescript
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  const map: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "PAST_DUE",
    incomplete: "INCOMPLETE",
    incomplete_expired: "EXPIRED",
    paused: "PAUSED",
  };
  return map[stripeStatus] ?? "ACTIVE";
}

function deriveLifecycleState(
  status: SubscriptionStatus,
  subscription: Stripe.Subscription,
): AccountLifecycleState {
  if (status === "ACTIVE" || status === "TRIALING") return "ACTIVE";
  if (status === "PAST_DUE") return "GRACE";
  if (status === "CANCELED" || status === "EXPIRED") return "ACTIVE"; // Free after cancel
  return "ACTIVE";
}

const PLAN_RANK: Record<SubscriptionPlan, number> = {
  FREE: 0, PRO: 1, FAMILY: 2, TEAMS: 3,
};
function planRank(plan: SubscriptionPlan): number {
  return PLAN_RANK[plan] ?? 0;
}
```

---

## Acceptance Criteria

- After a successful Stripe Checkout, the user's `Subscription.plan` and `User.lifecycleState` are updated.
- A `customer.subscription.updated` event (plan change) updates the local subscription row.
- `customer.subscription.deleted` sets plan to FREE and applies sync account pausing.
- `invoice.payment_failed` sets `lifecycleState = GRACE`.
- `invoice.payment_succeeded` clears GRACE and restores ACTIVE.
- Live shares are converted to static on downgrade to Free.
- Over-limit sync accounts are PAUSED on downgrade to Free (oldest one stays active).
- A `TODO(Phase13/14)` log is emitted for Family/Teams group dissolution — not silently ignored.
- All operations run within the Prisma transaction from P19-03.

---

## Risks and Open Questions

- **Family/Teams group dissolution:** the `applyDowngrade` stub logs a warning but does not dissolve the group. Phase 13 must replace this stub with real dissolution logic (per `lifecycle-policies.md` Section 3). Until Phase 13 ships, a Family plan downgrade will leave the group in an inconsistent state. Document this gap clearly with the `TODO` comment.
- **Concurrent webhooks:** Stripe can send `subscription.updated` and `invoice.payment_succeeded` nearly simultaneously. Both run in separate transactions. Because both read and then write the same `Subscription` row, there is a small race window. The `upsertSubscription` function is idempotent — running it twice with the same Stripe data produces the same result. This is acceptable.
- **Unknown price IDs:** if `getPlanFromPriceId` returns null (e.g., a price ID was added in Stripe but not in env vars), the handler throws and Stripe retries. This is intentional — an unknown price should be an error, not silently ignored.
