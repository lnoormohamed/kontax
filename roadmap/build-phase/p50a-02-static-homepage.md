# P50A-02 — Static homepage (no per-request `auth()`)

**Phase:** 50A · **Priority:** P1 · **Effort:** M · **Built with:** P50-03

## Problem (verified 2026-09-25)
`src/app/(marketing)/page.tsx:69` calls `await auth()` to choose the signed-in hero variant, so the
most important URL is fully dynamic: `cache-control: private, no-store`, `cf-cache-status:
DYNAMIC`, TTFB ≈ 640–840 ms, while `/pricing` and `/features` are served from cache.

## Steps
1. Render the homepage statically (or ISR) with the signed-out content as the default HTML.
2. Move the signed-in differences (hero greeting + "Open Kontax", closing CTA) into a small client
   component that reads the session the same way the marketing nav does (`/api/...` peek already
   used by the nav), swapping content after hydration without layout shift (reserve space; keep
   both CTAs the same size).
3. Keep FAQ JSON-LD and metadata static.

## Acceptance
- `/` response is cacheable (`x-nextjs-cache: HIT` / CDN cacheable) for signed-out visitors.
- TTFB for `/` within 100 ms of `/pricing` on the same host; CLS < 0.05 for signed-in visitors.
- Signed-in users still see "Welcome back" and "Open Kontax".
