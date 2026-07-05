# P34J-03 — Conflict / Review UX for Provider-Limited Fields

## Purpose

Ensure manual review flows do not frame provider-limited omissions as if they
were true data conflicts.

## Background

If capability-aware conflict logic is working, most unsupported-field cases
should never open a conflict. But any residual review or support UI must still
explain these cases correctly.

## Scope

**In scope**
- adjust conflict/review copy if provider-limited field families appear
- suppress misleading "remote removed field" language
- make capability-limited outcomes distinguishable in support contexts

**Out of scope**
- raw sync engine semantics

## Acceptance Criteria

- conflict/review UI does not treat unsupported-field absence as destructive
  remote removal
- any surfaced provider-limited case is clearly labeled

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — conflict UX constraints documented here
- [ ] Internal · support/admin — none
