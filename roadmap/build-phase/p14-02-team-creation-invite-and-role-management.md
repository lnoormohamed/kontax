# P14-02 Team Creation, Invite, and Role Management

## Purpose
This ticket delivers the full lifecycle management for a Teams group: creating a team, inviting members via signed email tokens, assigning and changing roles (OWNER/ADMIN/MEMBER), removing members, and transferring ownership. It extends the invite flow introduced for Family in Phase 11, which must remain intact, and adds the admin-level controls unique to Teams — role promotion/demotion, managed removal, and owner transfer with subscription anchor implications.

## Background
Phase 11 implemented the Family invite flow: a server-side signed invite token (48-hour TTL) is emailed to the invitee; clicking the link accepts the invite and sets `GroupMember.inviteStatus = ACCEPTED`. The `role` enum is already `OWNER | ADMIN | MEMBER`. Phase 11 used only `OWNER` and `MEMBER` for Family — `ADMIN` was scaffolded but never operationalised.

Phase 14 makes `ADMIN` a real, operational role for Teams. Admins can do everything except: remove the owner, downgrade the owner's role, or transfer ownership to themselves without the owner initiating it. Only the owner can promote a member to admin, demote an admin back to member, or transfer ownership.

The subscription for a Teams group is anchored to the owner (`Group.ownerId`). Billing events — seat upgrades, plan cancellations, grace period computations — all reference the owner. Ownership transfer has non-trivial billing implications that must be documented and handled in this ticket even if the billing execution itself is delegated to the billing system.

## Scope

### In scope
- "Create Team" entry point in the Settings UI (Teams plan users only).
- Server action: `createTeam(name: string)` → creates `Group` (type: TEAM), adds creator as OWNER, creates one default `GroupAddressBook`.
- Invite flow: admin or owner invites by email → signed token → accept endpoint.
- Default permission bootstrap on invite acceptance (from P14-01 design).
- Role management: promote MEMBER → ADMIN, demote ADMIN → MEMBER, both owner-only.
- Remove member: owner or admin can remove any MEMBER; owner can remove any ADMIN; no one can remove the OWNER.
- Owner transfer: owner-initiated, to any current ADMIN, with explicit confirmation step.
- Member cap enforcement: reject invites when active member count equals `memberSlotsLimit`.
- Subscription cancellation cascade: archive team book access on grace period expiry.
- Basic email notifications: invite email, removal notification email, role change notification email.

### Out of scope
- Billing plan gating / paywall for Teams plan — handled by billing system.
- Per-book permission management — P14-03.
- Team management UI tabbed layout — P14-07.
- Audit log events for role changes beyond recording the ActivityEvent — P14-05.

## Design / Implementation Spec

### 1. Create Team Flow

#### 1.1 Entry Point
Route: `GET /settings/teams/new`

The "Create Team" button is visible in Settings only when:
- The user's active subscription has plan type `TEAMS`.
- The user is not already an OWNER of a TEAM group.

If the user already has a team (as owner), the button is replaced with a link to `/settings/teams/{teamId}`.

#### 1.2 Server Action: `createTeam`
File: `src/app/actions/teams.ts`

```typescript
"use server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateTeamSchema = z.object({
  name: z.string().min(1).max(80).trim(),
});

export async function createTeam(input: z.infer<typeof CreateTeamSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  const userId = session.user.id;

  const validated = CreateTeamSchema.parse(input);

  // Verify subscription allows Teams
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE", plan: { type: "TEAMS" } },
  });
  if (!subscription) throw new Error("Teams plan required");

  // Verify user doesn't already own a team
  const existingTeam = await prisma.group.findFirst({
    where: { ownerId: userId, type: "TEAM" },
  });
  if (existingTeam) throw new Error("User already owns a team");

  return prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        ownerId: userId,
        type: "TEAM",
        name: validated.name,
        subscriptionId: subscription.id,
        memberSlotsLimit: 25,
      },
    });

    const defaultBook = await tx.groupAddressBook.create({
      data: {
        groupId: group.id,
        name: "Main",
        isDefault: true,
      },
    });

    await tx.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: "OWNER",
        inviteStatus: "ACCEPTED",
        canEdit: true,
        joinedAt: new Date(),
        invitedByUserId: userId,
      },
    });

    // Bootstrap permission for owner on the default book
    const ownerMember = await tx.groupMember.findFirst({
      where: { groupId: group.id, userId },
      select: { id: true },
    });
    if (ownerMember) {
      await tx.groupMemberAddressBookPermission.create({
        data: {
          groupMemberId: ownerMember.id,
          addressBookId: defaultBook.id,
          permission: "EDIT",
          grantedByUserId: userId,
        },
      });
    }

    return group;
  });
}
```

