# P34R-01 — Contact Health Dashboard and Quality Worklists

## Purpose

Give users a practical "clean up my contacts" surface that turns passive data
quality issues into clear worklists.

## Background

Kontax already has good primitives for search, labels, merge, activity, and
bulk editing. A contact-health surface would tie those capabilities together
into a visible, ongoing value loop.

## Scope

**In scope**
- dashboards / smart queues for:
  - missing details
  - stale sync
  - likely duplicate risk
  - missing labels / incomplete dates
- quick actions into bulk edit / review flows

**Out of scope**
- fully automated cleanup

## Dependencies

- existing merge, search, label, and bulk-edit primitives

## Design / Implementation Spec

### Health categories

- incomplete identity
- missing contact methods
- likely duplicates
- sync attention
- weak metadata coverage

### UX rules

- every category should lead into a concrete remediation flow
- the dashboard should feel operational, not decorative

### Candidate first views

- missing phones or emails
- missing company / job context
- unlabeled contacts
- contacts with no recent sync success

## Acceptance Criteria

- Users can see the biggest quality gaps in their contact set at a glance.
- Each health category links directly into a remediation flow.

## Documentation

- [ ] External · users — help later
- [x] Internal · engineering — category rules documented here
