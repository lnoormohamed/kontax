# Phase 34J — Capability-Aware UX, Diagnostics & Multi-Provider QA

> Builds the product-facing layer on top of Phase 34I so users and support can
> understand why certain fields sync to one provider but not another.

## Phase status
Pre-plan

## Phase objective
Make provider field limitations visible, understandable, and testable without
turning ordinary sync into a scary expert-only surface.

Phase 34I makes the behavior safe. Phase 34J makes it legible.

## Background
Once Kontax preserves canonical data against weaker providers, users will still
see cases where:
- a field exists in Kontax
- the same field exists in iCloud
- that field does not appear in Fastmail

That is correct behavior, but without explanation it can look like sync is
broken. We need lightweight product cues, better support surfaces, and QA
coverage that explicitly tests mixed-capability setups.

## Success criteria
- Users can understand why a field was not synced to a provider.
- Support can inspect capability-limited behavior without reading raw vCards.
- Activity/sync history can distinguish "no-op because unsupported" from "field
  removed".
- QA coverage includes mixed-provider fixtures and resync checks.

## Exit criteria
- Connection detail/history surfaces can expose capability limitations in plain
  language where appropriate.
- Sync activity can show when fields were intentionally kept local.
- QA fixtures cover at least:
  - plain English
  - Arabic
  - Mandarin
  - mixed significant-date cases (`birthday`, `anniversary`, `lunar birthday`)

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34J-01 — Provider capability copy in sync surfaces](p34j-01-provider-capability-copy-in-sync-surfaces.md)
> - [P34J-02 — Activity and support diagnostics for unsupported fields](p34j-02-activity-and-support-diagnostics-for-unsupported-fields.md)
> - [P34J-03 — Conflict/review UX for provider-limited fields](p34j-03-conflict-review-ux-for-provider-limited-fields.md)
> - [P34J-04 — Multi-provider capability QA harness and fixtures](p34j-04-multi-provider-capability-qa-harness-and-fixtures.md)

## Suggested implementation order
1. P34J-01 — user-facing copy
2. P34J-02 — activity/support diagnostics
3. P34J-03 — conflict/review behavior
4. P34J-04 — QA harness and signoff

## Product decisions captured here
- Do not warn noisily on every unsupported field; prefer calm explanatory copy.
- "Kept in Kontax" is better language than "failed to sync" when the omission is
  intentional and safe.
- Support/debug surfaces may be more explicit than the main end-user UI.

## Risks / open questions
- **UI noise**: too much capability copy could make sync screens feel fragile.
- **Per-provider nuance**: if capabilities vary within CardDAV providers,
  copy may need provider-specific wording rather than generic "CardDAV" labels.
- **Expectation setting**: we should avoid implying eventual support for every
  provider/field combination unless we intend to build it.

## Documentation
- [ ] External · users — help copy / docs update after UI lands
- [ ] External · developers — none
- [x] Internal · engineering — this phase file defines user-facing expectations
- [ ] Internal · support/admin — add support runbook once diagnostics ship
