# P31-03 — Mobile PWA Session Resilience

## Purpose

Make the installed PWA and mobile Safari preserve session state and navigation
the way desktop does — no login loops, no stale authenticated HTML served from
the service worker cache, and preserved scroll position when returning from a
detail page.

## Background

Kontax ships a **custom service worker** (`public/sw.js`, caches
`kontax-shell-v5` / `kontax-pages-v5` / `kontax-assets-v5`). A page-cache that
serves a *previously authenticated* HTML shell can show stale auth state or,
worse, reference JS chunks the server no longer has — producing "module factory
not available" / blank application errors that survive reloads. (Observed in dev
when the SW served old chunks across deploys.) Mobile Safari adds its own
wrinkle: the edge middleware can fail to decode a valid `authjs.session-token`,
which `middleware.ts` already works around by passing through when the cookie is
present. This ticket hardens the SW + cookie/runtime config for those surfaces.

## Scope

**In scope**
- SW caching strategy review: authenticated app navigations must be
  **network-first** (never serve a cached authed HTML shell as if fresh); bump
  and prune cache versions on deploy; ensure `caches`/SW updates take effect.
- Cookie/runtime review: `authjs.session-token` name, `secure`, `sameSite`,
  domain behind the Coolify proxy (`trustHost`, `x-forwarded-*`).
- Don't prefetch authenticated routes that can capture a stale auth failure.
- Preserve contacts-list scroll position when returning from a detail page
  (the list already has a scroll-restore mechanism — verify it survives the PWA).
- A clear recovery message on auth failure instead of a blank error.

**Out of scope**
- The redirect audit (P31-01) and session-expired UX (P31-04) — consumed here,
  not redefined.

## Design / Implementation Spec

### Service worker
- App routes (`/contacts`, `/settings`, detail pages): **network-first**, falling
  back to `offline.html` only when truly offline — never to a cached authed page.
- Treat HTML navigations differently from static assets (assets: cache-first;
  navigations: network-first).
- On `activate`, delete non-current caches (already done) **and** ensure clients
  pick up the new SW promptly (`skipWaiting` + `clients.claim`), so a deploy that
  changes chunk hashes doesn't leave a tab on stale chunks.
- Document the cache-busting expectation: a stale SW is the first thing to clear
  when verifying ("module factory not available" → unregister SW + clear caches).

### Cookie / proxy
- Verify `secure` + `sameSite=lax` and that the cookie domain is correct behind
  the proxy; confirm `trustHost` + forwarded headers so Auth.js doesn't mis-detect
  https and drop the cookie.
- Keep the middleware cookie-present pass-through (the Safari edge-decode fix).

### Scroll & prefetch
- Confirm list→detail→back restores scroll in the installed PWA.
- Audit `<Link prefetch>` usage on authed routes; disable prefetch where a stale
  auth failure could be captured.

## Acceptance Criteria
- Installed PWA can browse, favorite/unfavorite, edit, archive, restore, and
  return to the list without login loops.
- Mobile Safari shows no excessive-redirect behavior during normal navigation.
- A deploy that changes chunk hashes does not leave PWA tabs on stale chunks /
  "module factory not available" errors.
- Auth failures show a clear recovery message, not a blank application error.
- List scroll position is preserved on return from detail in the PWA.

## Risks / Open Questions
- Some behavior depends on deployment proxy headers and cookie domain config —
  validate against the Coolify/LXC deploy, not just local.
- Network-first navigations slightly increase latency offline; ensure the
  `offline.html` fallback still works.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [x] Internal · admins/ops — roadmap/runbooks/: PWA/SW cache behavior, the stale-chunk symptom + fix, cookie/proxy config
- [x] Internal · engineering — docs/: SW caching strategy + cookie/session model on mobile
