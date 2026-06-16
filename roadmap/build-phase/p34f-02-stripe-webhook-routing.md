# P34F-02 — Stripe Webhook & Checkout Routing by Group

## Purpose

Teach the Stripe integration that a customer can represent a **Group** (org) rather
than a user. New Teams customers carry `metadata.kontaxGroupId`; checkout for a team
attaches to the group's customer; every webhook handler resolves a customer to either
a group or a user and applies entitlements to the correct target. Depends on the
schema from P34F-01.

## Background

The relevant code, with exact anchors:

- **Customer creation** — `ensureStripeCustomer(userId)` in
  `src/server/stripe-customers.ts` creates `stripe.customers.create({ metadata: { kontaxUserId } })`
  and upserts `SubscriptionCustomer` by `userId`.
- **Checkout** — `createCheckoutSession` in `src/app/actions/billing.ts:20`. It calls
  `ensureStripeCustomer(userId)` (`:64`), and sets
  `subscription_data.metadata = { kontaxUserId: userId, plan }` (`:90`). For `TEAMS`,
  quantity is `Math.max(3, seats ?? 3)` (`:32`).
- **Webhook resolution** — every handler in `src/server/stripe-handlers.ts` does
  `subscriptionCustomer.findFirst({ where: { providerCustomerId }, select: { userId: true } })`:
  `handleCheckoutSessionCompleted` (`:251`), `handleSubscriptionUpserted` (`:272`),
  `handleSubscriptionDeleted` (`:288`), `handleInvoicePaymentFailed` (`:328`),
  `handleInvoicePaymentSucceeded` (`:372`).
- **Core upsert** — `upsertSubscription(userId, stripeSubscription, tx)` (`:65`) writes
  the Subscription row (`:124`–`142`), `memberSlotsLimit` from Stripe quantity for
  TEAMS (`:102`), `lifecycleState` on the User (`:158`), and the Teams grace clear on
  re-upgrade by `ownerId` (`:168`).
- **Grace start** — `applyDowngrade` (`:180`) starts grace by
  `where: { ownerId: userId, type: "TEAM" }` (`:229`).

## Scope

**In scope:**
- `ensureStripeCustomerForGroup(groupId)` (new) → `metadata: { kontaxGroupId }`,
  upsert `SubscriptionCustomer` by `groupId`.
- `createCheckoutSession` branches: TEAMS → group customer + `{ kontaxGroupId, plan }`.
- `resolveBillingOwner(tx, providerCustomerId): BillingOwner` replacing the five
  `select: { userId: true }` lookups.
- `upsertSubscription(owner: BillingOwner, …)` writes `userId` **or** `groupId`, and
  for groups applies team capability to the **Group** by `groupId`.
- Grace start/clear targets the group by `groupId` (via the subscription), not
  `ownerId`.

**Out of scope:**
- Migrating existing customers' metadata/anchor (P34F-03).
- UI (P34F-04/06).
- Personal-plan behaviour (must remain identical — regression-tested).

## Design / Implementation Spec

### New: `ensureStripeCustomerForGroup`

```typescript
// src/server/stripe-customers.ts
export async function ensureStripeCustomerForGroup(groupId: string): Promise<string> {
  const stripe = getStripeClient();
  const existing = await db.subscriptionCustomer.findUnique({
    where: { groupId },
    select: { id: true, providerCustomerId: true },
  });
  if (existing && !isLegacyManualStripeCustomer(existing.providerCustomerId)) {
    return existing.providerCustomerId;
  }
  const group = await db.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { name: true, owner: { select: { email: true } } },
  });
  const customer = await stripe.customers.create({
    email: group.owner.email,          // billing contact; editable in portal
    name: group.name,
    metadata: { kontaxGroupId: groupId },
  });
  await db.subscriptionCustomer.upsert({
    where: { groupId },
    create: { groupId, provider: "STRIPE", providerCustomerId: customer.id, billingEmail: group.owner.email },
    update: { provider: "STRIPE", providerCustomerId: customer.id },
  });
  return customer.id;
}
```

### `createCheckoutSession` branch (`billing.ts`)

For a TEAMS checkout the customer must be the group. The team must exist before
checkout (Teams creates the group first; confirm the upgrade flow — if a team is
created at checkout time, create the group then call `ensureStripeCustomerForGroup`).

```typescript
// inside createCheckoutSession, after parsing
const isTeams = plan === "TEAMS";
const groupId = isTeams ? await resolveOrCreateTeamGroupId(userId, input) : null;

const stripeCustomerId = isTeams
  ? await ensureStripeCustomerForGroup(groupId!)
  : await ensureStripeCustomer(userId);

// ...
subscription_data: {
  trial_period_days: isFirstTimePro ? 14 : undefined,
  metadata: isTeams ? { kontaxGroupId: groupId!, plan } : { kontaxUserId: userId, plan },
},
```

`resolveOrCreateTeamGroupId` returns the caller's owned team group (creating it if the
flow does so at upgrade). The "already has an active paid sub" guard (`billing.ts:35`)
must also consider an existing **group** subscription for Teams re-purchase — extend
the check to look up the group's subscription, not only `userId`.

### Webhook resolver (`stripe-handlers.ts`)

```typescript
export type BillingOwner =
  | { kind: "user"; userId: string }
  | { kind: "group"; groupId: string };

async function resolveBillingOwner(tx: Tx, providerCustomerId: string): Promise<BillingOwner | null> {
  const c = await tx.subscriptionCustomer.findFirst({
    where: { provider: "STRIPE", providerCustomerId },
    select: { userId: true, groupId: true },
  });
  if (!c) return null;
  if (c.groupId) return { kind: "group", groupId: c.groupId };
  if (c.userId) return { kind: "user", userId: c.userId };
  return null;
}
```

