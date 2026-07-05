# P46-DB06 — Design brief: mobile UI consistency audit (nav, headers, back, banners) + Overview removal

Status: **Design converged (handoff #26, 2026-07-05) — ready for build** · Priority: P1 · Depends: —
Phase: [Phase 46](phase-46-alphabet-scrubber.md)
Scope: **Mobile only (< 1024px).** Desktop is deliberately deferred to a future brief.
Relates: [P46-DB04](p46-db04-design-brief-mobile-contact-list-refresh.md) (mobile row — this brief owns the *chrome around* the row), [mobile-design-brief.md](../mobile-design-brief.md) (the original all-routes mobile brief this audit reconciles against)

> A single design brief that audits **every mobile screen** and defines one
> consistent system for **navigation, headers, directional/back behaviour, and
> banners** — because the surfaces have drifted (each page rolls its own header,
> three screens have none, back is labelled on some and icon-only on others).
> It also settles a specific IA change the user asked for: **remove the mobile
> "Overview"** and relocate the options on it that are worth keeping. Mobile
> only; a companion desktop brief follows later.

## Why (verified 2026-07-05)

An investigation of the mobile chrome across all authenticated routes found a
consistent *pattern of inconsistency* — the drift the user is feeling:

### Headers roll their own, and three screens have none
- There is **no single mobile header component**. At least four variants coexist:
  - `MobileHomeHeader` — wordmark "K Kontax" + bell + search + filter
    (`src/app/_components/mobile-header.tsx:21-92`); **the contacts list**.
  - `MobilePlainHeader` — title + bell only; used by **Sync**
    (`sync/page.tsx:731`), **Settings root** (`settings/layout.tsx:90`), and —
    mid-group — the **contacts Activity tab** (`mobile-header.tsx:23-26`), so
    the header *changes* as you switch tabs on the same screen.
  - `MobileSecondaryHeader` — back + title + action, via `AppShell`
    (`app-shell.tsx:102-107`); **create contact**, **import/export**.
  - `MobileSettingsHeader` — **icon-only** back (no label) + title + bell
    (`mobile-settings-header.tsx:40-76`); all `/settings/*` subpages.
  - `MobileContactDetail` — a bespoke ~150-line scroll-hiding header with an
    editing-mode blue background (`mobile-contact-detail.tsx:189-341`).
- **Three major screens render no mobile header at all** — `AppShell` skips the
  header when no `mobileTitle` prop is passed (`app-shell.tsx:101`):
  **`/shares`** (Shared with me), **`/merge-suggestions/[id]`**, and
  **`/merge/manual`**. On these you get only the bottom nav — no title, no back,
  no context. (These feel broken on a phone.)

### Back navigation is three different contracts
- `MobileSecondaryHeader`: `<Link href={backHref}>`, default `/contacts`,
  label customisable (`mobile-header.tsx:127`).
- `MobileSettingsHeader`: hardcoded `<Link href="/settings">`, **no label**
  (`mobile-settings-header.tsx:45`).
- `MobileContactDetail`: conditional `router.back()` when the contact was
  opened from the list, else `href="/contacts"` (`mobile-contact-detail.tsx:180-184`)
  — correct behaviour, but a third mechanism.
- Net: where "back" lands, and whether it is even labelled, differs per screen.

### Banners: one good stack, but not every screen mounts it the same way
- The ordered stack is impersonation → email-verification → billing → security
  → connection banner (`app-shell.tsx:139-151`; `connection-banner.tsx` has its
  own internal rank). Good — but **the contacts list and Sync build their own
  layouts** instead of `AppShell` (`contacts/page.tsx:420+`, `sync/page.tsx:731+`),
  so the banner stack is duplicated rather than shared, and can drift.

### Bottom nav & the Overview
- Bottom nav (`bottom-nav.tsx`) = **Contacts · Activity · Sync · Settings**,
  56px + safe-area, badges on Activity/Sync.
- **Overview IS reachable on mobile**: the header wordmark links to
  `/contacts?tab=overview` (`mobile-header.tsx:47`) and the overview block
  renders on mobile (`contact-dashboard.tsx:738`). It shows: 4 **stat cards**
  (Contacts / Favorites / Emergency / Duplicates counts, `:240-264`), a
  **contact-health worklist** (missing methods / context / unlabeled / dates /
  sync attention), and 4 **action cards** — All contacts, Duplicate review,
  **Shared with me → `/shares`**, **Sync and imports → `/sync`** (`:265-292`).

## Part A — Canonical mobile chrome (the consistency spec)

Define **one** system and map every screen to it.

### 1. Header system — one component, a small set of variants
Specify a single mobile-header primitive with explicit variants, and assign
each screen exactly one:
- **Home** (wordmark + bell + search/filter) — contacts list only.
- **Section** (title + bell, no back) — top-level nav destinations: Sync,
  Settings root. Decide whether Activity keeps switching to this or the contacts
  screen holds one header across its tabs (recommend: **hold one header**; don't
  swap header type on tab change).
- **Detail/secondary** (labelled back + title + optional action) — everything
  reached *into*: create/edit, import/export, contact detail, **and the three
  currently header-less screens** (`/shares`, merge review, manual merge).
- Decide the fate of the bespoke `MobileContactDetail` header: fold its
  scroll-hide + editing-state behaviour into the canonical detail variant as
  documented options, or explicitly bless it as the one sanctioned exception.

### 2. Back navigation — one contract
- Every non-root screen shows a **labelled** back affordance (kill the
  icon-only settings back). Specify the label rule (name the destination, e.g.
  "Settings", "Contacts") and the mechanism rule (`Link href` default;
  `router.back()` only where list-state/scroll restoration needs it, as contact
  detail already does). Back target must be predictable per screen.

### 3. Banner stack — mount once, everywhere
- Ratify the ordered stack and require **every** mobile screen to mount the
  *same* stack in the same order — including the two screens that bypass
  `AppShell` (contacts list, Sync). Specify safe-area/padding so banners never
  collide with the fixed bottom nav.

### 4. Per-screen conformance table — **every mobile screen, no exceptions**
The brief must inventory **every** authenticated mobile screen (the user's
explicit ask — align *all* of them, not just exemplars) as one table:
route × {header variant, back label + target, which banners apply, which
bottom-nav tab is highlighted, current gap}. This table is the checklist the
build tickets execute against. The complete in-scope census (verified against
the App Router tree 2026-07-05):

**Contacts & workspace**
- `/contacts` — list (Home header: wordmark + bell + search + filter). Also its
  in-page tabs: People, Favorites, Emergency, Archived, Duplicates, Activity,
  and **Overview** (removed in Part B). Fix: hold **one** header across tabs
  (Activity currently swaps to the plain header).
- `/contacts/[id]` — **contact detail** (bespoke `MobileContactDetail` header,
  `mobile-contact-detail.tsx:189-341`: scroll-hide compact bar + editing-mode
  blue background). In scope for this audit: its **header** (decide fold-in to
  the canonical detail variant vs. sanctioned exception), its **back-to-list**
  behaviour (`router.back()` when opened from the list, else `/contacts` — the
  Back-consumes-tabs fix already shipped in [P46-05](p46-05-contact-detail-tab-history.md),
  don't reopen it), its **tab bar** (Details / Sharing / History — the tabs must
  not each read as a page; align the tab-strip styling with the rest of mobile),
  the **hero/photo** block chrome, and its banner stack. *Out* of this audit:
  the detail's internal **content** layout (field sections, ordering, empty
  states) — that stays owned by [02-contact-detail.md](../design-briefs/02-contact-detail.md);
  DB06 aligns the frame around it, not the field content.
