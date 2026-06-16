# P34F-03 — Migration: Re-anchor Existing Teams to the Org

## Purpose

Move every existing Teams subscription from the owner's user record onto the Group.
After P34F-01 (schema) and P34F-02 (routing) land, existing teams still have their
`SubscriptionCustomer` / `Subscription` anchored to `userId`. This one-time,
idempotent, dry-runnable, reversible migration re-anchors them to `groupId` and stamps
the Stripe customer with `metadata.kontaxGroupId`.

## Background

This is the sharp edge of P34F: it touches live, paying customers. A half-applied
migration could double-bill or drop webhook routing. The migration must be safe to
abort and re-run, and must leave a trail to reason about partial state. The repo uses
plain Node scripts for data migrations — mirror `scripts/migrate-default-address-books.mjs`
(idempotent, re-runnable; see `roadmap/build-phase/p18-11-personal-address-books.md:115`).

Relevant existing shapes:
- `SubscriptionCustomer` keyed by `userId` (`prisma/schema.prisma:452`), now also
  `groupId` (P34F-01).
- `Subscription` with `userId`/`groupId` (P34F-01), `plan`, `status`,
  `providerSubscriptionId`.
- `Group.subscriptionId` forward pointer (`:962`).
- Stripe customer metadata `{ kontaxUserId }` set by `ensureStripeCustomer`.

## Scope

**In scope:**
- `scripts/migrate-teams-billing-to-org.mjs` with `--dry-run` (default) and `--apply`.
- Per-team: stamp Stripe metadata, re-point customer + subscription to `groupId`, set
  `Group.subscriptionId`.
- Idempotency (skip already-migrated), verification pass, migration log for rollback.
- `scripts/rollback-teams-billing-to-org.mjs` reverse script (reads the log).
- `package.json` script entries.

**Out of scope:**
- Dropping the legacy `userId` column (kept readable this phase).
- Personal plans (never migrated).
- Entitlement logic (P34F-02 owns that).

## Design / Implementation Spec

### CLI

```
node scripts/migrate-teams-billing-to-org.mjs            # dry-run, prints plan, writes nothing
node scripts/migrate-teams-billing-to-org.mjs --apply    # executes
node scripts/migrate-teams-billing-to-org.mjs --verify   # post-conditions only
```

`package.json`:
```json
"migrate:teams-billing": "node scripts/migrate-teams-billing-to-org.mjs",
"migrate:teams-billing:apply": "node scripts/migrate-teams-billing-to-org.mjs --apply"
```

### Per-team algorithm

```
teams = group.findMany({ where: { type: "TEAM" }, include: { owner, billingCustomer } })

for team of teams:
  if team.billingCustomer (groupId already set):  SKIP "already migrated"

  ownerCustomer = subscriptionCustomer.findUnique({ where: { userId: team.ownerId } })
  if !ownerCustomer:                              SKIP "owner has no Stripe customer"

  // Pick the TEAMS subscription specifically — owner may also hold PRO/FAMILY.
  teamSub = subscription.findFirst({
    where: { subscriptionCustomerId: ownerCustomer.id, plan: "TEAMS" },
    orderBy: [{ status: "asc" }, { currentPeriodEnd: "desc" }],
  })
  if !teamSub:                                    WARN + SKIP "no TEAMS subscription"
  // (DB01 Q4: also migrate CANCELED/grace teamSub so re-upgrade re-anchors cleanly)

  PLAN:
    stripe.customers.update(ownerCustomer.providerCustomerId,
        { metadata: { kontaxGroupId: team.id, kontaxUserId: "" } })   // clear user key
    subscriptionCustomer.update(ownerCustomer.id → { groupId: team.id, userId: null })
    subscription.update(teamSub.id → { groupId: team.id, userId: null })
    group.update(team.id → { subscriptionId: teamSub.id })

  APPLY:
    1. Stripe write FIRST (metadata).                       // failure → abort this team, nothing in DB changed
    2. db.$transaction(re-point customer, subscription, group)   // failure → Stripe stamped but DB user-anchored → still works
    3. append { groupId, customerId, subscriptionId, previousUserId } to the log
    4. verify this team (below)
```

