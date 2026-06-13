# Phase 24B — Mobile PWA Design Completion (tickets)

**Created:** 2026-06-12 · **Tracks:** building every mobile page **strictly** to the design.
**Design source of truth:** [`mobile-pwa-design-spec.md`](./mobile-pwa-design-spec.md) (language + per-page,
derived from the `mob-*.jsx` modules behind **Mobile PWA.html / Mobile PWA Overview.html**).
**Live reference prototype (vendored):** [`design-briefs/mobile-pwa-prototype/`](./design-briefs/mobile-pwa-prototype/)
— open `Mobile PWA.html` to interact (online/offline, empty/full, install states). The visual
acceptance bar for every ticket.
**Status audit:** [`mobile-design-brief.md`](./mobile-design-brief.md).

> Lineage: **P24** initial PWA shell → **P24A** critical fixes (sync/activity/nav, shipped) →
> **P24B** full design coverage of every route. We are **building on the existing P24 design language**,
> not reinventing it.

## How to use
- Ticket IDs `P24B-NN`. Each has a full ticket file in
  [`build-phase/`](./build-phase/) (`p24b-NN-*.md`) with Purpose / Background / Scope / Spec /
  Acceptance Criteria / Risks. This file is the index; the build-phase files are the detail.
- Status: ☐ todo · ◑ in progress · ✅ done · ⬚ blocked.
- Every ticket's **Definition of Done** is: matches the referenced spec §, covers the **Part E0
  plan/role/lifecycle variants** that apply, and reproduces the relevant **Overview states**
  (offline / empty / swipe-revealed / keyboard-aware / install / locked) where the Overview defines them.
- Verify on a real 375px viewport (preview) before marking ✅. No "looks about right."

## Global definition of done (applies to all tickets)
1. **Strictly follows the spec** — tokens (A2), type (A3), spacing/radius/elevation/motion (A4),
   components (Parts B–D). If a value isn't in the spec, derive from Part A; don't invent.
2. **Variance covered** — every plan (FREE/PRO/FAMILY/TEAMS), lifecycle (read-only), and role
   (OWNER/ADMIN/MEMBER) variant from Part E0 that applies to the page is designed and tested.
3. **States covered** — loading / empty / error / offline / upsell, per Part F.
4. **No regressions on desktop** (≥768px) and no duplicate chrome.
5. **A11y** — tap targets ≥44px, inputs ≥16px (no iOS zoom), `prefers-reduced-motion` respected.

---

## Design briefs (`p24b-dbNN` — design requirements; precede the build)
Core flows (contacts, detail, create/edit, activity, sync, settings, import, install) are already
briefed by `p24-db06` + [`mobile-pwa-design-spec.md`](./mobile-pwa-design-spec.md) + the vendored
prototype. These cover the **net-new** surfaces the prototype never drew. Each contains a **Design
Requirements** section; the paired build ticket builds to it.

| Brief | Title | Builds | Status |
| --- | --- | --- | --- |
| P24B-DB14 | Mobile variance & gating system | P24B-03 (+ all pages) | ☐ |
| P24B-DB15 | Family & Teams mobile management surfaces | P24B-13, P24B-14 | ☐ |
| P24B-DB16 | Merge surfaces (restyle + mobile compare) | P24B-17 | ☐ |
| P24B-DB17 | Pricing page mobile | P24B-18 | ☐ |
| P24B-DB18 | Search & Notifications mobile overlays | P24B-22, P24B-23 | ☐ |
| P24B-DB19 | Contact edit (mobile) — full-field edit sheet | P24B-07 (edit) | ✅ |
| P24B-DB20 | Activity feed (mobile rows) | P24B-09 | ☐ |
| P24B-DB21 | Sync (mobile) + plan variance | P24B-10 | ☐ |

---

## Workstream A — Shared foundations (do first; unblock the rest)
| Ticket | Title | Spec § | Priority | Status | Depends |
| --- | --- | --- | --- | --- | --- |
| P24B-01 | `MobilePlainHeader` (title + bell) — extract & adopt on Activity/Sync/Settings roots | B1 | P1 | ✅ | — |
| P24B-02 | Settings layout: secondary-header back-nav on sub-pages (‹ Settings · <title>) | B1, E6 | **P0** | ✅ | — |
| P24B-03 | Variance primitives: `UpsellCard`, `NearLimitBanner`, `ReadOnlyBanner`, `PendingChip`, `PermissionGate` | E0.4, C | **P0** | ✅ | P24B-DB14 |
| P24B-04 | "Stack table → cards / h-scroll" helper | C, F | P1 | ✅ | — |
| P24B-05 | Confirm-dialog / action-sheet primitive | D4 | P1 | ✅ | — |
| P24B-06 | `MobileInstallPrompt` (iOS steps / Android programmatic) | D5 | P2 | ☐ | — |

