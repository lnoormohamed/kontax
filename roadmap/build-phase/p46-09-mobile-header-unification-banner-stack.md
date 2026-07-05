# P46-09 — Mobile header primitive unification + banner-stack reconciliation

Status: **Built & preview-verified (2026-07-05, 375px) — uncommitted** · Priority: P1 · Depends: P46-08

> Delivered: one `MobileHeader` primitive (home/section/detail) in
> `mobile-header.tsx`; `MobilePlainHeader` deleted, `MobileSettingsHeader` now a
> thin route-aware shim; `AppBannerStack` (`app-banner-stack.tsx`) mounted on
> AppShell + /contacts + /sync — **live-verified that /sync now shows the
> email-verification banner it previously missed**. The primitive is fully
> presentational (bell passed as a slot) after a client-bundle break: the
> client settings shim importing a header that imported NotificationBellSlot
> dragged `~/server/notifications` → ioredis into the browser bundle.
>
> **Spec deviation recorded:** DB06 A4 assigned `/help` a Detail header, but
> `/help` is a *public marketing page* (PublicNav + public-site.css + SEO
> JSON-LD) — it belongs to the A6 public/marketing out-of-scope set, so it
> keeps its public chrome. Contact detail's scroll-hide header remains the
> sanctioned exception, untouched.
Phase: [Phase 46](phase-46-alphabet-scrubber.md)
Spec: [P46-DB06](p46-db06-design-brief-mobile-consistency-audit.md) A1–A3

## Scope
1. **One `MobileHeader` primitive, three variants** (A1): fold
   `MobileHomeHeader` / `MobilePlainHeader` / `MobileSecondaryHeader` /
   `MobileSettingsHeader` into one component with `variant="home" | "section"
   | "detail"` and explicit slots. Contact detail's scroll-hide header stays
   the sanctioned Detail exception (`mobile-contact-detail.tsx`) — document,
   don't fold.
2. **Section = title + bell** everywhere: Sync's `MobilePlainHeader` gains the
   bell; Settings root already has it.
3. **Banner-stack reconciliation (A3):** `/contacts` (`contacts/page.tsx`) and
   `/sync` (`sync/page.tsx`) currently build their own layouts and duplicate
   the impersonation → email-verify → billing → security → connection stack —
   extract the ordered stack from `app-shell.tsx:139-151` into one shared
   component both mount. Safe-area padding so banners never collide with the
   56px bottom nav.
4. **`/help`** gets the Detail variant with a fixed labelled back
   ("Settings") — not referrer-based.

## Acceptance
- Grep shows a single mobile header component consumed by every mobile route;
  the four legacy components are gone (or thin re-exports during migration).
- Sync header shows the bell; no Section header without one.
- The banner stack renders identically (same order, same components) on
  /contacts, /sync, and AppShell pages — verified by forcing email-verify +
  offline together on all three.
- No visual regression on create/import-export/detail headers (the already-
  conforming screens).
