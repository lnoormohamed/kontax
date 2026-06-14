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
              │                        └─ 3-day window expires → write restricted
              │
              └─user requests deletion──► LOCKED ──30d cron──► (deleted)
```

| `lifecycleState` | Meaning | Write access |
|------------------|---------|-------------|
| `ACTIVE` | Normal — free, trialing, or paid | Yes |
| `GRACE` | Payment failed, retrying | Yes (3-day window) |
| `LOCKED` | User requested account deletion | No (read + export only) |

`LOCKED` is **only** set by the account deletion flow — not by billing. When a subscription is fully cancelled and the user reverts to FREE, `lifecycleState` goes back to `ACTIVE`.

---

## Webhook events handled

| Stripe event | Handler |
|-------------|---------|
| `checkout.session.completed` | `handleCheckoutSessionCompleted` — creates the subscription row |
| `customer.subscription.updated` | `handleSubscriptionUpserted` — updates plan/status |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` — reverts to FREE, `lifecycleState=ACTIVE` |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` — sets `GRACE`, sends email + in-app notification |
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