Each handler replaces its `select: { userId: true }` block. Handlers that currently
`throw` on a missing customer (`handleCheckoutSessionCompleted:255`) keep throwing on
`null`; handlers that `return` (the rest) keep returning.

### `upsertSubscription` signature + body

```typescript
async function upsertSubscription(owner: BillingOwner, stripeSubscription: Stripe.Subscription, tx: Tx) {
  // ...derive planInfo / status / subscriptionData exactly as today...

  const ownerWhere = owner.kind === "user" ? { userId: owner.userId } : { groupId: owner.groupId };

  const existing = await tx.subscription.findFirst({
    where: { ...ownerWhere, providerSubscriptionId: stripeSubscription.id },
  });

  // legacy-manual lookup + fromPlan: same logic, scoped by ownerWhere
  if (existing) {
    await tx.subscription.update({ where: { id: existing.id }, data: subscriptionData });
  } else {
    const subCustomer = await tx.subscriptionCustomer.findFirstOrThrow({ where: ownerWhere });
    await tx.subscription.create({
      data: {
        ...ownerWhere,                       // userId OR groupId
        subscriptionCustomerId: subCustomer.id,
        provider: "STRIPE",
        providerSubscriptionId: stripeSubscription.id,
        ...subscriptionData,
      },
    });
  }
  // cancel any legacy manual subs scoped by ownerWhere (same as today)

  if (owner.kind === "user") {
    await tx.user.update({ where: { id: owner.userId }, data: { lifecycleState: deriveLifecycleState(status) } });
  } else {
    // Team capability lives on Group. Re-upgrade clears grace by groupId.
    await tx.group.update({
      where: { id: owner.groupId },
      data: {
        teamsEnabled: planInfo.plan === "TEAMS",
        ...(planInfo.plan === "TEAMS" ? { teamsGraceEndsAt: null } : {}),
      },
    });
  }

  // downgrade side-effects: branch — see below
}
```

### Grace start/clear by group (not `ownerId`)

The current re-upgrade clear (`:168`) and grace start (`:229`) both use
`where: { ownerId: userId, type: "TEAM" }`. With org anchoring the owner can change
(P34F-05), so target the group directly:

- **Re-upgrade clear** — handled in the `owner.kind === "group"` branch above
  (`teamsGraceEndsAt: null` on that group).
- **Downgrade grace start** (`applyDowngrade`) — when the owner is a group, set grace
  on that group:
  ```typescript
  if (owner.kind === "group" && fromPlan === "TEAMS" && toPlan !== "TEAMS") {
    const graceBase = currentPeriodEnd ?? new Date();
    await tx.group.update({
      where: { id: owner.groupId, teamsGraceEndsAt: null } as any, // guard: only if not already in grace
      data: { teamsGraceEndsAt: new Date(graceBase.getTime() + 14 * 24 * 60 * 60 * 1000) },
    });
  }
  ```
  `applyDowngrade` therefore also takes the `BillingOwner` (or the relevant branch is
  inlined into `upsertSubscription`'s group branch). The user-anchored downgrade
  side-effects (sync pause, share conversion) only apply when `owner.kind === "user"`.

### `memberSlotsLimit`

Already written from Stripe quantity in `subscriptionData` (`:102`) — that lands on
the group's subscription row now, which is read by P34F-06. No change beyond the
ownership of the row.

## Acceptance Criteria

- New Teams Stripe customers carry `metadata.kontaxGroupId`; personal carry
  `kontaxUserId`.
- A TEAMS checkout attaches to the group's `SubscriptionCustomer`, not the user's.
- `resolveBillingOwner` correctly branches group vs user for all five handlers.
- A Teams `customer.subscription.updated` updates the **group's** subscription +
  `Group.teamsEnabled`/grace — never the owner user's personal plan.
- Seat count from Stripe quantity lands on the org subscription's `memberSlotsLimit`.
- Grace start (downgrade) and clear (re-upgrade) target the group by `groupId`, not
  `ownerId` — so they survive owner transfer (P34F-05).
- Personal-plan webhooks (PRO/FAMILY checkout, payment fail/succeed, cancel) behave
  exactly as before — regression-tested against a personal account.
- A `userId`-anchored Teams customer (pre-migration) still resolves and updates
  correctly via `resolveBillingOwner` (`kind: "user"` path) until P34F-03 runs.

## Risks and Open Questions

- **Team-group existence at checkout.** Confirm whether the Teams upgrade flow creates
  the group before or during checkout. `ensureStripeCustomerForGroup` needs a group
  id; if the group is created post-checkout today, this ticket must move group
  creation earlier (or create a placeholder group at checkout). Resolve in DB01.
- **Mixed state during rollout.** Until P34F-03, some Teams customers are still
  user-anchored. Every handler + `upsertSubscription` must work for both; the
  regression test must include a user-anchored Teams subscription.
- **Owner with personal + team plans.** Two separate Stripe customers, two metadata
  keys, two `SubscriptionCustomer` rows (one by `userId`, one by `groupId`). Keyed on
  `providerCustomerId`, so the resolver never conflates them — but the "already has
  active paid sub" guard in `createCheckoutSession` must check the right scope.
- **Idempotency.** Stripe re-delivers webhooks; the upsert keyed on
  `(ownerWhere, providerSubscriptionId)` must stay idempotent across the new branch.
- **`findFirstOrThrow` vs `findUniqueOrThrow`.** The original used
  `findUniqueOrThrow({ where: { userId } })`; with the owner branch use
  `findFirstOrThrow({ where: ownerWhere })` (groupId is unique too, but the where shape
  varies). Verify both unique constraints exist (they do, per P34F-01).
