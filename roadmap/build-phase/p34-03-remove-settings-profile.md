# P34-03 — Remove /settings/profile page

## Purpose

Eliminate the duplicate `/settings/profile` route by adding a permanent redirect
to `/settings/account` and removing any navigation links that still point to it.

## Background

The route `/settings/profile` (and its sub-route `/settings/profile/card`) predates
the current Account settings page introduced in a later phase. Both pages expose
overlapping functionality (display name, email, avatar). New users who land on
`/settings/profile` via a bookmark, external link, or the settings sidebar
encounter a different experience than the canonical `/settings/account` page —
a source of confusion and a maintenance surface to keep in sync.

The following files reference `/settings/profile` as a navigation destination:
- `src/app/_components/settings-sidebar.tsx`
- `src/app/settings/_components/mobile-settings-nav.tsx`
- `src/app/u/[username]/add-to-kontax.tsx`

The existing page files:
- `src/app/settings/profile/page.tsx`
- `src/app/settings/profile/card/page.tsx` (profile card / QR-code route)
- `src/app/settings/profile/card/card-settings-client.tsx`
- `src/app/settings/profile/card/card-share-tools.tsx`

Note: `/settings/profile/card` is a distinct feature (public profile card / QR
code sharing, added in P28). Confirm before deletion whether this sub-route is
referenced or distinct from `/settings/account`. If it provides features not
present on `/settings/account`, it must be kept or redirected to its own canonical
path rather than blindly deleted.

## Scope

**In scope**
- Add a permanent (308) redirect in `next.config.js`:
  `source: '/settings/profile', destination: '/settings/account'`.
- Remove the `href="/settings/profile"` link from `settings-sidebar.tsx` and
  `mobile-settings-nav.tsx`.
- Audit `src/` for remaining references: `grep -r "settings/profile"
  src/ --include="*.tsx" --include="*.ts"`.
- If `/settings/profile/page.tsx` no longer serves any navigable purpose after the
  redirect, delete the file and directory.
- Document whether `/settings/profile/card` should be redirected to
  `/settings/account` or kept as-is.

**Out of scope**
- Merging the content of the old profile page into `/settings/account` (already
  done in a prior phase).
- Changes to `/settings/profile/card` features themselves.
- Any URL changes to public-facing profile routes (`/u/[username]`).

## Design / Implementation Spec

### next.config.js redirect

```js
/** @type {import("next").NextConfig} */
const config = {
  async redirects() {
    return [
      {
        source: "/settings/profile",
        destination: "/settings/account",
        permanent: true, // 308
      },
    ];
  },
};
```

Add inside `withBundleAnalyzer(config)` — the existing config object is currently
empty (`const config = {}`).

### Navigation link removal

In `src/app/_components/settings-sidebar.tsx`, find the nav item linking to
`/settings/profile` and either:
- Remove it entirely if the Account page item already covers the same label, or
- Change `href` to `/settings/account` if the label/position is meaningful.

Apply the same to `src/app/settings/_components/mobile-settings-nav.tsx`.

### File deletion checklist
1. Confirm `src/app/settings/profile/page.tsx` contains only content now covered
   by `/settings/account`. If yes, delete the file and confirm Next.js no longer
   generates a route for it (build will error if the redirect + page coexist
   awkwardly — test with `next build` locally).
2. Decide `/settings/profile/card` fate. If it is a unique QR/card-sharing
   feature, keep the files; the redirect only covers the parent path. If card
   functionality has been merged into Account, add a second redirect entry.

### Verification
After shipping:
- `curl -I https://<domain>/settings/profile` returns `308` with
  `Location: /settings/account`.
- Navigating to `/settings/profile` in the browser lands on `/settings/account`.
- Settings sidebar and mobile nav contain no dead `/settings/profile` links.
- `grep -r "settings/profile" src/` returns zero results outside the
  `next.config.js` redirect definition itself.

## Acceptance Criteria
- GET `/settings/profile` returns a 308 redirect to `/settings/account`.
- No navigation element in the sidebar or mobile nav links to `/settings/profile`.
- `grep -r 'href="/settings/profile"' src/` returns zero matches.
- If the old page file was deleted, `next build` succeeds with no missing-module
  errors.
- The `/settings/account` page continues to function normally (no regression).

## Risks / Open Questions
- `/settings/profile/card` may contain features (QR code, vCard share) that are
  not duplicated on `/settings/account`. Audit before deleting. If kept, add a
  redirect only for the bare `/settings/profile` path.
- External links or bookmarks pointing to `/settings/profile` will silently
  redirect — this is intentional and desirable.
- The `add-to-kontax.tsx` reference may be a display string rather than a nav
  link; inspect the context before changing it.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [ ] Internal · engineering — docs/: update settings route map if one exists
