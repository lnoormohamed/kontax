# P34J-01 — Provider Capability Copy in Sync Surfaces

## Purpose

Add calm, plain-language copy that explains when some fields are intentionally
kept in Kontax because a linked provider does not support them.

## Background

Once Phase 34I is in place, the behavior is correct but potentially confusing.
Users may expect every field to appear in every provider.

## Scope

**In scope**
- lightweight copy in connection detail and related sync surfaces
- provider-specific wording where useful
- explain "kept in Kontax" vs "failed to sync"

**Out of scope**
- support/debug-only deep technical detail

## Design / Implementation Spec

### Preferred wording

Use language like:
- "Some providers do not support every contact field."
- "Unsupported fields stay in Kontax and in providers that support them."

Avoid language like:
- "sync failed"
- "data was dropped"

## Acceptance Criteria

- Sync/account surfaces can display capability limitation guidance
- Copy does not imply data loss when the behavior is intentional
- Copy is specific enough to reduce support confusion

## Documentation

- [ ] External · users — may become help center copy later
- [ ] External · developers — none
- [x] Internal · engineering — wording intent documented here
- [ ] Internal · support/admin — none
