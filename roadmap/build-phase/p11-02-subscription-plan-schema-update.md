# P11-02 Subscription Plan Schema Update

## Purpose
This ticket updates the Prisma schema to reflect the new four-tier plan structure defined in P11-01. It renames the `SubscriptionPlan` enum (removing PLUS, adding FAMILY and TEAMS), adds the new entitlement fields to the `Subscription` model, and introduces three scaffolding models — `Group`, `GroupMember`, and `GroupAddressBook` — that validate the schema direction for Phase 13 and Phase 14 without introducing any product logic yet. It also writes the Prisma migration that safely handles the PLUS-to-PRO data migration for any existing subscribers.

## Background
The current `SubscriptionPlan` enum in `prisma/schema.prisma` has three values: `FREE`, `PLUS`, `PRO`. Phase 11 replaces this with `FREE`, `PRO`, `FAMILY`, `TEAMS`. The PLUS plan was an intermediate tier introduced during early billing work (Phase 2) but was never given a distinct feature set or made publicly available. Removing it cleanly requires a migration that sets any `Subscription.plan = 'PLUS'` rows to `PRO` before the enum value is dropped.

The current `Subscription` model has six entitlement fields: `contactsLimit`, `monthlyImportLimit`, `syncAccountsLimit`, `advancedMergeEnabled`, `premiumExportEnabled`, `cardDavSyncEnabled`. These were sufficient for the original three-tier model but do not cover app passwords, sharing, group membership, or activity log retention. All eight new fields must be added in this migration.

The `billing.ts` server module contains `PLAN_DEFAULTS` and `PLAN_LABELS` records keyed on `SubscriptionPlan`. These must be updated after the schema migration. `getUserBillingContext` must also be extended to handle group membership entitlement resolution for Family and Teams members. These code changes are part of this ticket's implementation scope.

The scaffolding models (`Group`, `GroupMember`, `GroupAddressBook`) have no business logic, no server actions, and no UI in this phase. They exist to surface any relational integrity issues before Phase 13 and 14 build on them.

## Scope
### In scope
- `SubscriptionPlan` enum update: remove `PLUS`, add `FAMILY`, `TEAMS`.
- Prisma migration: `UPDATE "Subscription" SET plan = 'PRO' WHERE plan = 'PLUS'` before the enum rename.
- New `Subscription` entitlement fields: `appPasswordsLimit`, `familyGroupEnabled`, `teamsEnabled`, `sharedAddressBooksLimit`, `memberSlotsLimit`, `activityLogRetentionDays`, `liveShareEnabled`, `staticShareEnabled`.
- New enum values: `GroupType` (FAMILY, TEAM), `GroupMemberRole` (OWNER, ADMIN, MEMBER), `GroupInviteStatus` (PENDING, ACCEPTED, DECLINED, REVOKED).
- Scaffolding models: `Group`, `GroupMember`, `GroupAddressBook`.
- Updates to `billing.ts`: `PLAN_DEFAULTS`, `PLAN_LABELS`, `PlanEntitlements` type, `getUserBillingContext` to handle group membership.
- TypeScript type updates in any file that imports `SubscriptionPlan` and references the `PLUS` variant.

### Out of scope
- Enforcement code changes (gates, assertions) — covered in P11-03.
- Stripe product ID updates — coordinated separately with the billing integration before production deployment.
- Group invite flow, group management actions, family admin controls — Phase 13 and Phase 14.
- App password model definition — if this model does not yet exist, a placeholder model must be added or the `appPasswordsLimit` field deferred until the model exists. Confirm before beginning.
- UI changes — P11-04 and P11-06.

---

## Design / Implementation Spec

### 1. SubscriptionPlan enum update

Remove `PLUS`. Add `FAMILY` and `TEAMS`.

```prisma
enum SubscriptionPlan {
    FREE
    PRO
    FAMILY
    TEAMS
}
```

The migration SQL must:
1. Update all existing `Subscription` rows with `plan = 'PLUS'` to `plan = 'PRO'` before altering the enum.
2. Use a transaction to ensure the data update and enum change are atomic.
3. Log the count of affected rows as a migration annotation or in a seed script comment.

