# Phase 31 — Session Continuity, Re-auth, and Trust Hardening

## Phase status
Pre-plan

## Phase objective
Make Kontax feel stable and trustworthy after sign-in by removing surprise login interruptions, defining where explicit password re-entry is appropriate, and hardening authenticated navigation across desktop, mobile web, and the PWA.

## Success criteria
- Logged-in users do not randomly land on the login screen during ordinary contact browsing, favoriting, editing, archiving, restoring, importing, exporting, merge review, or settings navigation.
- Sensitive actions use intentional re-authentication prompts instead of silent session failure or surprise redirects.
- Mobile Safari and installed PWA flows preserve session state, scroll position, and intended navigation.
- Redirect behavior is documented clearly enough that future tickets avoid reintroducing same-page auth redirects.

## Exit criteria
- All authenticated app routes share a consistent session-continuity policy.
- Small in-place mutations avoid redirecting unless navigation is part of the user-visible workflow.
- Re-auth requirements are limited to sensitive account, billing, export, destructive, or credential-management actions.
- Mobile PWA and desktop smoke tests cover navigation, favorite/unfavorite, contact detail return, settings, and re-auth-required flows.

## Pre-plan points

| Point | Status | Priority | Notes |
| --- | --- | --- | --- |
| P31-PP01 | Not Started | P0 | Once a user is logged in, ordinary app usage should never surprise them with a login screen. |
| P31-PP02 | Not Started | P0 | Same-page state changes should not use auth redirects as their normal success path. |
| P31-PP03 | Not Started | P0 | Sensitive areas should use explicit password confirmation or step-up auth, not a generic login bounce. |
| P31-PP04 | Not Started | P1 | Mobile Safari and PWA session behavior should be tested separately because cookie, redirect, and cache behavior can differ from desktop. |
| P31-PP05 | Not Started | P1 | Redirect targets should be reserved for clear workflow transitions such as delete-to-list, import-to-history, or completed setup. |
| P31-PP06 | Not Started | P1 | Auth failures inside server actions should produce controlled recovery UX where possible instead of unexpected navigation. |

## Proposed tickets

> **Build-ready detail lives in the standalone ticket files** (the summaries
> below are the overview):
> - [P31-01 — Authenticated navigation redirect audit](p31-01-authenticated-navigation-redirect-audit.md)
> - [P31-02 — Step-up authentication policy](p31-02-step-up-authentication-policy.md)
> - [P31-03 — Mobile PWA session resilience](p31-03-mobile-pwa-session-resilience.md)
> - [P31-04 — Controlled session-expired UX](p31-04-controlled-session-expired-ux.md)

### P31-01 — Authenticated navigation redirect audit

Status: Not Started

Priority: P0

Dependencies: P18-10

Implementation notes:
- Inventory all `redirectTo`, `redirect()`, middleware redirects, and auth-required helpers across app routes and server actions.
- Classify each redirect as ordinary navigation, workflow completion, destructive-action completion, auth-required, or re-auth-required.
- Remove same-page redirects from tap-in-place actions where `revalidatePath` is enough.
- Preserve intentional redirects for delete-to-list, setup completion, and external protocol flows.

Acceptance criteria:
- Contact list to detail to back navigation does not trigger login.
- Favorite/unfavorite from list and detail does not trigger login.
- Desktop and mobile behavior match for ordinary authenticated routes.
- Remaining redirects are documented with a reason.

Risks/open questions:
- Some redirects may be compensating for stale UI state and need replacement loading or optimistic UI states.

### P31-02 — Step-up authentication policy

Status: Not Started

Priority: P0

Dependencies: P18-02, P18-07

Implementation notes:
- Define which actions require password confirmation, TOTP challenge, or recent-session checks.
- Candidate sensitive actions include password change, email change, export all contacts, permanent delete, app password creation, CardDAV credential changes, billing changes, account deletion, and recovery code viewing.
- Keep contact browsing, ordinary edits, favorites, archive/restore, labels, and merge review inside the normal logged-in session.

Acceptance criteria:
- Re-auth prompts clearly explain why confirmation is needed.
- Re-auth returns users to the exact action they attempted.
- Ordinary contact work never asks users to log in again unless the session is genuinely expired.

Risks/open questions:
- Export-all contacts may need a stricter policy than filtered export.
- TOTP availability depends on later account-security implementation.

### P31-03 — Mobile PWA session resilience

Status: Not Started

Priority: P1

Dependencies: P31-01

Implementation notes:
- Test Safari web login and installed PWA login separately.
- Review cookie names, secure flags, same-site settings, middleware fallback behavior, and cached/prefetched authenticated pages.
- Preserve contact list scroll position when returning from detail pages.
- Avoid prefetching routes that can capture stale auth failures.

Acceptance criteria:
- Installed PWA can browse, favorite, unfavorite, edit, archive, restore, and return to list without login loops.
- Mobile Safari no longer reports excessive redirects during normal app navigation.
- Failed auth states show a clear recovery message instead of a blank application error.

Risks/open questions:
- Some PWA behavior may depend on deployment proxy headers and cookie domain configuration.

### P31-04 — Controlled session-expired UX

Status: Not Started

Priority: P1

Dependencies: P31-01

Implementation notes:
- Replace generic login bounces with a dedicated session-expired route or inline recovery screen where appropriate.
- Preserve intended destination after re-login.
- Avoid losing unsaved form input when a session expires during create/edit flows.

Acceptance criteria:
- Expired sessions are understandable and recoverable.
- Re-login returns users to the intended contact or workflow.
- Create/edit forms warn before losing unsaved data.

Risks/open questions:
- Server actions may need structured return states rather than only `redirect()` and thrown errors.

## Cross-phase validation scenarios
- A logged-in user can move from contacts list to detail and back without seeing login.
- A logged-in user can favorite and unfavorite contacts from mobile and desktop without seeing login.
- A logged-in user can edit a contact and stay in the same workflow.
- A user attempting app-password creation or account deletion sees a deliberate confirmation step, not a surprise login page.
- An actually expired session has a clear recovery path and preserves the destination after re-authentication.

## Documentation (per roadmap/documentation-policy.md)
Each ticket in this phase follows the per-ticket documentation convention. The
session-continuity / re-auth policy is itself a documentation deliverable:
- [ ] Internal · engineering — docs/: a "Session continuity & re-auth policy" concept doc (where redirects are allowed, step-up rules) so future tickets don't reintroduce same-page auth bounces.
- [ ] Internal · admins/ops — roadmap/runbooks/: how to diagnose/handle session & re-auth issues in support.
- [ ] External · users — in-app Help (P26-12): only if any user-facing re-auth flow changes copy/behavior.
