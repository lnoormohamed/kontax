# P34F-DB01 — Org Billing Architecture (Design Brief)

## Purpose

Establish the architecture for **org-anchored Teams billing** before any code is
written. Today every billing object is chained to a single human; for a Teams plan
this is structurally wrong because members join and leave but the org persists. This
brief defines the target schema, the Stripe customer/metadata model, the webhook
routing change, and the migration sequence for existing teams. Every other P34F
ticket (P34F-01 through P34F-09) builds against the decisions ratified here.

> **Status: DESIGN BRIEF.** No implementation. Output is the agreed schema diff,
> Stripe metadata shape, webhook-routing branch, and migration plan. Sign-off on the
> "Open Questions" section unblocks P34F-01.

## Background — exactly what is anchored to `userId` today

Every billing identity in the system resolves to a single `User`:

| Object | Anchor | Location |
|---|---|---|
| Stripe customer row | `SubscriptionCustomer.userId @unique` | `prisma/schema.prisma:452` |
| Subscription row | `Subscription.userId` | `prisma/schema.prisma:466` |
| Customer creation | `metadata: { kontaxUserId }`, upsert by `userId` | `src/server/stripe-customers.ts` (`ensureStripeCustomer`) |
| Checkout session | `subscription_data.metadata = { kontaxUserId, plan }` | `src/app/actions/billing.ts:90` |
| Portal session | `subscriptionCustomer.findUnique({ where: { userId } })` | `src/app/actions/billing.ts:154` |
| Webhook → owner | `providerCustomerId → SubscriptionCustomer → userId` | `src/server/stripe-handlers.ts:251,272,288,328,372` |
| Subscription upsert | `upsertSubscription(userId, …)` | `src/server/stripe-handlers.ts:65` |
| Teams grace start/clear | `group.updateMany({ where: { ownerId: userId, type: "TEAM" } })` | `src/server/stripe-handlers.ts:168,229` |

The seam that already points the other way: `Group.subscriptionId`
(`prisma/schema.prisma:962`) — a team already references its subscription. What's
missing is making the *customer* the org so billing is not destroyed when the
anchor-human leaves.

**Consequence of the flaw:** if the billing-anchor human leaves, the team's plan is
orphaned. Phase 14 deferred owner transfer for exactly this reason
(`roadmap/design-briefs/14-teams-plan-surfaces.md:45`: "subscription is `userId`-anchored,
billing sign-off needed").

Note: entitlements today are thin on the write side — `upsertSubscription` writes
`memberSlotsLimit` to the Subscription row (`stripe-handlers.ts:102`) and
`lifecycleState` to the User (`:158`); team capability is read via `Group.teamsEnabled`
/ `Group.teamsGraceEndsAt` in `src/server/team-access.ts`. The re-anchor must keep
those group fields as the source of truth for team capability.

## Decisions this brief ratifies

1. **Teams billing is org-anchored.** For `GroupType.TEAM`, the Stripe customer
   represents the Group, not a person. Personal plans (FREE / PRO / FAMILY) stay
   user-anchored — this brief does **not** touch them.
2. **Billing access is permission-gated** via a new `GroupMember.canManageBilling`
   flag, independent of the Admin role. The **owner is always an implicit billing
   manager** (backstop: an org can never be locked out of its own billing).
3. **Owner transfer is a role change**, not a Stripe operation (this SUPERSEDES the
   earlier "re-assign the Stripe customer" idea from the first 34F draft).

## Target schema (proposal for review)

### `SubscriptionCustomer` — owned by a user OR a group

```prisma
model SubscriptionCustomer {
    id                 String          @id @default(cuid())
    // Exactly one of userId / groupId is non-null. Personal plans → userId.
    // Teams → groupId. Invariant enforced per "dual-ownership" decision below.
    userId             String?         @unique
    groupId            String?         @unique
    provider           BillingProvider @default(STRIPE)
    providerCustomerId String
    billingEmail       String?
    createdAt          DateTime        @default(now())
    updatedAt          DateTime        @updatedAt
    user               User?  @relation(fields: [userId], references: [id], onDelete: Cascade)
    group              Group? @relation(fields: [groupId], references: [id], onDelete: Cascade)
    subscriptions      Subscription[]

    @@unique([provider, providerCustomerId])
}
```

`userId` becomes nullable; add nullable `groupId`, both `@unique`. Postgres treats
multiple NULLs as distinct, so the personal rows (many `groupId = null`) and team rows
(many `userId = null`) coexist under the unique constraints.

### `Subscription` — owned by a user OR a group

Mirror the change: `userId String?`, add `groupId String?` + index. Keep
`Group.subscriptionId` as the canonical "the team's current subscription" forward
pointer; `Subscription.groupId` is the reverse relation.

### `GroupMember` — billing permission

```prisma
canManageBilling Boolean @default(false)
```

Owner is treated as `canManageBilling = true` regardless of the stored value (helper
defined in P34F-01).

## Stripe customer & metadata model

| | Personal (unchanged) | Teams (new) |
|---|---|---|
| Customer metadata | `{ kontaxUserId }` | `{ kontaxGroupId }` |
| Created by | `ensureStripeCustomer(userId)` | new `ensureStripeCustomerForGroup(groupId)` |
| Checkout metadata | `{ kontaxUserId, plan }` | `{ kontaxGroupId, plan }` |
| Webhook resolves to | `{ kind: "user", userId }` | `{ kind: "group", groupId }` |

Resolution is always keyed on `providerCustomerId` (the Stripe customer id on the
event), then branched by which owner column is set on the `SubscriptionCustomer` row.
The Stripe `metadata.kontax*` keys are belt-and-suspenders for debugging and for the
migration's verification pass; the DB row is the source of truth.

## Webhook routing change (summary; P34F-02 implements)

Replace the five `select: { userId: true }` lookups in `stripe-handlers.ts` with a
single `resolveBillingOwner(tx, providerCustomerId): BillingOwner` that returns
`{ kind: "user" | "group", id }`. `upsertSubscription` takes the `BillingOwner`,
writes `userId` **or** `groupId` on the Subscription row, and — for groups — applies
team capability to the **Group** (`teamsEnabled`, `teamsGraceEndsAt`, seat count) by
`groupId` rather than `ownerId`. The grace start/clear logic (`:168`, `:229`) changes
from `where: { ownerId, type: "TEAM" }` to `where: { id: groupId }`.

## Migration sequence (existing teams — P34F-03 implements)

For every `Group` of type `TEAM` whose owner holds a Teams subscription:

1. Read the owner's Teams `SubscriptionCustomer` + its `Subscription` (select by the
   subscription's `plan`, not just the user, so an owner who also has PRO/FAMILY isn't
   moved by mistake).
