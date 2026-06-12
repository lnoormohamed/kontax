# P24B-13 — Family / Teams management: owner vs member + permissions

## Purpose

Design the Family and Teams management screens for mobile across roles — member (read + leave) vs
owner/admin (invite, role-change, remove, per-book permissions) — including the team permission matrix.

## Background

The **member** family view is already excellent on mobile (roster cards, role badges, Leave). The
**owner/admin** views (invite management, role editing, Teams per-book permission matrix) were not
reachable as a Free family-member during the sweep and have desktop-shaped wide content (3 wide-content
markers). Depends on P24B-02 (back-nav), P24B-03 (variance), P24B-04 (table→cards).

## Scope

**In scope:** Family + Teams management at 375px for OWNER/ADMIN/MEMBER, including roster, invites,
role changes, remove, per-book permissions (Teams), pending invitees, and the upsell for non-group
plans. **Out of scope:** the underlying group/invite server logic.

## Design / Implementation Spec

Per spec §E6 and §E0.3.
- **Member:** roster cards (avatar · name/email · role badge) + "Leave" danger card. No management
  controls (hidden, not disabled).
- **Owner/Admin:** add invite, change role, remove member, and (Teams) per-book permissions. Use
  `PendingChip` for `inviteStatus = PENDING` with resend/revoke. Owner-only: billing/seat management,
  disband/transfer.
- **Permission matrix (Teams):** render via P24B-04 — prefer **per-member cards** listing each book +
  its permission (read/write) over a scrolled grid; fall back to sticky-column scroll if needed.
- **Non-group plans (Free/Pro):** `UpsellCard`.
- Destructive actions (remove, leave, disband) use the P24B-05 confirm dialog.

## Acceptance Criteria

- Member sees roster + Leave only; no management controls present in the DOM (hidden).
- Owner/Admin can invite, change role, remove, and (Teams) edit per-book permissions on mobile.
- Pending invitees show the pending chip + resend/revoke (owner/admin).
- The Teams permission matrix is usable at 375px (no page overflow).
- Free/Pro without a group sees the upsell.
- Verified with seeded Family-owner and Teams owner/admin/member accounts.

## Risks and Open Questions

- **Design brief:** P24B-DB15 (Family & Teams mobile management surfaces) — build to its requirements.
- **Needs seeded accounts** (Family owner; Teams owner/admin/member) — not reachable as Free member.
- Confirm ADMIN capabilities for Family vs Teams (ADMIN is primarily a Teams role).
