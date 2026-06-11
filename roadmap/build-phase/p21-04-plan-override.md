# P21-04 — Plan Override

## Purpose

Admins need to manually set a user's plan — for customer support resolutions, refunds, partnership deals, or correcting billing errors. Overridden plans must be visually distinguished from Stripe-managed plans so future admins don't accidentally treat them as normal billing state.

## Scope

**In scope:**
- `overridePlan(userId, plan, reason)` admin server action
- `User.planOverrideReason String?` and `User.planOverriddenAt DateTime?` schema fields
- Visual flag on the user detail panel and in settings when the plan is overridden
- Override does not affect the Stripe subscription — it only changes local entitlements

---

## Design / Implementation Spec

### Schema change

```prisma
// On User model:
planOverrideReason  String?
planOverriddenAt    DateTime?
```

Run: `prisma migrate dev --name add-plan-override`

### `overridePlan` server action

```typescript
export async function overridePlan(input: {
  targetUserId: string;
  plan: SubscriptionPlan;
  reason: string;
}): Promise<void> {
  const { userId: adminUserId } = await assertAdmin();

  // Upsert a local Subscription row with the override plan
  // This creates or updates without touching Stripe
  await db.subscription.upsert({
    where: { /* find by userId + provider override key */ },
    create: {
      userId: input.targetUserId,
      subscriptionCustomerId: await getOrCreateCustomerId(input.targetUserId),
      provider: "STRIPE",
      providerSubscriptionId: `admin-override-${input.targetUserId}`,
      plan: input.plan,
      status: "ACTIVE",
      interval: "MONTHLY",
    },
    update: { plan: input.plan, status: "ACTIVE" },
  });

  await db.user.update({
    where: { id: input.targetUserId },
    data: {
      lifecycleState: "ACTIVE",
      planOverrideReason: input.reason,
      planOverriddenAt: new Date(),
    },
  });

  await emitAdminEvent({
    adminUserId,
    action: ADMIN_ACTIONS.USER_PLAN_OVERRIDE,
    targetUserId: input.targetUserId,
    details: { newPlan: input.plan, reason: input.reason },
  });
}
```

### UI in admin user detail

```
Plan override
─────────────────────────────────────────────
Current plan: [Pro]  ⚑ Overridden on June 11, 2026
Reason: "Refund — billing error"

[Override plan]  (opens a modal: select plan + reason textarea + confirm)
[Clear override]  (restores Stripe-managed plan)
```

### Flag in user-facing settings

When `planOverriddenAt` is set, show a subtle note in the settings billing section:
```
Your plan is managed by the Kontax team. Contact support for billing questions.
```
This prevents the user from seeing confusing "Your plan is Pro but Stripe says Free" states and avoids them trying to upgrade/downgrade through the normal billing flow.

---

## Acceptance Criteria

- `overridePlan` updates the local `Subscription.plan` without touching Stripe.
- `User.planOverrideReason` and `planOverriddenAt` are set on override.
- The admin user detail panel shows an "Overridden" badge and the reason.
- The user's settings billing section shows a "managed by team" note when overridden.
- `USER_PLAN_OVERRIDE` admin audit event is emitted with the new plan and reason.
