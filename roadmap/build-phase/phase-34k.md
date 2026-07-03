# Phase 34K — Safe Generic CardDAV & Verified Provider Promotion

> Defines how Kontax should handle unknown CardDAV providers safely, without
> pretending we can infer full field support from the protocol alone.

## Phase status
Pre-plan

## Phase objective
Make the `CardDAV / Other` path safe and predictable by introducing a
conservative generic capability profile, then adding a clean way to promote a
provider or connection to a richer verified profile once we have evidence.

Phase 34I made multi-provider sync safe for known providers.  
Phase 34J made that behavior legible.  
Phase 34K closes the hardest gap: unknown CardDAV servers.

## Background

For iCloud and Fastmail we now have real observed behavior and explicit
profiles. For generic CardDAV providers, we do **not** have a trustworthy
server-side capability declaration for things like:

- extra significant dates
- custom labels
- structured address fidelity
- round-tripping of non-standard `X-` properties

CardDAV can tell us a lot about protocol support, but not enough about semantic
contact-field fidelity. In practice, the only reliable proof is a controlled
write + read-back roundtrip.

That means `CardDAV / Other` should not assume rich support by default.

## Core product rule

Unknown CardDAV providers should start in a **safe projection mode**, not a
full-fidelity mode.

## Success criteria

- Unknown CardDAV providers default to a conservative capability profile.
- Kontax preserves canonical data when a generic provider cannot be trusted to
  round-trip richer fields.
- Known-safe providers can still use richer verified profiles.
- There is a clear path to promote a provider or connection from generic-safe
  to verified behavior.
- Support and QA can explain which behavior came from safe defaults vs verified
  capability knowledge.

## Exit criteria

- `carddav-generic-safe` profile exists and is used by default for unknown
  CardDAV providers.
- The safe profile is defined by explicit field-family rules, not vague
  heuristics.
- Projection, merge, and conflict logic respect the safe profile.
- A provider/connection can be explicitly promoted to a richer verified profile
  without schema ambiguity.
- UX and QA artifacts describe the safe-default behavior clearly.

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34K-01 — Generic-safe CardDAV capability profile and field matrix](p34k-01-generic-safe-carddav-capability-profile-and-field-matrix.md)
> - [P34K-02 — Generic-safe outbound projection and inbound ownership rules](p34k-02-generic-safe-outbound-projection-and-inbound-ownership-rules.md)
> - [P34K-03 — Verified provider promotion and override model](p34k-03-verified-provider-promotion-and-override-model.md)
> - [P34K-04 — Unknown CardDAV UX and support copy](p34k-04-unknown-carddav-ux-and-support-copy.md)
> - [P34K-05 — Generic-vs-verified CardDAV QA harness](p34k-05-generic-vs-verified-carddav-qa-harness.md)

## Suggested implementation order
1. P34K-01 — define the safe profile
2. P34K-02 — enforce it in sync semantics
3. P34K-03 — add verified promotion / override
4. P34K-04 — explain the behavior in-product
5. P34K-05 — QA + rollout signoff

## Product decisions captured here

- Do **not** rely on live server capability discovery for semantic field
  fidelity in v1.
- Unknown CardDAV should bias toward canonical preservation, not maximal remote
  projection.
- False negatives are preferable to false positives:
  - better to keep a field in Kontax only
  - than to send it to a weak provider, lose fidelity, and create destructive
    ambiguity on resync
- Promotion from generic-safe to verified should be explicit and explainable.

## Risks / open questions

- **Too conservative by default:** some generic servers may actually support
  richer fields, so users may initially see fewer fields projected than their
  server could store.
- **Verification source of truth:** we need to decide whether verified
  promotion is:
  - host-based
  - per-connection
  - admin/support override
  - or a combination
- **Custom labels:** some providers may store labels but normalize them in ways
  that are still lossy; the safe matrix should be explicit about what "support"
  means.
- **Future probes:** a roundtrip probe may be useful later, but should not be a
  hidden background assumption in this phase.

## Documentation
- [ ] External · users — help copy for generic CardDAV safe mode later
- [ ] External · developers — none
- [x] Internal · engineering — this phase file defines the safe-default strategy
- [ ] Internal · support/admin — add verified-promotion runbook after shipping
