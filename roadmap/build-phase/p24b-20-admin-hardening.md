# P24B-20 — Admin minimal mobile hardening

## Purpose

Ensure the admin pages don't break below 768px without investing in a full mobile redesign — admin is
desktop-primary (decision locked).

## Background

Decision (2026-06-12): admin (`/admin` + audit/broadcast/feature-flags/metrics/users/users/[id]) is
desktop-primary. These are dense dashboards/tables; a mobile redesign isn't worth it, but they
shouldn't be unusable on a phone in a pinch.

## Scope

**In scope:** prevent layout breakage `< 768`: wrap dense tables in horizontal scroll, keep headers/
controls readable, tap targets ≥44px. **Out of scope:** any card/redesign of admin surfaces; bottom nav
on admin.

## Design / Implementation Spec

Per spec §E11. For each admin route: confirm no fixed-width container forces page-level horizontal
scroll; wrap wide tables in `overflow-x:auto`; ensure primary controls remain reachable and ≥44px. No
new chrome, no bottom nav.

## Acceptance Criteria

- No admin route causes page-level horizontal scroll at 375px (only table regions scroll).
- Controls/headers remain readable and tappable (≥44px).
- No functional change on desktop.

## Risks and Open Questions

- Requires an admin-role account to verify (`grant-admin` script).
