# Phase 19 — Stripe Billing (Sandbox → Production)

## Objective

Wire the plan and entitlement model (Phases 2 and 11) to real Stripe billing so paid plans can be purchased, upgraded, downgraded, and cancelled. The local schema (`SubscriptionCustomer`, `Subscription`, billing entitlements in `billing.ts`) is already complete — this phase connects it to Stripe's API and webhook events. Start in sandbox; flipping to production is a config change.

## What already exists

- `SubscriptionCustomer` model with `providerCustomerId`
- `Subscription` model with `providerSubscriptionId`, `status`, `plan`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `canceledAt`, `graceEndsAt`
- `billing.ts` — full entitlement layer, `BILLING_PROVIDER_BOUNDARY` constants, all assertion gates
- `SubscriptionStatus` enum: `INCOMPLETE`, `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `PAUSED`, `EXPIRED`
- `AccountLifecycleState` enum: `ACTIVE`, `TRIALING`, `GRACE`, `CANCELED`, `LOCKED`
- Pricing page component exists (`pricing-comparison.tsx`) but CTAs are not wired to Stripe

## What this phase adds

- Stripe SDK integration and env var setup
- `StripeWebhookEvent` model for idempotency
- `createCheckoutSession` — creates a Stripe Checkout session for plan upgrades
- Webhook handler for all subscription lifecycle events
- Plan entitlement sync on every webhook event
- Stripe Customer Portal link
- Failed-payment banner and grace period enforcement
- Downgrade/cancellation confirmation UI with data-loss warnings
- Pricing page CTAs wired to real Stripe price IDs
- Promo codes and trial period support

## Policy reference

All downgrade data-fate rules, payment-failure grace periods, group dissolution triggers, and live-share conversion policies are defined in `lifecycle-policies.md`. The webhook handler (P19-03/P19-04) must implement them exactly.

## Phase Tracker

| Ticket | Title | Status | Priority | Depends On |
| --- | --- | --- | --- | --- |
| DB-02 | Design brief — billing and subscription UI | Not Started | P1 | — |
| P19-01 | Stripe schema additions — StripeWebhookEvent idempotency table, price ID env mapping | Not Started | P0 | P11-02 |
| P19-02 | Checkout flow — create Stripe Checkout session, redirect back with success/cancel | Not Started | P0 | P19-01 |
| P19-03 | Stripe webhook handler — all subscription and invoice events, idempotency, signature verification | Not Started | P0 | P19-02 |
| P19-04 | Plan entitlement sync — update plan/status/lifecycle from webhook; apply lifecycle-policies.md downgrade rules | Not Started | P0 | P19-03 |
| P19-05 | Customer portal — Stripe-hosted portal link for payment method, invoices, cancellation | Not Started | P1 | P19-04 |
| P19-06 | Failed-payment banner and grace period — GRACE lifecycle state, 3-day window, recovery CTA | Not Started | P1 | P19-04 |
| P19-07 | Downgrade and cancellation confirmation — pre-change warnings, affected-features list, data-loss reassurance | Not Started | P1 | P19-05 |
| P19-08 | Pricing page rebuild — real Stripe price IDs wired; upgrade CTAs route to checkout | Not Started | P1 | P19-04 |
| P19-09 | Promo codes and trial periods — Stripe coupon/promotion_code support in checkout | Not Started | P2 | P19-02 |

## Environment variables

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe API key — `sk_test_...` for sandbox, `sk_live_...` for production |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint signing secret from Stripe dashboard |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Stripe Price ID for Pro monthly |
| `STRIPE_PRICE_ID_PRO_YEARLY` | Stripe Price ID for Pro yearly |
| `STRIPE_PRICE_ID_FAMILY_MONTHLY` | Stripe Price ID for Family monthly |
| `STRIPE_PRICE_ID_FAMILY_YEARLY` | Stripe Price ID for Family yearly |
| `STRIPE_PRICE_ID_TEAMS_MONTHLY` | Stripe Price ID for Teams monthly |
| `STRIPE_PRICE_ID_TEAMS_YEARLY` | Stripe Price ID for Teams yearly |

## Build order

P19-01 (schema) → P19-02 (checkout) → P19-03 (webhook handler) → P19-04 (entitlement sync) → P19-05/06/07/08 in parallel → P19-09 last.

## Exit criteria

- A Free user can upgrade to Pro/Family/Teams via Stripe Checkout and receive plan features immediately.
- A paid user can access the Stripe Customer Portal to manage payment methods and cancel.
- Stripe webhook events update local subscription state idempotently.
- Failed payments set `lifecycleState = GRACE`; recovery updates it back to `ACTIVE`.
- Downgrade to Free applies entitlement restrictions per `lifecycle-policies.md`.
- All price IDs are configurable via env vars; sandbox/production is a single config swap.