## Workstream B — Core write flow
| Ticket | Title | Spec § | Priority | Status | Depends |
| --- | --- | --- | --- | --- | --- |
| P24B-07 | Create/Edit as **bottom sheet** — collapsible sections, keyboard accessory bar, pinned Save; full page kept as `?full=1` fallback | E3, D1–D3 | **P0** | ✅ create + edit (DB19) | P24B-03, P24B-DB19 |

## Workstream C — Tab screens to spec
| Ticket | Title | Spec § | Priority | Status | Depends |
| --- | --- | --- | --- | --- | --- |
| P24B-08 | Contact detail: 4 green-tint **ActionPills** + scroll-aware compact header; Free history cap (last 3) + Sharing-tab gating | E2 | P1 | ✅ | P24B-03 |
| P24B-09 | Activity: mobile **GroupCard event rows** + retention caption; keep Free upsell (distinct from empty) | E4 | P1 | ◑ **redo → DB20** | P24B-03, P24B-DB20 |
| P24B-10 | Sync: confirm to spec + Free **CardDAV upsell / 1-account cap** variance | E5 | P2 | ◑ **redo → DB21** | P24B-03, P24B-DB21 |
| P24B-11 | Contacts list: sticky group headers (deferred from P24A) + limit/read-only variance | E1 | P2 | ✅ | P24B-03 |
| P24B-22 | Mobile **search overlay** → to spec (results, recents, no-match, offline) | E13 | P1 | ✅ | P24B-DB18 |
| P24B-23 | Mobile **notifications overlay** → to spec (category rows, security drawer, mark-all-read; cover bottom nav) | E14 | P1 | ✅ | P24B-DB18 |

## Workstream D — Settings sub-pages
| Ticket | Title | Spec § | Priority | Status | Depends |
| --- | --- | --- | --- | --- | --- |
| P24B-12 | Sub-page content pass: single-column; notifications/preferences toggle rows; verify account/devices/security | E6 | P1 | ✅ | P24B-02 |
| P24B-12a | Plan & billing settings mobile pass: visible billing content, usage rows, portal actions, cancellation sheet | E6 | P1 | ✅ | P24B-12 |
| P24B-13 | Family/Teams management: owner/admin vs member variance, roster cards, per-book permission **matrix → cards**, pending chips | E6, E0.3 | P1 | ☐ | P24B-02, P24B-04 |
| P24B-14 | Teams/audit log — stacked rows / h-scroll | E6 | P2 | ☐ | P24B-04 |

## Workstream D2 — Performance follow-ups
| Ticket | Title | Spec § | Priority | Status | Depends |
| --- | --- | --- | --- | --- | --- |
| P24B-PERF-01 | Contacts list render performance: memoized rows, derived list data, sticky-section cleanup | E1 | P0 | ◑ | P24B-11 |
| P24B-PERF-02 | Mobile gesture performance: swipe hot-path cleanup, scroll-vs-swipe stability | E1 | P0 | ◑ | P24B-PERF-01 |
| P24B-PERF-03 | Route bundle reduction: lazy-load modal/drawer surfaces and trim initial JS | All | P1 | ◑ | P24B-PERF-01 |
| P24B-PERF-04 | Server data query performance: defer archived and duplicate detail hydration to active tabs | All | P1 | ◑ | P24B-PERF-03 |

## Workstream E — Collaboration & data
| Ticket | Title | Spec § | Priority | Status | Depends |
| --- | --- | --- | --- | --- | --- |
| P24B-15 | Import/export wizard responsive: single-column steps, 2×2 source chips, sticky-column preview; quota + export variance | E7 | P1 | ☐ | P24B-03, P24B-04 |
| P24B-16 | Shares: confirm to spec + Free outbound-share gating (can still accept incoming) | E8 | P2 | ☐ | P24B-03 |
| P24B-17 | **Merge pages restyle** to light system (off-brand today) + stacked A/B compare | E8 | **P1** | ☐ | — |

