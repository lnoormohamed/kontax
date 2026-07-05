# P34S-03 — Marketing and Trust-Surface Cleanup for Launch Credibility

## Purpose

Remove placeholder or trust-eroding public-facing content and tighten the
product's credibility ahead of broader rollout.

## Background

The product itself is becoming serious, but a few public-facing surfaces still
signal "prelaunch" through placeholder proof, pricing caveats, or capability
copy that is looser than the actual product.

## Scope

**In scope**
- replace placeholder testimonials / proof
- finalize pricing and "coming soon" copy where possible
- align public claims with actual shipped capabilities
- tighten help / security / marketing consistency

**Out of scope**
- a complete brand redesign

## Dependencies

- current public site copy and pricing/help surfaces

## Design / Implementation Spec

### Trust-surface audit areas

- homepage
- pricing
- features page
- security/help claims
- public-facing support promises

### Rules

- no placeholder social proof in production-facing pages
- no promises that outrun the shipped product
- public claims should match support guidance

### Audit targets

- homepage
- pricing
- features
- help
- security

## Acceptance Criteria

- Public pages no longer rely on obvious placeholder proof or pricing language.
- Marketing, pricing, and help claims are aligned with the real product.
- The public site feels production-ready rather than prelaunch.

## Documentation

- [x] External · users — this directly affects public-facing copy
- [x] Internal · engineering — cleanup scope documented here
