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

## Implementation notes (2026-09-25)
- Processing lives in `src/server/stripe-webhook.ts` (`processStripeWebhookEvent`); the route only
  verifies the signature. Only `error IS NULL` rows are skipped; the success marker is written in
  the processing transaction (P2002 / already-cleared error → re-read → `skipped`).
- Ordering uses **no schema change**: subscription and invoice events apply the subscription as
  re-fetched from Stripe (`subscriptions.retrieve`), never the payload. Downgrade clean-up compares
  the user's *effective* plan (same query as `getUserBillingContext`) before/after, so a lapse on
  the same price (paused / incomplete_expired / canceled) runs it, and a late event for a
  superseded subscription does not.
- Family lapse: members get `snapshotFamilyBookForUser` copies and are removed; pending invites
  withdrawn; group + book stay with the owner. (Fable review) This runs post-commit, one
  transaction per member (`reconcileFamilyLapseForCustomer`), state-driven: after every
  personal subscription/invoice event, if the owner is below Family but still owns a FAMILY
  group with members, the remaining members are processed. A failure flags the event row with
  an error and returns 500, so Stripe's retry re-runs it; members already removed are skipped. Deviations from lifecycle-policies §3a: no 7-day
  advance notice (in-app notice at dissolution) and the book is not archived.
- Webhooks never change a `LOCKED` lifecycle. Emails/notifications run only after commit.
- `graceEndsAt`: stamped once on entering PAST_DUE (retries no longer extend it), cleared on any
  non-PAST_DUE state; read by `billing-surface.ts` (settings + banner). Not enforced on
  entitlements by design (policy §2a–2d: features stay on through Stripe dunning; the lapse is
  Stripe's final `canceled`/`paused`). Open decision: Stripe `unpaid` still maps to PAST_DUE, so
  a dunning config of "mark unpaid" would keep paid entitlements — set Stripe to cancel, or map it.
- Admin reprocess (step 4) not built: there is no admin page listing webhook events yet.
  `processStripeWebhookEvent(await stripe.events.retrieve(id), { db, stripe })` is the hook for it.