## Workstream F — Public / pricing / auth
| Ticket | Title | Spec § | Priority | Status | Depends |
| --- | --- | --- | --- | --- | --- |
| P24B-18 | Pricing: 1-col plan cards + stacked/scrollable comparison table | E10 | P2 | ☐ | P24B-04 |
| P24B-19 | Auth/public verification pass (login/register/2fa/reset/verify · privacy/terms · join-token · account-status) | E9–E10 | P2 | ☐ | — |

## Bugs
| Ticket | Title | Spec § | Priority | Status | Depends |
| --- | --- | --- | --- | --- | --- |
| P24B-24 | Shared contacts 404 for members (detail access) + mobile toolbar removal + SW stale-login hardening | E1, E2 | **P0** | ✅ | — |

## Workstream G — Admin & cross-cutting QA
| Ticket | Title | Spec § | Priority | Status | Depends |
| --- | --- | --- | --- | --- | --- |
| P24B-20 | Admin minimal mobile hardening (no break <768; h-scroll tables; ≥44px targets) | E11 | P3 | ☐ | — |
| P24B-21 | **Variance QA pass** across all pages with seeded accounts: Pro, Family owner+member, Teams owner+admin+member, read-only (GRACE/LOCKED) | E0 | P1 | ☐ | most build tickets |

---

## Notes & sequencing
- **P0 first:** P24B-02 (settings back-nav — navigation is broken today), P24B-03 (variance primitives —
  everything else reuses them), P24B-07 (create/edit sheet — most-used write flow, wrong pattern).
- **P24B-21 needs seeded data** — a Family owner, a Teams owner/admin, and a read-only (GRACE/LOCKED)
  account. The verification sweep could only reach a Free family-member, so owner/admin/2FA/read-only
  states are still unverified. Seed these before the QA pass. See [[db-and-verification-workflow]].
- **P24B-17 (merge restyle)** is also a desktop fix — those pages are off-brand on every viewport.
- **Design briefs** (`p24b-dbNN`) carry the design requirements and precede their build tickets; the
  `p24b-NN` files are the engineering builds. Core flows reuse `p24-db06` + the spec/prototype; the
  five new briefs (DB14–DB18) cover the surfaces the prototype never drew. Build to the brief.

## Suggested order (waves; design briefs ◀ sit just before the builds they gate)
**Wave 1 — Foundations (P0)**
1. **P24B-DB14** ◀ (variance design) · 2. **P24B-DB18** ◀ (search & notifications design) ·
3. **P24B-02** (settings back-nav, P0) · 4. **P24B-03** (variance primitives, P0; needs DB14) ·
5. P24B-01 (plain header) · 6. P24B-04 (table→cards) · 7. P24B-05 (confirm dialog)

**Wave 2 — Write flow + tab/header polish** (need P24B-03 / DB18)
8. **P24B-07** (create/edit sheet, P0) · 9. P24B-08 (detail pills) · 10. P24B-09 (activity rows) ·
11. P24B-10 (sync variance) · 12. P24B-11 (sticky headers) ·
13. P24B-22 (search overlay) · 14. P24B-23 (notifications overlay)

**Wave 3 — Settings + groups**
15. P24B-12 (settings sub-pages) · 16. **P24B-DB15** ◀ (family/teams design) ·
17. P24B-13 (family/teams mgmt) · 18. P24B-14 (teams audit)

**Wave 4 — Collaboration & data**
19. P24B-15 (import responsive) · 20. P24B-16 (shares) ·
21. **P24B-DB16** ◀ (merge design) · 22. P24B-17 (merge restyle)

**Wave 5 — Public / pricing / auth**
23. **P24B-DB17** ◀ (pricing design) · 24. P24B-18 (pricing) · 25. P24B-19 (auth/public verify)

**Wave 6 — Tail**
26. P24B-06 (install prompt) · 27. P24B-20 (admin hardening) · 28. **P24B-21** (variance QA — last)

## Progress log
- 2026-06-12 — Phase opened. P24A shipped (sync/activity/nav fixes). Spec + brief + variance model in place.
- 2026-06-12 — DB14 + DB18 design briefs approved (real-IOSDevice frames, scale 0.6).
- 2026-06-12 — **P24B-02 done** — settings sub-pages now get a back header (‹ Settings · title)
  via `MobileSettingsHeader`; root keeps the plain title. Verified at 375px; desktop unchanged.
  Follow-up for P24B-12: drop the redundant in-page "SETTINGS" kicker on mobile sub-pages.
