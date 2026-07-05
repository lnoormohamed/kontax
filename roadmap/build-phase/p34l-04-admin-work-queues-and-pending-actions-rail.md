# P34L-04 — Admin Work Queues and Pending-Actions Rail

## Purpose

Add structured work queues so admins can act on issues rather than just observe
them.

## Background

The current admin panel shows data, but it does not yet present a compact list
of things waiting for a human:

- users that need review
- sync connections that need reauth
- repeated provider failures
- accounts scheduled for deletion

## Scope

**In scope**
- add work-queue cards/rails on admin home
- define priority buckets and links into each queue
- add counts and empty states

**Out of scope**
- queue claim/assignment model
- SLA tracking

## Design / Implementation Spec

### Initial queues

- Users needing review
- Sync connections needing action
- Recent destructive admin actions
- Accounts with billing/lifecycle exceptions

### Queue behavior

- each queue should show count + top items
- each item should deep-link into the correct detail page
- queue ordering should prefer severity then recency

## Acceptance Criteria

- admins can see actionable queues on `/admin`
- queues link directly into the correct operational view
- empty states remain useful and non-alarming

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — queue model documented here
- [ ] Internal · support/admin — queue triage playbook later
