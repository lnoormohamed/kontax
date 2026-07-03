# P34K-03 — Verified Provider Promotion and Override Model

## Purpose

Create a clean path to move from generic-safe behavior to richer verified
behavior when we have evidence that a provider or connection safely supports
more fields.

## Background

If every unknown CardDAV provider stays generic forever, we leave capability on
the table. But if we auto-promote carelessly, we reintroduce destructive risk.

We need an explicit promotion model.

## Scope

**In scope**
- define how generic-safe becomes verified
- decide host-level vs connection-level override behavior
- define storage shape for the selected capability profile

**Out of scope**
- full automated roundtrip probing
- mass provider compatibility cataloguing

## Design / Implementation Spec

### Recommended model

Support both of these layers:

1. **Known host/provider mapping**
   - e.g. iCloud, Fastmail, future verified providers
2. **Explicit connection-level override**
   - support/admin can mark a connection as verified for a richer profile

### Important constraint

Promotion should be explicit and inspectable. Users/support should be able to
answer:

- why is this connection in generic-safe mode?
- why was it promoted?
- which profile is active now?

### Outbound/inbound impact

Once promoted, the connection should use the richer verified profile for:
- projection
- merge ownership
- conflict scoping
- diagnostics

## Acceptance Criteria

- capability-profile selection supports generic-safe and verified paths
- connection/profile choice can be explained without guesswork
- promotion path does not require destructive migration of link state

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — override model documented here
- [ ] Internal · support/admin — support process later
