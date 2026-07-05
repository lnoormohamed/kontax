# Phase 34I — Provider Capability Matrix & Non-Destructive Multi-Sync Semantics

> Defines how Kontax should behave when the same contact is synced across
> providers with different field support levels, so weaker providers do not
> erase stronger-provider data.

## Phase status
Pre-plan

## Phase objective
Make multi-provider sync safe by teaching Kontax which fields each provider can
reliably round-trip, then using that knowledge in outbound projection, inbound
merge, and conflict detection.

Kontax should remain the canonical contact model. Providers are projections of
that model, not authoritative schemas for every field.

## Background
- iCloud supports extra significant dates (`X-ABDATE` + `X-ABLABEL`) beyond
  plain `BDAY`.
- Fastmail/CardDAV currently round-trips `BDAY` but does not reliably expose
  the same richer date set.
- Today, unsupported-field absence risks being interpreted as deletion rather
  than "this provider cannot represent that field".
- The user explicitly called out the dangerous case:
  - iCloud stores `birthday`, `anniversary`, `lunar birthday`
  - Fastmail stores only `birthday`
  - a later Fastmail sync must **not** wipe `anniversary` / `lunar birthday`

## Core product rule
Absence from a provider that does not support a field is **not** a deletion
signal.

## Success criteria
- Kontax has a per-provider field capability matrix.
- Outbound sync only sends fields a provider can safely represent.
- Inbound sync only mutates fields a provider supports.
- Conflict detection compares only fields the provider actually owns/supports.
- Unsupported-field gaps from weaker providers do not erase canonical contact
  data.

## Exit criteria
- Capability rules exist for all current sync providers:
  - CardDAV/iCloud profile
  - CardDAV/Fastmail profile
  - Google
  - Microsoft
- Contact projection and merge logic use the capability rules in both
  directions.
- Significant dates are preserved in Kontax even when one linked provider only
  supports birthday.
- Support/debug output can explain why a field was kept local instead of synced.

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34I-01 — Provider field capability registry](p34i-01-provider-field-capability-registry.md)
> - [P34I-02 — Capability-aware outbound projection](p34i-02-capability-aware-outbound-projection.md)
> - [P34I-03 — Capability-aware inbound merge semantics](p34i-03-capability-aware-inbound-merge-semantics.md)
> - [P34I-04 — Capability-scoped conflict detection](p34i-04-capability-scoped-conflict-detection.md)
> - [P34I-05 — Per-link remote shadow and unsupported-field preservation](p34i-05-per-link-remote-shadow-and-unsupported-field-preservation.md)
> - [P34I-06 — Date-field compatibility rules](p34i-06-date-field-compatibility-rules.md)

## Suggested implementation order
1. P34I-01 — capability registry
2. P34I-02 — outbound filtering
3. P34I-03 — inbound merge semantics
4. P34I-04 — conflict scoping
5. P34I-05 — per-link shadow / provenance
6. P34I-06 — date-specific compatibility pass

## Product decisions captured here
- Kontax is the canonical store for all supported contact data.
- Provider absence only counts as deletion for fields that provider supports.
- Stronger-provider data survives weaker-provider round-trips.
- Capability rules belong in merge logic, not just export logic.

## Risks / open questions
- **Provider granularity**: "CardDAV" alone may be too coarse; iCloud and
  Fastmail likely need distinct capability profiles.
- **Shadow storage shape**: decide whether per-link remote snapshots should be
  full-field shadows or only supported-field subsets.
- **Support burden**: if a field is always local-only for one provider, the UI
  may need to explain that later to avoid confusion.
- **Future custom fields**: richer custom-field sync may need a second-layer
  capability system, not just a static field list.

## Documentation
- [ ] External · users — later help copy for "some providers do not support all fields"
- [ ] External · developers — none
- [x] Internal · engineering — this phase file is the source of truth for
      capability-aware sync semantics
- [ ] Internal · support/admin — add troubleshooting notes after debug surfaces land
