# P34L-01 — Admin Home Dashboard and Command Center

## Purpose

Replace the current `/admin` redirect with a real landing page that gives
platform admins an immediate operational overview.

## Background

The admin area already has real tools, but there is no single place to orient:

- user search lives in one page
- metrics live in another
- audit lives elsewhere
- sync issues are not represented as a first-class operational concern

An admin home should reduce time-to-triage and make the panel feel intentional.

## Scope

**In scope**
- build a real `/admin` page
- add overview cards for platform health, user impact, and recent admin actions
- add direct links into the highest-value admin workflows

**Out of scope**
- deep sync tooling
- feature-flag rollout controls
- audit export

## Design / Implementation Spec

### Primary sections

1. **Platform health summary**
   - auth failures
   - sync failure count
   - degraded service indicators

2. **Needs attention**
   - locked users
   - users in grace
   - connections needing reauth
   - recent critical admin audit actions

3. **Quick actions**
   - search users
   - open sync ops
   - review audit log
   - broadcast product update

4. **Recent changes**
   - last admin actions
   - last major feature-flag changes
   - recent platform incidents or spikes

## Acceptance Criteria

- `/admin` no longer redirects to `/admin/users`
- admins can see platform health and pending attention items at a glance
- every summary card links to a deeper operational view

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — command-center structure documented here
- [ ] Internal · support/admin — add screenshot walk-through after ship
