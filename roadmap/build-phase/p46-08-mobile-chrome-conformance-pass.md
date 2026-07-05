# P46-08 — Mobile chrome conformance pass (backs, missing headers, Overview removal)

Status: **Built & preview-verified (2026-07-05, 375px, QA li+p46qa) — uncommitted; real-device OS-back pass deferred to phase QA** · Priority: P1 · Depends: P46-DB06

> Verified live: settings subpage back = labelled blue "Settings"; /shares
> renders "Shared with me" + back→Settings with the banner stack below the
> header; /merge/manual renders "Manual merge" + back "Contacts" (duplicate
> review = same AppShell path); Activity tab holds the wordmark header;
> wordmark → /contacts; mobile ?tab=overview shows the fallback card while the
> desktop Overview stays hidden at 375px; "Shared with me" row present in
> Settings' Sync & Shared group.
Phase: [Phase 46](phase-46-alphabet-scrubber.md)
Spec: [P46-DB06](p46-db06-design-brief-mobile-consistency-audit.md) (design converged, handoff #29)

> First build chunk of DB06 — the mechanical, high-value fixes that close the
> named gaps without the header-primitive refactor (that's [P46-09](p46-09-mobile-header-unification-banner-stack.md)).

## Scope
1. **Labelled blue backs (A2).** Settings subpage header
   (`settings/_components/mobile-settings-header.tsx`) gains the "Settings"
   label; `MobileSecondaryHeader` back recolors to canonical blue `#4158f4`
   /600. Complete `SUBPAGE_TITLES` (books, presets, profile→"Public card").
2. **Three missing headers (A4 gaps).** `AppShell mobileTitle` on:
   `/shares` ("Shared with me", back "Settings" → `/settings`),
   `/merge-suggestions/[id]` ("Duplicate review", back "Contacts"),
   `/merge/manual` ("Manual merge", back "Contacts").
3. **Wordmark → `/contacts`** (`mobile-header.tsx`; was `?tab=overview`).
4. **Activity header hold (A1).** Remove the Activity-tab swap to
   `MobilePlainHeader`; the contacts screen holds one Home header across tabs.
5. **Mobile Overview removal (Part B).** Overview panel gated desktop-only
   (`hidden lg:grid`) with a mobile fallback linking to the list; drop the
   `tab` prop plumbing that supported the swap.
6. **Shared-with-me relocation (Part B).** "Shared with me" row in Settings'
   Sync & Shared group (`mobile-settings-nav.tsx`) → `/shares`.

## Acceptance
- Every `/settings/*` subpage shows "‹ Settings" (labelled, blue) — no
  icon-only backs anywhere on mobile.
- `/shares`, `/merge-suggestions/[id]`, `/merge/manual` each render a mobile
  Detail header with title + labelled back; back lands where the label says.
- Contacts Activity tab keeps the wordmark header; wordmark tap lands on the
  People list; `?tab=overview` on a phone shows the fallback, not the
  dashboard; desktop Overview untouched.
- Settings → Shared with me opens `/shares` with its new header (back →
  Settings). Typecheck clean; preview-verified at 375px; OS-back real-device
  pass deferred to the phase QA.
