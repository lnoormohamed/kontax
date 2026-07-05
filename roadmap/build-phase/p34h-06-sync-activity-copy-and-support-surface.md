# P34H-06 — Sync Activity Copy and Support Surface

## Purpose

Make reconnect, retire, and replacement events readable in user-facing activity
feeds and support-facing surfaces.

## Background

Even with the right event model, the experience will still feel opaque if the
user only sees raw status changes. This ticket turns lifecycle events into plain
language and ensures support/debug surfaces expose both row and logical ids.

## Scope

**In scope**
- user-facing activity copy for reconnect/retire/replace events
- support/debug presentation of row id vs `connectionId`
- consistent labels across sync history surfaces

**Out of scope**
- backend event emission itself
- chooser UI

## Design / Implementation Spec

### Example activity copy

- `iCloud reconnected`
- `Fastmail connection retired`
- `New iCloud connection created`
- `Replaced previous iCloud connection`

### Support/debug expectations

Show at minimum:
- sync-account row id
- `connectionId`
- provider
- label
- replaced-by / replaces links

## Acceptance Criteria

- user-facing activity copy exists for reconnect and replace events
- support/debug views expose both row and logical ids
- terminology is consistent with `Retired`

## Risks / Open Questions

- Keep raw ids out of customer-facing copy even if support/debug surfaces show them.

## Documentation

- [ ] External · users — later help/docs update
- [ ] External · developers — none
- [x] Internal · engineering — copy expectations documented here
- [ ] Internal · support/admin — later
