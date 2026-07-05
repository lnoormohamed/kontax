# P34N-05 — Internal Support Notes and Case-History Timeline

## Purpose

Give admins a lightweight internal memory layer so recurring support/debug work
does not depend on private Slack messages or human recollection.

## Background

The admin area can show system state, but not yet the support context around a
case:

- why a plan was overridden
- what was explained to the user
- which sync/provider issue has already been investigated

## Scope

**In scope**
- internal support notes on user/admin detail views
- case-history timeline behavior
- author + timestamp metadata

**Out of scope**
- public user-visible notes
- external CRM sync

## Design / Implementation Spec

### Constraints

- notes must be internal-only
- notes should appear in chronological context
- notes should coexist with audit, not replace it

### Good uses

- support handoff context
- provider verification history
- billing exception rationale
- investigation summary

## Acceptance Criteria

- admins can leave internal-only notes attached to a support context
- notes are timestamped and attributable
- timelines help future admins understand prior investigation context

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — note/timeline scope documented here
- [ ] Internal · support/admin — retention/privacy notes later
