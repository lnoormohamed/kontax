# P34F-09 — Org-Billing Smoke Test

End-to-end verification of P34F (org-anchored Teams billing, owner transfer, member
visibility, family copy-on-leave). Some steps need Stripe **test mode** + a staging
webhook endpoint; those are marked **STAGING**. Steps that need no Stripe were run
locally and their results are recorded here.

Demo logins (local dev DB): `demo1234`. Team member `tunde@orbit.health`; family
members `chidi@okafor.health`, `ngozi@family.example`; owners `li@linoormohamed.com`,
`verify@kontax.dev`.

## Local results (no Stripe required)

| # | Step | Result |
|---|------|--------|
| A | Migration dry-run (`npm run migrate:teams-billing`) | ✅ PASS — 4 teams: 2 migratable (active TEAMS subs → `teamsEnabled→true`), 2 warned+skipped (owner has no TEAMS sub). Writes nothing. |
| E | Member billing visibility | ✅ PASS — logged in as `tunde@orbit.health`, `/settings/teams` member view shows read-only "Plan · TEAMS · 2 seats", no Manage-billing button (not a billing manager), no Stripe IDs in payload. |
| F | Family copy-on-leave | ✅ PASS — as `chidi@okafor.health`, left "Okafor Family" via the UI confirm dialog. New personal `AddressBook` "Okafor Family" (slug `okafor-family`, `isDefault=false`, `sourceGroupBookId` = group book) created with **3 copied contacts**; family memberships 2→1; shared book untouched for others. |
| — | Login (auth sanity) | ✅ PASS — fresh login (`tunde`, `chidi`) establishes session + redirects; sign-out clears session; **wrong password rejected** (no session). Earlier flakiness was a transient LAN/DB outage, not code. |
| — | Settings copy (P34F-08) | ✅ PASS — family leave card + confirm show "You keep a private copy…"; confirm dialog: "A private copy of the family contacts will be saved to your account. Other members keep the shared book." |

**Note:** step F mutated demo data (removed `chidi` from one of two duplicate
"Okafor Family" groups). Re-run `npm run seed:demo` to restore if needed.

## Code-verified, not yet runtime-exercised

| # | Step | Status |
|---|------|--------|
| C | Billing-manager toggle (`setBillingManager`) | Pure DB action, tsc-clean; owner always-on guard in place. Exercise on staging or any team with members. |
| D | Owner transfer (`transferTeamOwnership`) | tsc-clean; **fails closed** when the team has no group billing customer (pre-migration) — so the happy path needs a migrated team (STAGING). Fail-closed guard verified by code review. |

## STAGING checklist (Stripe test mode + staging webhook endpoint)

Preconditions: P34F-01..08 deployed; `prisma db push` applied clean; CHECK
constraints applied (`scripts/sql/p34f-billing-owner-checks.sql`); Stripe test-mode
price IDs configured; webhook endpoint → staging with the correct signing secret.

### A2 — Migration apply
1. `STRIPE_SECRET_KEY=… node scripts/migrate-teams-billing-to-org.mjs --apply`
2. Verify per team: `SubscriptionCustomer.groupId` set + `userId` null; `Subscription.groupId`
   set + `userId` null; Stripe customer `metadata.kontaxGroupId` present; `Group.subscriptionId`
   set; `Group.teamsEnabled=true` for active teams.
3. Re-run `--apply` → no-op (idempotent). `--verify` → zero failures.
4. Owner with PRO+TEAMS on one Stripe customer → flagged + skipped (manual split).

### B — Group billing webhooks
5. New Teams checkout (Option A): "Get Teams" creates a pending group → checkout
   against the **group** customer (`metadata.kontaxGroupId`) → on success `Group.teamsEnabled=true`,
   `/settings/teams` shows the active owner view (not the "completing setup" card).
6. Change seat quantity in Stripe → `memberSlotsLimit` updates on the **group** sub.
7. Downgrade → grace starts on the Group by `groupId` (owner's personal plan unaffected);
   re-upgrade clears it.
8. Personal PRO/FAMILY checkout + payment-fail/succeed → still update the **user** (regression).

### C — Billing-manager access
9. Owner toggles `canManageBilling` on a non-admin member → that member can open the
   Stripe portal for the team customer and change plan/seats.
10. Member without the flag → portal/controls hidden; action throws. Owner toggle locked "Always".

### D — Owner transfer
11. Owner "Make owner" on an admin → atomic: new owner = OWNER + billing access, old
    owner = ADMIN, `Group.ownerId` updated, **zero Stripe API calls** (check Stripe logs).
12. Un-migrated team → transfer fails closed with the migration message.
13. Non-owner attempts transfer → denied.

### Post-migration cleanup (after A2 succeeds in prod)
- Drop the §08 owner-entitlement fallback in `team-access.ts` / `teams/page.tsx` /
  `welcome/[plan]/page.tsx` (now that `Group.teamsEnabled` is populated).
- Remove the legacy `createTeam` form on `/settings/teams` (teams now created via checkout).
