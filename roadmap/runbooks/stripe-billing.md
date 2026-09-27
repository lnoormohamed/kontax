# Runbook: Stripe & billing

**Subsystem:** Stripe webhooks, subscription state machine, payment recovery  
**Audience:** Engineers handling billing issues or Stripe incidents

---

## Overview

Billing is driven entirely by Stripe webhooks hitting `POST /api/stripe/webhook`. The app never polls Stripe — all state changes come through that endpoint. The webhook handler verifies the Stripe signature, wraps everything in a DB transaction, and calls the appropriate handler in `src/server/stripe-handlers.ts`.

---

## Normal state

- `User.lifecycleState` = `ACTIVE` for all paying and free users.
- `Subscription.status` = `ACTIVE` or `TRIALING` for paying users.
- Free users have no `Subscription` row (or one with `plan=FREE, status=CANCELED`).
- Webhook endpoint returns HTTP 200 to Stripe within 10 seconds.

---

## LifecycleState machine

```
              ┌─────────────────────────────────┐
              │                                 │
              ▼                                 │
           ACTIVE ──payment fails──► GRACE ─payment succeeds─►  ACTIVE
              │                        │
              │                        └─ 3 days after the first failure → Free entitlements
              │                           until paid (lifecycleState stays GRACE)
              │
              └─user requests deletion──► LOCKED ──30d cron──► (deleted)
```

| `lifecycleState` | Meaning | Write access |
|------------------|---------|-------------|
| `ACTIVE` | Normal — free, trialing, or paid | Yes |
| `GRACE` | Payment failed, Stripe retrying | Yes — paid plan for 3 days from the first failure, then Free limits until paid (P49A-19) |
| `LOCKED` | User requested account deletion | No (read + export only) |

`LOCKED` is **only** set by the account deletion flow — not by billing. When a subscription is fully cancelled and the user reverts to FREE, `lifecycleState` goes back to `ACTIVE`.

### Failed-payment grace (P49A-19, owner decision 2026-09-27)

