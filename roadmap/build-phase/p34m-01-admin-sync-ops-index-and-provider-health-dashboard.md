# P34M-01 — Admin Sync Ops Index and Provider Health Dashboard

## Purpose

Create `/admin/sync` as the operational landing page for sync support and
provider health.

## Background

Sync is now central enough that it deserves its own admin domain. We need one
place to answer:

- which providers are failing
- how many accounts need reauth
- what is happening by provider family
- which connections need intervention

## Scope

**In scope**
- `/admin/sync` page
- provider-level health summaries
- status buckets for active, paused, reauth, error, retired
- recent job and failure summaries

**Out of scope**
- deep per-connection editing
- automated remediation

## Design / Implementation Spec

### Core views

- provider summary cards
- connection status breakdown
- "needs action" list
- recent failures / recent recoveries

### Drilldowns

- by provider
- by status
- by capability profile

## Acceptance Criteria

- `/admin/sync` exists and loads meaningful sync health data
- admins can identify reauth spikes and provider-specific issues quickly
- major sync states are visible without opening a user record

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — page contract documented here
- [ ] Internal · support/admin — sync ops runbook later
