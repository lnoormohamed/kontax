# P34I-05 — Per-Link Remote Shadow and Unsupported-Field Preservation

## Purpose

Strengthen multi-provider safety by storing enough per-link remote state to
reason about what each provider last saw, instead of inferring everything from
the canonical contact alone.

## Background

Capability-aware filtering reduces risk, but per-link shadow state makes the
system more explainable and resilient:
- what did iCloud last store?
- what did Fastmail last store?
- which values are canonical but local-only for a given provider?

## Scope

**In scope**
- define whether `SyncContactLink` or a companion structure stores remote shadow
- preserve provider-limited canonical fields even when not present remotely
- expose enough metadata for future support/debug work

**Out of scope**
- main UI
- user-facing help copy

## Design / Implementation Spec

### Recommended approach

Store a provider-scoped remote shadow or supported-field snapshot per
`SyncContactLink`, for example:
- last remote-supported field projection
- last remote capability profile id
- optional omitted-field counts or markers

This gives later sync runs a stable reference point for:
- true deletions
- lossy provider projections
- support/debug explanations

### Minimum requirement

Even if full shadow storage is postponed, define an explicit preservation rule:
- canonical unsupported data survives all inbound syncs from that provider

## Acceptance Criteria

- A per-link preservation strategy is implemented and documented
- Multi-provider sync does not rely solely on full-contact naive comparison
- Future support tooling has a path to explain per-provider visibility

## Risks / Open Questions

- Decide whether the first version should store:
  - full supported-field JSON shadow
  - hash/signature only
  - lightweight omitted-field metadata

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — preservation strategy documented here
- [ ] Internal · support/admin — later