**Ordering rationale.** Stripe metadata is informational; the DB `groupId` is what
P34F-02's `resolveBillingOwner` branches on. Writing Stripe first means a failed DB
transaction leaves the row user-anchored → resolver returns `kind: "user"` → billing
keeps working. The only inconsistency window is "Stripe says group, DB says user,"
which is benign because the DB is authoritative.

**Owner with a personal plan.** The personal `SubscriptionCustomer`/`Subscription`
(PRO/FAMILY) is a *separate Stripe Customer* and is never selected — `teamSub` is
filtered by `plan: "TEAMS"`. Confirm by asserting `teamSub.subscriptionCustomerId ===
ownerCustomer.id` and that no other customer row shares the providerCustomerId.

> ⚠️ Edge case: if a team owner's TEAMS and PRO subscriptions share **one** Stripe
> customer (same `providerCustomerId`), moving the customer to the group would drag the
> personal plan along. Detect this (two active subs of different plans on one customer)
> and flag for manual handling rather than auto-migrating. Confirm in DB01 whether the
> product ever co-locates plans on one customer (today `ensureStripeCustomer` makes one
> customer per user, so a user *could* have both plans on it — this must be checked).

### Migration log

Write to `scripts/out/teams-billing-migration-<ISO timestamp>.json`:
```json
[{ "groupId": "...", "customerId": "cus_...", "subscriptionId": "...", "previousUserId": "..." }]
```
The reverse script reads the latest log and re-points `groupId → previousUserId`,
re-stamps Stripe metadata `{ kontaxUserId }`, and clears `Group.subscriptionId` if it
was set by the migration.

### Verification pass (`--verify`, also auto-run per team after `--apply`)

For each migrated team assert:
- `group.billingCustomer.groupId === group.id` and its `userId === null`
- `teamSub.groupId === group.id` and `teamSub.userId === null`
- Stripe customer `metadata.kontaxGroupId === group.id`
- exactly one billing customer for the group
- the owner's **personal** plan (if any) still resolves user-anchored and untouched

Print a summary: `{ migrated, skipped, warned, failed }`.

## Acceptance Criteria

- Dry-run prints a complete per-team plan and writes nothing (no DB, no Stripe).
- `--apply` re-anchors every eligible team; re-running is a no-op (idempotent skip).
- A team interrupted between the Stripe write and the DB transaction still bills and
  routes webhooks correctly (resolves user-anchored until the DB flips).
- Owner personal plans are never moved; the shared-customer edge case is detected and
  flagged, not auto-migrated.
- `--verify` reports zero failures on a fully migrated dataset.
- Migration log written; the rollback script restores a team from the log.
- Executed on staging against seeded teams (incl. one owner with PRO+TEAMS, one
  grace-locked team) before production. Coordinate with
  `project_stripe-smoke-test-deferred`.

## Risks and Open Questions

- **Live billing.** Run on staging with Stripe **test mode** first; on production run
  during low traffic and watch webhook delivery + the verification summary.
- **Shared Stripe customer for two plans.** See the edge case above — must be resolved
  in DB01 before `--apply` touches production. If it can happen, those teams are
  hand-migrated (split into two Stripe customers) outside this script.
- **Grace-locked / expired teams (DB01 Q4).** Recommended: migrate if any `plan:
  "TEAMS"` Subscription row exists regardless of status, so re-upgrade re-anchors. The
  script's `teamSub` query already includes non-active statuses.
- **Webhook in-flight during the flip.** A webhook mid-transaction resolves by DB
  `groupId`, consistent on either side of commit. Keep the transaction short (3 row
  updates, no external calls inside it — the Stripe call happens before).
- **Stripe rate limits.** Batch with a small delay (e.g. 100ms) between teams if there
  are many.
- **`kontaxUserId: ""` clearing.** Stripe metadata keys are cleared by setting `""`.
  Verify this removes the key rather than storing an empty string that confuses later
  reads; if needed, read-modify-write the metadata object.