- The grace is **enforced**: `Subscription.graceEndsAt` = the failing invoice's first attempt
  (`status_transitions.finalized_at`) + 3 days, stamped by the webhook and only ever moved
  earlier while PAST_DUE (duplicates / retries / out-of-order events can't restart it).
- Past `graceEndsAt`, `subscriptionGrantsPlan` (`src/server/dav/plan-entitlements.mjs`) drops the
  row from the effective plan — web app and CardDAV server alike. The user gets Free limits (or
  an admin comp / Teams membership if they have one). Stripe is not touched; nothing is deleted.
- `invoice.payment_succeeded` / status `active` → `graceEndsAt` cleared, paid plan back at once.
- Downgrade clean-up, the Family 7-day notice and the Teams 14-day window still start only when
  Stripe finally cancels / pauses the subscription.
- Stripe `unpaid` maps to PAST_DUE and lapses the same way, so either dunning end state
  ("cancel" or "mark unpaid") is safe for entitlements.
- Check a user: `SELECT status, "graceEndsAt" FROM "Subscription" WHERE "userId" = …` — PAST_DUE
  with `graceEndsAt` in the past = on Free until paid. Settings → Plan & billing shows
  "Payment failed — your account moved to the Free plan on <date>"; the admin user view shows
  "Pro — payment lapsed, on Free since <date>".
- **Self-heal for a lost recovery webhook:** the nightly `POST /api/cron/delete-accounts` (existing
  crontab entry, no new schedule) also re-reads from Stripe every real subscription that is
  PAST_DUE past `graceEndsAt` (`resyncLapsedPaymentSubscriptions` → `syncStripeSubscriptionById`;
  100 per night, least recently updated first, 250 ms apart). The JSON response has
  `paymentLapseResync: { scanned, synced, errors }`; errors are per subscription and don't stop the
  batch. The billing-portal return (`?portal=returned`) also resyncs at once. To heal one customer
  immediately: resend the latest `invoice.payment_succeeded` / `customer.subscription.updated` from
  the Stripe dashboard.
- **While unpaid:** a new checkout is refused (`USE_CUSTOMER_PORTAL` → billing portal) so the
  customer can't start a second subscription; live shares they receive are paused
  (`RECIPIENT_PAYMENT_LAPSED`), not converted, and resume after payment.

---

## Webhook events handled

| Stripe event | Handler |
|-------------|---------|
| `checkout.session.completed` | `handleCheckoutSessionCompleted` — creates the subscription row |
| `customer.subscription.updated` | `handleSubscriptionUpserted` — updates plan/status |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` — reverts to FREE, `lifecycleState=ACTIVE` |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` — sets `GRACE`, stamps `graceEndsAt`, sends email + in-app notification (in-app only once the grace is over) |
| `invoice.payment_succeeded` | `handleInvoicePaymentSucceeded` — clears `GRACE`, restores `ACTIVE` |
| `customer.subscription.trial_will_end` | `handleTrialWillEnd` — sends trial-ending reminder email |

---

## Downgrade side-effects (automatic)

When a subscription downgrades to FREE:
1. Sync accounts beyond the free limit (1) are **paused** (oldest active is kept).
2. Outbound **live shares** are converted to static copies.
3. Inbound **live shares** are also converted to static.
4. Family/Teams group dissolution is logged as a TODO (handled by Phase 13/14 code).

---

## Failure modes & recovery

### Webhook not received / bouncing

**Check:** Stripe dashboard → Developers → Webhooks → your endpoint → Recent deliveries. Look for failed deliveries.

**Common causes:**
- `STRIPE_WEBHOOK_SECRET` is wrong or stale. Rotate: in the Stripe dashboard create a new signing secret, update the env var in Coolify, redeploy.
- The app returned a non-200. Check Coolify logs for the webhook request.

**Re-deliver:** In Stripe dashboard, open any failed delivery and click Resend. The handler is idempotent — safe to re-deliver.

### User stuck in GRACE after payment recovers

**Symptom:** User says their subscription renewed but they still can't edit contacts.

**Check:**
```sql
SELECT "lifecycleState", plan, status FROM "User" u
JOIN "Subscription" s ON s."userId" = u.id
WHERE u.email = 'user@example.com';
```

**Fix:** If Stripe shows `invoice.payment_succeeded` was delivered and the webhook returned 200, the DB should be correct. If not, re-deliver the event from Stripe. If the event was lost, manually update:
```sql
UPDATE "User" SET "lifecycleState" = 'ACTIVE' WHERE email = 'user@example.com';
UPDATE "Subscription" SET status = 'ACTIVE', "graceEndsAt" = NULL WHERE "userId" = (SELECT id FROM "User" WHERE email = 'user@example.com');
```

### Manual plan override (support case)

Use the admin panel at `/admin` → Users → find user → Override plan. This writes a `Subscription` row directly and bypasses Stripe. Use for comps, internal accounts, or manual corrections. The action is logged in the admin audit log.

### Webhook secret rotation

1. In Stripe dashboard, delete the old webhook signing secret and create a new one.
2. Update `STRIPE_WEBHOOK_SECRET` in Coolify environment variables.
3. Redeploy (required — env vars are baked at startup).
4. Verify with a test event delivery in Stripe dashboard.

---

## Price IDs

Price IDs are stored in env vars (`STRIPE_PRICE_ID_PRO_MONTHLY` etc.). If you add or change a plan in Stripe, update both the env var and any references in `src/server/stripe-prices.ts`.

---

## References

- Webhook handler: `src/server/stripe-handlers.ts`
- Webhook route: `src/app/api/stripe/webhook/route.ts`
- Billing surface (entitlement checks): `src/server/billing.ts`, `src/server/billing-surface.ts`
- Stripe price map: `src/server/stripe-prices.ts`
