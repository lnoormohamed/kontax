# P34F-03 — Migration: Re-anchor Existing Teams to the Org

## Purpose

Move every existing Teams subscription from the owner's user record onto the Group.
After P34F-01 (schema) and P34F-02 (webhook routing) land, existing teams still have
their `SubscriptionCustomer` / `Subscription` anchored to `userId`. This one-time,
idempotent, dry-runnable migration re-anchors them to `groupId` and stamps the Stripe
customer with `metadata.kontaxGroupId`.

## Background

This is the sharp edge of P34F. A half-applied migration could double-bill or drop
webhook routing for a live, paying team. The migration must be safe to abort and
re-run, and must leave enough trail to reason about partial state.

## Scope

**In scope:**
- A script that, for each `GroupType.TEAM` with an owner holding a Teams subscription:
  1. Stamps the Stripe customer with `metadata.kontaxGroupId`.
  2. Re-points the `SubscriptionCustomer` and `Subscription` rows to `groupId`.
  3. Sets `Group.subscriptionId` to the migrated subscription.
- `--dry-run` (default) and `--apply` modes.
- Idempotency: already-migrated groups are skipped.
- A verification pass that asserts post-conditions.

**Out of scope:**
- Dropping the legacy `userId` column (kept readable this phase).
- Personal plans (never migrated).
- Changing entitlement logic (P34F-02 owns that).

## Design / Implementation Spec

### Script

`scripts/migrate-teams-billing-to-org.mjs` (mirrors the style of
`scripts/migrate-default-address-books.mjs`, idempotent + re-runnable).

```
node scripts/migrate-teams-billing-to-org.mjs            # dry-run, prints plan
node scripts/migrate-teams-billing-to-org.mjs --apply    # executes
```

### Per-team algorithm

```
for each group where type = TEAM:
  if group.billingCustomer exists (groupId already set): SKIP (idempotent)
  owner = group.owner
  cust  = SubscriptionCustomer where userId = owner.id  (Teams customer)
  sub   = active/most-recent Teams Subscription for that customer
  if no Teams subscription for owner: WARN + SKIP (e.g. grace-locked, expired)

  PLAN (dry-run prints):
    - Stripe: set customer.metadata.kontaxGroupId = group.id (remove kontaxUserId)
    - DB: SubscriptionCustomer.update → set groupId, null userId
    - DB: Subscription.update        → set groupId, null userId
    - DB: Group.update               → subscriptionId = sub.id

  APPLY (single DB transaction per group; Stripe write first, then DB):
    1. Stripe API: customers.update(cust.providerCustomerId, { metadata })
    2. tx: update the three rows above
    3. verify (see below)
```

Ordering: do the Stripe metadata write **before** the DB re-point, so if the DB
transaction fails the customer still resolves (P34F-02 resolver branches on the DB
`groupId`, which is unchanged on failure → still user-anchored → still works). If the
Stripe write fails, abort that group and continue; nothing changed.

### Owner with a personal plan too

If the owner also has a non-Teams `SubscriptionCustomer`/`Subscription` (PRO/FAMILY),
that customer is a **separate Stripe Customer** and stays `userId`-anchored. The
migration only touches the Teams customer/subscription. Select the Teams customer by
the subscription's plan, not by user, to avoid moving the wrong one.

### Verification pass

`--verify` (also run automatically after `--apply` per group):
- `Group.billingCustomer.groupId === group.id`
- The migrated `Subscription.groupId === group.id` and `userId === null`
- Stripe customer metadata has `kontaxGroupId === group.id`
- Exactly one billing customer per migrated group
- Owner's personal plan (if any) is untouched

### Rollback

Because the legacy `userId` is only nulled (not dropped) and we keep a log of
`{ groupId, customerId, previousUserId }`, a reverse script can re-point back if a
team is found broken. Write the migration log to `scripts/out/teams-billing-migration-<ts>.json`.

## Acceptance Criteria

- Dry-run prints a complete, per-team plan and writes nothing.
- `--apply` re-anchors every eligible team; re-running is a no-op (idempotent).
- A team mid-migration (Stripe stamped, DB not yet) still bills and routes webhooks
  correctly (still resolves user-anchored until DB flips).
- Owner personal plans are never moved.
- Verification pass reports zero failures on a fully migrated dataset.
- Migration log written for audit/rollback.
- Run on staging against seeded teams before production (coordinate with
  `project_stripe-smoke-test-deferred`).

## Risks and Open Questions

- **Live billing.** This touches paying customers. Run on staging with Stripe test
  mode first; on production, run during low traffic and watch webhook delivery.
- **Grace-locked / expired teams.** A team whose owner downgraded may have no active
  Teams subscription. Decide: migrate the lapsed subscription too (so re-upgrade
  re-anchors cleanly) or skip and let re-upgrade create a fresh org customer.
  Recommend: migrate if a Subscription row exists at all, regardless of status.
- **Webhook in-flight during flip.** A webhook arriving mid-transaction resolves by
  DB `groupId` — consistent either side of the transaction commit. Confirm the
  transaction is short.
- **Stripe rate limits.** Batch with a small delay if there are many teams.
