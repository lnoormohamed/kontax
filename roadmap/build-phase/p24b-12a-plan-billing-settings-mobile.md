# P24B-12a — Plan & billing settings mobile pass

## Status

Done — implemented 2026-06-13.

## Purpose

Bring the plan and billing settings surface into the mobile settings pass without expanding P24B-12 beyond its original profile/account/notifications/preferences/devices/security scope.

## Background

P24B-12 intentionally covered settings sub-pages, but the `/settings` plan and billing surface was still hidden on mobile behind the settings navigation. This made the mobile settings pass feel complete while leaving subscription state, usage, billing portal actions, and cancellation flows desktop-only.

## Scope

**In scope:** `/settings` plan and billing content on mobile, current plan card, usage rows, billing portal actions, cancellation/downgrade modal, success/portal-return banners, and roadmap tracking.

**Out of scope:** pricing page redesign (P24B-18), Stripe/backend billing changes, plan tier copy changes, and family/team management (P24B-13).

## Design / Implementation Spec

- Keep the mobile settings nav at the top of `/settings`.
- Expose the existing plan and billing content below the nav with the `#plan-billing` anchor.
- Ensure the billing card is single-column, readable, and does not overflow at 375px.
- Make primary billing actions full-width on mobile and compact on desktop.
- Present cancellation as a mobile bottom sheet while keeping the desktop modal.
- Preserve existing lifecycle, usage, group-plan, and portal-return behavior.

## Acceptance Criteria

- Mobile `/settings` includes visible plan and billing content.
- The `Plan & billing` nav row jumps to the billing section.
- Billing portal and cancel-plan actions have 44px mobile tap targets.
- Cancellation modal is bottom-sheet style on mobile.
- Desktop billing layout remains unchanged.

## Implementation Notes

- `/settings` billing wrapper is now visible on mobile.
- `MobileSettingsNav` links `Plan & billing` to `/settings#plan-billing`.
- `BillingSection`, `BillingPortalButton`, and `CancelPlanModal` now include mobile-first sizing and bottom-sheet behavior.
