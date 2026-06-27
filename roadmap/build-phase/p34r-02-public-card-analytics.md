# P34R-02 — Public Card Analytics and CTA Performance Surfaces

## Purpose

Make public cards feel like an active product by showing basic performance and
engagement analytics.

## Background

The public-card feature already has routing and click instrumentation. Exposing
that activity to users would make the feature feel more valuable and would help
people decide whether their public card is actually working.

## Scope

**In scope**
- page views
- CTA clicks
- QR/open tracking where already supported
- simple trend / top-action breakdown

**Out of scope**
- deep attribution or external ad analytics

## Dependencies

- existing public-card click/view instrumentation

## Design / Implementation Spec

### First-wave metrics

- views over time
- top CTA clicked
- recent traffic trend
- per-card summary

### Presentation rules

- keep the analytics lightweight and understandable
- avoid fake precision where tracking is partial

### Useful first metrics

- 7-day / 30-day views
- most-clicked action
- latest activity timestamp

## Acceptance Criteria

- Users with public cards can see useful engagement metrics.
- Analytics tie back to existing click/view instrumentation where possible.

## Documentation

- [ ] External · users — likely needs a help page later
- [x] Internal · engineering — metric scope documented here
