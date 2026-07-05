# P34I-06 — Date-Field Compatibility Rules

## Purpose

Codify the exact sync rules for `birthday` vs other significant dates across
providers with uneven support.

## Background

Dates are the clearest real-world example of capability mismatch:
- `BDAY` is broadly supported
- extra dates such as `Anniversary` and `Lunar birthday` are not

Because we already validated extra dates against iCloud, this ticket should
turn that knowledge into explicit field-family rules instead of leaving it as
connector trivia.

## Scope

**In scope**
- define canonical significant-date semantics
- define provider support behavior for birthday vs non-birthday dates
- verify custom-label date handling (`Anniversary`, `Lunar birthday`, arbitrary custom)

**Out of scope**
- general custom-field support
- help copy

## Design / Implementation Spec

### Required rules

- `birthday` is its own first-class field family
- `significantDates` is a separate family
- providers may support:
  - `birthday` only
  - `birthday + significantDates`
  - `birthday + limited/custom-label significantDates`

### Expected behavior examples

#### iCloud -> Kontax -> Fastmail
- iCloud contact has birthday + anniversary + lunar birthday
- Kontax stores all three
- Fastmail receives birthday only
- later Fastmail sync does not erase anniversary/lunar birthday

#### Fastmail -> Kontax -> iCloud
- Fastmail edits birthday
- Kontax updates birthday
- iCloud later receives updated birthday
- existing iCloud-only extra dates remain intact unless explicitly changed in a
  provider that supports them

## Acceptance Criteria

- Date sync rules are explicit in code or mapping helpers
- Birthday remains safely syncable across all current providers
- Non-birthday significant dates survive weaker-provider round-trips
- Custom labels like `Lunar birthday` remain canonical in Kontax even if not
  projected to every provider

## Risks / Open Questions

- Decide whether `Anniversary` should eventually become a first-class special
  case in more providers or remain part of generic significant-date handling.

## Documentation

- [ ] External · users — later help copy
- [ ] External · developers — none
- [x] Internal · engineering — date compatibility rules documented here
- [ ] Internal · support/admin — none
