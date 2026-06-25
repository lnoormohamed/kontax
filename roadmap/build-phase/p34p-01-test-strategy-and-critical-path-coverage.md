# P34P-01 — Repo-Owned Test Strategy and Critical-Path Coverage Baseline

## Purpose

Add project-owned tests for the app's highest-risk paths instead of relying
mainly on manual smoke testing.

## Background

Kontax now has meaningful product risk in sync, billing, admin governance, and
contact editing, but the repo still lacks a clear first-party automated test
baseline.

## Scope

**In scope**
- define the test pyramid for Kontax
- add initial automated coverage for:
  - auth/session continuity
  - contact create/edit
  - sync settings save flows
  - admin guardrails around destructive actions
- make these tests runnable in CI/local without special tribal knowledge

**Out of scope**
- exhaustive coverage of every surface
- visual snapshot testing for the marketing site

## Design / Implementation Spec

### Test layers

- unit tests for pure sync helpers, provider identity rules, and serializer
  logic
- integration tests for server actions and important mutation flows
- Playwright smoke tests for critical browser journeys

### First wave of coverage

- sign in / session continuity
- create contact
- edit contact mid-field without cursor-jump regressions
- save sync settings / reconnect flows
- destructive admin actions require confirmation and audit payloads

### Delivery rules

- tests should live in the repo, not in ad-hoc local scripts only
- each critical flow should have a documented owning suite
- tests should be runnable locally with one or two standard commands

## Acceptance Criteria

- The repo contains meaningful app-owned tests under source control.
- Critical flows have a documented automated test owner/path.
- CI/local commands for running these tests are documented.
- The first-pass suites cover at least one contact edit regression and one sync
  regression.

## Documentation

- [x] Internal · engineering — test strategy lives here first
