# P34F-09 — Smoke Test: Org Billing, Transfer & Family Copy

## Purpose

End-to-end verification on staging that org-anchored billing, permission-gated billing
access, owner transfer, and family copy-on-leave work together — including migrating a
pre-existing team. This is the gate before P34F ships to production. Depends on
P34F-01..06 (billing) and P34F-07 (family path).

## Background

P34F touches money and webhooks. The repo has no automated test framework
(`project_p27-google-sync-oauth`), so this is a scripted manual pass on staging with
Stripe **test mode**, mirroring prior smoke-test docs. The deploy target runs
`prisma db push` on startup and schema drift crash-loops the site
(`project_email-ses-deployment`) — verify the P34F schema is pushed cleanly on staging
first. Coordinate with `project_stripe-smoke-test-deferred`.

## Preconditions

- Staging app deployed with P34F-01..08 merged; `prisma db push` applied clean; CHECK
  constraints (P34F-01) present.
- Stripe test-mode product/price IDs configured; webhook endpoint points at staging
  with the correct signing secret.
- Seed data: (a) a Teams team still `userId`-anchored (pre-migration shape), (b) an
  owner holding **both** PRO and TEAMS, (c) a grace-locked team, (d) a Family group with
  shared contacts and ≥2 members.

## Test Plan

### A. Migration (P34F-03)

1. `npm run migrate:teams-billing` (dry-run) → review printed plan; nothing written.
2. `npm run migrate:teams-billing:apply` → verify per team: `SubscriptionCustomer.groupId`
   set + `userId` null; `Subscription.groupId` set + `userId` null; Stripe customer
   `metadata.kontaxGroupId` present; `Group.subscriptionId` set.
3. Re-run `--apply` → no-op (idempotent skip).
4. Owner with PRO+TEAMS: only the TEAMS sub moved; PRO untouched (or flagged if shared
   customer — confirm the edge case handling).
5. Grace-locked team: migrated (per DB01 Q4) and verification passes.
6. Migration log written to `scripts/out/`.

### B. Group billing webhooks (P34F-02)

7. Change seat quantity in Stripe test → `customer.subscription.updated` →
   `memberSlotsLimit` updates on the **group** subscription, not the owner user.
8. Downgrade Teams → grace starts on the **group** (by `groupId`); confirm
   `Group.teamsGraceEndsAt` set, owner user's personal plan unaffected.
9. Re-upgrade Teams → `Group.teamsEnabled = true`, `teamsGraceEndsAt` cleared.
10. Personal PRO/FAMILY checkout + payment-fail/succeed webhooks → still update the
    **user** (regression).

### C. Billing-manager access (P34F-04)

11. As owner, toggle `canManageBilling` on a non-admin member.
12. As that member → `openTeamBillingPortal` opens the Stripe portal for the team's
    customer; can change plan/seats.
13. As a member without the flag → portal/controls hidden; the action throws.
14. Attempt to toggle the owner's flag off → blocked ("always has billing access").

### D. Owner transfer (P34F-05)

15. As owner, "Make owner" on an admin → atomic: new owner = OWNER + `canManageBilling`,
    old owner = ADMIN, `Group.ownerId` updated; **no Stripe API call** (verify via Stripe
    request logs — none for this action).
16. New owner can manage billing; old owner now limited to admin powers.
17. On a **not-yet-migrated** team → transfer button disabled / action fails closed
    with the migration message.
18. Non-owner attempts transfer → denied.

### E. Member visibility (P34F-06)

19. As an ordinary member → read-only billing strip shows owner, plan, seats used/limit,
    renewal date.
20. Inspect the network payload → no `providerCustomerId` / `providerSubscriptionId`
    present.
21. Cancel-pending and grace states render with correct copy/color.

### F. Family copy-on-leave (P34F-07)

22. Member with shared family contacts leaves → a personal `AddressBook` (named after
    the group, `sourceGroupBookId` set) appears with copies of all shared contacts;
    field fidelity matches the original.
23. Member with a pre-existing book of the same slug leaves → slug suffixed
    (`-2`), no unique violation.
24. Owner attempts to leave → blocked (must transfer/dissolve).
25. **Team** member leaves (`leaveTeam`) → **no** copy created; private contacts intact.
26. Family cancel modal copy → reflects "each member keeps a copy" (P34F-08).

## Acceptance Criteria

- All steps A–F pass; results recorded in a smoke-test results doc under
  `roadmap/runbooks/` (mirror prior smoke-test docs, e.g. the format referenced by
  `project_db-and-verification-workflow`).
- No double-billing or missed webhook routing observed during/after migration.
- Personal plans demonstrably unaffected throughout (steps 4, 10).
- Owner transfer makes zero Stripe calls (step 15, verified in Stripe request logs).
- No Stripe identifiers leak to the client (step 20).
- Any failure is filed as a follow-up ticket and fixed before production rollout.

## Risks and Open Questions

- **Staging Stripe parity.** Ensure staging uses Stripe test mode with the same
  product/price structure as production.
- **Webhook delivery to staging.** Confirm the Stripe webhook endpoint + signing secret
  target the staging app; otherwise B/C/D events won't arrive.
- **Schema drift on deploy.** `prisma db push` runs on startup — a drift crash-loops the
  site (`project_email-ses-deployment`). Verify the push is clean on staging before
  running the plan.
- **No automated regression.** Until a test framework exists, re-run this pass manually
  after any change to `stripe-handlers.ts`, `billing.ts`, or the billing schema.
- **Production execution** is a separate go-live step (run the migration during low
  traffic, watch webhook delivery + the verification summary).
