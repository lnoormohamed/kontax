# P34O-02 — Provider Detection Registry and Verification-State Model

## Purpose

Create a conservative provider detection registry for CardDAV connections so
Kontax can distinguish:

- verified known providers
- detected-but-unverified providers
- fully generic CardDAV connections

## Background

P34O-01 defines the identity model, but that model is only useful if there is a
clear source of truth for how we derive provider identity. We should not let
arbitrary hostname guesses leak directly into branding.

## Scope

**In scope**
- add a provider detection registry keyed by normalized host / host patterns
- define `VERIFIED`, `DETECTED_UNVERIFIED`, and `GENERIC` identity states
- define the precedence rules when:
  - a host matches a verified entry
  - a host matches only a loose detection hint
  - a user-edited label conflicts with the detected provider
- store enough provenance for support/admin inspection

**Out of scope**
- capability promotion behavior
- custom logos for every provider
- active network probing

## Dependencies

- P34O-01 — identity model and host capture

## Design / Implementation Spec

### Detection sources

Detection should be driven by explicit code-owned data such as:

- exact host matches
- trusted suffix / subdomain mappings where appropriate
- optional manual overrides from future admin tooling

### Registry shape

The registry should be explicit code-owned data, for example:

- stable provider key
- display name
- verification strength
- exact hosts
- optional suffix/pattern rules
- optional brand key / icon key

### Matching precedence

1. exact verified host match
2. exact detected-but-unverified host match
3. trusted suffix / pattern match
4. generic fallback

If several rules match, the most specific rule wins.

### Verification states

- `VERIFIED`
  - the host matches a trusted registry entry
- `DETECTED_UNVERIFIED`
  - the host suggests a provider, but the mapping is not strong enough for full
    branding confidence
- `GENERIC`
  - no reliable provider identity is known

### Provenance fields

Support/admin should be able to inspect:

- normalized host
- matching rule id / registry key
- verification state
- derived display name

### Guardrails

- do not infer a provider name from arbitrary path segments or vanity labels
- do not let a user-edited account label silently change the underlying
  provider verification state
- do not show full branded treatment for `DETECTED_UNVERIFIED`

## Acceptance Criteria

- CardDAV provider detection is driven by an explicit registry, not ad-hoc UI
  logic.
- Verification state is persisted or derivable consistently across app and
  admin surfaces.
- Verified provider identity is only shown when backed by a trusted mapping.
- Unknown hosts fall back to `GENERIC`.
- Matching precedence is deterministic and documented.

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — registry contract documented here
- [ ] Internal · support/admin — future runbook can reference the verification states
