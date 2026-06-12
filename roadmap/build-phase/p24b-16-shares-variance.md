# P24B-16 — Shares: confirm to spec + Free outbound gating

## Purpose

Confirm the `/shares` screen matches the spec and apply sharing plan variance: Free can't create
outbound shares but can still receive/accept incoming ones.

## Background

The sweep found `/shares` already good on mobile (pending empty-state card + accepted/declined rows).
This ticket applies the sharing gate: `liveShareEnabled`/`staticShareEnabled` are false on Free.

## Scope

**In scope:** verify `/shares` to spec + Free outbound-share gating; verify the contact-level Sharing
affordance gate (coordinates with P24B-08). **Out of scope:** share propagation logic.

## Design / Implementation Spec

Per spec §E8 and §E0. Keep the current layout (pending card / accepted-declined rows / "View contact").
- **Free:** outbound share affordances show an `UpsellCard`/gated state ("Sharing is a Pro feature");
  **incoming** shares can still be viewed and accepted/declined.
- **Pro+:** full. **Read-only:** view incoming only.

## Acceptance Criteria

- `/shares` matches the spec at 375px (verified).
- Free can accept/decline incoming shares but is gated from creating outbound shares.
- Pro+ full; read-only view-only.

## Risks and Open Questions

- Ensure the gate matches server enforcement of `liveShareEnabled`/`staticShareEnabled`.
