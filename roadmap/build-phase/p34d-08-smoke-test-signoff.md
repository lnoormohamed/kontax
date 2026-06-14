# P34D-08 — Smoke Test Sign-Off Gate

## Purpose

Aggregate all results from P34D-01 through P34D-07, classify every failure by
severity, and produce a written sign-off that gates the P34D-23 go-live execution.
This is a process checkpoint, not a code ticket.

## Background

A go/no-go gate with structured failure classification prevents incomplete or
broken code from shipping to production users. Without a formal sign-off, there is
no single moment of accountability between "we ran some tests" and "we flipped the
DNS switch". This ticket creates that moment.

The severity classification used here:

| Class | Definition | Effect on go-live |
|-------|-----------|------------------|
| P0 | Blocks go-live. Data loss, security failure, auth broken, payments broken, or any scenario where a user could not use the core product (register, log in, create a contact). | Must be fixed and re-tested before P34D-23 begins. No exceptions. |
| P1 | Should be fixed within 48 hours of launch. Significant UX degradation, a feature not working but workaround exists, or a missing non-security header. | Tracked in a P34D-post-launch hotfix list. Does not block go-live. |
| P2 | Minor issue or cosmetic defect. Log for the next sprint. | Does not block go-live. |

## Scope

**In scope**
- Tallying results from all seven smoke-test tickets (P34D-01 through P34D-07)
- Failure classification (P0 / P1 / P2)
- Written sign-off from the test runner
- Creation of `roadmap/runbooks/smoke-test-results-v1.md` as the persistent record
- A P0 work-off loop: any P0 discovered must be assigned, fixed, and re-tested
  before the gate can close

**Out of scope**
- Actually fixing any bugs (that happens outside this ticket, re-testing closes the loop)
- Infrastructure checklists (those are P34D-19 through P34D-22)

## Design / Implementation Spec

### smoke-test-results-v1.md structure

Create (or finalise) `roadmap/runbooks/smoke-test-results-v1.md` with this structure:

```markdown
# Smoke Test Results — v1

**Run date**: YYYY-MM-DD
**Tester**: [name]
**Environment**: kontax.vexon.co (staging)
**Re-verified on production**: [yes/no, date]

## Summary Table

| Area | Pass | Fail | P0 Failures | Status |
|------|------|------|-------------|--------|
| Auth (P34D-01) | n | n | [list] | PASS / FAIL |
| Contacts (P34D-02) | n | n | [list] | PASS / FAIL |
| Sync (P34D-03) | n | n | [list] | PASS / FAIL |
| Sharing (P34D-04) | n | n | [list] | PASS / FAIL |
| Billing & Admin (P34D-05) | n | n | [list] | PASS / FAIL |
| Mobile & PWA (P34D-06) | n | n | [list] | PASS / FAIL |
| Public Card / API / Notifs (P34D-07) | n | n | [list] | PASS / FAIL |
| **Total** | **n** | **n** | | |

## P0 Failures (must fix before go-live)

| ID | Test Case | Description | Assigned | Fixed | Re-tested |
|----|-----------|-------------|----------|-------|-----------|

## P1 Failures (fix within 48h of launch)

| ID | Test Case | Description | Assigned |
|----|-----------|-------------|----------|

## P2 Issues (next sprint)

| ID | Test Case | Description |
|----|-----------|-------------|

## Sign-Off

I, [tester name], confirm that all P0 failures listed above have been resolved and
re-tested, and that this build is approved for the go-live execution in P34D-23.

**Signed**: _____________________ **Date**: _____________
```

### P0 Work-Off Process

1. List all P0 failures in the table above immediately after the test run.
2. Assign each P0 to an engineer.
3. The engineer fixes the issue on the `main` branch and deploys to staging.
4. The tester re-runs the specific failing test cases and marks "Re-tested" with date.
5. Once all P0 rows are marked "Fixed + Re-tested", the tester signs off.
6. The signed document is the prerequisite for P34D-23 step 1.

## Acceptance Criteria

- `roadmap/runbooks/smoke-test-results-v1.md` exists and is fully filled out.
- Zero open P0 failures at the time of sign-off.
- Sign-off line is present with tester name and date.
- P34D-23 step 1 explicitly checks this document.

## Risks / Open Questions

- If the staging environment diverges from the production build during the P0 work-off
  period, the re-tests may not reflect the production state. Ensure the staging
  deployment always tracks the main branch tip.
- The tester and the engineer fixing P0 bugs should not be the same person — the fix
  should be independently verified.
- P0 classification is a judgment call. If unsure whether a failure is P0 or P1,
  default to P0 and downgrade only with explicit justification documented in the
  sign-off file.

## Documentation

- [x] Internal · ops — `roadmap/runbooks/smoke-test-results-v1.md`: this file IS the
      deliverable of this ticket
- [ ] Internal · ops — `roadmap/runbooks/post-launch-review.md`: reference smoke
      results in the post-launch review (P34D-24)
- [ ] External · users — no changes needed
- [ ] Internal · engineering — docs/: no code changes in this ticket
