# Phase 21 — Admin Section

## Objective

Give internal operators a protected admin surface to manage users, plans, and platform health. Admin tools reduce the manual overhead of running a SaaS: looking up accounts, overriding plans, suspending bad actors, and monitoring platform health. Not exposed to end users — admin routes are protected by a separate role check.

## What already exists

- `User` model with `lifecycleState` — ACTIVE, GRACE, LOCKED, etc.
- `ActivityEvent` model for per-user activity
- `billing.ts` entitlement layer
- `Subscription` and `SubscriptionCustomer` models
- No `User.role` field — needed for admin gate (P21-01)
- No `AdminAuditEvent` model — needed for audit trail (P21-02)

## What this phase adds

- `User.role` enum (USER / ADMIN) with middleware protection on `/admin/**`
- `AdminAuditEvent` table for all admin actions
- User search and detail panel
- Plan override, account suspend/unsuspend, and admin-triggered deletion
- Platform metrics dashboard
- Read-only impersonation
- Simple feature flags

## Phase Tracker

| Ticket | Title | Status | Priority | Depends On |
| --- | --- | --- | --- | --- |
| DB-04 | Design brief — admin dashboard and user management surfaces | Not Started | P1 | P21-03 |
| P21-01 | Admin role and route guard — `User.role` enum, middleware for `/admin/**` | Not Started | P0 | P18-10 |
| P21-02 | Admin audit log — `AdminAuditEvent` table; every admin action recorded | Not Started | P0 | P21-01 |
| P21-03 | User search and detail panel — look up by email/name; view plan, contacts, last active | Not Started | P0 | P21-01 |
| P21-04 | Plan override — set a user's plan manually; record reason; flag in UI | Not Started | P1 | P21-03, P19-04 |
| P21-05 | Flag and suspend account — suspend (blocks login), unsuspend, admin-triggered delete | Not Started | P1 | P21-03 |
| P21-06 | Platform metrics overview — total users, plan breakdown, DAU/MAU, error rates | Not Started | P1 | P21-03 |
| P21-07 | Impersonation (read-only) — view the app as a user without modifying their data | Not Started | P2 | P21-03 |
| P21-08 | Feature flags — per-user and percentage-rollout flags for unreleased features | Not Started | P2 | P21-01 |

## Build order

P21-01 (role + guard) → P21-02 (audit log) → P21-03 (user search) → P21-04 + P21-05 + P21-06 in parallel → P21-07 + P21-08 last.

## Exit criteria

- `/admin/**` is inaccessible to non-admin users.
- Every admin action is recorded in `AdminAuditEvent`.
- An admin can look up any user, override their plan, and suspend/unsuspend their account.
- The platform metrics page shows live user and subscription counts.
