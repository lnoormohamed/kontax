# P49A-05 — Stripe webhook retries and billing lifecycle

**Phase:** 49A · **Priority:** P0 · **Depends on:** — · **Effort:** S (webhook) + M (lifecycle)
**Audit IDs:** A-09 (high, verified), A-24

## Objective
Every Stripe event is eventually applied exactly once, in order, and every plan transition leaves
entitlements consistent.

## Production verification (2026-09-25)
- Stripe is live in prod (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, all six price ids set).
- **A-09 confirmed** in origin/main `api/stripe/webhook/route.ts:69-91`: the idempotency check
  returns `skipped` for *any* existing `StripeWebhookEvent` row, and the failure path upserts a row
  with `error` set before returning 500 — so Stripe's retry is skipped forever.
- Prod data: 0 webhook events, 0 subscriptions, 1 Stripe customer — no customer affected yet.

## Steps
1. Skip only rows where `error IS NULL`; on reprocess success clear `error`. Handle the
   unique-index race (two concurrent deliveries) by catching P2002 and re-reading.
2. Ordering: store the Stripe object's `created`/event time on the subscription and ignore events
   older than the last applied one (A-24).
3. Lifecycle gaps (A-24): apply downgrade clean-up on Family lapse and on `paused` /
   `incomplete_expired`; prevent a second first-time Pro trial; never flip an admin-`LOCKED`
   account back to active from a webhook; read `graceEndsAt` where grace is shown/enforced.
4. Admin panel: list errored webhook events with a "reprocess" action.

## Acceptance
- Test: first delivery throws → row with error; second delivery reprocesses and succeeds.
- Test: `customer.subscription.updated` older than the stored state is ignored.
- Test matrix for Pro→Free, Family lapse, Teams lapse, paused, incomplete_expired.
- Staging with Stripe test clock: a forced DB error during checkout still ends with the plan
  granted after Stripe's retry.
