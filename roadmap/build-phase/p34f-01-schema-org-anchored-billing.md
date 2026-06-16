# P34F-01 — Schema: Org-Anchored Billing

## Purpose

Implement the schema agreed in P34F-DB01: allow `SubscriptionCustomer` and
`Subscription` to belong to a `Group` (not only a `User`), and add a per-member
`canManageBilling` flag. This is the data-layer foundation for every other P34F
billing ticket. No webhook or UI behaviour changes here — those are P34F-02 / P34F-04.

## Background

See P34F-DB01 for the full audit. Today billing is hard-anchored to `userId`
(`SubscriptionCustomer.userId @unique` at `prisma/schema.prisma:452`,
`Subscription.userId` at `:466`). Teams need the Stripe customer to represent the org
so billing survives members joining and leaving. The forward link
`Group.subscriptionId` (`:962`) already exists; this ticket adds the reverse anchors.

## Scope

**In scope:**
- `SubscriptionCustomer.userId` → nullable; add `groupId String? @unique` + relation.
- `Subscription.userId` → nullable; add `groupId String?` + relation + index.
- `GroupMember.canManageBilling Boolean @default(false)`.
- `Group` reverse relations to `SubscriptionCustomer` / `Subscription`.
- Dual-ownership invariant (CHECK constraint or app guard per DB01 Q1).
- New module `src/server/billing-owner.ts`: `assertSingleBillingOwner`,
  `getGroupBillingCustomer`, `getUserBillingCustomer`, `canManageGroupBilling`.

**Out of scope:**
- Stripe metadata + webhook routing (P34F-02).
- Migrating existing teams' data (P34F-03).
- Any UI (P34F-04, P34F-06).
- Dropping the legacy `userId` link (kept readable through the transition).

## Design / Implementation Spec

### Schema changes (`prisma/schema.prisma`)

**Before** (`SubscriptionCustomer`, `:450`):
```prisma
model SubscriptionCustomer {
    id                 String            @id @default(cuid())
    userId             String            @unique
    provider           BillingProvider   @default(STRIPE)
    providerCustomerId String
    billingEmail       String?
    createdAt          DateTime          @default(now())
    updatedAt          DateTime          @updatedAt
    user               User              @relation(fields: [userId], references: [id], onDelete: Cascade)
    subscriptions      Subscription[]

    @@unique([provider, providerCustomerId])
}
```

**After:**
```prisma
model SubscriptionCustomer {
    id                 String            @id @default(cuid())
    userId             String?           @unique
    groupId            String?           @unique
    provider           BillingProvider   @default(STRIPE)
    providerCustomerId String
    billingEmail       String?
    createdAt          DateTime          @default(now())
    updatedAt          DateTime          @updatedAt
    user               User?  @relation(fields: [userId], references: [id], onDelete: Cascade)
    group              Group? @relation(fields: [groupId], references: [id], onDelete: Cascade)
    subscriptions      Subscription[]

    @@unique([provider, providerCustomerId])
}
```

**Before** (`Subscription`, `:464`): `userId String` + `user User @relation(...)`,
with `@@index([userId, status])`.

**After:** add alongside the existing fields:
```prisma
    userId  String?
    groupId String?
    user    User?  @relation(fields: [userId], references: [id], onDelete: Cascade)
    group   Group? @relation(fields: [groupId], references: [id], onDelete: Cascade)

    @@index([userId, status])     // keep
    @@index([groupId, status])    // add
```
(`subscriptionCustomerId` and its relation are unchanged.)

**`GroupMember`** (`:982`) — add:
```prisma
    canManageBilling Boolean @default(false)
```

**`Group`** (`:957`) — add reverse relations:
```prisma
    billingCustomer SubscriptionCustomer?
    subscriptions   Subscription[]
```
(There is already `subscription Subscription? @relation(fields: [subscriptionId]...)`
at `:973`. Naming: keep the existing `subscription` forward relation; add a distinct
`subscriptions` back-relation for `Subscription.group`. Prisma requires named
relations when two relations connect the same pair of models — annotate both, e.g.
`@relation("GroupCurrentSubscription")` on the existing FK and
`@relation("GroupSubscriptions")` on the new back-relation. Resolve the exact names at
implementation; the constraint is that both compile.)

**`User`** (`:~246`) — the existing `subscriptions Subscription[]` and
`subscriptionCustomer SubscriptionCustomer?` back-relations stay; Prisma will accept
them now that the FK sides are optional.

### Dual-ownership invariant (DB01 Q1)

Per DB01 recommendation, add a CHECK constraint. Since the repo uses `prisma db push`
(no migration files — see `project_db-and-verification-workflow`), apply the CHECK via
a one-time SQL script run after the push:

