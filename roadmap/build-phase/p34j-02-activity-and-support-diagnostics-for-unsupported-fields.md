# P34J-02 — Activity and Support Diagnostics for Unsupported Fields

## Purpose

Give activity/support surfaces a way to say "this field stayed local because
that provider does not support it" instead of presenting a silent no-op.

## Background

The user explicitly wanted something like:
- `2 fields kept local because Fastmail does not support them`

That is exactly the kind of diagnostic that makes safe behavior understandable.

## Scope

**In scope**
- sync job / activity summary diagnostics
- support-facing per-connection detail if available
- count or list unsupported-field omissions

**Out of scope**
- full end-user diff UI

## Design / Implementation Spec

### Recommended outputs

At minimum support one of:
- summary count (`2 fields kept local`)
- grouped family note (`significant dates not sent to Fastmail`)

Prefer family-level explanations over raw field-name spam.

## Acceptance Criteria

- Sync surfaces can expose unsupported-field omissions
- Diagnostics distinguish:
  - unsupported omission
  - deletion
  - conflict
  - no-op

## Documentation

- [ ] External · users — later if surfaced publicly
- [ ] External · developers — none
- [x] Internal · engineering — diagnostic expectations documented here
- [ ] Internal · support/admin — support copy later
