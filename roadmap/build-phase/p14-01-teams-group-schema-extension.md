# P14-01 Teams Group Schema Extension

## Purpose
Phase 14 introduces Teams as a distinct group type that is strictly more capable than the Family sharing introduced in Phase 11. This ticket extends the existing Group, GroupMember, GroupAddressBook, and related models to carry the additional columns and relationships Teams require — multiple shared address books, per-book per-member permissions, team-level sync account linkage, and a higher default member cap — while leaving the Family code path fully intact and unaffected.

## Background
Phase 11 introduced a lightweight Group scaffold: `Group` (type FAMILY|TEAM, ownerId, subscriptionId, memberSlotsLimit, defaultAddressBookId), `GroupMember` (role OWNER|ADMIN|MEMBER, inviteStatus, canEdit Boolean), and `GroupAddressBook` (isDefault, archivedAt). Phase 13 layered `GroupContact` (groupAddressBookId FK, contactId FK, addedByUserId FK) and propagation infrastructure on top of that scaffold to make Family sharing operational.

The key Family limitations that Teams must overcome:
- One shared address book per group (enforced by `defaultAddressBookId` on Group).
- A single Boolean `canEdit` on `GroupMember` applies team-wide — no per-book granularity.
- Member cap hard-coded to 6 via `memberSlotsLimit`.
- No model for a sync account that targets a team address book rather than a personal contact library.
- No team-scoped field on `ActivityEvent` for efficient audit queries.

This ticket's schema changes are prerequisites for every other Phase 14 ticket. No product surface should ship until migrations here are stable in all environments.

## Scope

### In scope
- Add `addressBookPermissions` (or normalised table — see design decision below) to `GroupMember`.
- Add `description String?` to `GroupAddressBook` (name was already present).
- Remove the implicit "one book per group" assumption: `Group.defaultAddressBookId` becomes nullable and semantically irrelevant for Teams.
- Introduce the `TeamSyncAccount` join model.
- Add `teamId` FK on `ActivityEvent` to support fast team-scoped audit queries.
- Set `maxMembers` default to 25 for Teams groups.
- Migration file with safe, backwards-compatible ALTER TABLE steps.
- Seed data helpers for tests.
- Prisma client regeneration.

### Out of scope
- Any UI — purely data layer.
- Changes to Family `canEdit` logic — must remain identical.
- Billing enforcement of the 25-member cap — that is P14-02.
- Sync runner changes — that is P14-06.
- ActivityEvent query routes — that is P14-05.

## Design / Implementation Spec

### 1. Design Decision: JSON vs Normalised Permission Table

#### Option A — `addressBookPermissions Json?` on `GroupMember`
Store a map `{ [addressBookId: string]: "EDIT" | "VIEW" | "NONE" }` directly on the `GroupMember` row.

Pros:
- Single row read to resolve all permissions for a member.
- No JOIN required in the hot path (middleware permission checks on every mutation).
- Simple to serialise/deserialise in TypeScript with a Zod schema.
- No orphan rows when an address book is archived or deleted — just remove the key from the JSON.

Cons:
- Cannot be indexed at the DB level — cannot query "which members have EDIT on book X" without a full table scan of `GroupMember` (acceptable for teams ≤ 25 members, problematic at scale).
- Schema evolution requires JSON migration if permission levels are renamed.
- Prisma typed JSON requires a manual type assertion or a Zod parse on every read.

#### Option B — Normalised `GroupMemberAddressBookPermission` Table
```
model GroupMemberAddressBookPermission {
  id              String          @id @default(cuid())
  groupMemberId   String
  groupMember     GroupMember     @relation(fields: [groupMemberId], references: [id], onDelete: Cascade)
  addressBookId   String
  addressBook     GroupAddressBook @relation(fields: [addressBookId], references: [id], onDelete: Cascade)
  permission      BookPermission  // enum: EDIT | VIEW | NONE
  grantedByUserId String
  grantedBy       User            @relation(fields: [grantedByUserId], references: [id])
  updatedAt       DateTime        @updatedAt
  createdAt       DateTime        @default(now())

  @@unique([groupMemberId, addressBookId])
  @@index([addressBookId])
}
```

