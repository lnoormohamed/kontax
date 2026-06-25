# P34O-03 — Sync/Account Identity Surfaces for Generic CardDAV Connections

## Purpose

Apply the provider identity model from P34O-01/02 to the actual places where
users and support staff need to distinguish connections quickly.

## Background

Identity metadata is only valuable if it shows up in the sync rail, connection
detail pages, account settings, and support/admin surfaces. Otherwise the
product remains visually opaque even if the data model is correct.

## Scope

**In scope**
- update sync connection list rows
- update sync connection detail views
- update user-facing account labels / secondary metadata
- update admin/support connection inspection surfaces

**Out of scope**
- provider capability messaging
- verified-provider promotion workflows

## Dependencies

- P34O-01 — identity model
- P34O-02 — provider detection registry

## Design / Implementation Spec

### User-facing display contract

For generic CardDAV accounts:

- primary line = user label
- secondary line = verified provider, detected provider, or canonical host

Examples:

- `ClickUp Contacts` / `Detected from dav.clickup.com`
- `Work CRM` / `carddav.example.net`
- `Fastmail Personal` / `Verified provider: Fastmail`

### UX rules

- The label should remain the scannable primary element.
- Secondary metadata should never crowd out the label on narrow layouts.
- Verified providers may use stronger badge/icon treatment than unverified
  detections.
- Generic providers should use neutral CardDAV treatment rather than a made-up
  brand.

### Support/admin display contract

Expose:

- label
- canonical host
- provider display name
- verification state
- detection provenance if available

### States to design for

- active verified provider
- active detected-but-unverified provider
- active generic provider
- disconnected / retired connection where host identity still matters
- replaced/reconnected lineage where historical identity must remain visible

## Acceptance Criteria

- Generic CardDAV connections are distinguishable in the sync rail without
  opening each one.
- Support/admin detail pages expose canonical host and verification state.
- Display logic is consistent across user-facing and admin-facing surfaces.
- Mobile and compact sync rows remain readable with the added metadata.

## Documentation

- [ ] External · users — none yet
- [ ] External · developers — none
- [x] Internal · engineering — surface contract documented here
- [ ] Internal · support/admin — future screenshots / runbook later
