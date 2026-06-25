# Phase 34O — Generic CardDAV Provider Identity & Friendly Naming

> Makes generic CardDAV accounts easier to recognize by capturing a user-facing
> account label, detected provider identity, canonical host metadata, and a
> clear verification state.

## Phase status
Pre-plan

## Portfolio priority
2 of 5 (`34O-34S`)

## Phase objective
Make `CardDAV / Other` connections legible and supportable by separating:

- the label the user chooses
- the provider identity we can detect from the remote endpoint
- the canonical host / base URL we store for diagnostics
- the confidence level of that provider identification

This should let a generic CardDAV account feel less like an opaque manual
connection while still avoiding false certainty about the provider brand.

## Background

Today, generic CardDAV connections can be hard to distinguish once a user has
multiple accounts connected. Known providers like iCloud and Fastmail are
recognizable because they have explicit provider handling and branding, but a
generic CardDAV connection may only expose a freeform label and a raw URL.

That makes the sync rail, activity history, support tooling, and future admin
inspection harder to use. It also creates unnecessary friction when a provider
is recognizable from its host or DAV metadata but we do not surface that
identity safely.

We want a model that is useful without over-claiming:

- if we know the provider, say so
- if we only suspect the provider from the hostname, say that clearly
- if we do not know, fall back cleanly to the user label + canonical host

## Core product rule

Generic CardDAV accounts should have a layered identity model, not just a raw
URL or a guessed brand string.

## Success criteria

- Users can distinguish multiple generic CardDAV connections at a glance.
- The UI can show both a friendly label and a trustworthy provider identity
  state.
- Support/admin tooling can inspect the canonical host and provider detection
  outcome without guesswork.
- Known providers can remain explicitly branded while unknown providers fall
  back safely.

## Exit criteria

- A provider identity model exists for generic CardDAV connections.
- Provider identity is split into:
  - user label
  - display name
  - canonical host / base URL
  - verification state
  - optional provider brand key / icon mapping
- Sync/account UI can display a safe provider identity for unknown providers.
- Admin/support surfaces can inspect the same normalized provider metadata.

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34O-01 — Generic CardDAV provider identity, host capture, and friendly account naming](p34o-01-generic-carddav-provider-identity-and-friendly-naming.md)
> - [P34O-02 — Provider detection registry and verification-state model](p34o-02-provider-detection-registry-and-verification-state.md)
> - [P34O-03 — Sync/account identity surfaces for generic CardDAV connections](p34o-03-sync-account-identity-surfaces-for-generic-carddav.md)

## Suggested implementation order
1. P34O-01 — add the provider identity model and display rules
2. P34O-02 — add trusted host mapping and verification logic
3. P34O-03 — surface the identity model in the product and support UI

## Why this phase sits here

Phase 34O should land soon after the platform-hardening work in 34P because it
unblocks a cleaner user and support experience for generic CardDAV. It also
sets up later work in 34Q around user-facing diagnostics and in future phases
around verified-provider promotion.

## Product decisions captured here

- Provider identity should be layered, not flattened into one label.
- A user-editable account label remains the primary display value.
- Provider branding should only be shown as verified when we have a trusted
  registry match or equivalent explicit knowledge.
- Unknown providers should fall back to neutral CardDAV presentation plus host
  metadata.
- Canonical host information should be retained for support/debugging even when
  the user-facing label changes.

## Risks / open questions

- False branding risk: hostname-based guesses can be wrong if providers use
  white-labeled or custom domains.
- Overloaded labels: we need to avoid showing too many identity fragments in
  cramped sync UI.
- Provider drift: a host may move from generic to verified later; the model
  should support clean promotion.
- Multi-domain providers: some providers may use several endpoint domains that
  all map to the same brand.

## Documentation
- [ ] External · users — help copy for generic provider naming later
- [ ] External · developers — none
- [x] Internal · engineering — this phase file defines the identity model goal
- [ ] Internal · support/admin — add provider-identity support notes after shipping