Pros:
- Fully queryable: "all members with EDIT on book X" is a trivial index scan.
- Cascade deletes on both GroupMember and GroupAddressBook automatically remove orphan rows.
- Auditable: `grantedByUserId` and `createdAt` / `updatedAt` give a lightweight trace of permission changes (full audit is P14-05 ActivityEvent).
- Clean enum type — type safety without custom Zod parsing.

Cons:
- Two extra JOINs per mutation authorization check.
- Write path more expensive: creating a new member requires INSERT of N rows (one per address book).
- Slightly more complex seed/test setup.

#### Decision: Option B — Normalised Table

**Rationale:** Teams can have up to 25 members and can expose multiple address books. The admin workflow "show me all members who can edit the Clients book" (needed in the per-book permission matrix UI in P14-08) requires a DB-level query. A JSON column makes that O(N) over all members. With a normalised table and an index on `addressBookId`, this is a fast index scan. The write overhead at join time is acceptable (max ~25 INSERTs spread across multiple books). Cascade deletes eliminate orphan management complexity. Type safety and auditability are bonuses.

The `canEdit Boolean` on `GroupMember` is retained for Family groups and MUST NOT be removed or repurposed. The new `GroupMemberAddressBookPermission` rows are only created/consumed for TEAM groups.

---

### 2. Prisma Schema Changes

#### 2.1 New Enum

```prisma
enum BookPermission {
  EDIT
  VIEW
  NONE
}
```

#### 2.2 `GroupMember` — no new columns required beyond the relation
The `canEdit Boolean` column stays for Family. The new relation to `GroupMemberAddressBookPermission` is added:

```prisma
model GroupMember {
  // ... existing fields unchanged ...
  addressBookPermissions GroupMemberAddressBookPermission[]
}
```

#### 2.3 New Model: `GroupMemberAddressBookPermission`

```prisma
model GroupMemberAddressBookPermission {
  id              String           @id @default(cuid())
  groupMemberId   String
  groupMember     GroupMember      @relation(fields: [groupMemberId], references: [id], onDelete: Cascade)
  addressBookId   String
  addressBook     GroupAddressBook @relation(fields: [addressBookId], references: [id], onDelete: Cascade)
  permission      BookPermission   @default(EDIT)
  grantedByUserId String
  grantedBy       User             @relation("PermissionGrantedBy", fields: [grantedByUserId], references: [id])
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@unique([groupMemberId, addressBookId])
  @@index([addressBookId])
  @@index([groupMemberId])
}
```

#### 2.4 `GroupAddressBook` — add `description`

```prisma
model GroupAddressBook {
  // ... existing fields ...
  description     String?
  // ... existing archivedAt, isDefault, relations ...
  memberPermissions GroupMemberAddressBookPermission[]
  teamSyncAccounts  TeamSyncAccount[]
}
```

`isDefault Boolean` already exists from Phase 11. For Teams: no book is implicitly default. When a TEAM group's first address book is created, `isDefault` is set to true as a UI hint only — it carries no exclusivity constraint for Teams.

#### 2.5 `Group` — update `memberSlotsLimit` default

The `memberSlotsLimit` column already exists. The migration sets the default to 25 for rows with `type = TEAM`. Family rows are unchanged (default 6). Application code enforcing the cap is in P14-02.

#### 2.6 New Model: `TeamSyncAccount`

```prisma
model TeamSyncAccount {
  id                 String           @id @default(cuid())
  groupId            String
  group              Group            @relation(fields: [groupId], references: [id], onDelete: Cascade)
  syncAccountId      String
  syncAccount        SyncAccount      @relation(fields: [syncAccountId], references: [id], onDelete: Cascade)
  groupAddressBookId String
  groupAddressBook   GroupAddressBook @relation(fields: [groupAddressBookId], references: [id], onDelete: Cascade)
  addedByUserId      String
  addedBy            User             @relation("TeamSyncAddedBy", fields: [addedByUserId], references: [id])
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  @@unique([syncAccountId, groupAddressBookId])
  @@index([groupId, groupAddressBookId])
  @@index([syncAccountId])
}
```

The `@@unique([syncAccountId, groupAddressBookId])` constraint ensures a single CardDAV sync account cannot be linked to the same team address book twice. A sync account CAN be linked to different team books (though this should be unusual and the UI should warn).

#### 2.7 `ActivityEvent` — add `teamId` FK

```prisma
model ActivityEvent {
  // ... existing fields ...
  teamId   String?
  team     Group?   @relation(fields: [teamId], references: [id], onDelete: SetNull)

  // New index for team-scoped audit queries
  @@index([teamId, createdAt(sort: Desc)])
}
```

