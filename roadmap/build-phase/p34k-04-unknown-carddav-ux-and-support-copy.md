# P34K-04 — Unknown CardDAV UX and Support Copy

## Purpose

Explain the safe-default behavior for unknown CardDAV providers so users do not
misread conservative projection as broken sync.

## Background

Once we make `CardDAV / Other` conservative, some users will see fewer fields on
their remote server than in Kontax. That is correct behavior, but it needs calm
copy.

## Scope

**In scope**
- connection detail copy for generic-safe CardDAV
- settings/support copy that explains "safe mode"
- wording for verified vs generic-safe status where needed

**Out of scope**
- deep compatibility debug UI

## Design / Implementation Spec

### Preferred framing

Use language like:

- "This CardDAV provider hasn’t been verified for every field type yet."
- "Kontax sends the fields most providers reliably support."
- "Richer fields stay in Kontax until this provider is verified."

Avoid language like:

- "sync failed"
- "this provider is broken"
- "data was dropped"

### Support expectations

Support/admin surfaces may be slightly more explicit, for example:

- `Mode: generic-safe`
- `Extra significant dates kept in Kontax until provider verification`

## Acceptance Criteria

- unknown CardDAV safe mode can be explained in plain language
- copy distinguishes conservative behavior from sync failure
- verified connections can be distinguished from generic-safe ones where useful

## Documentation

- [ ] External · users — later help copy
- [ ] External · developers — none
- [x] Internal · engineering — wording intent documented here
- [ ] Internal · support/admin — later support copy