- `/contacts/new` — create (secondary header, back "Contacts"). Editing an
  existing contact routes through the same create/edit surface — confirm parity.
- `/import-export` — Import & Export (secondary header). ✔ conforms today.
- `/merge-suggestions/[id]` — duplicate review. **NO HEADER — gap.**
- `/merge/manual` — manual merge workbench. **NO HEADER — gap.**
- `/shares` — Shared with me. **NO HEADER — gap** (and Part B routes users here
  from Settings, so it must gain a proper header).

**Sync & connections** (the "including connections" ask)
- `/sync` — Sync (plain header; builds its own layout, bypasses `AppShell`
  banner stack — reconcile). "Connections" is **not a separate route**: it's the
  `connection-settings.tsx` surface *inside* `/sync` (alongside
  `mobile-sync-screen.tsx`, `sync-shared.tsx`, `projection-explainer.tsx`). The
  brief must align the connection add/edit/detail surfaces and any per-provider
  connection sheets/modals to the same header + back + banner rules — connection
  UIs are a common source of bespoke, off-pattern chrome.

**Settings — the root + all 13 subpages** (align every one)
- `/settings` — root (plain "Settings" header + `MobileSettingsNav` card list).
- Subpages, each currently `MobileSettingsHeader` with **icon-only back** (the
  gap to fix — add a labelled back): `/settings/account`,
  `/settings/notifications`, `/settings/preferences`, `/settings/devices`,
  `/settings/security`, `/settings/family`, `/settings/teams`,
  `/settings/teams/audit`, `/settings/books`, `/settings/profile/card`,
  `/settings/developer`, `/settings/import-presets`, `/settings/export-presets`.
  Verify each subpage's *in-content* header/section titles and any nested
  sheets follow the canonical pattern, not just the top bar.

