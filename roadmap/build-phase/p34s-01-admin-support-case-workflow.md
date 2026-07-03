# P34S-01 — Admin Support Case Workflow on Top of Notes and Timelines

## Purpose

Build a lightweight support case workflow on top of the new support notes and
timeline primitives so admin work can be assigned, tracked, and handed off.

## Background

Support notes and timelines are a strong base, but once several admins are
helping users, loose notes are not enough. We need a small but explicit case
layer.

## Scope

**In scope**
- case status
- assignee
- severity / priority
- next follow-up date
- handoff summary

**Out of scope**
- full external ticketing integration

## Dependencies

- admin support notes
- support timelines
- admin overview queues

## Design / Implementation Spec

### Case lifecycle

- open
- waiting on user / provider
- resolved
- archived

### Surface requirements

- visible from admin home
- visible from user detail
- visible from sync connection detail where relevant

### Useful case metadata

- owner / assignee
- severity
- current blocker
- next expected action

## Acceptance Criteria

- Admins can manage support work as cases, not just loose notes.
- Cases can be handed off cleanly between teammates.
- Open support work is visible from the admin home and user/sync detail pages.

## Documentation

- [x] Internal · support/admin — workflow docs required
- [x] Internal · engineering — case model documented here
