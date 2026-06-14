# P34D-24 — 24-Hour Post-Launch Review

## Purpose

Review the first 24 hours of production operation, identify any issues that emerged
after go-live that were not caught in smoke testing, and produce a written post-launch
note that guides the first post-launch sprint.

## Background

The first 24 hours of a new production deployment always surfaces issues that no
amount of staging testing can anticipate: real traffic patterns, real user data
shapes, real third-party service interactions under live conditions. This review turns
those observations into actionable fixes before they compound.

This is not a code ticket. The output is a written document. Any issues identified
are opened as separate engineering tickets with the appropriate priority.

## Scope

**In scope**
- Error log analysis (Coolify logs, any application error tracking if configured)
- Stripe payment events and webhook delivery
- SES email delivery (registrations, password resets)
- New user registrations
- UptimeRobot alerts received (if any)
- Search Console crawl activity
- User-reported issues (support email or contact form submissions)

**Out of scope**
- Performance optimisation (track metrics but make changes in the next sprint)
- Feature development
- This ticket does not close any bugs — it identifies them

## Design / Implementation Spec

Run this review 24 hours after P34D-23 step 5 (DNS flip). The review should take
30–60 minutes and result in a document created at
`roadmap/runbooks/post-launch-review.md`.

### Section 1 — Error log review

In Coolify → Production app → Logs, filter for the past 24 hours. Search for:
- `500` status codes
- `Error:` or `Unhandled` strings
- `NEXTAUTH_URL` mismatch warnings
- Database connection errors (`P1001`, `P1002`)
- Prisma query errors (`P2002` unique constraint, `P2025` not found)

For each pattern, note:
- Which route is failing (if discernible from the log)
- How many times it occurred
- Severity classification (P0 / P1 / P2)

### Section 2 — Stripe review

In Stripe Dashboard → Events (last 24h):
- Total events received
- Webhook deliveries to `getkontax.com` — any failed deliveries?
- Any `customer.subscription.created` events (real sign-ups if any)
- Any `invoice.payment_failed` events

If webhook failures occurred: check the delivery details, look at the response body,
and investigate why the handler returned a non-200.

### Section 3 — SES review

In AWS Console → SES → Account Dashboard → Sending statistics (or CloudWatch if
configured):
- Emails sent in the last 24h
- Bounce rate (should be < 2% — if higher, there may be a spam or deliverability issue)
- Complaint rate (should be < 0.1%)

Common first-day SES issues:
- Verification emails going to spam (check the SES "reputation" dashboard)
- Email template generating broken links (the `/api/auth/verify` URL is wrong)
- SES sandbox mode still active (if sandbox mode was not disabled, emails only go to
  verified addresses — this would block all new user registrations)

### Section 4 — New user registrations

Query the production database for registrations in the last 24h:
```sql
SELECT COUNT(*) AS total_new_users,
       SUM(CASE WHEN "emailVerified" IS NOT NULL THEN 1 ELSE 0 END) AS verified
FROM "User"
WHERE "createdAt" > NOW() - INTERVAL '24 hours';
```

If there are unverified users (registered but not verified), check whether the
verification email was delivered (SES logs) or if the verification flow has a bug.

### Section 5 — UptimeRobot alerts

Log in to UptimeRobot. Check:
- Were any downtime alerts sent in the last 24h?
- If yes: what was the duration? What time did it start? Is the monitor back to "Up"?
- Correlate any downtime with Coolify deploy events (deploys cause a brief restart).

### Section 6 — Search Console

In Google Search Console → Coverage and URL Inspection:
- Any crawl errors reported?
- Any indexing issues for the marketing homepage?
- Sitemap processing status (if submitted in P34D-21)

Note: Search Console data has a 24–72h delay. Check again 72h post-launch for a
more complete picture.

### Section 7 — User feedback

Check any support inbox or contact form submissions received in the first 24h.
Categorise any issues:
- Feature questions (not a bug — candidate for Help docs)
- Bugs (open a ticket)
- Account issues (handle via admin tools)

## Post-Launch Note Template

Create `roadmap/runbooks/post-launch-review.md` with this structure:

```markdown
# Post-Launch Review — 24h

**Go-live date/time**: YYYY-MM-DD HH:MM UTC
**Review date/time**: YYYY-MM-DD HH:MM UTC (24h later)
**Reviewer**: [name]

## Summary

[2–3 sentences: overall health, any major issues, general sentiment]

## Error Logs

[Findings from Section 1 — list any patterns and their frequency]

## Stripe & Billing

[Findings from Section 2]

## Email (SES)

[Findings from Section 3 — bounce rate, delivery rate]

## New Users

Total registered: n
Verified: n (n%)
[Any registration issues?]

## Uptime

Downtime events in 24h: n
Total downtime duration: n minutes
[Cause if known]

## User Feedback

[Summary of any reports received]

## Issues Opened

| Priority | Issue | Ticket ID |
|----------|-------|-----------|

## What Worked Well

- [list]

## What to Fix in the Next Deploy

- [list of P0/P1 items]

## What to Monitor Over the Next Week

- [list of metrics or behaviours to watch]
```

## Acceptance Criteria

- Review is completed 24 hours after P34D-23 step 5.
- `roadmap/runbooks/post-launch-review.md` is created with all sections filled out.
- Any P0 issues found are assigned to an engineer and tracked.
- The review is shared with the full team.

## Risks / Open Questions

- **No real traffic**: if Kontax had zero users in the first 24h, many sections will
  be "N/A". That is fine — the review should note the absence of data and confirm
  the systems are ready when traffic does arrive.
- **SES sandbox mode**: if SES was still in sandbox mode and this was not caught in
  P34D-11, this will be the most critical finding. Exiting sandbox requires an AWS
  support request that takes 24h. Open this immediately if discovered.
- **First deploy after go-live**: if any fixes were deployed in the first 24h, the
  review should note when and what changed, and whether it resolved or introduced
  issues.

## Documentation

- [x] Internal · ops — `roadmap/runbooks/post-launch-review.md`: this IS the
      deliverable of this ticket
- [ ] External · users — no changes needed
- [ ] Internal · engineering — any bugs identified become new tickets; do not fix
      bugs inside this review ticket
