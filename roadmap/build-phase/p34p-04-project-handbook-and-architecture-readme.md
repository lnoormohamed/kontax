# P34P-04 — Project Handbook, Architecture README, and Operator Onboarding Docs

## Purpose

Replace the starter README with a real handbook that explains what Kontax is,
how it is structured, and how to operate it safely.

## Background

The root README still looks like a starter scaffold, while the real product now
includes:

- multiple sync providers
- admin tooling
- billing and plan management
- public cards
- address books and sharing

That gap slows onboarding and makes ops knowledge harder to discover.

## Scope

**In scope**
- rewrite the root README
- add architecture overview
- add local setup and common commands
- add sync/provider model overview
- link key runbooks and admin surfaces

**Out of scope**
- exhaustive internal wiki replacement

## Dependencies

- P34P-03 should at least have a provisional deploy/schema policy so the
  handbook does not document a moving target

## Design / Implementation Spec

### The handbook should cover

- what Kontax is
- core architecture and runtime model
- key directories and ownership boundaries
- local development commands
- schema/deploy model
- sync/provider model
- admin and support surfaces
- links to the important runbooks

### Suggested structure

1. product overview
2. local development
3. architecture map
4. sync and provider model
5. admin/support operations
6. deployment and schema caveats
7. common troubleshooting entry points

## Acceptance Criteria

- The root README reflects the actual system.
- A new engineer can set up, run, and reason about the project from docs.
- Important runbooks are discoverable from the handbook.
- The handbook explains production caveats around sync, billing, and schema
  rollout.

## Documentation

- [x] Internal · engineering — this ticket is documentation-first by design