- 2026-06-12 — **P24B-03 done** — variance primitives built to DB14 in
  `_components/mobile-variance.tsx` (UpsellCard, GenuineEmpty, NearLimitBanner, ReadOnlyBanner,
  PendingChip, PermissionGate). Server-compatible (Link nav, no hooks). Verified every state at
  375px against the design via `/wireframes/variance`. Ready for consumers (P24B-08/09/10/11/13…).
- 2026-06-12 — **P24B-01/04/05 done** — Wave 1 foundations complete:
  `MobilePlainHeader` (adopted on Sync/Settings-root/Activity, no visual change),
  `MobileTable` (stack-to-cards + sticky-column scroll; demo `/wireframes/mobile-table`),
  `ConfirmDialog` (portal, scrim/Escape dismiss, destructive/neutral; demo `/wireframes/confirm-dialog`).
  **Wave 1 foundations all ✅** — next is the P0 P24B-07 (create/edit bottom sheet).
- 2026-06-13 — **P24B-07 done** — create contact via the design bottom sheet (`MobileContactSheet`:
  collapsible Basic/Phones/Emails/Address/More, pinned Save, keyboard-aware). FAB opens it; verified
  end-to-end at 375px (create → saved → detail). **Decision:** edit keeps the comprehensive in-place
  `ContactInlineEditor` (fuller field set than the sheet); full form is the `?full=1` fallback.
- 2026-06-13 — **P24B-24 done** (bug) — shared contacts now open for members (detail access mirrors
  the list); mobile sort/view/scope toolbar removed; SW no longer caches redirected navigations (v3).
  Note: a *separate* intermittent "login screen on tap/unfav" auth-session bug is still open.
- 2026-06-13 — **P24B-08 done** — contact detail action row → 4 green-tint ActionPills
  (Call · Message · Email · More) per the design; added a `message` (chat-bubble) icon. Favourite /
  Share / Archive moved into a "More" bottom sheet. Verified at 375px. Scroll-aware compact header
  already existed; Free Sharing-tab gating ("Pro & above") and history cap are already enforced by the
  existing plan-aware ContactSharing / ContactHistory components.
- 2026-06-13 — **P24B-09 done** — verified the unlocked activity feed at 375px with a temporary Pro
  account: it already renders as a responsive GroupCard event feed (circle icon · name/action · actor ·
  timestamp), with the retention caption at the footer and the Free upsell (P24A) correct. The one real
  fix: the FilterBar now h-scrolls as a single row on mobile (`flex-nowrap overflow-x-auto`,
  `md:flex-wrap`) instead of wrapping into 3 rows — reclaims vertical space per spec §E4.
- 2026-06-13 — **P24B-10 done** — MobileSyncScreen plan variance, mirroring the server gates
  (assertCanUseCardDavSync / assertCanCreateSyncAccount): **Free** (cardDavSyncEnabled=false) → UpsellCard
  "Sync is a Pro feature"; **Pro+** → cards + Add, disabled at syncAccountsLimit (with reason);
  **read-only** → ReadOnlyBanner + Add disabled. Verified Free (upsell) and Pro (enabled Add) at 375px
  via the temp-Pro recipe.
