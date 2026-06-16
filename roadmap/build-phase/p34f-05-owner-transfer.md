# P34F-05 — Team Owner Transfer (Role Change, No Stripe Writes)

## Purpose

Implement the "Make owner" action deferred since Phase 14. Because billing is now
org-anchored (P34F-01/02), transferring ownership is a **role change only** — no Stripe
customer/subscription surgery, no billing gap. Update `Group.ownerId` and the two
members' roles atomically.

## Background

- `roadmap/design-briefs/14-teams-plan-surfaces.md:45`: "Owner transfer is not built —
  subscription is `userId`-anchored, billing sign-off needed. Leave room for a 'Make
  owner' action on admin rows." P34F removes the blocker.
- Team management gates on `getManageableTeam(userId)` (`src/server/team-access.ts:113`).
- Role promotion/demotion patterns exist in `src/app/actions/teams.ts` (e.g.
  `changeTeamRole` around `:256`, owner-only checks at `:258`/`:261`).
- `leaveTeam` (`teams.ts:597`) and `deleteTeam` (`:616`) show the transaction style and
  the "owner can't leave — transfer or delete" guard (`:607`).
- `GroupMember` has `@@unique([groupId, userId])` (`schema.prisma:1006`) preventing
  duplicate membership.

Once P34F-02 makes Teams grace target the group by `groupId` (not `ownerId`), changing
the owner no longer disturbs grace state — which is the entire reason this is now safe.

## Scope

**In scope:**
- `transferTeamOwnership(formData)` action: old owner → ADMIN, new owner → OWNER,
  `Group.ownerId` updated, all atomic.
- Authorization: only the current owner can transfer.
- New owner must be an ACCEPTED member with a linked `userId`.
- Fail-closed guard: refuse transfer if the team's billing is not yet org-anchored.
- "Make owner" UI on admin/member rows (owner-only visibility) with confirmation.

**Out of scope:**
- Any Stripe API call (billing already belongs to the group).
- Billing-manager flag mechanics (P34F-04) — though the new owner is granted billing
  access here for safety.
- GDPR erasure flow (this action satisfies its precondition; see runbook note).

## Design / Implementation Spec

### Action

```typescript
// src/app/actions/teams.ts
import { getGroupBillingCustomer } from "~/server/billing-owner";

export const transferTeamOwnership = async (formData: FormData) => {
  const userId = await requireUserId();
  const groupId = str(formData, "groupId");
  const newOwnerMemberId = str(formData, "memberId");

  await db.$transaction(async (tx) => {
    const group = await tx.group.findUnique({
      where: { id: groupId },
      select: { id: true, ownerId: true, type: true },
    });
    if (!group || group.type !== "TEAM") throw new Error("Team not found.");
    if (group.ownerId !== userId) throw new Error("Only the owner can transfer ownership.");

    // Fail closed: never transfer a team whose billing is still user-anchored,
    // or ownership change would orphan billing (see P34F-03).
    const billing = await tx.subscriptionCustomer.findUnique({ where: { groupId } });
    if (!billing) {
      throw new Error("This team's billing isn't set up for transfer yet. Contact support.");
    }

    const newOwner = await tx.groupMember.findUnique({ where: { id: newOwnerMemberId } });
    if (!newOwner || newOwner.groupId !== groupId) throw new Error("Member not found.");
    if (newOwner.inviteStatus !== "ACCEPTED" || !newOwner.userId) {
      throw new Error("The new owner must be an active team member.");
    }
    if (newOwner.userId === userId) throw new Error("You are already the owner.");

    const oldOwnerMember = await tx.groupMember.findFirst({
      where: { groupId, userId, role: "OWNER" },
    });
    if (!oldOwnerMember) throw new Error("Current owner membership not found.");

    await tx.groupMember.update({ where: { id: oldOwnerMember.id }, data: { role: "ADMIN" } });
    await tx.groupMember.update({
      where: { id: newOwner.id },
      data: { role: "OWNER", canManageBilling: true },
    });
    await tx.group.update({ where: { id: groupId }, data: { ownerId: newOwner.userId } });
  });

  revalidatePath("/settings/teams");
};
```

### What does NOT change

- `SubscriptionCustomer` / `Subscription` rows — anchored to `groupId`, not the owner.
  **No Stripe call.** This is the payoff of the re-anchor.
- Grace state — targeted by `groupId` after P34F-02, so transfer leaves it intact.
- Per-book permissions (`addressBookPermissions`) — unchanged; the new owner is a
  manager (`isManager` via `getUserTeamMembership`) and always resolves EDIT.

### Hard dependency on migration

For a team not yet migrated by P34F-03 (still `userId`-anchored, no `groupId` customer),
`getGroupBillingCustomer`/the `findUnique({ where: { groupId } })` returns null and the
action fails closed. This makes P34F-03 a prerequisite for surfacing transfer; until a
team is migrated, the "Make owner" button should be disabled with a tooltip rather than
throwing on click.

### UI

- "Make owner" action on admin/member rows, visible only to the current owner (gate on
  `getManageableTeam(...).role === "OWNER"`).
- Disabled with tooltip "Available once team billing is set up" when the group has no
  `billingCustomer`.
- Confirmation modal (destructive style — privilege handover):
  *"Make {name} the owner? You'll become an Admin. Billing stays with the team — no
  payment changes."*

## Acceptance Criteria

- The owner can promote any ACCEPTED, `userId`-linked member to owner; the change is
  atomic (old → ADMIN, new → OWNER, `Group.ownerId` updated).
- The new owner gains billing access (`canManageBilling = true` and owner backstop).
- **No Stripe API call** is made; the group's subscription/customer rows are unchanged.
- Non-owners cannot invoke the action (server throws; UI hides the control).
- Transfer fails closed with a clear message if the team's billing is not org-anchored;
  the button is disabled in that state.
- The `gdpr-erasure` runbook precondition (owner must transfer or dissolve before
  deletion — `roadmap/runbooks/gdpr-erasure.md:46`) is satisfiable via this action.
- Unit tests: happy path, non-owner denied, pending/declined target rejected,
  self-transfer rejected, un-migrated team rejected.

## Risks and Open Questions

- **Un-migrated teams.** The guard fails closed; ensure P34F-03 runs before transfer is
  broadly surfaced, or the disabled-state copy points to support.
- **Double-owner race.** The transaction plus the `role: "OWNER"` re-read and
  `@@unique([groupId, userId])` prevent two owners; the new owner is already a member,
  so no new membership row is created.
- **Billing email.** The Stripe customer's `billingEmail` may still be the old owner's
  email. Decide whether transfer updates it to the new owner (recommend: leave it
  editable in the portal; out of scope here).
- **Notifications.** Consider notifying the new owner ("You're now the owner of
  {team}") and the old owner — reuse the notification pattern in `teams.ts` if desired;
  not required for acceptance.