```sql
-- scripts/sql/p34f-billing-owner-checks.sql
ALTER TABLE "SubscriptionCustomer"
  ADD CONSTRAINT subscription_customer_one_owner
  CHECK ((("userId" IS NOT NULL)::int + ("groupId" IS NOT NULL)::int) = 1);

ALTER TABLE "Subscription"
  ADD CONSTRAINT subscription_one_owner
  CHECK ((("userId" IS NOT NULL)::int + ("groupId" IS NOT NULL)::int) = 1);
```

Always pair it with the application guard (cheaper error messages, runs before the DB
round-trip):

```typescript
// src/server/billing-owner.ts
export function assertSingleBillingOwner(
  owner: { userId?: string | null; groupId?: string | null },
): void {
  const hasUser = Boolean(owner.userId);
  const hasGroup = Boolean(owner.groupId);
  if (hasUser === hasGroup) {
    throw new Error("Billing record must belong to exactly one of a user or a group.");
  }
}
```

If DB01 chose app-layer-only (Q1 option b), skip the SQL file and rely on the guard
in every write path. Document the chosen approach at the top of `billing-owner.ts`.

### Accessors + permission helper

```typescript
// src/server/billing-owner.ts
import { db } from "~/server/db";
import type { GroupRole } from "../../generated/prisma";

export const getGroupBillingCustomer = (groupId: string) =>
  db.subscriptionCustomer.findUnique({
    where: { groupId },
    include: { subscriptions: true },
  });

export const getUserBillingCustomer = (userId: string) =>
  db.subscriptionCustomer.findUnique({
    where: { userId },
    include: { subscriptions: true },
  });

// Owner is always a billing manager (DB01 Q2 backstop); others need the flag.
export const canManageGroupBilling = (
  member: { role: GroupRole; canManageBilling: boolean },
): boolean => member.role === "OWNER" || member.canManageBilling;
```

### Apply the schema

`prisma db push` (no migration files, per repo convention). Widening `userId` to
nullable and adding nullable columns is **non-destructive** — do not pass
`--accept-data-loss`. Inspect the generated SQL/plan first; if `db push` reports any
drop, stop and investigate (existing personal rows must be preserved exactly).

Then run `node` against `scripts/sql/p34f-billing-owner-checks.sql` (via `psql` or a
small runner) if the CHECK approach was chosen. The CHECK must be added **after** any
data is consistent — existing rows all have `userId` set and `groupId` null, so the
`=1` constraint holds for them immediately.

### Regenerate the client

`prisma generate` (the repo vendors the client under `generated/prisma`). Grep for
code that assumes a non-null `.user` on subscription/customer objects and null-guard
those reads:

```bash
grep -rnE "subscriptionCustomer\.[a-z]+\.user|subscription\.user\b" src/
```

## Acceptance Criteria

- `SubscriptionCustomer` and `Subscription` each accept a `groupId` owner; `userId` is
  nullable on both; both have a `group` relation.
- `GroupMember.canManageBilling` exists, defaults `false`.
- The dual-ownership invariant rejects rows with zero or two owners (CHECK and/or
  `assertSingleBillingOwner`), and the chosen approach is documented.
- `getGroupBillingCustomer`, `getUserBillingCustomer`, `canManageGroupBilling` exist
  and are unit-tested (owner→true, flagged member→true, plain member→false).
- `prisma db push` applies with no data loss; `prisma generate` succeeds.
- Existing personal billing rows are untouched (still `userId`-anchored, `groupId`
  null) and entitlements resolve exactly as before.
- No team is migrated by this ticket (that's P34F-03); the schema simply *allows*
  group ownership.

## Risks and Open Questions

- **Existing rows in the interim.** This ticket only widens the schema; existing Teams
  subscriptions stay on `userId` until P34F-03. The app must keep resolving
  `userId`-anchored Teams billing correctly meanwhile — P34F-02's `resolveBillingOwner`
  handles both, but verify nothing in this ticket assumes a `groupId` exists yet.
- **Prisma dual-relation naming.** `Group` now relates to `Subscription` twice (current
  subscription FK + back-relation). Prisma requires named relations; pick names that
  compile and read clearly. This is the most likely source of a `prisma generate`
  error — resolve it here, not downstream.
- **Optional relations surprise includes.** Making both relation sides optional can
  break code that did `customer.user.email`. The grep above must come back clean (all
  null-guarded) before merge.
- **CHECK timing.** Add the CHECK only after confirming all existing rows satisfy it
  (they do: `userId` set, `groupId` null). If a future path inserts a two-owner row,
  the CHECK fails loudly — intended.