- 2026-06-13 — **P24B-11 done** — sticky group headers in the virtualized contacts list: a scroll-driven
  overlay (`position: sticky`, md:hidden) pins the current section letter at the top of the scroll
  viewport (native sticky can't pin absolutely-positioned virtual rows). Verified at 375px with 70
  seeded contacts ("C" pins while C rows scroll under it). Variance: the near-limit + read-only banners
  already exist in contact-dashboard and the read-only FAB is already hidden (canWrite); added an
  `atLimit` prop so the create FAB hides at the contact cap (the near-limit banner explains + Upgrade).
  NOTE: ~60 random contacts were seeded into ngozi for scroll testing — re-run seed-demo-showcase for a
  clean demo. (Turbopack/SW staleness masked the working code mid-build; a clean .next + SW clear fixed it.)
- 2026-06-13 — **Process correction:** three surfaces shipped without dedicated design briefs are being
  redone brief-first. Added **DB19** (contact edit mobile — full-field edit sheet), **DB20** (activity
  feed mobile rows), **DB21** (sync mobile + plan variance). Reset P24B-07 (edit portion → DB19),
  P24B-09 (→ DB20), P24B-10 (→ DB21) to ◑ pending designer mockups, then rebuild to the briefs.
- 2026-06-13 — **P24B-22 done** — mobile search overlay to DB18: full-screen (portaled to body so it
  covers the bottom nav), search field + Cancel, debounced inline results via new
  `/api/contacts/search` (owned + shared books, name/company/email/phone/nickname), match highlight
  (#fff0bf), recents (localStorage), no-match, and offline note. Verified results/no-match/recents +
  nav coverage at 375px.
- 2026-06-13 — **P24B-23 done** — mobile notifications overlay to DB18: 52px full-screen mobile
  chrome above bottom nav, category rows with unread state, New/Earlier grouping, SECURITY drawer
  behavior, actionUrl navigation, mark-all-read, empty/loading states, and settings footer.
- 2026-06-13 — **P24B-12 done** — settings sub-pages content pass: shared cards tighten on
  mobile, duplicate in-page titles hidden behind the P24B-02 back header, account inputs use 16px,
  notifications/preferences toggles render as row switches, and 2FA enrolment becomes a mobile bottom sheet.
- 2026-06-13 — **P24B-12a done** — plan & billing settings mobile pass: `/settings` now exposes
  plan/billing content on mobile, the nav anchors to it, portal/cancel actions are full-width touch
  targets, and cancellation opens as a mobile bottom sheet while desktop stays modal.
- 2026-06-13 — **P24B-PERF-01 started** — contacts list render pass: memoized row subcomponents,
  memoized visible IDs/selection state and favorite/rest partitions, stable selection callbacks, and
  sticky section lookup moved out of inline JSX.
- 2026-06-13 — **P24B-PERF-02 started** — mobile gesture pass: cached swipe row width on gesture
  start, skipped no-op drag state updates, and removed the unused catch binding warning.
- 2026-06-13 — **P24B-PERF-03 started** — route bundle pass: lazy-loaded the notification security
  alert drawer and security settings 2FA enrolment modal so they load only when opened.
- 2026-06-13 — **P24B-PERF-04 started** — server data query pass: deferred archived contacts and
  duplicate detail hydration to their active tabs while preserving lightweight badge counts.
- 2026-06-13 — **P24B-07 edit redo done (DB19)** — `MobileContactSheet` rebuilt as ONE sheet for both
  create and edit, full field coverage vs the desktop editor: Basic (always-on) · Phones · Emails ·
  Websites · Address (multi sub-cards) · Dates (birthday + significant, native date inputs) · Related
  people · More (notes, name-details accordion, job title, **department**, custom fields). Count pills,
  data-bearing sections open by default / empty optional collapsed, label pills + add/remove, inline
  per-field validation under the field, pinned Save. Mobile detail now opens the sheet (replacing the
  in-place inline editor); prefill built server-side in `contacts/[id]/page.tsx`. Save path =
  `updateContact` per the brief — added `department` to the FormData contract so it round-trips, and
  made `updateContact` **shared-aware** (`resolveContactEditAccess` + `editableContactWhere`) so
  family/team-editable contacts save through the sheet (and the `?full=1` form) without the old
  owner-scoped failure. Variance gating: `isEditable` now uses `resolveContactEditAccess.allowed`, so
  view-only shared contacts show a **Read-only chip + no FAB** instead of a dead Edit affordance.
  Verified at 375px: full sheet renders, inline validation blocks save, owned-contact save round-trips
  (incl. department persist + prefill), shared-editable saves, view-only shared shows Read-only chip.
  Known limit (accepted per brief): 2+ structured addresses degrade extra addresses to formatted
  strings on save (matches the `?full=1` form). `?full=1` remains the fallback.
- 2026-06-13 — **P24B-07 keyboard UX fix (sheet)** — `MobileBottomSheet` header was pushed off-screen
  when the soft keyboard opened: the sheet lifted its bottom above the keyboard but kept `maxHeight:
  90svh`, so it stayed ~full-height while shifted up. Fix: when the keyboard is up, anchor the sheet to
  the **top** and fill the visual viewport (`top:0; height: visibleHeight`) rather than offsetting the
  bottom — robust across iOS (fixed = visual-viewport-relative) and Android (layout-relative), where
  anchoring the bottom diverged and floated the sheet mid-screen on iOS. Keyboard-down (bottom sheet,
  90svh) unchanged; confirmed on device (Android + iPhone). **P24B-07 / DB19 complete.**
