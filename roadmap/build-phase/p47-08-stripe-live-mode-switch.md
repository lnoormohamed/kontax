# P47-08 — Stripe live-mode switch (keys, webhook, prices, portal)

**Phase:** 47 · **Workstream:** B · **Priority:** P0 · **Depends on:** —

## Objective

Move billing from **test mode** to **live**: live secret key, live webhook
endpoint + secret, live price IDs, and the customer portal configured for the
prod origin. Until this lands, real customers cannot pay.

## Context

Infra memory confirms prod still runs `sk_test_`. Billing degrades gracefully
when Stripe env is unset, so a half-switched config **looks** fine but silently
fails checkout or entitlement sync. Do the whole switch atomically.

## Steps

1. **Live keys** — set `STRIPE_SECRET_KEY=sk_live_...` in Coolify (P47-05).
2. **Live products / prices** — create (or activate) the live-mode Products and
   copy the six live price IDs into `STRIPE_PRICE_ID_{PRO,FAMILY,TEAMS}_{MONTHLY,YEARLY}`.
   Confirm `NEXT_PUBLIC_PRICE_*` display strings still match the live prices.
3. **Live webhook endpoint** — in Stripe → Developers → Webhooks, add the prod
   endpoint (the app's Stripe webhook route on the canonical origin). Subscribe
   to the events the P19-03 handler consumes (checkout, subscription
   created/updated/deleted, invoice payment succeeded/failed, etc.). Copy the
   signing secret into `STRIPE_WEBHOOK_SECRET`.
4. **Customer portal** (`.env.example` §Customer Portal) — in Stripe → Settings →
   Billing → Customer portal, enable: update payment methods, view invoices,
   cancel (at period end), plan changes with allowed prices; set return URL
   `{APP_URL}/settings?portal=returned`.
5. **Org-anchored billing** — confirm the P34F org-anchored routing (customer =
   Group for Teams) works with the live webhook (webhook routing = P34F-02).
6. **Promotions** — if using promo codes, enable them in Stripe → Promotions
   (checkout already sets `allow_promotion_codes: true`).

## Acceptance

- A **live** test purchase (real card or Stripe's live-mode test path) completes
  checkout, the webhook is received and verified (correct signature), and the
  user's plan entitlement updates (P19-04).
- Customer portal opens from Settings, allows cancel/plan-change, returns to the
  app.
- Failed-payment path and downgrade path behave (P19-06/07).
- Recorded on the P47-01 checklist; note the smoke-test billing case (P47-13).

## References

- `.env.example` §Stripe · env-secrets §Stripe · [../runbooks/stripe-billing.md](../runbooks/stripe-billing.md)
- Phase 19 (billing), P34F (org-anchored billing)
- Prior deferral: `memory/project_stripe-smoke-test-deferred.md`
</content>