`teamId` is nullable to keep all existing personal activity events valid without migration data backfill. When an event is emitted in a team context (P14-04, P14-06), the server must populate `teamId`.

#### 2.8 `Group` — add `TeamSyncAccount` relation

```prisma
model Group {
  // ... existing fields ...
  teamSyncAccounts TeamSyncAccount[]
  activityEvents   ActivityEvent[]
}
```

---

### 3. Migration Strategy

The migration file (`prisma/migrations/YYYYMMDDHHMMSS_phase14_teams_schema/migration.sql`) must:

1. Create the `BookPermission` enum: `CREATE TYPE "BookPermission" AS ENUM ('EDIT', 'VIEW', 'NONE');`
2. Add `description TEXT` to `GroupAddressBook`.
3. Create `GroupMemberAddressBookPermission` table with all constraints and indexes.
4. Create `TeamSyncAccount` table with all constraints and indexes.
5. Add `teamId TEXT REFERENCES "Group"(id) ON DELETE SET NULL` to `ActivityEvent`.
6. Create `INDEX "ActivityEvent_teamId_createdAt_idx" ON "ActivityEvent"("teamId", "createdAt" DESC)`.
7. No destructive changes — all operations are additive.
8. No data backfill required (existing Family rows are unaffected; `teamId` on ActivityEvent is nullable).

Migration must be tested against the production schema snapshot before merging.

---

### 4. TypeScript Utility Types

Create `src/lib/teams/permissions.ts`:

```typescript
import { BookPermission } from "@prisma/client";

export type AddressBookPermissionMap = Record<string, BookPermission>;

/**
 * Resolves whether a GroupMember has at least the required permission level
 * for a given address book. Uses the normalised permission rows.
 */
export function hasBookPermission(
  permissions: { addressBookId: string; permission: BookPermission }[],
  addressBookId: string,
  required: BookPermission
): boolean {
  const row = permissions.find((p) => p.addressBookId === addressBookId);
  if (!row) return false;
  // EDIT > VIEW > NONE
  const rank: Record<BookPermission, number> = { EDIT: 2, VIEW: 1, NONE: 0 };
  return rank[row.permission] >= rank[required];
}

/**
 * Returns the subset of address book IDs visible to a member
 * (i.e., permission != NONE).
 */
export function visibleBookIds(
  permissions: { addressBookId: string; permission: BookPermission }[]
): string[] {
  return permissions
    .filter((p) => p.permission !== BookPermission.NONE)
    .map((p) => p.addressBookId);
}
```

---

### 5. Default Permission Bootstrap

When a member accepts an invitation to a Teams group (P14-02), the server must:

1. Fetch all non-archived `GroupAddressBook` rows for the group.
2. Insert one `GroupMemberAddressBookPermission` row per book with `permission: EDIT`.
3. Wrap in a transaction with the `GroupMember.inviteStatus = ACCEPTED` update.

When a new address book is created for a Teams group (P14-03):

1. Fetch all active `GroupMember` rows for the group (status ACCEPTED).
2. Insert one `GroupMemberAddressBookPermission` row per member with `permission: EDIT`.
3. Wrap in the same transaction as the `GroupAddressBook` INSERT.

These bootstrap operations ensure the permission matrix is always complete — no missing rows — which simplifies permission checks to a single join with no NULL-handling edge cases.

---

### 6. Zod Validation

`src/lib/teams/schemas.ts`:

```typescript
import { z } from "zod";

export const BookPermissionSchema = z.enum(["EDIT", "VIEW", "NONE"]);

export const UpdateMemberBookPermissionsSchema = z.object({
  groupMemberId: z.string().cuid(),
  permissions: z.array(
    z.object({
      addressBookId: z.string().cuid(),
      permission: BookPermissionSchema,
    })
  ),
});

export const CreateTeamSyncAccountSchema = z.object({
  groupId: z.string().cuid(),
  syncAccountId: z.string().cuid(),
  groupAddressBookId: z.string().cuid(),
});
```

---

### 7. Prisma Query Helpers

`src/lib/teams/queries.ts`:

