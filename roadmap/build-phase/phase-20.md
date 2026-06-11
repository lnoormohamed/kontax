# Phase 20 — Amazon SES & Email Templates

## Objective

Replace the local/no-op email transport with Amazon SES so all transactional emails are deliverable in production. Add a governed React Email template system covering every email Kontax sends. Phase 18 built the verification and reset token logic using a console-log transport — this phase swaps in SES and designs the actual email content.

## What already exists

- `sendVerificationEmail` and `sendPasswordResetEmail` functions exist (P18-04, P18-05) with a console-log fallback transport
- Phase 12 (P12-06) sends share invite emails with a graceful no-op if no provider is configured
- `User.email` and `User.emailVerified` exist on the schema
- No `User.emailStatus` field — needed for bounce/complaint suppression (added in P20-10)

## What this phase adds

- AWS SES SDK integration and IAM credential setup
- A single `sendEmail(to, template, data)` abstraction that all callers use
- React Email template system — every transactional email as a React component
- 6 transactional email templates
- SES bounce and complaint handling via SNS webhook
- `User.emailStatus` field to suppress sending to bounced/complained addresses

## Policy reference

`lifecycle-policies.md` Section 8 defines which events trigger notifications. This phase implements the email channel for those events.

## Phase Tracker

| Ticket | Title | Status | Priority | Depends On |
| --- | --- | --- | --- | --- |
| DB-03 | Design brief — email template visual language and all transactional types | Not Started | P1 | — |
| P20-01 | SES configuration — domain verification, DKIM/SPF, IAM credentials, sandbox → production lift | Not Started | P0 | P18-04 |
| P20-02 | Email transport abstraction — `sendEmail` function; SES SDK under the hood; console fallback in dev | Not Started | P0 | P20-01 |
| P20-03 | React Email template system — shared layout, per-template components, plain-text variants | Not Started | P0 | P20-02 |
| P20-04 | Template: email verification | Not Started | P0 | P20-03, P18-04 |
| P20-05 | Template: password reset | Not Started | P0 | P20-03, P18-05 |
| P20-06 | Template: contact share invite — wire existing P12-06 logic to the new transport | Not Started | P1 | P20-03 |
| P20-07 | Template: suspicious activity alert | Not Started | P1 | P20-03, P22-04 |
| P20-08 | Template: billing events — payment failed, trial ending, plan changed, account deleted | Not Started | P1 | P20-03, P19-06 |
| P20-09 | Template: notification digest — daily/weekly summary of activity | Not Started | P2 | P20-03, P22-08 |
| P20-10 | Bounce and complaint handling — SNS webhook, address suppression, User.emailStatus | Not Started | P1 | P20-02 |

## Environment variables

| Variable | Purpose |
| --- | --- |
| `AWS_ACCESS_KEY_ID` | IAM credentials for SES |
| `AWS_SECRET_ACCESS_KEY` | IAM credentials for SES |
| `AWS_SES_REGION` | SES region (e.g. `eu-west-1`) |
| `EMAIL_FROM` | Verified sending address (e.g. `hello@kontax.app`) |
| `AWS_SNS_BOUNCE_TOPIC_ARN` | SNS topic for bounces/complaints (P20-10) |

## Build order

P20-01 → P20-02 → P20-03 → P20-04 + P20-05 in parallel → P20-06 through P20-10 in parallel.

## Exit criteria

- Every transactional email is delivered via SES in production.
- React Email templates render correctly in email clients and have plain-text fallbacks.
- Bounced addresses are suppressed — Kontax never retries sending to a hard-bounced address.
- The dev environment logs email content to the console when `AWS_ACCESS_KEY_ID` is absent.
