# P34M-03 — User Detail Upgrade into a Support Console

## Purpose

Turn the admin user detail page into a real support console instead of a mostly
account-centric profile view.

## Background

The current user detail page is a strong start, but for support work it is
missing high-value operational context:

- sync accounts
- provider mix
- reauth blockers
- lifecycle issues
- entitlement/cap usage in one glance

## Scope

**In scope**
- add sync account summary to user detail
- add provider mix / status summary
- add support-oriented context panels
- improve quick links into related admin views

**Out of scope**
- free-form agent notes
- CRM/ticketing integration

## Design / Implementation Spec

### New support panels

- sync accounts
- provider health for this user
- recent sync failures / capability warnings
- linked family/team context where relevant

### UX rules

- key support context should be visible above the fold
- drilldowns should open the matching admin sync view directly

## Acceptance Criteria

- a support admin can understand a user’s sync footprint from one page
- user detail links cleanly into connection- and provider-level admin views
- lifecycle, plan, and sync state are readable together

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — support-console scope documented here
- [ ] Internal · support/admin — walkthrough later
