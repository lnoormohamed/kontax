# P24B-21 — Plan/role/lifecycle variance QA pass

## Purpose

A final cross-cutting verification that every mobile page renders its plan, role, and lifecycle variants
correctly, using seeded accounts — closing the gaps the initial sweep couldn't reach.

## Background

The 2026-06-12 sweep ran as a single Free family-member, so owner/admin, Pro/Teams, 2FA, and read-only
states are unverified. The variance model (spec §E0) must be confirmed in the running app, not just on paper.

## Scope

**In scope:** drive every variance-bearing page at 375px across seeded accounts and confirm the correct
upsell/limit/read-only/role treatment. File/fix any divergences. **Out of scope:** new features.

## Design / Implementation Spec

Per spec §E0. Seed and test:
- **Plans:** Free, Pro, Family, Teams — contacts limit banner, activity lock/retention, sync cap/upsell,
  sharing gate, import quota, premium export.
- **Roles:** Family owner + member; Teams owner + admin + member — management controls hidden for
  members, present for owner/admin; pending invitees; per-book permissions.
- **Lifecycle:** GRACE / LOCKED (read-only) — FAB/swipe-edit/edit-save/add-connection/invite disabled,
  owned contacts visible, basic export available.
Record results against the §E0.5 who-sees-what table; fix mismatches (or split follow-ups).

## Acceptance Criteria

- Every row of the §E0.5 who-sees-what table verified in the running app at 375px.
- Members never see (in the DOM) controls they can't use; temporary gates are disabled-with-reason.
- Read-only consistently disables the full write-affordance set across pages.
- Divergences fixed or ticketed.

## Risks and Open Questions

- **Depends on seeded accounts:** Pro, Family owner+member, Teams owner+admin+member, and a read-only
  (GRACE/LOCKED) account. Coordinate seeding (see [[db-and-verification-workflow]]); this is the main blocker.
- Run after the build tickets land so there's something to verify.
