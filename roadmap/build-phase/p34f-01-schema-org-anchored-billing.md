# P34F-01 — Schema: Org-Anchored Billing

## Purpose

Implement the schema changes agreed in P34F-DB01: allow `SubscriptionCustomer` and
`Subscription` to belong to a `Group` (not only a `User`), and add a per-member
`canManageBilling` flag. This is the data-layer foundation for all other P34F billing
tickets. No webhook or UI behaviour changes here — those are P34F-02 and P34F-04.

## Background

See P34F-DB01 for the full rationale. Today billing is hard-anchored to `userId`
(`SubscriptionCustomer.userId @unique`, `Subscription.userId`). Teams need the Stripe
customer to represent the org so billing survives members joining and leaving.

## Scope

**In scope:**
- `SubscriptionCustomer.userId` → nullable; add `groupId String? @unique` + relation.
- `Subscription.userId` → nullable; add `groupId String?` + relation + index.
- `GroupMember.canManageBilling Boolean @default(false)`.
- `Group` reverse relations to `SubscriptionCustomer` / `Subscription`.
- Application-layer invariant helper: exactly one of `userId` / `groupId` is set.
- `getGroupBillingCustomer(groupId)` / `getUserBillingCustomer(userId)` accessors.

**Out of scope:**
- Stripe metadata + webhook routing (P34F-02).
- Migrating existing teams' data (P34F-03).
- Any UI (P34F-04, P34F-06).
- Dropping the legacy `userId` link (kept readable through the transition).

## Design / Implementation Spec

### Schema changes

```prisma
model SubscriptionCustomer {
    id                 String          @id @default(cuid())
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

model Subscription {
    // ...existing fields...
    userId                 String?
    groupId                String?
    // ...
    user  User?  @relation(fields: [userId], references: [id], onDelete: Cascade)
    group Group? @relation(fields: [groupId], references: [id], onDelete: Cascade)

    @@index([groupId, status])
}

model GroupMember {
    // ...existing fields...
    canManageBilling Boolean @default(false)
}

model Group {
    // ...existing fields...
    billingCustomer SubscriptionCustomer?
    subscriptions   Subscription[]
}
```

Note `Subscription.userId` and `Subscription.groupId` are both nullable now; the
existing `@@index([userId, status])` stays. The `User` side of both relations becomes
optional (Prisma will require the back-relation fields to allow null).

### Dual-ownership invariant

Postgres/Prisma won't natively enforce "exactly one of userId/groupId." Per the
DB01 decision, enforce at the application layer with a guard used by every write path:

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

If DB01 chose a raw-SQL CHECK constraint instead, add it in the migration:
`ALTER TABLE "SubscriptionCustomer" ADD CONSTRAINT one_owner CHECK ((("userId" IS NOT NULL)::int + ("groupId" IS NOT NULL)::int) = 1);`
(and the same for `Subscription`). Document which approach was taken.

### Accessors

```typescript
// src/server/billing-owner.ts
export const getGroupBillingCustomer = (groupId: string) =>
  db.subscriptionCustomer.findUnique({ where: { groupId }, include: { subscriptions: true } });

export const getUserBillingCustomer = (userId: string) =>
  db.subscriptionCustomer.findUnique({ where: { userId }, include: { subscriptions: true } });
```

### Owner = implicit billing manager

Add a helper used by P34F-04/05/06 (defined here so the rule lives in one place):

```typescript
// canManageGroupBilling — true if member is the owner OR has the flag.
export const canManageGroupBilling = (member: { role: GroupRole; canManageBilling: boolean }) =>
  member.role === "OWNER" || member.canManageBilling;
```

### Migration

`prisma db push` per repo convention (no migration files; see project memory
`project_db-and-verification-workflow`). Do **not** pass `--accept-data-loss` —
making `userId` nullable and adding nullable columns is non-destructive. Verify the
generated SQL drops no data before applying.

## Acceptance Criteria

- `SubscriptionCustomer` and `Subscription` each accept a `groupId` owner; `userId`
  is nullable on both.
- `GroupMember.canManageBilling` exists, defaults `false`.
- `assertSingleBillingOwner` (or the CHECK constraint) rejects rows with zero or two
  owners.
- `getGroupBillingCustomer` / `getUserBillingCustomer` / `canManageGroupBilling`
  exist and are unit-tested.
- `prisma db push` applies with no data loss; existing personal billing rows are
  untouched (still `userId`-anchored).
- No behaviour change for existing users — entitlements still resolve as before.

## Risks and Open Questions

- **Existing rows.** This ticket only widens the schema; existing Teams subscriptions
  remain on `userId` until P34F-03 migrates them. The app must keep resolving
  `userId`-anchored Teams billing correctly in the interim (P34F-02 handles the
  branch).
- **Prisma optional relations.** Making both relation sides optional can surprise
  includes that assumed a non-null `user`. Grep for `.user` access on subscription/
  customer objects and null-guard.
- **Unique on nullable `groupId`.** Postgres treats multiple NULLs as distinct, so
  `@unique` on a nullable column is fine (many personal rows have `groupId = null`).