After creation, redirect to `/settings/teams/{groupId}`.

---

### 2. Invite Flow

#### 2.1 Invite by Email — Server Action: `inviteTeamMember`

```typescript
const InviteTeamMemberSchema = z.object({
  groupId: z.string().cuid(),
  email: z.string().email().toLowerCase(),
});

export async function inviteTeamMember(
  input: z.infer<typeof InviteTeamMemberSchema>
) {
  // Auth: acting user must be OWNER or ADMIN of the group
  // Cap check: active member count < memberSlotsLimit
  // Duplicate check: no existing ACCEPTED or PENDING GroupMember with this email
  // Create GroupMember with inviteStatus: PENDING, role: MEMBER
  // Generate signed JWT token (48hr TTL, payload: { groupId, email, memberId })
  // Send invite email via email provider
}
```

**Signed token details:**
- Algorithm: HS256, secret from `INVITE_TOKEN_SECRET` env var (min 32 chars).
- Payload: `{ sub: memberId, groupId, email, exp: now + 48h, purpose: "team_invite" }`.
- Token is single-use: on acceptance, the `GroupMember` row is marked ACCEPTED and any future use of the same token returns 410 Gone.

**Cap enforcement:**
```typescript
const activeCount = await prisma.groupMember.count({
  where: { groupId, inviteStatus: "ACCEPTED" },
});
const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
if (activeCount >= group.memberSlotsLimit) {
  throw new Error(`Team is at capacity (${group.memberSlotsLimit} members)`);
}
```

Note: count pending invites against the cap to prevent invite-flooding around the cap. Pending + accepted count is the effective seat usage.

#### 2.2 Accept Invite — Route: `GET /api/teams/invite/accept?token={token}`

```typescript
// src/app/api/teams/invite/accept/route.ts
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  // 1. Verify JWT signature and expiry
  // 2. Look up GroupMember by sub (memberId)
  // 3. Confirm inviteStatus === PENDING
  // 4. Confirm email matches session user's email (or prompt login)
  // 5. In a transaction:
  //    a. Set GroupMember.inviteStatus = ACCEPTED, joinedAt = now()
  //    b. Fetch all non-archived GroupAddressBook for the group
  //    c. Insert GroupMemberAddressBookPermission rows (EDIT) for each book
  // 6. Redirect to workspace with team section visible
}
```

If the invitee does not have a Kontax account, redirect to `/signup?invite={token}` and complete bootstrap after account creation.

#### 2.3 Decline or Revoke

- Invitee can decline: `POST /api/teams/invite/decline` with token → sets `inviteStatus: DECLINED`.
- Admin/Owner can revoke a pending invite: `inviteStatus: REVOKED`. UI shows revoke button in Members tab next to PENDING rows.
- Revoked/declined invites do not count against the member cap.

---

### 3. Role Management

#### 3.1 Role Hierarchy and Capabilities Matrix

| Action | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| Invite new members | Yes | Yes | No |
| Remove MEMBER | Yes | Yes | No |
| Remove ADMIN | Yes | No | No |
| Promote MEMBER → ADMIN | Yes | No | No |
| Demote ADMIN → MEMBER | Yes | No | No |
| Transfer ownership | Yes (initiates) | No | No |
| Create address book | Yes | Yes | No |
| Archive/rename address book | Yes | Yes | No |
| Manage per-book permissions | Yes | Yes | No |
| Add/remove team sync accounts | Yes | Yes | No |
| View audit log | Yes | Yes | No |
| Export audit log (CSV) | Yes | Yes | No |
| Edit contacts (per book) | Per permission | Per permission | Per permission |

#### 3.2 Server Action: `setMemberRole`

```typescript
const SetMemberRoleSchema = z.object({
  groupId: z.string().cuid(),
  targetMemberId: z.string().cuid(), // GroupMember.id of the target
  newRole: z.enum(["ADMIN", "MEMBER"]),
});

export async function setMemberRole(
  input: z.infer<typeof SetMemberRoleSchema>
) {
  // Auth: acting user must be OWNER of the group
  // Validate: cannot change OWNER role (OWNER is only changed via transferOwnership)
  // Validate: cannot set OWNER as newRole via this action
  // Update GroupMember.role
  // Emit ActivityEvent (actor: TEAM_MEMBER, teamId: groupId, eventType: ROLE_CHANGED)
  // Send notification email to affected member
}
```

