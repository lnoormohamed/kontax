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
- Family lapse (7-day notice, owner decision 2026-09-25): a lapse no longer dissolves at once.
  Post-commit, state-driven (`reconcileFamilyLapseForCustomer`, after every personal
  subscription/invoice event and the billing-return sync): if the owner is below Family and
  still owns a FAMILY group with other members, `Group.familyDissolveAt` (migration
  `20260925120000_family_dissolve_at`, nullable, additive) is stamped now + 7 days with a
  conditional update, and accepted members get an in-app + email notice once. Members keep
  access meanwhile (family access is membership-based — web and CardDAV never read the owner's
  plan); invites, resends and invite acceptance are blocked (`family-lifecycle.ts`). A
  re-subscribe (Family or Teams) clears the date and tells members the group continues.
- Dissolution, once the date has passed and the owner is still below Family: members get
  `snapshotFamilyBookForUser` copies and are removed, pending invites withdrawn, group + book
  stay with the owner, the date is cleared. One transaction per member that re-checks plan +
  date, snapshots, then claims the row by delete (rolled back if already removed). Runs from
  the nightly `/api/cron/delete-accounts` (`sweepDueFamilyDissolutions`, no new crontab entry)
  and opportunistically from the owner's next webhook; a webhook failure flags the event row
  and returns 500 so Stripe retries, a sweep failure is reported and retried next night.
- Scheduled cancellation (`cancelAtPeriodEnd` false→true on an active Family subscription):
  accepted members are notified with the period-end date and an export link; a flip back sends
  "your family plan will continue". The flip is claimed with a conditional update inside the
  webhook transaction, so retries, replays and the billing-return sync notify once.
- Remaining deviation from lifecycle-policies §3a: the shared book is not archived (it is the
  owner's only view of those contacts).
- Webhooks never change a `LOCKED` lifecycle. Emails/notifications run only after commit.
- `graceEndsAt`: stamped once on entering PAST_DUE (retries no longer extend it), cleared on any
  non-PAST_DUE state; read by `billing-surface.ts` (settings + banner). Not enforced on
  entitlements by design (policy §2a–2d: features stay on through Stripe dunning; the lapse is
  Stripe's final `canceled`/`paused`). Open decision: Stripe `unpaid` still maps to PAST_DUE, so
  a dunning config of "mark unpaid" would keep paid entitlements — set Stripe to cancel, or map it.
- Admin reprocess (step 4) not built: there is no admin page listing webhook events yet.
  `processStripeWebhookEvent(await stripe.events.retrieve(id), { db, stripe })` is the hook for it.
