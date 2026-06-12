# P24B-24 — Bug: shared contacts 404 for members (+ SW stale-login hardening)

## Purpose

Fix the reported "tap a contact → error/login screen, pull-to-refresh shows it" bug, and the related
mobile-toolbar divergence flagged alongside it.

## Background

Reported on the mobile PWA: tapping *some* contacts showed an error/login-looking screen while a
pull-to-refresh loaded the detail. Reproduced at 375px logged in as a **family member**:

- **Owned contacts** (`/contacts/[id]`) → 200, open fine.
- **Family/team-shared contacts** → **404** (bare Next.js "This page could not be found").

Root cause: the contact detail query was **owner-scoped** (`where: { id, userId }`), so a member saw
shared contacts in the list (which grants access via shared books) but the detail page couldn't find
them. The detail page already had full rendering support for shared contacts (the "Shared with the
… book" panel + member roster) — only the query blocked them.

Two findings handled together:
1. **Toolbar divergence** — the desktop Sort/Compact-Cozy/All-Private bar rendered on mobile; the
   design's mobile list has none.
2. **The 404/login symptom** — owner-scoped detail access + a service worker that cached redirected
   navigations (an auth redirect to /login could be cached under the page URL and served later).

## Scope

**In scope:** grant the detail page the *same* shared-book read access the list uses; gate the mobile
toolbar to desktop; harden the SW navigation cache. **Out of scope:** full member vs owner edit-gating
UX (that's P24B-08 / P24B-13 — the contact already computes `access: owner/edit/view`).

## Design / Implementation Spec

- **Access (`contacts/[id]/page.tsx`):** fetch the user's accessible book ids
  (`getUserFamilyMembership().bookId` + `getAccessibleTeamBooks()`), then query
  `where: { id, OR: [{ userId }, { groupContacts: { some: { groupAddressBookId: { in: bookIds } } } }] }`
  — mirroring `contacts/page.tsx` exactly. **Do not widen beyond the list's access.**
- **Toolbar (`contact-dashboard.tsx`):** `flex` → `hidden … md:flex`.
- **Service worker (`public/sw.js`):** cache navigations only when `response.ok && !response.redirected`;
  bump cache version `v2 → v3` to evict any poisoned entries.

## Acceptance Criteria

- Member can open a shared family/team contact (200, full detail + family panel). ✅
- Owned contacts still open; a nonexistent / non-accessible id still 404s (no over-grant). ✅
- Mobile contacts list shows no sort/view/scope toolbar; desktop unchanged. ✅
- SW never caches a redirected (auth) navigation. ✅

## Risks and Open Questions

- The user's literal "pull-to-refresh fixes it" wasn't reproduced server-side (a 404 would also 404 on
  refresh) — likely the bare-404 misread as login, and/or the SW serving a stale page; both addressed.
  If the soft-vs-hard discrepancy persists on device, it needs on-device repro (Next prefetch / router
  cache) — re-open then.
- Member **edit** of shared contacts is owner-scoped server-side; full read-only/edit gating UX is
  P24B-08 / P24B-13. This ticket only restores **openability** (read).