```typescript
import { prisma } from "@/lib/prisma";

/**
 * Returns the full permission set for a member within a team group.
 * Used in every team mutation to gate access.
 */
export async function getMemberBookPermissions(
  userId: string,
  groupId: string
) {
  return prisma.groupMemberAddressBookPermission.findMany({
    where: {
      groupMember: {
        userId,
        groupId,
        inviteStatus: "ACCEPTED",
      },
    },
    select: {
      addressBookId: true,
      permission: true,
    },
  });
}

/**
 * Returns GroupMember row including role for authorization decisions.
 */
export async function getGroupMembership(userId: string, groupId: string) {
  return prisma.groupMember.findFirst({
    where: { userId, groupId, inviteStatus: "ACCEPTED" },
    select: { id: true, role: true },
  });
}
```

---

### 8. Index Verification

After migration, verify these indexes exist via `\d` in psql or Prisma Studio:

| Table | Index |
|---|---|
| `GroupMemberAddressBookPermission` | `(groupMemberId)` |
| `GroupMemberAddressBookPermission` | `(addressBookId)` |
| `GroupMemberAddressBookPermission` | `UNIQUE (groupMemberId, addressBookId)` |
| `TeamSyncAccount` | `(groupId, groupAddressBookId)` |
| `TeamSyncAccount` | `(syncAccountId)` |
| `TeamSyncAccount` | `UNIQUE (syncAccountId, groupAddressBookId)` |
| `ActivityEvent` | `(teamId, createdAt DESC)` |

---

### 9. Backwards Compatibility Checklist

- [ ] Family group flows (Phase 13) continue to use `GroupMember.canEdit` — no code reads `addressBookPermissions` for FAMILY type groups.
- [ ] `ActivityEvent` rows with `teamId = NULL` are unaffected — existing personal activity queries must still work.
- [ ] `GroupAddressBook.description` is nullable — all existing SELECT/INSERT for Family books work without modification.
- [ ] `Group.memberSlotsLimit` is not changed in existing rows — only the application-level default for new TEAM groups is 25.

## Acceptance Criteria

- [ ] `prisma migrate dev` runs cleanly in a fresh local environment with no errors.
- [ ] `prisma generate` produces TypeScript types for `BookPermission`, `GroupMemberAddressBookPermission`, and `TeamSyncAccount`.
- [ ] A `GroupMemberAddressBookPermission` row can be inserted, queried, and deleted via the Prisma client in a test.
- [ ] `hasBookPermission` utility returns correct results for all three permission levels and for a missing row.
- [ ] `visibleBookIds` returns only non-NONE entries.
- [ ] `getMemberBookPermissions` and `getGroupMembership` queries execute without N+1 issues (verify with query logging).
- [ ] Existing Family group seed data and Phase 13 tests pass without modification.
- [ ] `ActivityEvent` rows with `teamId = NULL` continue to be returned by existing activity log queries.
- [ ] `TeamSyncAccount` unique constraint prevents duplicate `(syncAccountId, groupAddressBookId)` pairs.
- [ ] Database migration is idempotent (re-running `migrate deploy` in CI does not error).
- [ ] All new models appear correctly in Prisma Studio.

## Risks and Open Questions

- **Migration lock on `ActivityEvent`**: This table may be large in production. Adding a nullable FK column with no default should be a fast metadata operation in Postgres 12+ but must be verified against row count. If row count exceeds 10M, consider a concurrent migration strategy.
- **BookPermission default bootstrap race**: If a new address book is created at the same time a member accepts an invite, the transaction boundaries in P14-02 and P14-03 must be carefully ordered to avoid missing permission rows. Use a database-level transaction wrapping both operations.
- **JSON vs normalised — re-evaluation point**: If Teams grows to 100+ members (enterprise tier), the normalised table remains the correct choice. Document the decision explicitly in the migration file header so future engineers understand the tradeoff.
- **SyncAccount model compatibility**: Phase 5/7 introduced `SyncAccount`. Confirm the exact model name and primary key type before writing the `TeamSyncAccount` FK. If `SyncAccount` uses `uuid` not `cuid`, the FK type must match.
- **`Group.defaultAddressBookId`**: Should this be deprecated for TEAM groups or retained as a "last used book" hint? Decision must be made before P14-03 ships. For now, leave the column but add a comment in the Prisma schema noting it is unused for Teams.

## Outcome
The database and Prisma client are fully prepared for Teams-specific features: per-book member permissions, team sync accounts, and team-scoped audit events, with all changes additive and fully backwards-compatible with existing Family functionality.
