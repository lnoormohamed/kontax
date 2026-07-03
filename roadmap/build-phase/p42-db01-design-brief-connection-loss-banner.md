# P42-DB01 — Design Brief: Connection-Loss Banner & Offline States

## Purpose

Specify the single, coherent connection-loss experience that replaces today's
full-page "Waiting for connection" takeover: a status banner that keeps the
user on the page they were using, tells them what still works, and recovers
visibly on its own. Covers the banner's states, the demoted cold-start page,
and how the banner coexists with the app's other top-of-shell banners.

## Background

- Today three surfaces compete: the slim amber `OfflineBanner` (app shell),
  the full-page `public/offline.html` (service worker fallback on any failed
  navigation), and the app error shell (which can catch offline fetch
  failures). They contradict each other; the takeover discards context.
- The locked design language applies. The existing banner already uses the
  amber info tokens (`#f6edd9` / `#e8d8b0` / `#7a5a1a`) shared with P36-DB01's
  callouts — keep that family for offline (informational, not an error).
- Reality to design for: while offline the app can still *read* everything
  already rendered, but writes fail and new navigations may fail. The banner's
  promise ("showing your last synced contacts") must match what actually
  works.

## Scope

### In scope

1. **Banner states** (single component, one slot at the top of the app shell):
   - **Offline** — persistent, amber, `role="status"`. Copy: what's happening
     + what still works. No dismiss (state-driven), no spinner.
   - **Degraded** — browser thinks it's online but requests are failing.
     Same visual family, adds a **[Try again]** text action. Copy must not
     blame the user or the app ("Having trouble reaching Kontax…").
   - **Reconnected** — brief green success flash ("Back online — refreshing…"),
     auto-dismisses ~2.5s after the refresh lands. Motion: fade/slide per the
     existing toast conventions, `prefers-reduced-motion` honoured.
2. **Write-attempt feedback while offline** — what a blocked save/action shows
   (inline near the action, referencing the banner; the action is *not*
   silently queued — v1 has no offline mutation queue, be honest about it).
3. **Banner stacking rules** — one visible banner, priority order decided
   here. Candidates competing for the same slot: read-only/billing
   (`ReadOnlyBanner` GRACE/LOCKED), offline, SW-update ("new version
   available"), failed-payment. Rule proposal to validate: account-state
   banners outrank connectivity; connectivity outranks update prompts. Mobile
   sync screen currently hard-codes either/or — the rule replaces that.
4. **Cold-start page restyle** (`offline.html`, the only remaining full-page
   case): align copy and visuals with the banner system ("You're offline" not
   "Waiting for connection"; same tone, same status-dot pattern it already
   has). Must remain a self-contained static file — inline styles, no fonts,
   no JS imports.
5. **Mobile / PWA** — banner placement under the mobile header, safe-area
   handling, and the standalone-PWA cold start (where `offline.html` is most
   often seen).

### Out of scope
- Offline mutation queueing / background sync (a future phase; the copy just
  needs to not promise it).
- Service-worker caching strategy changes (P42-01 keeps navigation caching
  as-is).
- The stale-chunk deploy recovery flow (already shipped; only ensure visual
  consistency).

## States to specify

For the banner: offline, degraded, reconnected flash, and each stacking
collision (offline + read-only, offline + SW-update). For blocked writes: the
three commonest surfaces — contact save, bulk action, sync "Sync now". For
`offline.html`: default, "back online — reconnecting…" transition. All at
desktop / tablet / mobile / standalone PWA.

## Copy deck (deliverable)

Exact strings for every state above. Tone: calm, factual, no exclamation
marks. The offline line must state the read-only reality ("showing your last
synced contacts — changes can't be saved until you're back online").

## Deliverables

A `p42-db01` brief in `roadmap/design-briefs/` following the P36-DB01 format:
layout blocks, tokens, motion spec, stacking priority table, the copy deck,
and the `offline.html` restyle — ready for P42-01 to build without further
design decisions.

## Dependencies
Blocks P42-01. Coordinate the stacking rules with P39-DB01 (its enforcement
banners live on `/sync`, not the app shell, but the tone and amber tokens are
shared).
