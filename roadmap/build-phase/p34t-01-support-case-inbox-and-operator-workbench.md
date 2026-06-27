# P34T-01 — Support Case Inbox and Operator Workbench

## Purpose

Give admins a dedicated support-work surface instead of forcing case handling to
happen only from scattered detail pages and dashboard queue cards.

## Background

Support cases now exist and are visible in context, but operators still lack a
single place to:

- triage unassigned work
- sort by urgency
- manage follow-ups
- work through cases in batches

That is workable for low volume, but not for a real support queue.

## Scope

**In scope**
- support case index page
- filters by status / severity / owner / subject type
- overdue and due-today follow-up views
- quick assignment and status-change controls
- saved queue tabs for common operator workflows

**Out of scope**
- external helpdesk synchronization
- SLA automation or customer-facing ticket portals

## Dependencies

- P34S-01 support case model and detail-page surfaces
- admin overview work queues

## Design / Implementation Spec

### Core queue views

- unassigned
- assigned to me
- waiting on customer
- waiting on provider
- due today / overdue
- recently resolved

### Row content

- case title
- subject target
- severity
- owner
- next follow-up
- current blocker / summary preview

### UX rules

- operators should be able to update the most common fields without opening the
  full detail page
- queue defaults should bias toward open and actionable work
- follow-up date should be visually louder when overdue

## Acceptance Criteria

- admins can manage support cases from a dedicated inbox/workbench
- the most common support triage tasks do not require opening multiple detail
  pages first
- overdue or unassigned case work is easy to spot quickly

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — inbox/workbench scope documented here
- [x] Internal · support/admin — queue usage notes in `roadmap/runbooks/admin-support-case-inbox-workbench.md`