#### 3.3 Server Action: `removeMember`

```typescript
const RemoveMemberSchema = z.object({
  groupId: z.string().cuid(),
  targetMemberId: z.string().cuid(),
});

export async function removeMember(input: z.infer<typeof RemoveMemberSchema>) {
  // Auth: acting user must be OWNER or ADMIN
  // If acting as ADMIN: target must be MEMBER (not ADMIN, not OWNER)
  // If acting as OWNER: target can be MEMBER or ADMIN (not OWNER themselves)
  // In transaction:
  //   1. Set GroupMember.inviteStatus = REVOKED (soft removal — preserves audit trail)
  //   2. Delete all GroupMemberAddressBookPermission rows for this member
  // Emit ActivityEvent
  // Send removal notification email
}
```

Soft removal rationale: audit log events referencing this member's ID must remain queryable. Hard deletion would orphan ActivityEvent rows or require cascade deletes that destroy audit data. Setting `inviteStatus = REVOKED` excludes the member from all permission checks and workspace queries while retaining the join row for audit purposes.

---

### 4. Owner Transfer

#### 4.1 Flow
Owner navigates to Settings → Team → Members tab → "Transfer Ownership" button (only visible to owner).

A two-step modal:
1. Select a current ADMIN from a dropdown.
2. Type the team name to confirm.
3. Submit → `transferOwnership` server action.

#### 4.2 Server Action: `transferOwnership`

```typescript
const TransferOwnershipSchema = z.object({
  groupId: z.string().cuid(),
  newOwnerId: z.string().cuid(), // User.id of the new owner
  confirmation: z.string(), // must equal group.name
});

export async function transferOwnership(
  input: z.infer<typeof TransferOwnershipSchema>
) {
  // Auth: acting user must be current OWNER
  // Validate: newOwnerId is an ACCEPTED ADMIN member of the group
  // Validate: confirmation === group.name (case-sensitive)
  // In transaction:
  //   1. Set old OWNER GroupMember.role = ADMIN
  //   2. Set new owner GroupMember.role = OWNER
  //   3. Set Group.ownerId = newOwnerId
  //   4. Transfer subscription anchor: Group.subscriptionId logic (see billing note)
  // Emit ActivityEvent (eventType: OWNERSHIP_TRANSFERRED)
  // Email both parties
}
```

**Billing implications (document, delegate to billing system):**
- The Teams subscription is billed to the owner. After transfer, the new owner becomes the subscription's billing contact.
- If the billing system stores a `customerId` per user, the subscription must be migrated to the new owner's billing customer record.
- The old owner retains their personal Kontax account and any personal contacts unaffected.
- If the new owner does not have an active payment method in the billing system, the transfer should be blocked with a clear error: "The new owner must have a valid payment method before ownership can be transferred."
- This enforcement is a billing-system responsibility. This server action should call a `validateBillingReadiness(userId)` check before proceeding, and that function is a stub that the billing system fills in.

---

### 5. Subscription Cancellation Cascade

When the Teams plan subscription is cancelled:

1. Subscription status transitions to `CANCELLING` (existing billing lifecycle).
2. Grace period: 30 days from cancellation date.
3. On grace period expiry (scheduled job or webhook from billing provider):
   - Set all `GroupAddressBook.archivedAt = now()` for the team's books.
   - Set `Group.memberSlotsLimit = 0` (prevents re-invite attempts).
   - Send email to all ACCEPTED members: "Your team workspace has been deactivated."
   - Send email to owner with reactivation instructions.
4. Contacts in archived team books are not deleted — they are soft-archived (read-only). The owner can reactivate by re-subscribing.

---

### 6. UI: Create Team Page
Route: `/settings/teams/new` (RSC page)

```
[ Create Your Team ]

Team name: _______________

[ Create Team ]

Note: You are creating a team workspace. As the team owner, you are responsible
for the subscription billing. Your team can have up to 25 members.
```

After successful creation, redirect to `/settings/teams/{teamId}?tab=members`.

### 7. UI: Invite Member Modal (in team management page, P14-07)

