# P47-09 — SES production sending (sandbox exit, from-domain)

**Phase:** 47 · **Workstream:** B · **Priority:** P1 · **Depends on:** —

## Objective

Confirm Amazon SES can deliver transactional email to **any** recipient from the
production origin (not just verified addresses), and settle the from-address
domain.

## Context

SES is already live for `noreply@vexon.co` (`memory/project_email-ses-deployment.md`,
region `us-east-1`, prod). Two things to verify/decide for go-live:

1. **Sandbox status** — if the SES account is still in the sandbox, it can only
   send to **verified** addresses. Production needs the account **out of the
   sandbox** (AWS support request; can take ~24 h). Confirm the current state.
2. **From-domain decision** — `EMAIL_FROM` currently uses `noreply@vexon.co`.
   Decide whether prod sends from `vexon.co` or a `getkontax.com` address
   (brand consistency vs the existing verified identity). If moving to
   `getkontax.com`, verify that domain identity in SES (DKIM CNAMEs + SPF) first.

All four SES vars must be set together or `SES_CONFIGURED` is false and email
stays console-only (env-secrets §Email).

## Steps

1. Confirm sandbox vs production sending in the SES console for the prod region;
   if still sandboxed, file the production-access request.
2. Decide `EMAIL_FROM` domain; if `getkontax.com`, add + verify the domain
   identity (DKIM + SPF + DMARC alignment) before switching.
3. Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SES_REGION`,
   `EMAIL_FROM` in Coolify (P47-05); the IAM user needs `ses:SendEmail`.
4. Bounce/complaint handling (P20-10) — confirm the SNS topic + webhook are
   wired for the prod domain.
5. **Live send test** — trigger a real email (email verification or password
   reset) to an external inbox; confirm delivery, correct From, DKIM pass, and
   that it lands in inbox (not spam).

## Acceptance

- A transactional email delivers to a non-verified external inbox from the prod
  origin with DKIM/SPF passing.
- `EMAIL_FROM` domain decided and its identity verified in SES.
- Bounce/complaint pipeline active for the prod domain.
- Recorded on the P47-01 checklist.

## References

- [../runbooks/ses-setup.md](../runbooks/ses-setup.md) · env-secrets §Email
- `memory/project_email-ses-deployment.md` · Phase 20 (email), P20-10 (bounces)
</content>
