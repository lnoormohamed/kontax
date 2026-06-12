# P24B-14 — Teams audit log (mobile)

## Purpose

Render the team audit log readably on mobile as stacked rows (or sticky-column scroll), so Teams
owners/admins can review activity on a phone.

## Background

`/settings/teams/audit` is a log table — desktop-shaped. Teams-only, owner/admin. Depends on P24B-04
(table→cards) and P24B-02 (back-nav).

## Scope

**In scope:** mobile layout for the audit log. **Out of scope:** audit data/retention logic.

## Design / Implementation Spec

Per spec §E6. Each entry as a stacked row/card: actor · action · target · timestamp (FieldRow-style).
Long lists paginate/load-more. If a tabular view is preferred, use the P24B-04 sticky-column scroll.
Visible to owner/admin only (members don't see audit).

## Acceptance Criteria

- Audit entries are readable at 375px with no page overflow.
- Pagination/load-more works.
- Visible only to owner/admin (role-gated, hidden for members).

## Risks and Open Questions

- Needs a seeded Teams account with audit history to verify.
