# P49A-07 — Admin plan override without poisoning Stripe; admin hardening

**Phase:** 49A · **Priority:** P0 · **Depends on:** P49A-05 · **Effort:** M
**Audit IDs:** A-11 (medium→P0 for billing impact), A-27, admin P2 items

## Objective
Admins can grant or revoke a plan without breaking the customer's own billing, and admin
actions fully cut off access where they intend to.

## Production verification (2026-09-25)
- **A-11 confirmed** in origin/main: `actions/admin.ts` upserts
  `SubscriptionCustomer.providerCustomerId = \`admin-override-${target.id}\``, while
  `stripe-customers.ts:5` treats only `manual_` as a placeholder — so checkout/portal send
  `admin-override-…` to Stripe (error) and `syncStripeBillingState` lists subscriptions for it.
  Prod has 0 override rows today (1 real `cus_` customer).
- A-27 confirmed by the security audit: admin "schedule deletion" (`admin.ts:213`) does not call
  `invalidateDavCredentialCacheForUser` (the lock path at `:141` does) → devices keep DAV access up
  to 10 min.

## Steps
1. Store overrides on `User` (`planOverride`, `planOverrideExpiresAt`, `planOverrideReason`) and
   merge them in `getUserBillingContext`; never touch `SubscriptionCustomer`. Migrate any
   `admin-override-%` rows (none in prod) and treat that prefix as a placeholder meanwhile.
2. Override must not mask a real paid subscription: effective plan = max(paid, override) unless
   the override is an explicit "suspend".
3. Add `invalidateDavCredentialCacheForUser` to schedule-deletion.
4. Admin hardening (P2 set): pass capabilities into `searchAdminEntities` and drop audit results
   without `audit.view`; gate `/admin/metrics` on `sync.view`; neutralise `= + - @ \t \r` in the
   audit CSV export; cap broadcast title/body length.

## Acceptance
- Test: override FREE→PRO then user starts Checkout → a real Stripe customer is created.
- Test: overriding a paying PRO user does not reduce their entitlements.
- Test: after schedule-deletion, a cached DAV credential is rejected immediately.
- Test: SUPPORT_OPS admin search returns no audit rows; CSV cell `-2+2` is exported as `'-2+2`.
