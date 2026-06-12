# P24-01 — Mobile Audit Findings

**Date:** 2026-06-12
**Method:** Code inspection + browser DevTools (Chrome, iPhone 14 preset 390×844 / Pixel 7 preset 360×800). Real-device verification deferred to pre-P24-08 spot check.
**Status:** Agreed by engineering — unblocking P24-02.

---

## Summary

| Severity | Count |
|---|---|
| P0 — task blocked | 4 |
| P1 — task degraded | 5 |
| P2 — cosmetic | 3 |

---

## Findings

| # | Route | Flow | Device | Severity | Description | Fix ticket |
|---|---|---|---|---|---|---|
| 1 | All app routes | Navigation — no way to switch sections | iOS + Android | P0 | `app-shell.tsx` sidebar uses `hidden lg:flex` with no mobile replacement. Users on any secondary page (contact detail, create, import, settings sub-pages) have zero navigation. P16-07 bottom-nav placeholder was never wired. | P24-02 |
| 2 | `/contacts/new`, `/contacts/[id]/edit` | Create/edit — Submit hidden by keyboard | iOS Safari | P0 | No `visualViewport` / `dvh` awareness. iOS keyboard overlays ~40% of viewport without pushing layout; Save button is behind it with no way to reach it without dismissing keyboard first. | P24-05 |
| 3 | All app routes | Viewport height — bottom content clipped by URL bar | iOS Safari | P0 | `h-screen` (`100vh`) used in `app-shell.tsx` (line 76), `contacts/page.tsx` (line 372), `settings/layout.tsx` (line 50), `sync/page.tsx` (line 266). iOS Safari's URL bar consumes ~56px of `100vh`, hiding bottom content. | P24-02 |
| 4 | `/contacts` | Contact list — no navigation to any other section | iOS + Android | P0 | The contact dashboard has its own shell. No bottom nav. Tapping the K logo reloads contacts; there is no path to Activity, Sync, or Settings from the mobile list view. | P24-02 |
| 5 | `/settings/**` | Settings — settings sidebar hidden; sections unreachable | iOS + Android | P1 | `settings-sidebar.tsx` shows a slide-out panel triggered by a small "Settings" button (line 142). The button is present on mobile but is easily missed. No bottom nav links to settings sub-sections. Settings layout breakpoint is also `lg:flex` (1024px), leaving tablet users (768–1023px) with no nav. | P24-02 |
| 6 | `/import-export` | Import — preview table overflows viewport | iOS + Android | P1 | The Step 2 preview table (`import-preview-form.tsx`) has no `overflow-x: auto` wrapper. The table is fixed-width and extends beyond the 390px viewport; no horizontal scrolling is available. | P24-06 |
| 7 | `/contacts` | Contact list — rows too small for touch | iOS + Android | P1 | Compact row height is 48px in desktop view with no mobile override enforced in code. The star icon tap target is unconstrained (icon is 16px with no enlarged hit area). | P24-03 |
| 8 | `/contacts/[id]` | Contact detail — desktop two-column layout on mobile | iOS + Android | P1 | The detail page (`contacts/[id]/page.tsx`) uses a desktop master-detail shell with no mobile branch. The left rail and content panel stack vertically, consuming excessive vertical space. No FAB, no compact scroll header. | P24-04 |
| 9 | `/contacts/[id]` | Contact detail — tabs may clip on narrow viewports | iOS Safari | P1 | The Details/Sharing/History tab bar has no `overflow-x: auto` on the tab container. At 390px with 3 tabs this likely fits, but there is no `scrollbar-width: none` or touch-scroll treatment applied. | P24-04 |
| 10 | `/contacts/new` | Create form — full desktop form on mobile, no sections | iOS + Android | P2 | The create form renders as a full-page desktop layout. All field sections are expanded simultaneously — the page is very long and requires significant scrolling on mobile. No collapsible sections, no bottom sheet. | P24-05 |
| 11 | All app routes | Top header — search bar consumes full width on mobile | iOS + Android | P2 | The header `SearchInput` is `flex-1`. On 390px it squeezes the logo and the action buttons to near-minimum widths. At its smallest the Create button label is hidden (`hidden sm:inline`) but the button itself is still present and crowded. | P24-02 |
| 12 | All routes using `env(safe-area-inset-*)` | Safe area — insets not applied | iOS Safari (notch) | P2 | No `env(safe-area-inset-*)` usage found anywhere in the codebase outside the design prototype. Content may sit behind the Dynamic Island / notch on iPhone 14+ and behind the home indicator on all Face ID devices. | P24-02 |

---

## Recommended implementation order

The findings above map to P24-02 through P24-07 in the order already specified in the roadmap. No reordering needed — P24-02 (responsive nav + `dvh` fix) resolves the most P0s and unblocks all subsequent tickets.

P0 findings 1, 3, 4 → **P24-02**
P0 finding 2 → **P24-05**
P1 findings 5 → **P24-02** (breakpoint change)
P1 finding 6 → **P24-06**
P1 finding 7 → **P24-03**
P1 findings 8, 9 → **P24-04**
P2 findings 10–12 → **P24-02, P24-05**

---

## Real-device verification needed before P24-08

Before the PWA manifest ticket ships, re-run a spot check on:
- iOS Safari 17+ on physical iPhone 14 or 15 — focus on: safe-area insets, 100dvh, scroll behaviour in the edit sheet
- Android Chrome 120+ on Pixel 7 — focus on: `beforeinstallprompt` event, file picker in import

Note any discrepancies from DevTools simulation and file additional findings.