**Account-state & onboarding screens** (don't forget these — they're easy to
leave off-pattern)
- `/welcome/[plan]` (post-register onboarding), `/verify-email`,
  `/account-pending-deletion`, `/account-deleted`, `/help`. Assign each a header
  variant + banner behaviour or an explicit "intentionally chromeless" note.

**Auth flow — in scope (user decision 2026-07-05)**
- `/login`, `/login/verify-2fa`, `/register`, `/forgot-password`,
  `/reset-password`. These are **pre-authentication**: no bottom nav, no app
  banner stack, and they own a distinct centered-card layout governed by
  [04-login-register.md](../design-briefs/04-login-register.md). Align them on
  the shared primitives that *do* apply — logo/wordmark treatment, back/step
  navigation between the auth steps (e.g. login → verify-2fa → forgot →
  reset), form field + primary-button styling, error/notice banner styling, and
  safe-area handling — so the auth journey feels part of the same product as the
  app it leads into. Do **not** bolt the app chrome (bottom nav / app header /
  connection banner) onto them. Reconcile any conflict with 04-login-register in
  this brief and note it as the source of truth for auth once aligned.

Explicitly list the **known gaps** to close at minimum: `/merge-suggestions/[id]`,
`/merge/manual`, `/shares` (no header); all `/settings/*` (unlabelled back);
`/contacts` Activity (mid-screen header swap); `/sync` + `/contacts` (bypass the
shared banner stack).

### 5. Non-route overlays, sheets & menus — **in scope** (user asked 2026-07-05)
Consistency lives as much in the transient surfaces as in the pages, and they
are a prime offender (full-screen overlay vs. bottom sheet vs. dropdown vs.
modal, each with a different open/dismiss/back gesture). The brief must define a
**presentation taxonomy** — *when* a surface is a full-screen overlay vs. a
bottom sheet vs. an anchored dropdown vs. a centered modal — and one set of
rules for all of them: dismiss affordance (back vs. close-X vs. backdrop tap +
swipe-down), where the title/back sits, scroll-lock, safe-area insets, and
z-index layering **above** the fixed bottom nav. Then map each surface to the
taxonomy:

- **Notification panel** — `notification-bell.tsx`: full-screen mobile overlay
  (`max-md:fixed inset-0 h-[100dvh]`, `role="dialog"`, leads with a back
  button; `z-[100]`). Its *content/aging* behaviour is owned by
  [P46-DB03](p46-db03-design-brief-notification-aging.md) (D6·B) — this audit
  owns its **chrome** (how it opens/dismisses, back placement, layering) and
  makes it consistent with the other full-screen overlays.
- **Search** — `mobile-search-button.tsx` → `search-dropdown.tsx` /
  `search-input.tsx` / `search-results.tsx`. Define the mobile search
  presentation (full-screen overlay vs. expanding inline field), the results
  surface, empty/loading states, and dismiss/back — aligned with the panel
  taxonomy.
- **Filters** — `mobile-filter-sheet.tsx` + `label-filter-bar.tsx`, and
  **sort** — `sort-menu.tsx`. Bottom-sheet vs. menu treatment, apply/clear
  affordances, and how an active filter/sort is reflected back in the list
  header.
- **Other sheets & menus to bring onto the pattern** (list, don't leave
  bespoke): `mobile-bottom-sheet.tsx` (the shared primitive — confirm it *is*
  the shared base), `mobile-contact-sheet.tsx` (create/quick-add),
  `more-menu.tsx`, `user-menu.tsx`, and the modal/drawer family
  (`confirm-dialog.tsx`, `confirm-password-modal.tsx`, `downgrade-modal.tsx`,
  `plan-comparison-modal.tsx`, `labels-manage-modal.tsx`,
  `security-alert-drawer.tsx`). Decide which collapse onto the shared bottom
  sheet vs. modal primitive and which stay distinct, so there aren't five
  hand-rolled dismiss behaviours.

### 6. Scope boundaries — what this mobile brief does *not* cover
So the census is unambiguous, record these as **out of scope** (each has, or
gets, its own brief):
- **Marketing / public** `/(marketing)/*` (about, features, pricing, privacy,
  security, terms, changelog, contact), `/developers` — own design system
  ([05-public-landing.md](../design-briefs/05-public-landing.md)).
- **Admin** `/admin/*` — desktop-primary per the mobile brief; not part of this
  mobile pass.
- **Public share / join** `/u/[username]`, `/share/[token]`,
  `/family/join/[token]`, `/teams/join/[token]` — public, outside app chrome.
- **Non-shipping / print** `/wireframes/*`, `/contacts/print` — excluded.

## Part B — Remove the mobile Overview + relocate its options

**Recommendation: yes, remove Overview on mobile.** On a phone it's a
low-value middle layer between the wordmark and the list, and most of what it
holds is reachable elsewhere. But "move the options to Settings" only fits
*some* of them — decide each item's destination explicitly:

