# P38-10 — Static Marketing Pages + Import-Export Bundle Split

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
