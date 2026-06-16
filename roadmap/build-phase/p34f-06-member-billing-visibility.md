# P34F-06 — Member Billing Visibility (Read-Only)

## Purpose

Give every team member a read-only view of the team's plan: who runs it, the plan, seat
usage, and renewal date. No Stripe writes, no portal access — just transparency so
members understand the plan and when it renews. Depends on P34F-01/02 (org subscription
to read from).

## Background

`/settings/teams` for non-admins is a thin read card — team name, "Run by {owner}",
your role, Leave (`roadmap/design-briefs/14-teams-plan-surfaces.md:55`). It shows
nothing about billing. With org-anchored billing the data lives on the group's
subscription and group capability fields (`Group.teamsEnabled`,
`Group.teamsGraceEndsAt`), and can be surfaced safely. Grace state is already derived
by `getTeamGraceState(teamsGraceEndsAt, teamsEnabled)` in
`src/server/team-access.ts:8`.

## Scope

**In scope:**
- `getTeamBillingSummary(groupId)` selector returning a client-safe shape (no Stripe
  IDs).
- A read-only billing strip on `/settings/teams` for ALL members.
- Grace/locked/cancel-pending states surfaced read-only.

**Out of scope:**
- Any management control (P34F-04, gated).
- Invoices / payment method (managers see those via the portal).

## Design / Implementation Spec

### Selector

```typescript
// src/server/team-access.ts
import { getTeamGraceState } from "~/server/team-access"; // (same module)

export async function getTeamBillingSummary(groupId: string) {
  const group = await db.group.findUnique({
    where: { id: groupId },
    select: {
      name: true,
      teamsEnabled: true,
      teamsGraceEndsAt: true,
      owner: { select: { name: true, email: true } },
      subscriptions: {
        where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          plan: true,
          status: true,
          memberSlotsLimit: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      },
      _count: { select: { members: { where: { inviteStatus: "ACCEPTED" } } } },
    },
  });
  if (!group) return null;

  const sub = group.subscriptions[0] ?? null;
  return {
    ownerName: group.owner.name ?? group.owner.email,
    plan: sub?.plan ?? "TEAMS",
    status: sub?.status ?? null,
    seatsUsed: group._count.members,
    seatsLimit: sub?.memberSlotsLimit ?? null,
    renewsAt: sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    graceState: getTeamGraceState(group.teamsGraceEndsAt, group.teamsEnabled),
    graceEndsAt: group.teamsGraceEndsAt,
  };
}
```

`group.subscriptions` is the back-relation added in P34F-01. **Never** select
`providerCustomerId` / `providerSubscriptionId` — they must not reach the client.

### UI — billing strip on `/settings/teams` (all roles)

Render a compact strip from the summary:

| State | Copy | Color |
|---|---|---|
| Active | `Run by {ownerName} · Teams · {seatsUsed} of {seatsLimit} seats · renews {renewsAt}` | ink |
| Cancel pending | `… · ends {renewsAt}` | amber |
| Grace (`graceState: "grace"`) | `Plan ending {graceEndsAt}` | amber |
| Locked (`graceState: "locked"`) | `Read-only — plan ended` | red |

- Managers (P34F-04) get the "Manage billing" button beneath the strip.
- Non-managers get only the strip.
- Format dates with the app's existing date helper; respect the user's `weekStart`/date
  prefs if a shared formatter exists (Phase 34B).

## Acceptance Criteria

- Every ACCEPTED member sees the read-only billing summary on `/settings/teams`.
- Seat usage reflects ACCEPTED member count vs `memberSlotsLimit`.
- Renewal / cancel-pending / grace / locked states render with correct copy and color.
- No Stripe identifiers appear in the server response or client payload.
- Members without billing permission see the summary but no management controls.
- The selector returns `null` gracefully for a group with no subscription (pre-
  migration) and the UI shows a neutral "Plan details unavailable" rather than erroring.

## Risks and Open Questions

- **Pending members and seats.** Stripe quantity may already bill for pending invites.
  Decide whether the strip shows ACCEPTED only (recommended) and notes pending
  separately when near the limit.
- **Stale `currentPeriodEnd`.** Driven by webhooks; a missed webhook lags the date.
  Acceptable for a read-only strip; managers can refresh via the portal.
- **Pre-migration groups.** Until P34F-03 runs, a team may have its subscription still
  user-anchored, so `group.subscriptions` is empty. The null-safe path above covers it;
  confirm copy with the migration rollout plan.
