# P24B-DB15 — Design Brief: Family & Teams mobile management surfaces

## Purpose

Design the Family and Teams **management** surfaces on mobile across roles — member (read + leave) vs
owner/admin (invite, role-change, remove, per-book permissions, audit) — including the Teams permission
matrix and pending-invite states. These surfaces are **not** in the P24 prototype, so they need design.

## Background

The member family view is already good on mobile (roster cards + Leave). The owner/admin surfaces and
the Teams per-book permission matrix are desktop-shaped and undrawn for mobile. Group model:
`GroupRole = OWNER/ADMIN/MEMBER`, `inviteStatus = PENDING/ACCEPTED/DECLINED/REVOKED`, `canEdit`,
`addressBookPermissions`. Builds: **P24B-13** (management) and **P24B-14** (audit). Variance rules from
**P24B-DB14**.

## Scope

**In scope:** mobile design for Family + Teams management at all roles, plus pending states and the
non-group-plan upsell. **Out of scope:** group/invite server logic; the family *member* view (already
shipped, used as the baseline pattern).

## Design Requirements

### Chrome
Secondary header (‹ Settings · Family / Team management) + bottom nav (these live under Settings).

### Member view (baseline — keep)
Roster GroupCard: rows = avatar 42 · name/email · role badge. "Leave {group}" danger card at bottom.
**No management controls present** (hidden, not disabled).

### Owner / Admin view (design this)
- **Roster rows** gain an actions affordance: change role, remove member (confirm dialog P24B-05).
- **Invite:** add-member entry (email) → pending row with **PendingChip** + resend/revoke.
- **Teams per-book permissions (matrix):** design as **per-member cards** — each member card lists the
  books with a read/write control per book — in preference to a scrolled grid. Fall back to
  sticky-column scroll (P24B-04) only if cards don't scale.
- **Owner-only:** billing/seat management entry; disband/transfer. **Admin:** all of the above except
  billing and owner-removal.

### Audit (Teams, owner/admin) — build P24B-14
Stacked rows: actor · action · target · timestamp; load-more. Hidden for members.

### Plan / role / lifecycle variance (per P24B-DB14)
- **Free/Pro (no group):** `UpsellCard` ("Family/Teams is a … feature").
- **Member:** read + leave only; management hidden.
- **Owner/Admin:** full management per the role matrix (spec §E0.3).
- **Read-only:** management disabled with reason; roster still viewable.

### States to deliver
member · owner · admin · pending-invitee · seat-limit reached (e.g., 6/6 family, 25/25 teams) ·
non-group upsell · read-only.

### Deliverables
Annotated frames for: member roster, owner roster + invite + role/remove, Teams per-book permission
cards, pending state, audit log, seat-limit, upsell.

## Acceptance Criteria (design sign-off)

- Member vs owner vs admin layouts specified; member never shows management controls.
- Teams permission matrix has an approved mobile layout (cards or sticky-scroll) that fits 375px.
- Pending, seat-limit, upsell, and read-only states designed.
- Tokens/components per Part A; chrome per §B1.

## Dependencies / Risks

- **Needs seeded accounts** to validate (Family owner; Teams owner/admin/member) — not reachable as a
  Free member. Coordinate seeding.
- Confirm ADMIN's exact capabilities for Family vs Teams (ADMIN is primarily a Teams role).
- Implemented by **P24B-13** and **P24B-14**.
