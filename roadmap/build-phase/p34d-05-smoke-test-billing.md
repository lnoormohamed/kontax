# P34D-05 — Smoke Test: Billing and Admin

## Purpose

Verify the full billing lifecycle using Stripe sandbox test cards, confirm the
customer portal is accessible, and validate admin capabilities: user search, plan
override, audit logging, and account suspension.

## Background

Kontax uses Stripe for subscription billing. The sandbox environment uses test card
numbers. Webhooks from Stripe update plan status in the Kontax database. An admin
role (granted via the grant-admin script) gives access to `/admin` with user
management and override capabilities.

This test runs entirely against the Stripe **sandbox** (test mode). The production
Stripe live keys and production webhooks are tested as part of P34D-13.

## Scope

**In scope**
- Pricing page rendering
- Stripe Checkout for upgrade (test card success and decline)
- Customer portal access from settings
- Downgrade confirmation dialog
- Failed payment webhook → UI banner
- Admin access, user search, plan override, audit log
- Admin: suspend and unsuspend account

**Out of scope**
- Live Stripe keys (those are verified in P34D-13 separately)
- Proration calculations (billing domain detail, not smoke scope)
- Invoice PDF download (nice-to-have, not P0)

## Design / Implementation Spec

Before running these tests, ensure the sandbox Stripe webhook is forwarding to
kontax.vexon.co. Use the Stripe CLI (`stripe listen --forward-to
http://localhost:3000/api/webhooks/stripe`) or the registered sandbox webhook
in the Stripe dashboard.

For admin tests (TC-07 onwards), log in as an admin account. If the test account
does not have admin role, run the grant-admin script:
```
node scripts/grant-admin.js --email admin@example.com
```
Use a separate non-admin account as the test target for plan override and suspension.

Record results in `roadmap/runbooks/smoke-test-results-v1.md` → Billing & Admin section.

## Test Cases

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| TC-01 | Pricing page loads | Navigate to /pricing (or the marketing pricing page). | Page loads. All plan names (Free, Pro — or as defined) shown with correct prices. No hydration errors. | |
| TC-02 | Upgrade to Pro — success | Click "Upgrade to Pro" or equivalent CTA. | Stripe Checkout opens (hosted checkout page or embedded). | |
| TC-03 | Complete checkout with test card | In Stripe Checkout, enter: card 4242 4242 4242 4242, any future expiry, any CVC, any ZIP. Complete checkout. | Redirected back to Kontax. A success message or redirect to settings/billing. Plan shows "Pro" in Settings → Billing. | |
| TC-04 | Pro plan reflected in settings | Go to Settings → Billing after TC-03. | Current plan shows "Pro". Subscription status "Active". Next billing date shown. | |
| TC-05 | Customer portal link | Click "Manage subscription" or "Customer portal" in Settings → Billing. | Stripe-hosted customer portal opens in a new tab. Subscription details are visible. | |
| TC-06 | Downgrade plan | In the customer portal or via a downgrade button in Kontax: initiate downgrade to Free. | A confirmation dialog or Stripe portal confirmation appears with a data-loss warning (e.g. "You will lose access to Pro features"). Downgrade completes. | |
| TC-07 | Failed payment webhook | Use decline test card 4000 0000 0000 0002 to initiate a new subscription or payment. (Alternatively, use `stripe trigger invoice.payment_failed` from Stripe CLI.) | After the webhook fires, the Kontax UI shows a "Payment failed" banner or notification. Plan may downgrade or show "past due" state. | |
| TC-08 | Admin login | Log in as admin account. Navigate to /admin. | /admin page loads without a 403. User management UI visible. | |
| TC-09 | Admin user search | In /admin, search for the test non-admin user by email. | User appears in search results with their current plan and account status shown. | |
| TC-10 | Admin plan override | In /admin, select the test user. Override their plan to "Pro". Save. | Test user's plan changes. If the test user is logged in, their settings reflect the change (may need a refresh). | |
| TC-11 | Audit log — override action | After TC-10, check the admin audit log (in /admin or a sub-page). | An audit entry is present showing: action "plan override", target user email, new plan, timestamp, and admin user email. | |
| TC-12 | Admin suspend account | In /admin, find the test user. Click "Suspend account". Confirm. | Test user account marked suspended. | |
| TC-13 | Suspended user cannot log in | Log out of admin. Attempt to log in as the suspended test user. | Login fails. A message is shown (e.g. "Your account has been suspended. Contact support."). Not a generic "invalid credentials" message. | |
| TC-14 | Admin unsuspend account | Log back in as admin. Unsuspend the test user. | Test user can log in again normally. | |

## Acceptance Criteria

- All 14 test cases pass.
- Stripe webhook delivery is confirmed in the Stripe dashboard (event log shows
  delivery to kontax.vexon.co with a 200 response).
- Admin plan override is reflected in the user's session within one page refresh.
- Suspension prevents login (TC-13) — this is P0 if it fails (admin tools are
  required for abuse handling post-launch).
- Results recorded in `roadmap/runbooks/smoke-test-results-v1.md`.

## Risks / Open Questions

- Stripe webhook timing: the webhook may arrive a few seconds after TC-03 checkout
  completion. If the plan does not immediately update, wait 10 seconds and refresh
  before marking as fail.
- TC-07 (failed payment): the easiest way to trigger this is `stripe trigger
  invoice.payment_failed` via Stripe CLI, which sends a test event. The webhook
  handler must match on the customer ID to affect the correct test account.
- The grant-admin script path should be confirmed before the test session. Reference
  the DB & verification workflow memory: `scripts/grant-admin.js` or equivalent.
- If /admin is protected by middleware (should be), verify that a non-admin session
  returns 403 — this is part of P34D-19 security checklist as well.

## Documentation

- [ ] External · users — in-app Help: billing/upgrade help article should exist
- [ ] External · developers — /developers: no changes needed
- [x] Internal · ops — `roadmap/runbooks/smoke-test-results-v1.md`: record results here
- [x] Internal · ops — grant-admin script usage documented in the ops runbook
- [ ] Internal · engineering — docs/: no code changes in this ticket