2. **Stripe first:** `customers.update(custId, { metadata: { kontaxGroupId } })`.
3. **DB transaction:** re-point `SubscriptionCustomer` and `Subscription` from
   `userId` to `groupId`; set `Group.subscriptionId`.
4. Keep the prior `userId` value in a migration log (`{ groupId, customerId,
   previousUserId }`) — do **not** drop the `userId` column this phase, so a
   half-applied migration is debuggable and reversible.
5. Idempotent: a group whose `billingCustomer` already has `groupId` is skipped.
   Dry-run mode prints the plan and writes nothing.

Ordering rationale: Stripe metadata write before the DB flip means a failed DB
transaction leaves the customer still resolving user-anchored (DB `groupId` unchanged
→ P34F-02 resolver returns `kind: "user"` → billing still works).

## Acceptance Criteria (for the brief)

- Schema diff above reviewed and approved (or amended).
- Stripe metadata shape (`kontaxGroupId` vs `kontaxUserId`) agreed.
- Webhook branch (`resolveBillingOwner` group vs user) agreed.
- Migration sequence approved as idempotent + dry-runnable + reversible.
- The four Open Questions below are answered.

## Open Questions (require sign-off before P34F-01)

1. **Dual-ownership invariant** — "exactly one of `userId`/`groupId` non-null" can't be
   expressed in Prisma. Choose: (a) raw-SQL CHECK constraint added in a manual
   migration, or (b) application-layer guard (`assertSingleBillingOwner`) only.
   *Recommendation: (a) CHECK — it's cheap and prevents corrupt rows from any path.*
2. **Owner-implicit-billing-manager backstop** — confirm the owner always has billing
   access regardless of the `canManageBilling` flag, so the last explicit billing
   manager leaving can't lock the team out. *Recommendation: yes.*
3. **Who can grant `canManageBilling`?** Owner only, or owner + admins?
   *Recommendation: owner + admins (matches `getManageableTeam`), revisit if finance
   roles need tighter control.*
4. **Lapsed/grace teams** — migrate teams whose owner already downgraded (a
   Subscription row exists but is CANCELED/grace)? *Recommendation: migrate if any
   Subscription row exists, so a later re-upgrade re-anchors cleanly.*

Coordinate the live-billing testing with `project_stripe-smoke-test-deferred`.
