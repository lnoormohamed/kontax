# P34I-04 — Capability-Scoped Conflict Detection

## Purpose

Prevent unsupported-field mismatches from generating fake sync conflicts or
false "remote deleted this field" outcomes.

## Background

If Fastmail does not support extra dates, comparing the full canonical contact
against the Fastmail payload guarantees constant disagreement. That is noise,
not a real conflict.

## Scope

**In scope**
- Scope conflict comparisons to supported fields
- Update both mutation-conflict and deletion-conflict logic as needed
- Ensure auto-resolve policies do not mis-handle provider-limited fields

**Out of scope**
- end-user conflict copy
- support UI

## Design / Implementation Spec

### Comparison rule

When building remote-vs-local diffs for a sync account:
- compare only fields the provider supports
- ignore unsupported families for conflict generation

### Practical effect

Fastmail should not open a conflict because:
- local has `Lunar birthday`
- remote does not

But it still may open a conflict if:
- both local and remote changed `birthday`
- both local and remote changed `phoneEntries`

## Acceptance Criteria

- Conflict snapshots and comparison logic use provider capability scope
- Unsupported-field gaps do not create sync conflicts
- Real supported-field conflicts still open and resolve as before

## Risks / Open Questions

- Confirm whether conflict snapshots should still retain ignored field families
  for support/debug visibility even if they are excluded from decision logic.

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — capability-scoped diffing documented here
- [ ] Internal · support/admin — none