| Overview item | Recommendation |
| --- | --- |
| **Stat cards** (Contacts / Favorites / Emergency / Duplicates counts) | **Drop** on mobile. Favorites + Emergency are already People filters; Duplicates is its own destination — the counts don't earn a full screen. Optionally fold a small count into the list header. |
| **All contacts** action | **Drop** — redundant; the list is where you already are. |
| **Duplicate review** action | **Drop as an Overview card**; keep the destination reachable (it already is via the duplicates view / Settings). |
| **Shared with me → `/shares`** | **Relocate to Settings** — this is the genuinely orphaned destination (not in bottom nav). Settings already has a **"Sync & Shared"** group (`mobile-settings-nav.tsx`) — add it there. And fix `/shares`' missing mobile header (Part A). |
| **Sync and imports → `/sync`** | **Already** a bottom-nav tab and in Settings — just drop the card. |
| **Contact-health worklist** (missing methods/context/labels/dates) | **The real decision.** This is Overview's one uniquely useful surface — *don't* bury proactive data-quality nudges in Settings where nobody looks. Recommend surfacing it inside **People** (a dismissible prompt or a "needs attention" filter/section) rather than Settings. Decide its home here. |

### The wordmark must be re-pointed
- The header wordmark currently targets `/contacts?tab=overview`
  (`mobile-header.tsx:47`). With Overview gone on mobile it should target
  **`/contacts`** (people list) — the standard "logo → home" behaviour. Specify
  this and confirm the desktop wordmark/Overview is untouched (Overview stays a
  desktop surface; this removal is **mobile-only**).

## Deliverable
A brief in `roadmap/design-briefs/` (e.g. `p46-db06-mobile-consistency.md`)
containing: the canonical header variants + a per-screen conformance table that
covers **every** in-scope mobile route from the Part A.4 census (contacts,
sync **and its connections surfaces**, all 13 settings subpages, the
account-state/onboarding screens, and the **auth flow** aligned on its shared
primitives); the **overlay/sheet/menu taxonomy** (Part A.5 — notification panel,
search, filters, sort, and the shared bottom-sheet/modal primitives) with one
open/dismiss/back + layering contract; with the out-of-scope boundaries (Part A.6)
recorded so nothing is left ambiguous; the single back-navigation contract; the
ratified banner stack with the two bypass screens reconciled; and the Overview
removal + per-item relocation decisions (Part B) including the contact-health
home and the wordmark re-point. Scope it **mobile only** and note the desktop consistency pass as a
future brief. Cross-link [mobile-design-brief.md](../mobile-design-brief.md) and
[P46-DB04](p46-db04-design-brief-mobile-contact-list-refresh.md).

> **Note on size.** This is the largest design surface in Phase 46 — it touches
> every mobile route and will likely spawn its own build tickets (header
> unification, the three missing headers, the Overview removal + health
> relocation). The brief should call out that split so the builds can be
> sequenced rather than done as one mega-change.

## Design status & review history

Design mocked in Claude Design; three review rounds (feedback in
`roadmap/design-briefs/p46-db06-review-round-{1,2}.md`):

- **Round 1** → added contact detail, enlarged phones, drew the patterns that
  were table-only, added the states matrix.
- **Round 2** → made key surfaces interactive, fixed content clipping, fixed the
  overlay/sheet layering (full-screen scrim, sheet clears the nav/rounded
  corner).
- **Handoff #26 (converged, verified by rendering 2026-07-05):** all prior
  feedback resolved. Bodies auto-height (no clipping), no canvas frame overlaps,
  interactive open/close + tab-switch + selection wired, filter/overlay scrim
  covers header+nav, modal correctly excludes backdrop-dismiss per the taxonomy.

## Carry into build (from the design review — not design defects)

These are prototype-vs-production gaps the **build** must honour; the design
signed off with them noted:

- **Real swipe-to-dismiss on bottom sheets.** The prototype dismisses sheets via
  grabber / backdrop tap / apply only (click). The build must implement genuine
  swipe-down-to-dismiss (filter, sort, quick-add) per the A5 taxonomy.
- **Reduced-motion coverage for the new overlay transitions.** The sheet-slide,
  menu/modal scale, and full-screen-overlay transitions must sit under
  `prefers-reduced-motion: reduce` (the prototype guards its skeletons/pulse but
  not these), consistent with the P43 motion preference.
- **Modal dismiss rule is intentional.** Modals dismiss on *explicit* action
  only (no backdrop tap); sheets and dropdowns dismiss on backdrop tap. Preserve
  this split — it is a taxonomy decision, not an oversight.

## Optional / deferred (not blocking)

- Individual mocks for the distinct-content settings subpages (Family, Teams,
  Books, Devices, Security, Public card) were left riding the single
  Notifications exemplar. The header pattern is proven; draw them only if
  body-level coverage is wanted.
