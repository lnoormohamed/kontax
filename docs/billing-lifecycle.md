# Billing lifecycle & entitlements

**Cross-cutting subsystem.** The billing lifecycle determines what a user can do at any moment — independently of which plan they subscribe to.

---

## Two orthogonal dimensions

Every user's billing state is the combination of two things:

1. **Plan** (`Subscription.plan`): `FREE | PRO | FAMILY | TEAMS` — determines *what features* they can access (contact limits, sync accounts, sharing, etc.)
2. **Lifecycle state** (`User.lifecycleState`): `ACTIVE | GRACE | LOCKED` — determines *whether* they can access those features at all.

Most product code should gate on lifecycle first, then on plan entitlements.

---

## AccountLifecycleState

| State | Meaning | `canWrite` | `canUseBasicExport` |
|-------|---------|-----------|-------------------|
| `ACTIVE` | Normal — free, trialing, or paid in good standing | ✓ | ✓ |
| `GRACE` | Payment failed; Stripe retrying (3-day window) | ✓ | ✓ |
| `LOCKED` | Account deletion in progress (30-day countdown) | — | — |

`CANCELED` exists in the enum for future use; it is not written by the current codebase. When a paid subscription is cancelled in Stripe, the user reverts to `plan=FREE` and stays `lifecycleState=ACTIVE`.

### State transitions

```
ACTIVE ──invoice.payment_failed──► GRACE ──invoice.payment_succeeded──► ACTIVE
  │                                  │
  │                              3 days elapse
  │                              (write-restricted but not yet LOCKED)
  │
  └──user requests account deletion──► LOCKED ──30d cron job──► (hard deleted)
```

Transitions are driven by:
- **Stripe webhooks** → `invoice.payment_failed` sets `GRACE`; `invoice.payment_succeeded` clears it back to `ACTIVE`.
- **Account deletion action** → `scheduleAccountDeletion` sets `LOCKED`.
- **Admin panel** → Suspend sets `LOCKED`; Unsuspend restores `ACTIVE`.

---

## Plan entitlements

The entitlement matrix lives in `src/server/billing.ts`. Key limits:

| Entitlement | FREE | PRO | FAMILY | TEAMS |
|-------------|------|-----|--------|-------|
| Contacts limit | 500 | Unlimited | Unlimited | Unlimited |
| Sync accounts | 1 | 5 | 5 | 5 |
| App passwords | 1 | 5 | 5 | 5 |
| Monthly import limit | 500 | Unlimited | Unlimited | Unlimited |
| Activity log retention | 3 changes/contact | 90 days | 365 days | 365 days |
| Live/static sharing | — | ✓ | ✓ | ✓ |
| Advanced merge | — | ✓ | ✓ | ✓ |

---

## How to check entitlements in product code

Call `getBillingContext(userId)` from `src/server/billing.ts`. It returns:

```typescript
{
  lifecycleState: "ACTIVE" | "GRACE" | "LOCKED",
  plan: "FREE" | "PRO" | "FAMILY" | "TEAMS",
  entitlements: {
    contactsLimit: number | null,  // null = unlimited
    syncAccountsLimit: number,
    canShare: boolean,
    // ...
  }
}
```

The lifecycle access policy (`canWrite`, `canUseBasicExport`) is enforced by `assertCanWrite(userId)` / `assertCanExport(userId)` — call these at the start of any write or export action rather than checking `lifecycleState` directly.

---

## Stripe webhook → lifecycle state flow

1. `checkout.session.completed` → `handleCheckoutSessionCompleted` → creates `Subscription` row, sets plan + status.
2. `customer.subscription.updated` → `handleSubscriptionUpserted` → updates plan + status, triggers downgrade side-effects if plan decreased.
3. `customer.subscription.deleted` → `handleSubscriptionDeleted` → resets to `plan=FREE, status=CANCELED`, lifecycle stays `ACTIVE`.
4. `invoice.payment_failed` → `handleInvoicePaymentFailed` → sets `lifecycleState=GRACE`, sets `graceEndsAt=+3 days`, sends payment-failed email + in-app notification.
5. `invoice.payment_succeeded` → `handleInvoicePaymentSucceeded` → clears `GRACE`, restores `lifecycleState=ACTIVE`.

All handlers run in a Prisma transaction. Webhook events are idempotent — safe to re-deliver.

---

## Downgrade side-effects

When a subscription moves to a lower plan, `applyDowngrade` runs in the same transaction:

- **FREE**: extra sync accounts (beyond 1) are `status=PAUSED`; live shares become static.
- **Below PRO**: outbound and inbound live shares are converted to static copies.

---

## References

- Billing context & entitlements: `src/server/billing.ts`
- Billing surface (enforcement helpers): `src/server/billing-surface.ts`
- Stripe webhook handlers: `src/server/stripe-handlers.ts`
- Price/plan mapping: `src/server/stripe-prices.ts`
- Runbook: [stripe-billing.md](../roadmap/runbooks/stripe-billing.md)
