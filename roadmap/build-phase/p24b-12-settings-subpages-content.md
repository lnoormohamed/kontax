# P24B-12 — Settings sub-pages content pass (mobile)

## Purpose

Confirm and polish each settings sub-page's content to the mobile spec: single-column, card-based,
toggle rows where appropriate. Most already fit; this is the verification + small-fix pass after the
back-nav lands.

## Background

The 2026-06-12 sweep found settings content already card-based and fitting (profile, devices, security,
family-member, teams-upsell). Notifications/preferences toggle rows and account weren't directly
eyeballed. Depends on P24B-02 (back-nav) for the chrome.

## Scope

**In scope:** `profile, account, notifications, preferences, devices, security` content at 375px —
verify + fix single-column/overflow/tap-target issues. **Out of scope:** family/teams (P24B-13),
teams/audit (P24B-14).

## Design / Implementation Spec

Per spec §E6. Keep section-labelled FieldCards / GroupCards; toggles render as rows (label + switch).
Verify: no horizontal overflow, inputs ≥16px, tap targets ≥44px, the `SettingsPageHead` breadcrumb
doesn't double the new back-header title. The 2FA setup should open as a sheet (QR + code) — coordinate
with the security page.

## Acceptance Criteria

- Each listed sub-page verified at 375px: single column, no overflow, ≥44px targets, ≥16px inputs.
- Notifications/preferences toggles render as clean rows.
- No double-title between the back header and any in-page heading.
- 2FA enrolment opens a sheet (QR + code entry).

## Risks and Open Questions

- 2FA QR + recovery-code flow as a sheet may warrant its own small ticket if complex — split if needed.
