# P38-10 — Static Marketing Pages + Import-Export Bundle Split

## Status
Marketing static conversion implemented & verified 2026-07-02. Import-export
split deferred (see below).

**Root cause found:** every route was `ƒ` (dynamic) not because of the pages
themselves but because the ROOT layout rendered `<ImpersonationBanner>`, a
server component calling `auth()` on every request. Moving that to a
client-side fetch (`/api/impersonation`) was the unlock — a broader win than
the ticket scoped.

**Done:**
- `/changelog`, `/developers`, `/features`, `/help`, `/privacy`, `/security`,
  `/terms` → `○` Static; `/pricing` → Static with 1h ISR (Stripe prices) and
  client-resolved current-plan highlight (`/api/billing/plan`). All were `ƒ`.
- Session-aware chrome resolves client-side after hydration:
  `useSessionUser` hook (`/api/auth/session`) feeds MarketingNav + PublicNav;
  ImpersonationBanner and the pricing plan badge fetch their own state.
- Middleware lets `/api/impersonation` + `/api/billing/plan` through so anon
  visitors get clean JSON instead of a redirect to /login.
- Verified: static pages serve in 4–15ms with no auth cookie; logged-out nav
  shows Log in / Get started; logged-in session peek returns the user and the
  page still serves statically (nav swaps client-side); app routes stay gated.
- `/` (homepage) intentionally stays dynamic — its hero personalises on the
  server for logged-in users.

**Deferred — import-export bundle split:** the 139 kB route weight is
hand-written wizard code (import-preview-form 723 + import-field-mapping 652
lines), not a heavy dependency. A `next/dynamic` wrapper splits the chunk but
the wizard renders on page load, so it stays in first-load JS — the <150 kB
criterion isn't met without gating the wizard behind an interaction (a page
restructure into client tab-state that risks the export flow). Reverted the
ineffective wrapper; tracked as a follow-up. The marketing conversion is the
phase's real rendering win.

## Purpose

Two independent low-priority wins bundled as one ticket: stop server-rendering
the public marketing/legal pages on every hit, and split the one outlier client
bundle (`/import-export`).

## Background

The production build shows every route as `ƒ (Dynamic)` — including `/pricing`,
`/features`, `/security`, `/changelog`, `/help`, `/privacy`, `/terms`, and
`/developers`. These are the pages anonymous visitors and search crawlers hit;
each request currently runs the full RSC render. They are dynamic because
something in the tree reads request state (most likely a session check to swap
logged-in/out chrome, per the middleware's public-prefix design).

Separately, `/import-export` has a 146 kB route chunk (269 kB first load) —
the only bundle outlier; everything else sits near the healthy 102 kB shared
baseline. The import wizard (preview, field mapping) loads eagerly even for
users who land on the page just to export.

## Scope

**In scope**
- Identify what forces dynamic rendering on each marketing/legal page (likely
  `auth()` in a shared shell or `headers()`/`cookies()` reads) and restructure
  so the page body is static: either fully static pages with a small client
  component for the logged-in header state, or ISR (`revalidate = 3600`).
- `/help` FAQ content (`help-faq-data.ts` is one of the largest source files)
  is a natural static page.
- `next/dynamic` the import wizard's heavy steps (`import-preview-form.tsx`,
  `import-field-mapping.tsx`) so `/import-export` initial load carries only
  the landing/export surface.

**Out of scope**
- The logged-in app routes (correctly dynamic).
- Marketing copy/design changes.
- CDN-level caching config (Cloudflare already fronts getkontax.com; static
  output makes its caching effective without extra work).

## Design / Implementation Spec

- Pattern for "static page, session-aware header": server-render the page
  statically with the logged-out header, hydrate a tiny client component that
  checks the session (or just the cookie's presence) and swaps the header CTA.
  The middleware already passes these routes through without auth.
- Verify with `next build` output flipping the routes to `○ (Static)` /
  `● (SSG)`.

## Acceptance Criteria

- `/pricing`, `/features`, `/security`, `/privacy`, `/terms`, `/help`,
  `/developers`, `/changelog` render as Static or ISR in the build output.
- Logged-in users visiting a marketing page still see appropriate header state
  (client swap verified).
- `/import-export` first-load JS drops below ~150 kB in the build output;
  import wizard still functions end-to-end (run an actual CSV import on
  staging).

## Risks / Open Questions

- The changelog may be intentionally dynamic if it reads from the DB — if so,
  ISR with a short revalidate rather than fully static.
- Check `robots`/`sitemap`/OG image routes aren't inadvertently coupled.

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — note the static-page + session-header pattern
- [ ] Internal · support/admin — none
