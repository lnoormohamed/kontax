# P34F-02 — Stripe Webhook Routing by Group

## Purpose

Make the Stripe integration aware that a customer can represent a **Group** (org)
rather than a user. New Teams customers carry `metadata.kontaxGroupId`; webhook
handlers resolve a customer to either a group or a user and apply entitlements to the
correct target. Depends on the schema from P34F-01.

## Background

Every handler in `src/server/stripe-handlers.ts` currently does
`providerCustomerId → SubscriptionCustomer → userId`, then writes entitlements onto
the `User`. `upsertSubscription(userId, …)`, `handleCheckoutSessionCompleted`,
`handleSubscriptionUpdated/Deleted`, `handleInvoicePaymentSucceeded/Failed` all assume
a user. This ticket teaches that pipeline about groups.

## Scope

**In scope:**
- Customer creation for Teams sets `metadata.kontaxGroupId`; personal keeps
  `metadata.kontaxUserId`.
- A single resolver: `providerCustomerId → { kind: "user"|"group", id }`.
- `upsertSubscription` accepts a billing owner (user or group) and writes
  entitlements to the right place.
- Teams entitlements (`teamsEnabled`, `memberSlotsLimit`, grace) applied to the Group
  / its subscription, not the owner user.
- Seat quantity attributed to the org subscription.

**Out of scope:**
- Migrating existing customers' metadata (P34F-03).
- UI (P34F-04/06).
- Personal-plan behaviour (unchanged).

## Design / Implementation Spec

### Customer resolver

```typescript
// src/server/stripe-handlers.ts
type BillingOwner = { kind: "user"; userId: string } | { kind: "group"; groupId: string };

async function resolveBillingOwner(tx: Tx, providerCustomerId: string): Promise<BillingOwner> {
  const customer = await tx.subscriptionCustomer.findFirst({
    where: { provider: "STRIPE", providerCustomerId },
    select: { userId: true, groupId: true },
  });
  if (!customer) throw new Error(`No SubscriptionCustomer for ${providerCustomerId}`);
  if (customer.groupId) return { kind: "group", groupId: customer.groupId };
  if (customer.userId) return { kind: "user", userId: customer.userId };
  throw new Error(`SubscriptionCustomer ${providerCustomerId} has no owner`);
}
```

Every handler that currently does `subscriptionCustomer.findFirst(... ).userId`
switches to `resolveBillingOwner`.

### `upsertSubscription` signature

Change from `upsertSubscription(userId, stripeSubscription, tx)` to
`upsertSubscription(owner: BillingOwner, stripeSubscription, tx)`. Internally:

- Resolve/lookup the `SubscriptionCustomer` by `userId` **or** `groupId`.
- Upsert the `Subscription` row keyed on `(provider, providerSubscriptionId)`, setting
  `userId` **or** `groupId` to match the owner.
- For `kind: "group"`: apply Teams entitlements to the Group (`teamsEnabled`,
  `memberSlotsLimit` from Stripe quantity, `teamsGraceEndsAt` clear on re-upgrade).
  Do **not** write plan entitlements to the owner user.
- For `kind: "user"`: unchanged from today.

### Entitlement application split

Today entitlements are written to `User` (`prisma.user.update`). For group billing,
the team's capabilities derive from the **Group's** subscription. Audit every place
that reads "does this user have Teams?" — for Teams it must read through the Group's
subscription, not the user's. Key reads:
- `src/server/team-access.ts` grace-state derivation (`teamsEnabled`,
  `teamsGraceEndsAt` already on `Group`).
- Any entitlement gate that checks the owner user's `teamsEnabled`.

The grace logic in `applyDowngrade` (`stripe-handlers.ts:226`) already targets
`Group` by `ownerId` — update it to target by the subscription's `groupId` instead so
it survives owner transfer.

### Checkout for a new team

When a team upgrades, the Checkout Session / customer must be created against the
group: set `metadata.kontaxGroupId` and create (or reuse) the group's
`SubscriptionCustomer`. Trace the existing upgrade entry point (the action that
creates the Stripe Checkout Session for Teams) and branch it.

## Acceptance Criteria

- New Teams Stripe customers carry `metadata.kontaxGroupId`; personal carry
  `kontaxUserId`.
- `resolveBillingOwner` correctly branches group vs user for every webhook handler.
- A Teams `customer.subscription.updated` event updates the **Group's** subscription
  and entitlements, never the owner user's personal plan.
- Seat count from Stripe quantity lands on the org subscription's `memberSlotsLimit`.
- Grace start/clear on Teams downgrade/re-upgrade targets the group by subscription,
  not by `ownerId`.
- Personal-plan webhooks behave exactly as before (regression-tested).

## Risks and Open Questions

- **Mixed-state during rollout.** Until P34F-03 migrates existing teams, some Teams
  customers still resolve to `userId`. `resolveBillingOwner` handles both, but the
  entitlement-application path must too — test a `userId`-anchored Teams customer
  still works.
- **Owner who also has a personal plan.** Two customers, two metadata keys. Ensure
  the resolver never conflates them (keyed on `providerCustomerId`, so safe).
- **Idempotency.** Stripe re-delivers webhooks; the upsert keyed on
  `(provider, providerSubscriptionId)` must stay idempotent across the new branch.
