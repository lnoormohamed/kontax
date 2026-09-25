# P49A-06 — Entitlements: Teams personal limits, contact cap everywhere, team lock

**Phase:** 49A · **Priority:** P0 · **Depends on:** — · **Effort:** M
**Audit IDs:** A-10 (high, verified), A-25, A-26, SEC-6

## Objective
Every paying tier gets what it pays for, and the Free cap and team lapse lock hold on every write
path — web, API, CardDAV and inbound sync.

## Production verification (2026-09-25)
- **A-10 confirmed** in origin/main: Teams subscriptions are created with `groupId` and
  `userId = null` (`stripe-handlers.ts:~300`; schema comment "userId is null for Teams"), while
  `getUserBillingContext` (`billing.ts:222-262`) reads only `user.subscriptions`. Teams owners and
  members therefore resolve to FREE personal entitlements (500 contacts, no API, 1 sync
  account). Teams prices are configured in prod; no Teams subscriptions exist yet.
- **A-25 confirmed:** `server.mjs` (the DAV server) contains no `contactsLimit`/`assertCanCreate`
  reference; `sync-import-engine.ts` create branch has no cap check; `createContact` skips the cap
  for family/team book targets (`actions/contacts.ts:614-618`).
- **A-26 confirmed:** `requireTeamNotLocked` looks up `group.findFirst({ ownerId: userId })`
  (`teams.ts:98-103`) — for a team ADMIN it finds nothing and returns, so admins bypass the lock;
  `getTeamBookAccess` in `server.mjs:1198` ignores grace/lock entirely.
- Prod: 0 users over 500 contacts, 0 teams.

## Steps
1. Resolve entitlements as max(personal subscription, active Teams membership → Teams tier), with
   Teams `memberSlotsLimit` from the group. Decide and document: do Family members also inherit
   Family personal limits? (Today Family members are covered via the owner's personal sub only.)
2. Enforce `contactsLimit` inside the create transaction on: DAV PUT (personal/family/team),
   sync import creates, create-into-family/team-book (against the book owner, matching
   `addContactToFamilyBook`). DAV returns 507 with a readable body; sync records a job warning
   and stops creating (never deletes).
3. `requireTeamNotLocked`: resolve the team via `getManageableTeam(userId)`; DAV team access sets
   `canEdit = false` when the team is locked.

## Acceptance
- Tests: Teams member gets API access and unlimited contacts; Free user's DAV PUT #501 → 507;
  Google import of 600 on Free creates 500 and flags the job; team admin blocked after grace;
  DAV write to a locked team book → 403.

## Implementation notes (2026-09-25)
- **Shared rules module.** The plan matrix (`PLAN_DEFAULTS`), effective-plan resolution, the
  contact-cap check and the team-lock rule now live in `src/server/dav/plan-entitlements.mjs`
  (plain ESM + JSDoc). `billing.ts` wraps/re-exports it; `server.mjs` imports it directly. It sits
  under `src/server/dav/` because that is the only `src/` directory the Dockerfile ships next to
  `server.mjs`. One matrix, no duplicate.
- **A-10.** Effective plan = max rank (FREE < PRO < FAMILY < TEAMS) of every ACTIVE / TRIALING /
  PAST_DUE personal subscription and a live Teams membership (accepted member of a TEAM group with
  `teamsEnabled`, or `teamsGraceEndsAt` in the future; pending never-paid teams grant nothing).
  Multiple personal rows (paid + admin comp, P49A-07) resolve to the higher, independent of period
  end. Teams `memberSlotsLimit` comes from the org's active Teams subscription, else the group.
  `BillingContext` gains `personalPlan`, `planSource`, `teamEntitlement`; `canRunOwnTeam()`.
  Call sites that meant "the user's own Teams plan" (team creation, upgrade onboarding, the
  welcome page, the owned-team grace display) now read `personalPlan` / `canRunOwnTeam`, so a
  member can't create a team off someone else's plan and the grace banner still shows. TEAMS has
  no family group, so a Family payer who also gets Teams keeps `familyGroupEnabled`.
- **Family members (decision).** Family members do **not** inherit the owner's Family personal
  limits; they keep their own plan. Shared-book contacts are owned by (and capped against) the
  owner, whose Family plan is unlimited. Unchanged from before; revisit only if pricing promises
  per-member Pro limits for Family.
- **A-25.** Cap enforced inside the inserting transaction (owner's `User` row locked first) on:
  DAV PUT create — personal, family, team (`507` + readable text); Google/Microsoft import engine
  (stops at the cap, `capSkipped`, job PARTIAL + `CONTACT_LIMIT_REACHED`, nothing deleted);
  CardDAV client runner create branch (creates only what fits; same job flag); `createContact`
  into a family/team book (checked against the book owner). The cap counts every Contact row the
  owner has, exactly like `getUserPlanSummary`.
- **A-26.** `requireTeamNotLocked` resolves the caller's manageable team (owner **or admin**);
  `isTeamLocked` = not `teamsEnabled`, grace date passed, and no legacy personal Teams sub on the
  owner. DAV `getTeamBookAccess` folds the lock into `canEdit` (PUT/DELETE → 403);
  `canEditTeamBook` (web create/add into team book) also honours it.
- **Found in passing, fixed:** `createContact` into any family/team book always failed — it
  emitted `CONTACT_CREATED` with a `{ sharedBook }` payload, which the strict-empty schema rejects
  (ZodError → rollback). The label now rides on `actorDetail`.
- **Follow-ups.** (1) Google/Microsoft: contacts skipped at the cap are only re-offered when they
  change remotely or on a full re-import (the incremental cursor advances); consider clearing
  `lastSyncCursor` when a capped user upgrades. CardDAV client sync re-offers them every run.
  (2) Billing page / surface for a Teams *member* (plan shows "Teams" with no personal
  subscription) — check on staging that no personal manage/cancel CTA is offered.
