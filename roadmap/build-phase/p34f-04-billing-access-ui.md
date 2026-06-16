# P34F-04 — Billing Access UI (Permission-Gated)

## Purpose

Let any member with billing permission — not just the owner — manage the team's Stripe
billing. Gate the Stripe customer portal and plan/seat/payment controls on
`canManageGroupBilling`, and add a "Billing manager" toggle to the admin member
controls. Depends on P34F-01 (flag + helper) and P34F-02 (group customer).

## Background

- The shared billing portal is opened by `createBillingPortalSession` in
  `src/app/actions/billing.ts:147`. It currently looks up the customer by `userId`
  (`:154`) and is wired to the personal billing UI via
  `src/app/settings/_components/billing-portal-button.tsx` and `billing-section.tsx`.
- Team management actions gate on `getManageableTeam(userId)` in
  `src/server/team-access.ts:113` (`role IN (OWNER, ADMIN)`).
- There is no shared billing access for teams today — billing is implicitly the
  owner's personal portal. With org anchoring (P34F-02) the portal belongs to the
  group, so access becomes a permission, not an identity.
- `canManageGroupBilling(member)` helper is defined in P34F-01
  (`src/server/billing-owner.ts`): `member.role === "OWNER" || member.canManageBilling`.

## Scope

**In scope:**
- `requireBillingManager(groupId, userId)` server guard.
- `openTeamBillingPortal(formData)` server action → portal session against the
  **group's** customer.
- `setBillingManager(formData)` to grant/revoke `canManageBilling` (authz per DB01 Q3).
- Team settings billing section: management controls rendered only for managers.
- Member-management UI: a "Billing" column with a per-row toggle; owner row locked
  "Always".

**Out of scope:**
- Read-only visibility for non-managers (P34F-06).
- Owner transfer (P34F-05).
- The underlying customer/subscription model (P34F-01/02).
- The personal `createBillingPortalSession` (unchanged — still serves personal plans).

## Design / Implementation Spec

### Server guard

```typescript
// src/app/actions/teams.ts (or team-access.ts)
import { canManageGroupBilling } from "~/server/billing-owner";

async function requireBillingManager(groupId: string, userId: string) {
  const member = await db.groupMember.findFirst({
    where: { groupId, userId, inviteStatus: "ACCEPTED" },
    select: { id: true, role: true, canManageBilling: true },
  });
  if (!member || !canManageGroupBilling(member)) {
    throw new Error("You don't have billing access for this team.");
  }
  return member;
}
```

### Portal session against the group customer

```typescript
// src/app/actions/teams.ts
import { getGroupBillingCustomer } from "~/server/billing-owner";

export const openTeamBillingPortal = async (formData: FormData) => {
  const userId = await requireUserId();
  const groupId = str(formData, "groupId");
  await requireBillingManager(groupId, userId);

  const customer = await getGroupBillingCustomer(groupId);
  if (!customer) throw new Error("This team has no billing account yet.");

  const stripe = getStripeClient();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const portal = await stripe.billingPortal.sessions.create({
    customer: customer.providerCustomerId,
    return_url: `${appUrl}/settings/teams?portal=returned`,
  });
  if (!portal.url) throw new Error("Could not open billing portal.");
  redirect(portal.url);
};
```

This mirrors the personal `createBillingPortalSession` (`billing.ts:147`) but resolves
the customer by `groupId` and guards on billing permission. Any plan-change / seat-
change actions added for teams use the same `requireBillingManager` guard.

### "Billing manager" toggle

```typescript
export const setBillingManager = async (formData: FormData) => {
  const userId = await requireUserId();
  const groupId = str(formData, "groupId");
  const targetMemberId = str(formData, "memberId");
  const enabled = str(formData, "enabled") === "true";

  // DB01 Q3: owner + admins can grant. Reuse getManageableTeam.
  const manageable = await getManageableTeam(userId);
  if (!manageable || manageable.team.id !== groupId) {
    throw new Error("You aren't allowed to manage this team's billing access.");
  }

  const target = await db.groupMember.findUnique({ where: { id: targetMemberId } });
  if (!target || target.groupId !== groupId) throw new Error("Member not found.");
  if (target.role === "OWNER") {
    throw new Error("The owner always has billing access."); // backstop, DB01 Q2
  }

  await db.groupMember.update({
    where: { id: targetMemberId },
    data: { canManageBilling: enabled },
  });
  revalidatePath("/settings/teams");
};
```

### UI

In `/settings/teams` (admin/manager view):
- **Billing section** — render "Manage billing" (→ `openTeamBillingPortal`) and any
  plan/seat controls only when the viewer `canManageGroupBilling`. Reuse the
  visual treatment of `billing-section.tsx` but bind to the team action.
- **Member table** (the matrix described in
  `roadmap/design-briefs/14-teams-plan-surfaces.md:37`) — add a "Billing" column:
  - Owner row: locked badge "Always".
  - Admin/Member rows: a toggle bound to `setBillingManager`.
- Non-managers see the read-only summary from P34F-06 instead of these controls.

Match the Teams locked-light system / Geist styling per the Phase 14 brief.

## Acceptance Criteria

- A non-owner member with `canManageBilling = true` can open the Stripe portal and
  manage the team's plan/seats/payment.
- A member without the flag (and not owner) cannot — `requireBillingManager` throws and
  the UI hides the controls.
- The owner always has billing access regardless of the stored flag; their toggle is
  locked "Always" and `setBillingManager` refuses to change it.
- Granting/revoking is restricted to owner + admins (DB01 Q3) and revalidates
  `/settings/teams`.
- The portal session targets the group's `providerCustomerId`, never a user's personal
  customer.
- The personal `createBillingPortalSession` path is unchanged for non-team users.

## Risks and Open Questions

- **Who can grant billing-manager (DB01 Q3).** Default owner + admins. If finance staff
  shouldn't be promotable by every admin, restrict `setBillingManager` to owner only —
  confirm before build.
- **Last billing manager leaves.** Covered by the owner backstop, but verify the
  leave/remove flows (P34F-05 + `leaveTeam`) can't strand a team without any manager.
- **Stripe portal configuration.** The hosted portal can expose cancel/plan-switch and
  payment-method edits. Ensure the Stripe portal config matches what the app intends
  to allow for teams (e.g. whether cancellation is permitted there vs in-app).
- **Pre-migration teams.** `getGroupBillingCustomer` returns null until P34F-03 has
  run for a team; the "no billing account yet" error covers it, but surface a clearer
  message ("billing is being set up — contact the owner") if teams will be partially
  migrated when this ships.
