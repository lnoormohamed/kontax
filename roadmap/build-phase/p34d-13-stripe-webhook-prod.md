# P34D-13 — Register Stripe Webhook for Production

## Purpose

Register a new Stripe webhook endpoint pointed at `https://getkontax.com/api/webhooks/stripe`,
subscribe it to the required billing events, copy the signing secret into Coolify,
and verify end-to-end delivery using the Stripe CLI.

## Background

Stripe webhooks are the mechanism by which Kontax learns about subscription changes,
payment failures, and checkout completions. Without a registered production webhook,
the app will not update plan status or show payment failure banners — users who pay
will remain on Free tier until the database is manually updated.

The staging webhook (kontax.vexon.co) must remain active during the transition so
that P34D-05 billing smoke tests can continue to run on staging after go-live.

The `STRIPE_WEBHOOK_SECRET` is unique per webhook endpoint — the staging secret and
the production secret are different values. The production secret must be set in the
production Coolify env (as part of P34D-11, but it depends on this ticket).

## Scope

**In scope**
- Register a new webhook endpoint in Stripe Dashboard (live mode)
- Subscribe to required events
- Copy the webhook signing secret to Coolify production env
- Verify delivery with Stripe CLI (`stripe trigger`)
- Confirm the handler returns 200 and the database updates correctly

**Out of scope**
- Sandbox webhook (already exists from P34D-05 smoke test setup)
- Stripe billing UI (tested in P34D-05)
- Webhook retry logic or dead-letter handling (future phase)

## Design / Implementation Spec

### Step 1 — Register the endpoint in Stripe Dashboard (live mode)

1. Log in to Stripe Dashboard: https://dashboard.stripe.com
2. **Switch to Live mode** (top-left toggle — default may be Test mode).
3. Navigate to: Developers → Webhooks → Add endpoint.
4. Endpoint URL: `https://getkontax.com/api/webhooks/stripe`
5. Description: "Kontax production webhook"
6. Select events to listen to (at minimum):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
7. Click "Add endpoint".
8. On the next screen, click "Reveal" next to "Signing secret". Copy the value
   (starts with `whsec_`).

### Step 2 — Set STRIPE_WEBHOOK_SECRET in Coolify

In Coolify → Production app → Environment Variables:
```
STRIPE_WEBHOOK_SECRET=whsec_<production-webhook-signing-secret>
```

Trigger a Coolify redeploy so the new env var is loaded.

### Step 3 — Verify with Stripe CLI

Install the Stripe CLI if not already available:
```bash
brew install stripe/stripe-cli/stripe
stripe login
```

Listen to the production webhook (requires the production API key):
```bash
stripe listen --forward-to https://getkontax.com/api/webhooks/stripe \
  --api-key sk_live_...
```

In a second terminal, trigger a test event:
```bash
stripe trigger invoice.payment_succeeded --api-key sk_live_...
```

**Expected**: the Stripe CLI shows the event forwarded with a `200` response.
Kontax logs show the event received and processed. The Stripe Dashboard webhook
endpoint shows the event in its "Recent deliveries" tab.

### Step 4 — Verify handler behaviour

The webhook handler at `/api/webhooks/stripe` must:
1. Validate the Stripe-Signature header using `STRIPE_WEBHOOK_SECRET`.
2. Return 400 if the signature is invalid (tested in P34D-19).
3. Return 200 and process the event if the signature is valid.
4. Be idempotent — processing the same event twice must not duplicate data.

Verify idempotency by sending the same event twice via Stripe CLI and confirming the
database state (subscription status, plan) is unchanged after the second delivery.

### Step 5 — Staging webhook still active

Go to Stripe Dashboard → Developers → Webhooks. Confirm both endpoints are listed:
```
https://kontax.vexon.co/api/webhooks/stripe    (staging — Test mode)
https://getkontax.com/api/webhooks/stripe      (production — Live mode)
```

Note: Stripe live mode and test mode webhooks are completely separate. The staging
webhook is in test mode; the production webhook is in live mode. They do not
interfere.

## Acceptance Criteria

- [ ] Webhook endpoint `https://getkontax.com/api/webhooks/stripe` is registered in
      Stripe live mode with all 6 required events.
- [ ] `STRIPE_WEBHOOK_SECRET` in Coolify production env matches the live endpoint's
      signing secret.
- [ ] Stripe CLI `stripe trigger invoice.payment_succeeded` results in a 200 response
      from the production endpoint.
- [ ] The Stripe Dashboard "Recent deliveries" tab shows a successful delivery.
- [ ] Staging webhook (kontax.vexon.co) is still active in test mode.
- [ ] `STRIPE_WEBHOOK_SECRET` from staging is NOT set in the production env (they
      must be different values).

## Risks / Open Questions

- **Live mode requires a real card event to fully test**: `stripe trigger` in live
  mode sends synthetic events. The first real end-to-end test (a real user upgrading
  to Pro after launch) is the true integration test. Monitor closely in P34D-24.
- **Webhook signing secret rotation**: if the `whsec_` secret is ever exposed, it
  must be rotated immediately in the Stripe Dashboard and updated in Coolify. Document
  this procedure in the ops runbook.
- **Network access**: the production server must be accessible from Stripe's IP ranges
  on port 443. Stripe publishes their IP allowlist at https://stripe.com/docs/webhooks.
  If a firewall is in place, add Stripe's CIDRs to the allowlist.
- **Handler at /api/webhooks/stripe**: confirm this route exists in the Next.js app
  and is not behind NextAuth middleware. Stripe webhooks are not authenticated with
  a session cookie — only the signature header is validated.

## Documentation

- [ ] External · users — no changes needed
- [ ] External · developers — no changes needed
- [x] Internal · ops — add Stripe live webhook details (URL, events subscribed,
      signing secret location) to the ops runbook
- [ ] Internal · engineering — docs/: no code changes; the webhook handler code
      already exists from sandbox setup
