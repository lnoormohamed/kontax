# P34F-DB01 — Org Billing Architecture (Design Brief)

## Purpose

Establish the architecture for **org-anchored Teams billing** before any code is
written. Today every billing object is chained to a single human; for a Teams plan
this is structurally wrong because members join and leave but the org persists. This
brief defines the target schema, the Stripe customer/metadata model, the webhook
routing change, and the migration sequence for existing teams. Every other P34F
ticket depends on the decisions made here.

> **Status: DESIGN BRIEF.** No implementation. Output is the agreed schema diff +
> migration plan that P34F-01..06 build against.

## Background — what's anchored to `userId` today

- `SubscriptionCustomer.userId @unique` (`prisma/schema.prisma:452`) — one Stripe
  customer per human.
- `Subscription.userId` (`prisma/schema.prisma:466`) — subscription belongs to a
  human; entitlement fields (`teamsEnabled`, `memberSlotsLimit`, …) live on this row.
- `Group.subscriptionId` (`prisma/schema.prisma:962`) — **the seam**: a team already
  points at its subscription. What's missing is making the *customer* the org.
- Webhook routing (`src/server/stripe-handlers.ts`): every handler resolves
  `providerCustomerId → SubscriptionCustomer → userId`, then writes entitlements to
  the `User`. The whole pipeline funnels through one person.

The consequence: if the billing-anchor human leaves, the team's plan is orphaned.
The Phase 14 brief deferred owner transfer for exactly this reason
(`roadmap/design-briefs/14-teams-plan-surfaces.md:45`).

## Decisions this brief ratifies

1. **Teams billing is org-anchored.** For a `GroupType.TEAM`, the Stripe customer
   represents the Group, not a person. Personal plans (FREE / PRO / FAMILY) stay
   user-anchored — this brief does **not** touch them.
2. **Billing access is permission-gated** via a new `GroupMember.canManageBilling`
   flag, independent of the Admin role. The owner is always an implicit billing
   manager (backstop so an org can never be locked out of its own billing).
3. **Owner transfer is a role change**, not a Stripe operation (supersedes the
   earlier "re-assign the Stripe customer" idea).

## Target schema (proposal for review)

### `SubscriptionCustomer` — allow a group owner

```prisma
model SubscriptionCustomer {
    id                 String          @id @default(cuid())
    // Exactly one of userId / groupId is set. Personal plans → userId.
    // Teams → groupId. Enforced at the application layer + a CHECK-style
    // partial unique index per owner column.
    userId             String?         @unique
    groupId            String?         @unique
    provider           BillingProvider @default(STRIPE)
    providerCustomerId String
    billingEmail       String?
    // ...timestamps...
    user               User?  @relation(fields: [userId], references: [id], onDelete: Cascade)
    group              Group? @relation(fields: [groupId], references: [id], onDelete: Cascade)
    subscriptions      Subscription[]

    @@unique([provider, providerCustomerId])
}
```

`userId` becomes nullable; add nullable `groupId`. Both `@unique`. Application
invariant: exactly one is non-null.

### `Subscription` — allow a group owner

Mirror the same change: `userId String?`, add `groupId String?`. For Teams the
subscription belongs to the group. Keep `Group.subscriptionId` as the forward link;
this brief decides whether that becomes redundant (recommend: keep it as the
canonical "the team's current subscription" pointer and make `Subscription.groupId`
the reverse).

### `GroupMember` — billing permission

```prisma
canManageBilling Boolean @default(false)
```

Owner is treated as `canManageBilling = true` regardless of the stored flag.

## Stripe customer & metadata model

- New Teams customers are created with `metadata.kontaxGroupId = <groupId>` (and no
  `kontaxUserId`). Personal customers keep `metadata.kontaxUserId`.
- Webhook handlers resolve the customer to **either** a group or a user. The lookup
  becomes: `SubscriptionCustomer.findFirst({ providerCustomerId })` → branch on
  whether `groupId` or `userId` is set → apply entitlements to the Group or the User
  accordingly.
- Seat quantity (`memberSlotsLimit`) for Teams is attributed to the Group's
  subscription, as today, but read from the org subscription rather than the owner's.

## Migration sequence (existing teams)

For every `Group` of type `TEAM` with an owner that has a Teams subscription:

1. Read the owner's `SubscriptionCustomer` + active `Subscription`.
2. Set `metadata.kontaxGroupId` on the Stripe customer (Stripe API write).
3. Re-point the `SubscriptionCustomer` and `Subscription` rows from `userId` to
   `groupId` (DB write).
4. Leave the owner's `userId` link **readable** during transition (do not drop the
   column in this phase) so a half-applied migration can be reasoned about.
5. Idempotent: re-running must be a no-op for already-migrated groups. Dry-run mode
   prints intended changes without writing.

Owners who also hold a personal plan keep that personal customer separate — only the
Teams subscription moves to the group.

## Risks / open questions for sign-off

- **Dual ownership invariant.** Postgres can't easily express "exactly one of two
  columns non-null" without a CHECK constraint; Prisma won't generate it. Decide:
  raw-SQL CHECK in a migration, or application-layer enforcement only.
- **Owner with both personal + team customer.** Confirm Stripe allows (it does — two
  separate Customer objects). Ensure email/portal flows don't conflate them.
- **Half-migrated billing.** A team mid-migration must not double-bill or drop
  webhook routing — hence "keep userId readable" + idempotency.
- **Backstop rule.** Confirm: owner is always an implicit billing manager; if the
  last explicit `canManageBilling` member leaves, the owner retains access. (Sign-off
  needed — recommended yes.)
- **Coordinate with the deferred Stripe smoke test** (`project_stripe-smoke-test-deferred`).

## Acceptance Criteria (for the brief)

- Schema diff above reviewed and approved (or amended).
- Stripe metadata shape (`kontaxGroupId` vs `kontaxUserId`) agreed.
- Webhook branch (group vs user) agreed.
- Migration sequence approved as idempotent + dry-runnable.
- Backstop/owner-implicit-billing-manager rule decided.
- Dual-ownership enforcement approach (CHECK vs app-layer) decided.
