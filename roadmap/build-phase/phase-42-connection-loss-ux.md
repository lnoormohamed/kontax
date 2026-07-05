# Phase 42 — Connection-Loss UX (banner, not takeover)

> **Mini-phase** (like 31B). One user-facing problem: losing connectivity
> mid-session throws a **full-page "Waiting for connection" takeover**
> (`public/offline.html`, served by the service worker on any failed
> navigation) instead of keeping the user on the page they were using. The app
> already has a slim `OfflineBanner`; this phase makes the banner the *primary*
> connection-loss experience and demotes the full page to cold starts only.

## Phase status
Pre-plan

## Phase objective
Going offline should never cost the user their context. The contacts list, a
half-filled form, a detail page — all keep rendering from client state; a
banner explains the situation and recovers on its own. The full-page fallback
remains only for the case where there is genuinely nothing to keep on screen
(cold start / hard refresh while offline).

## Why the current behaviour is wrong
- `sw.js` answers **every** failed navigation with `offline.html` — so a
  mid-session refresh or link click while offline replaces a working, fully
  rendered app with a dead-end page, discarding scroll position and any
  unsaved form state.
- Offline RSC/fetch failures can also bubble into the app error boundary
  (`error.tsx` → `ErrorShell`), a second full-page path that mislabels a
  connectivity blip as an app error.
- Meanwhile `OfflineBanner` (app-shell) already handles the pure
  "browser says offline" case gracefully — the experiences contradict each
  other depending on which code path the failure takes.

## Tickets

| Ticket | Title | Priority | Depends on |
| --- | --- | --- | --- |
| [P42-DB01](p42-db01-design-brief-connection-loss-banner.md) | Design brief: connection-loss banner & offline states | P0 | — |
| [P42-01](p42-01-offline-connection-banner.md) | Connection-loss banner replaces full-page takeover | P0 | P42-DB01 |

## Success criteria
- Losing connectivity on any signed-in page keeps that page on screen with a
  banner; no navigation-triggered takeover while the app shell is alive.
- Reconnection is automatic and visible (banner flips to "back online",
  refreshes data, dismisses itself).
- `offline.html` appears only on cold start / hard refresh with no cached
  shell, restyled to match the banner's language.
- Unsaved form state survives an offline blip.

## Exit criteria
- P42-01 verified on desktop and on a real device (airplane-mode walk-through;
  browser preview cannot emulate connectivity loss reliably).
- docs/mobile-session-model.md updated if the PWA offline story changes.

## Documentation (per roadmap/documentation-policy.md)
- [ ] External · users — in-app Help: what works offline
- [ ] Internal · engineering — service-worker strategy note (navigation
      fallback rules)
