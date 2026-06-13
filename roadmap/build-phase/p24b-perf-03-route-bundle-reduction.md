# P24B-PERF-03 — Route bundle reduction

## Status

In Progress — first lazy-load pass implemented 2026-06-13.

## Purpose

Reduce initial client JavaScript on high-traffic routes by moving heavy, rarely-opened overlays and modals out of the default route bundle.

## Background

Kontax has several interactive surfaces that are imported eagerly even though users only need them after an explicit action. Examples include security alert drawers, two-factor enrolment, contact edit sheets, merge dialogs, import previews, and other modal-style flows. Lazy-loading these surfaces should improve first interaction readiness on both mobile and desktop.

## Scope

**In scope:** dynamic imports for modal/drawer surfaces, route-bundle cleanup, and low-risk lazy loading that does not alter UX.

**Out of scope:** server query changes, visual redesign, route restructuring, or replacing existing components.

## Acceptance Criteria

- Heavy drawer/modal surfaces are not loaded until needed.
- Desktop and mobile UX stays unchanged.
- Build passes after each lazy-loading slice.
- Route bundle size for affected pages does not increase.

## Implementation Notes

- Lazy-loaded `SecurityAlertDrawer` from the notification bell.
- Lazy-loaded `TwoFactorModal` from the security settings 2FA section.

## Follow-up Candidates

- Lazy-load `MobileContactSheet` from create/edit entry points.
- Lazy-load merge confirmation/dialog surfaces.
- Lazy-load import/export preview components where practical.
- Review notification/search overlays after measuring bundle impact.
