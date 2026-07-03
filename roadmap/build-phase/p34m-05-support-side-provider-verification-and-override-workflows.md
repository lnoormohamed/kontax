# P34M-05 — Support-Side Provider Verification and Override Workflows

## Purpose

Add carefully-scoped admin/support workflows for promoting a connection from
generic-safe behavior to a verified provider profile when evidence exists.

## Background

Phase 34K introduced per-connection capability overrides, but the main surface
is currently connection settings. Support/admin also need a controlled way to:

- inspect current mode
- understand why it is set
- promote or revert safely

## Scope

**In scope**
- admin visibility into connection override state
- support-side override controls
- audit coverage for changes
- reason capture for override actions

**Out of scope**
- fully automated provider verification
- bulk rollout changes for all providers

## Design / Implementation Spec

### Workflow

1. inspect connection
2. confirm evidence
3. choose verified profile or revert to auto-detect
4. record reason
5. audit the change

### Safety rules

- admin/support actions must be explicit and auditable
- generic-safe should remain the default when uncertain
- override UI should explain operational consequences clearly

## Acceptance Criteria

- admins can inspect and update connection capability overrides
- override changes are audited with actor + reason
- support can revert a connection back to safe mode cleanly

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — workflow documented here
- [ ] Internal · support/admin — add verification playbook after ship
