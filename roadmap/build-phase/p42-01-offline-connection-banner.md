# P42-01 — Connection-loss banner replaces full-page takeover

Status: Complete (2026-07-03) · Priority: P0 · Depends: P42-DB01

## Problem

Three code paths currently decide what a user sees when connectivity drops,
and two of them are full-page:

1. **`public/sw.js`** — the `navigate` handler answers *any* failed navigation
   with `public/offline.html` ("Waiting for connection"). A refresh or link
   click while offline replaces a fully rendered app with a takeover page,
   losing scroll position and unsaved form state.
2. **`src/app/error.tsx` → `ErrorShell`** — offline RSC/fetch failures can
   bubble into the error boundary and render the full error shell for what is
   a connectivity blip, not an app error.
3. **`src/app/_components/offline-banner.tsx`** — the correct pattern, but
   passive: it only reflects `navigator.onLine` and offers no retry/recovery,
   and it doesn't prevent paths 1–2 from firing.

## Change

Make the banner the single connection-loss experience while the app shell is
alive; reserve `offline.html` for cold starts only. Build to the P42-DB01 spec.

### 1. Upgrade `OfflineBanner` → connection status banner
- Two states beyond hidden: **offline** ("You're offline — showing your last
  synced contacts", amber, persistent) and **reconnected** (green flash
  "Back online", auto-refreshes data via `router.refresh()`, auto-dismisses).
- Optional third state per the brief: **degraded** — browser reports online
  but app fetches are failing (fetch-failure signal from §3), with a
  [Try again] action.
- Keep the single mount in `app-shell.tsx`; resolve the either/or stacking
  with `ReadOnlyBanner` in `mobile-sync-screen.tsx` per the brief.

### 2. Stop the in-session takeover (`sw.js`)
- On failed navigation, serve `offline.html` **only when no window client is
  currently controlled** (cold start / hard refresh). When a client exists,
  let the failure surface to the page (where §3 catches it) — or respond with
  a minimal 503 the client intercepts; pick whichever proves reliable across
  Safari/Chrome PWA during implementation.
- Keep the existing "no caching of authenticated pages" stance — this ticket
  changes the *fallback*, not the caching strategy.

### 3. Keep the error boundary out of connectivity failures
- In `ErrorShell` (and the `error.tsx` recovery pass), detect
  network-failure errors while `!navigator.onLine` (fetch TypeError / failed
  RSC digest): instead of the full shell, keep the current view where
  possible, show the banner's degraded state, and retry via `reset()` on
  `online`. Genuine app errors keep the existing shell — do not widen the
  match beyond connectivity signatures.

### 4. Restyle `offline.html` (cold-start only)
- Align copy and visual language with the brief so the two surfaces read as
  one system. Keep it dependency-free static HTML (it must render with no
  network and no JS bundle).

## Acceptance
- Airplane mode on `/contacts`, click into a contact: view stays (or
  gracefully stays put), banner shows; no `offline.html`.
- Airplane mode with a half-filled create-contact form, attempt save: form
  state intact, banner shows, save succeeds after reconnect.
- Reconnect: banner flips to "Back online", data refreshes, banner dismisses.
- Hard refresh while offline: restyled `offline.html`, and its auto-reload on
  `online` still works.
- Stale-chunk deploy recovery (`error.tsx` auto-recovery, commit e88ec6c) is
  unaffected — verify its path still reloads once.
- Verified on a real phone (iOS Safari PWA + Android Chrome), not just
  preview.
