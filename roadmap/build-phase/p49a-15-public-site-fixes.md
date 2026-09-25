# P49A-15 — Public site: /about & /contact public, dead links, mobile, titles

**Phase:** 49A · **Priority:** P1 · **Depends on:** — · **Effort:** S
**Audit IDs:** A-35, A-36, A-37

## Objective
Every public page and link works for a logged-out visitor on phone and desktop.

## Production verification (2026-09-25) — all live on getkontax.com
- `/about` → 307 `/login?next=%2Fabout`; `/contact` → 307 `/login?next=%2Fcontact`. The pages exist
  (`src/app/(marketing)/about`, `/contact`) but are missing from `PUBLIC_PREFIXES` in
  `src/middleware.ts`. `/pricing` links to `/contact` ("Get in touch").
- `/u/demo` → 404 (linked from `/features:313` "see an example card").
- `/changelog.xml` → 404 (RSS link on `/changelog:47`).
- `<title>Help — Kontax · Kontax</title>` and `<title>Developer docs — Kontax · Kontax</title>`.
- At 375 px `/changelog` scrolls sideways (scrollWidth 385; `.chg-entry__date--mobile`), and the
  `/help` search input is 15 px (iOS zoom on focus).

## Steps
1. Add `/about` and `/contact` to `PUBLIC_PREFIXES`; check the contact form's action/route is also
   reachable logged-out and rate-limited; add both to the sitemap if missing.
2. `/u/demo`: create a demo public card (seeded, non-personal) or point the link at a static
   example.
3. Add a `changelog.xml` route (RSS from the changelog data) or remove the link.
4. Drop the extra "· Kontax" from those two page titles (template already appends the brand).
5. Fix the changelog mobile date overflow; set the help search input to 16 px.

## Acceptance
- Logged-out `curl` of every footer/nav link returns 200.
- No horizontal scroll at 375 px on any public page; no input under 16 px.