Fields:
- Email address (text input)
- Role (select: Member | Admin) — default: Member

On submit, calls `inviteTeamMember`. Show success toast "Invite sent to {email}". On cap error, show inline error. On duplicate error, show "This person already has a pending invite or is already a member."

### 8. Notification Emails

| Trigger | Recipient | Subject |
|---|---|---|
| Invite sent | Invitee | "You've been invited to join {teamName} on Kontax" |
| Invite accepted | Owner + all admins | "{name} joined {teamName}" |
| Member removed | Removed member | "You've been removed from {teamName}" |
| Role changed | Affected member | "Your role in {teamName} has been updated to {role}" |
| Ownership transferred | Old owner, new owner | "Ownership of {teamName} has been transferred" |
| Subscription cancelled | All members | "Your {teamName} team workspace will deactivate on {date}" |

All emails use the existing transactional email provider. Add new templates following the project's existing email template structure.

---

### 9. Server-Side Authorization Middleware Helper

`src/lib/teams/auth.ts`:

```typescript
import { prisma } from "@/lib/prisma";

export type GroupRole = "OWNER" | "ADMIN" | "MEMBER";

export async function requireGroupRole(
  userId: string,
  groupId: string,
  minimumRole: GroupRole
): Promise<{ memberId: string; role: GroupRole }> {
  const member = await prisma.groupMember.findFirst({
    where: { userId, groupId, inviteStatus: "ACCEPTED" },
    select: { id: true, role: true },
  });

  if (!member) throw new Error("Not a member of this team");

  const rank: Record<GroupRole, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };
  if (rank[member.role as GroupRole] < rank[minimumRole]) {
    throw new Error("Insufficient role");
  }

  return { memberId: member.id, role: member.role as GroupRole };
}
```

All team server actions must call this helper as the first authorization step.

## Acceptance Criteria

- [ ] A user with a Teams plan subscription can create a team and is set as OWNER.
- [ ] Creating a team creates a default GroupAddressBook named "Main" with isDefault=true.
- [ ] An owner can invite a member by email; the invitee receives a signed 48-hour invite email.
- [ ] Accepting the invite sets inviteStatus=ACCEPTED and bootstraps EDIT permissions for all current address books.
- [ ] Inviting beyond `memberSlotsLimit` (pending + accepted) returns a clear error.
- [ ] An owner can promote a MEMBER to ADMIN and demote an ADMIN to MEMBER.
- [ ] An ADMIN cannot promote or demote other members.
- [ ] An ADMIN can remove a MEMBER but not an ADMIN or OWNER.
- [ ] An OWNER can remove any non-OWNER member.
- [ ] Removing a member soft-deletes (REVOKED) and removes their book permissions; they can no longer access the workspace.
- [ ] Owner transfer requires typed team name confirmation and target must be an existing ADMIN.
- [ ] After ownership transfer, the new owner has OWNER role and old owner has ADMIN role.
- [ ] `requireGroupRole` throws the correct error for unauthorized attempts.
- [ ] All notification emails are sent for each trigger listed in Section 8.
- [ ] A user can be a member of one Family group AND one Team simultaneously.
- [ ] Grace period cascade archives all team books and notifies all members.

## Risks and Open Questions

- **Billing system integration**: The `validateBillingReadiness` stub in owner transfer is a known placeholder. The billing team must implement this before ownership transfer is enabled in production.
- **Invite token replay after REVOKED**: If a member is removed and later re-invited with a new token, the old expired token must not be re-accepted. The single-use check on `inviteStatus === PENDING` handles this, but the edge case of a pending invite followed by a removal needs testing (the REVOKED status from removal should block re-use of the original invite token).
- **Email deliverability for invites**: Invite emails from a SaaS domain often land in spam. Consider adding a "copy invite link" fallback in the UI so admins can share the invite URL directly.
- **User belongs to two groups simultaneously**: Session and workspace queries must always join both Group memberships. Performance test with a user who has both a Family group and a Team.
- **Cap counting semantics**: Counting pending + accepted against the cap is the safe choice but may frustrate admins whose invites bounce (invitee never accepts) and they cannot re-use the slot. Consider adding an "expire and reclaim" action for pending invites older than 7 days.

## Outcome
Teams groups can be created, staffed with invited members, managed with role-based access controls, and transferred between owners, providing the full membership lifecycle foundation that all other Phase 14 features depend on.