The migration file name should follow the existing convention in the project. If using Prisma Migrate, the migration should be named `20250608_p11_plan_redesign` (or follow the project's actual naming convention).

Example migration SQL (within the generated migration file):

```sql
-- Step 1: Migrate PLUS subscribers to PRO
UPDATE "Subscription" SET "plan" = 'PRO' WHERE "plan" = 'PLUS';

-- Step 2: Alter enum (Prisma generates this automatically from the schema diff)
-- ALTER TYPE "SubscriptionPlan" ADD VALUE 'FAMILY';
-- ALTER TYPE "SubscriptionPlan" ADD VALUE 'TEAMS';
-- The PLUS removal requires renaming the type and recreating it.
```

Note: PostgreSQL does not support `DROP VALUE` on an enum directly. The standard approach is:
1. Create a new enum type `SubscriptionPlan_new` with the correct values.
2. Update all columns referencing the old type to cast to the new type.
3. Drop the old type.
4. Rename the new type.
Prisma Migrate handles this pattern automatically when the schema changes, but the `UPDATE` step for PLUS rows must appear before the type replacement in the migration.

### 2. New Subscription entitlement fields

Add the following fields to the `Subscription` model:

```prisma
model Subscription {
    -- existing fields unchanged --

    -- new entitlement fields
    appPasswordsLimit          Int?     -- null = not applicable; 1=Free, 5=Pro/Family/Teams
    familyGroupEnabled         Boolean  @default(false)
    teamsEnabled               Boolean  @default(false)
    sharedAddressBooksLimit    Int?     -- 0=Free/Pro, 1=Family, null=unlimited(Teams)
    memberSlotsLimit           Int?     -- null=Free/Pro, 6=Family, 25=Teams
    activityLogRetentionDays   Int?     -- 0=Free, 90=Pro, 365=Family, null=unlimited(Teams)
    liveShareEnabled           Boolean  @default(false)
    staticShareEnabled         Boolean  @default(false)
}
```

All new Boolean fields default to `false`. All new `Int?` fields default to `null`. The correct values are set either:
- By the Stripe webhook handler when a subscription is created or updated (the webhook maps the Stripe product/price ID to the correct entitlement values and writes them to the subscription row).
- By the seed script for development and test environments.
- By the Free tier default path in `getUserBillingContext` when no active subscription exists (the fallback must be updated to include the new fields with their Free-tier defaults).

### 3. New enum definitions

Add to `schema.prisma`:

```prisma
enum GroupType {
    FAMILY
    TEAM
}

enum GroupMemberRole {
    OWNER
    ADMIN
    MEMBER
}

enum GroupInviteStatus {
    PENDING
    ACCEPTED
    DECLINED
    REVOKED
}
```

### 4. Group scaffolding model

```prisma
model Group {
    id                   String       @id @default(cuid())
    ownerId              String
    owner                User         @relation("GroupOwner", fields: [ownerId], references: [id], onDelete: Restrict)
    type                 GroupType
    name                 String
    subscriptionId       String
    subscription         Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Restrict)
    memberSlotsLimit     Int          @default(6)
    defaultAddressBookId String?      -- set after first GroupAddressBook is created; nullable FK resolved below
    members              GroupMember[]
    addressBooks         GroupAddressBook[]
    createdAt            DateTime     @default(now())
    updatedAt            DateTime     @updatedAt

    @@index([ownerId])
    @@index([subscriptionId])
}
```

Notes:
- `onDelete: Restrict` on `ownerId` prevents deleting a User who owns a Group. The owner must dissolve the group before account deletion.
- `onDelete: Restrict` on `subscriptionId` prevents deleting a Subscription that has an active Group. The group must be dissolved first.
- `defaultAddressBookId` is nullable at creation time. It will be set by Phase 13 when the first `GroupAddressBook` is created.
- The `User` model must add a `ownedGroups Group[] @relation("GroupOwner")` field.
- The `Subscription` model must add a `groups Group[]` field.

### 5. GroupMember scaffolding model

```prisma
model GroupMember {
    id              String            @id @default(cuid())
    groupId         String
    group           Group             @relation(fields: [groupId], references: [id], onDelete: Cascade)
    userId          String
    user            User              @relation("GroupMemberships", fields: [userId], references: [id], onDelete: Cascade)
    role            GroupMemberRole   @default(MEMBER)
    inviteStatus    GroupInviteStatus @default(PENDING)
    canEdit         Boolean           @default(true)
    invitedByUserId String?
    invitedBy       User?             @relation("GroupInvitedBy", fields: [invitedByUserId], references: [id], onDelete: SetNull)
    invitedAt       DateTime          @default(now())
    joinedAt        DateTime?
    createdAt       DateTime          @default(now())
    updatedAt       DateTime          @updatedAt

    @@unique([groupId, userId])
    @@index([userId, inviteStatus])
    @@index([groupId, role])
}
```

Notes:
- `@@unique([groupId, userId])` prevents a user from having multiple membership rows in the same group.
- `joinedAt` is null until the invite is accepted.
- The `User` model must add:
  - `groupMemberships GroupMember[] @relation("GroupMemberships")`
  - `groupInvitesSent GroupMember[] @relation("GroupInvitedBy")`

### 6. GroupAddressBook scaffolding model

```prisma
model GroupAddressBook {
    id          String    @id @default(cuid())
    groupId     String
    group       Group     @relation(fields: [groupId], references: [id], onDelete: Cascade)
    name        String
    description String?
    isDefault   Boolean   @default(false)
    archivedAt  DateTime?
    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt

    @@index([groupId, isDefault])
    @@index([groupId, archivedAt])
}
```

Notes:
- `isDefault` flags the primary address book for a Family group. Only one `isDefault = true` per group should be enforced at the application layer, not by a DB constraint, because Prisma does not support partial unique indexes in a portable way.
- `archivedAt` is used for the Teams downgrade path (P11-03) where address books become read-only after the grace period.

### 7. billing.ts updates

#### PlanEntitlements type

Extend the type to include all new entitlement fields:

```typescript
type PlanEntitlements = {
  contactsLimit: number | null;
  monthlyImportLimit: number | null;
  syncAccountsLimit: number;
  appPasswordsLimit: number;
  advancedMergeEnabled: boolean;
  premiumExportEnabled: boolean;
  cardDavSyncEnabled: boolean;
  familyGroupEnabled: boolean;
  teamsEnabled: boolean;
  sharedAddressBooksLimit: number | null;
  memberSlotsLimit: number | null;
  activityLogRetentionDays: number | null;
  liveShareEnabled: boolean;
  staticShareEnabled: boolean;
};
```

Note the change of `contactsLimit` and `monthlyImportLimit` from `number` to `number | null`. All enforcement code reading these fields must be updated (P11-03) to treat `null` as unlimited.

#### PLAN_DEFAULTS update

Remove `PLUS`. Add `FAMILY` and `TEAMS`. Update `FREE` and `PRO` values to match P11-01 matrix:

```typescript
const PLAN_DEFAULTS: Record<SubscriptionPlan, PlanEntitlements> = {
  FREE: {
    contactsLimit: 500,
    monthlyImportLimit: 3,
    syncAccountsLimit: 1,
    appPasswordsLimit: 1,
    advancedMergeEnabled: false,
    premiumExportEnabled: false,
    cardDavSyncEnabled: false,
    familyGroupEnabled: false,
    teamsEnabled: false,
    sharedAddressBooksLimit: 0,
    memberSlotsLimit: null,
    activityLogRetentionDays: 0,
    liveShareEnabled: false,
    staticShareEnabled: false,
  },
  PRO: {
    contactsLimit: null,
    monthlyImportLimit: null,
    syncAccountsLimit: 5,
    appPasswordsLimit: 5,
    advancedMergeEnabled: true,
    premiumExportEnabled: true,
    cardDavSyncEnabled: true,
    familyGroupEnabled: false,
    teamsEnabled: false,
    sharedAddressBooksLimit: 0,
    memberSlotsLimit: null,
    activityLogRetentionDays: 90,
    liveShareEnabled: true,
    staticShareEnabled: true,
  },
  FAMILY: {
    contactsLimit: null,
    monthlyImportLimit: null,
    syncAccountsLimit: 5,
    appPasswordsLimit: 5,
    advancedMergeEnabled: true,
    premiumExportEnabled: true,
    cardDavSyncEnabled: true,
    familyGroupEnabled: true,
    teamsEnabled: false,
    sharedAddressBooksLimit: 1,
    memberSlotsLimit: 6,
    activityLogRetentionDays: 365,
    liveShareEnabled: true,
    staticShareEnabled: true,
  },
  TEAMS: {
    contactsLimit: null,
    monthlyImportLimit: null,
    syncAccountsLimit: 5,
    appPasswordsLimit: 5,
    advancedMergeEnabled: true,
    premiumExportEnabled: true,
    cardDavSyncEnabled: true,
    familyGroupEnabled: false,
    teamsEnabled: true,
    sharedAddressBooksLimit: null,
    memberSlotsLimit: 25,
    activityLogRetentionDays: null,
    liveShareEnabled: true,
    staticShareEnabled: true,
  },
};
```

Note: the PLAN_DEFAULTS `monthlyImportLimit` for FREE is changed from `250` to `3`. This is a corrective fix alongside the migration — the old value of 250 was a placeholder that did not match the intended Free tier limit of 3 imports per month.

#### PLAN_LABELS update

```typescript
const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  FREE: "Free",
  PRO: "Pro",
  FAMILY: "Family",
  TEAMS: "Teams",
};
```

#### getUserBillingContext: group membership resolution

For Family and Teams members (users who are not the group owner but have an ACCEPTED GroupMember row), entitlements must be derived from the group owner's subscription, not from the member's own subscriptions (which may be empty).

The updated function must:
1. Query the user's own active subscriptions as before.
2. If no active subscription is found, query for an ACCEPTED GroupMember row for this user.
3. If a GroupMember row exists, resolve the group's `subscriptionId` and load that subscription's entitlements.
4. Return the resolved entitlements. For group members, also include `groupId` and `groupRole` in the returned context for use by P11-03 enforcement code and P11-06 settings UI.

The `BillingContext` type must be extended:

```typescript
type BillingContext = {
  lifecycleState: BillingLifecycleState;
  plan: SubscriptionPlan;
  planLabel: string;
  entitlements: PlanEntitlements;
  groupMembership?: {
    groupId: string;
    groupName: string;
    groupType: GroupType;
    role: GroupMemberRole;
    memberCount: number;
    memberSlotsLimit: number;
  };
};
```

### 8. TypeScript callsite updates

Search the codebase for all imports of `SubscriptionPlan` and all references to `'PLUS'` or `"PLUS"` in TypeScript source. Update to remove the `PLUS` case. Expected locations:
- `src/server/billing.ts` (handled above)
- Any Stripe webhook handler that maps price IDs to plan codes
- Any seed scripts that create test subscriptions with plan: 'PLUS'
- Any test fixtures or factory functions

Run `grep -r "PLUS" src/ --include="*.ts" --include="*.tsx"` to enumerate all callsites before beginning.

### 9. Prisma client regeneration

After the schema changes, run `npx prisma generate` to regenerate the Prisma client in `generated/prisma/`. The generated client will reflect the new enum values and new model types. Confirm that `generated/prisma/schema.prisma` and `generated/prisma/index.d.ts` both reflect the updates before merging.

### 10. Migration safety checklist

Before running `npx prisma migrate deploy` in any environment:
1. Confirm zero active subscribers with `plan = 'PLUS'` by running `SELECT COUNT(*) FROM "Subscription" WHERE plan = 'PLUS'` against the target database.
2. If any rows exist, coordinate the migration with the communication plan for affected users.
3. Backup the `Subscription` table before running the migration in production.
4. Run the migration in a staging environment that mirrors production first.
5. Verify that the Prisma client regeneration does not break any running server processes (rolling restart required post-migration).

---

## Acceptance Criteria
- `SubscriptionPlan` enum in `prisma/schema.prisma` contains exactly: `FREE`, `PRO`, `FAMILY`, `TEAMS`. No `PLUS`.
- Migration runs cleanly on a fresh database and on a database with existing `PLUS` subscription rows (migration sets them to `PRO`).
- All eight new `Subscription` entitlement fields are present with correct types and defaults as specified.
- `Group`, `GroupMember`, and `GroupAddressBook` models are present in the schema with all specified fields, relations, and indexes.
- `GroupType`, `GroupMemberRole`, `GroupInviteStatus` enums are present.
- `User` model has the three new relation fields: `ownedGroups`, `groupMemberships`, `groupInvitesSent`.
- `Subscription` model has the `groups` relation field.
- `billing.ts` compiles without errors with the updated `PlanEntitlements` type, `PLAN_DEFAULTS`, and `PLAN_LABELS`.
- `getUserBillingContext` correctly resolves entitlements for group members via group subscription lookup.
- `npx prisma generate` completes without errors.
- `npx prisma migrate dev` or `npx prisma migrate deploy` completes without errors on a clean staging database.
- Grep for `'PLUS'` and `"PLUS"` in TypeScript source returns no remaining callsites that reference the plan value (enum member, string literal, or comment-as-code).
- Unit tests for `getUserBillingContext` cover: Free user (no subscription), Pro subscriber, Family group owner, Family group member, Teams group owner, Teams group member.

## Risks and Open Questions
- PostgreSQL enum `DROP VALUE` requires creating a new type and migrating. Ensure the generated Prisma migration handles this correctly and does not leave orphaned enum types in the database.
- The `PLAN_DEFAULTS.FREE.monthlyImportLimit` change from 250 to 3 is a corrective fix. Confirm this does not break any Free users who were relying on the 250-import limit in testing or staging. If tests use the old value they will need updating.
- The `Group.defaultAddressBookId` self-referential FK (a Group FK pointing to a GroupAddressBook which FKs back to Group) creates a circular dependency. Prisma handles this with a `@relation` deferral, but the migration order matters. Confirm that `defaultAddressBookId` is nullable and no FK enforcement is applied until Phase 13 creates the first address book.
- If app passwords are not yet a database model, `appPasswordsLimit` on `Subscription` will be a dormant field. That is acceptable — the field documents the intended limit without breaking anything. The enforcement gate in P11-03 will be a stub in that case.
- The `getUserBillingContext` group membership query adds a second database round-trip for group members. This is acceptable for now. If it becomes a performance issue, a single JOIN query can replace the two-step lookup in a later optimization.
- Stripe product/price ID mapping must be updated before any new subscriptions can be created with the `FAMILY` or `TEAMS` plan codes. Coordinate with the Stripe integration owner before deploying to production.

## Outcome
The Prisma schema, database, and `billing.ts` module accurately reflect the four-tier plan structure defined in P11-01, with all entitlement fields and group scaffolding models in place and ready for P11-03 enforcement wiring.
