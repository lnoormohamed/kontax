# P49A-08 — SES/SNS webhook: bind to our TopicArn

**Phase:** 49A · **Priority:** P0 · **Depends on:** — · **Effort:** S
**Audit IDs:** A-12 (high, SEC-1)

## Objective
Only bounce/complaint notifications from Kontax's own SNS topic can suppress a user's email.

## Production verification (2026-09-25)
- Route is live in prod: `GET https://getkontax.com/api/ses/events` → 405 (POST handler present);
  SES is configured in prod (`AWS_SES_REGION`, AWS keys, `SES_TO_EMAIL`).
- Confirmed in origin/main: `TopicArn` appears only in the signable-key lists of
  `sns-verify.ts:30-46`; nothing compares it to an expected value. The route auto-fetches
  `SubscribeURL` for any validly-signed `SubscriptionConfirmation` (`route.ts:100-105`) and sets
  `emailStatus` to BOUNCED/COMPLAINED on notifications (`:130, :139`). `email.ts:85` then suppresses
  non-security mail (password reset, verification) for that user.
- Prod users all `emailStatus = OK` today — not exploited.

## Steps
1. Add `SES_SNS_TOPIC_ARN` (comma-separated allowed list) to `src/env.js`; required in production.
2. Reject (403, logged) any message whose `TopicArn` is not allowed — before confirming a
   subscription and before processing a notification.
3. Treat password-reset and verification emails as security mail (`bypassSuppression`) so a bad
   suppression can't lock a user out of recovery.
4. Admin: show suppressed users and allow clearing the status.
5. Ops: set the env var on prod and staging (requires an explicit go-ahead for the prod change).

## Acceptance
- Tests: a correctly-signed message from another topic → 403, no DB write, no SubscribeURL fetch;
  our topic → processed.
- Password reset is delivered to a BOUNCED user.
