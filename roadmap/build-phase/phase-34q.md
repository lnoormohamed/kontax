# Phase 34Q — User Trust, Self-Serve Support & Sync Clarity

> Improves the logged-in product experience by giving users better account
> security surfaces, sync diagnostics, richer help, and a more complete dates
> experience.

## Phase status
Pre-plan

## Portfolio priority
3 of 5 (`34O-34S`)

## Phase objective
Reduce support burden and user confusion by making the product explain itself
better in the places where sync, security, and contact fidelity matter.

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34Q-01 — Connected sign-in accounts in security settings](p34q-01-connected-sign-in-accounts.md)
> - [P34Q-02 — User-facing sync diagnostics and unsupported-field explainers](p34q-02-user-facing-sync-diagnostics.md)
> - [P34Q-03 — Help center expansion with provider troubleshooting guides](p34q-03-help-center-and-provider-guides.md)
> - [P34Q-04 — Multiple dates and reminder surfaces beyond birthday](p34q-04-multiple-dates-and-reminder-surfaces.md)

## Suggested implementation order
1. P34Q-01 — close the visible security/settings gap
2. P34Q-02 — expose meaningful sync diagnostics
3. P34Q-03 — turn diagnostics into self-serve help
4. P34Q-04 — productize richer date support

## Why this phase sits here

Phase 34Q should follow 34P and 34O because it depends on:

- stronger sync semantics and test confidence
- a clearer provider identity model

Once those exist, user-facing diagnostics and help become much more truthful
and much easier to maintain.

## Documentation
- [ ] External · users — help copy grows materially in this phase
- [x] Internal · engineering — this phase defines the self-serve support arc
