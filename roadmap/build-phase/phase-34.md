# Phase 34 — UI Polish & Tablet Responsiveness

> Addresses visible defects and layout breakages before the go-live marketing push.
> Focused on avatar correctness, dead-route cleanup, and making the app usable
> at tablet breakpoints (768–1024px) — a common device width for business users.

## Phase status
Pre-plan

## Phase objective
Ship the small but visible UI defects that would embarrass a new user's first
session: blank avatar discs for company-only or empty contacts, a stale
`/settings/profile` route that diverges from the Account page, and a two-column
app that breaks entirely at iPad widths. P34-04 produces the authoritative tablet
audit; P34-05 through P34-07 are the first-pass fixes for the worst offenders.

## Background
Three separate pain points converged into this phase:

1. **Avatar defects** — `getInitials` and `tintForName` are copy-pasted across
   seven files and all assume `fullName` is non-empty. Company-only contacts
   render an empty disc; fully-empty contacts render the same empty disc.
   Both are visible in production today.

2. **Dead route** — `/settings/profile` predates the current Account settings
   page and duplicates it. The sidebar still links to it in some views, causing
   user confusion about which page is canonical.

3. **Tablet layout** — the desktop layout (two-column split on sync, settings
   sidebar, contact detail side-by-side panels) was never tested below ~1280px.
   At 768–900px multiple pages are functionally broken. No formal audit exists.

## Success criteria
- All contact avatars show either correct initials or the "person" silhouette —
  never a blank disc.
- `/settings/profile` redirects permanently to `/settings/account`.
- The /sync page, settings sidebar, and contact detail page are usable at 768px
  and 900px without horizontal overflow or unreadably narrow columns.
- A tablet audit findings doc exists and is kept up-to-date through the phase.

## Exit criteria
- Avatar fix verified in contacts list, contact detail (desktop + mobile), and
  search results for contacts with company-only and fully-empty name fields.
- Zero `href="/settings/profile"` references in `src/` that aren't the redirect
  definition itself.
- The three tablet fix tickets (P34-05, P34-06, P34-07) have passing acceptance
  criteria at 768px and 900px in Chrome DevTools.
- `p34-04-tablet-audit-findings.md` documents all P0/P1 issues found.

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34-01 — Avatar fallback: company-only contacts](p34-01-avatar-fallback-company.md)
> - [P34-02 — Avatar fallback: truly empty contacts](p34-02-avatar-fallback-empty.md)
> - [P34-03 — Remove /settings/profile page](p34-03-remove-settings-profile.md)
> - [P34-04 — Tablet layout audit](p34-04-tablet-layout-audit.md)
> - [P34-05 — Tablet fix: /sync page](p34-05-tablet-sync-page.md)
> - [P34-06 — Tablet fix: settings sidebar collapse](p34-06-tablet-settings-sidebar.md)
> - [P34-07 — Tablet fix: contact detail two-panel split](p34-07-tablet-contact-detail.md)

### P34-01 — Avatar fallback: company-only contacts
When `fullName` is blank but `company` is set, derive initials from the company
name and use it as the hash input for the tint colour. Affects all
`getInitials`/`tintForName` copies across seven files. No new component needed —
update the helpers in place.

### P34-02 — Avatar fallback: truly empty contacts
When both `fullName` and `company` are blank, show a `WorkspaceIcon name="person"`
silhouette centred in the tinted disc instead of an empty circle. Uses the same
affected surfaces as P34-01.

### P34-03 — Remove /settings/profile page
Add a permanent redirect in `next.config.js` from `/settings/profile` to
`/settings/account`. Remove nav links. Evaluate whether the route's page files
can be deleted.

### P34-04 — Tablet layout audit
Walk through the full app at 768px, 900px, and 1024px. Document every broken
page with severity. Output feeds P34-05 through P34-07 and future follow-ons.

### P34-05 — Tablet fix: /sync page
At <900px stack the account-list and detail panels vertically. On mobile (≤640px)
the account list is full-width and tapping an account navigates into the detail.

### P34-06 — Tablet fix: settings sidebar collapse
Below 900px, hide the sidebar and show a breadcrumb/back-button header matching
the existing `MobileSecondaryHeader` pattern. Every settings sub-route must be
directly navigable.

### P34-07 — Tablet fix: contact detail two-panel split
Below 900px collapse the side-by-side left/right panels into a single column:
avatar and action buttons at top, then tabs and field sections below.

## Documentation (per roadmap/documentation-policy.md)
- [ ] External · users — in-app Help: none required for redirect/avatar fixes
- [ ] Internal · engineering — docs/: update component map if new shared avatar
      helper is extracted to `~/lib/` or `~/app/_components/`
- [ ] Internal · admins/ops — roadmap/runbooks/: none required
