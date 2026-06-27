# P34T-03 — Global Admin Search, Saved Views, and Deep-Link Pivots

## Purpose

Make the admin section much faster to enter and navigate by improving search,
reusable operational views, and predictable deep-link behavior.

## Background

Admin search already spans multiple entities, but operator flow still suffers
when people arrive with partial context such as:

- a connection id
- a case title
- a flag key
- a user email fragment
- a recent incident category

Search and filtering should feel like a workspace, not a collection of isolated
pages.

## Scope

**In scope**
- improved global search result coverage
- saved admin views / queue presets
- deep-link pivots from dashboard queues into prefiltered screens
- better ranking for exact ids, emails, and known operational entities

**Out of scope**
- external search infrastructure
- attachment/document search

## Dependencies

- P34N-04 global admin search foundation
- P34L overview queues
- P34T-01 support case workbench

## Design / Implementation Spec

### Additional search targets

- support cases
- broadcast titles
- feature flags
- connection ids / provider identities
- audit target ids and major entity refs

### Saved-view examples

- unassigned support cases
- sync re-auth queue
- billing exceptions
- recent destructive actions
- provider-family watchlists

### UX rules

- exact identifiers should rank above fuzzy text matches
- queue links from overview cards should land in the most relevant filtered view
- saved views should be lightweight and operator-owned, not a heavy report
  builder

## Acceptance Criteria

- admins can search and pivot through the main operational entities quickly
- common queue/filter combinations can be reopened without rebuilding them each
  time
- dashboard cards deep-link into useful filtered views rather than broad index
  pages

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — search/pivot scope documented here
- [x] Internal · support/admin — saved-view usage notes required
