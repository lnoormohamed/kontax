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
