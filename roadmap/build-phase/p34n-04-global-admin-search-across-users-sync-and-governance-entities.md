# P34N-04 — Global Admin Search Across Users, Sync, and Governance Entities

## Purpose

Give admins one fast internal search entry point across the main operational
entities.

## Background

User search already exists, but support work often begins with partial
identifiers that are not just user emails:

- sync connection ids
- contact ids
- audit targets
- group/team names

## Scope

**In scope**
- global admin search input
- multi-entity result sets
- lightweight ranking / grouping
- deep links into matching admin views

**Out of scope**
- full-text search infrastructure redesign
- fuzzy OCR / attachment search

## Design / Implementation Spec

### Initial entity types

- users
- sync connections
- connection ids
- groups / teams
- audit targets

### UX rules

- results should be grouped by entity type
- exact id/email matches should rank above fuzzy text matches
- the result should open the most useful admin detail page directly

## Acceptance Criteria

- admins can search more than just users
- search results cover the main operational entities
- deep-link behavior feels predictable and support-friendly

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — search scope documented here
- [ ] Internal · support/admin — quick guide later
