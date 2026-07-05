# P46-11 — Overlay & sheet taxonomy consolidation (mobile)

Status: **Built & preview-verified (2026-07-05) — only the real-device touch pass remains (phase QA)** · Priority: P2 · Depends: P46-08

> **Consolidation completed (second pass):**
> - Swipe-down-to-dismiss extracted to a shared `useSheetDrag` hook in
>   `mobile-bottom-sheet.tsx` — the ONE implementation, consumed by the
>   primitive **and** the filter sheet's bespoke chrome (main sheet + label
>   edit sub-sheet). Filter-sheet swipe + Escape verified live.
> - Manage-labels overlay back recolored to contract blue.
> - **Audited, no changes needed:** `more-menu`/`user-menu` (anchored,
>   outside-tap + Escape — Type-3 conform); `SortMenu` is desktop-only (the
>   mobile design has no sort surface — sort defaults to Name A–Z; if a mobile
>   sort is ever added it must be a bottom sheet per A5). Full conversion of
>   the filter sheet's layout onto `MobileBottomSheet` was deliberately NOT
>   done — its 90%-height + nested manage/edit layers are sound; sharing the
>   gesture/dismiss contract was the goal, not identical markup.

> **Delivered & verified:**
> - `MobileBottomSheet` primitive: **real swipe-down-to-dismiss** (grabber +
>   header zone, pointer-events; >80px or fast flick closes, small drag
>   springs back — all three verified live via synthetic pointer drags),
>   backdrop-tap + Escape kept, safe-area footer kept.
> - **Modal backdrop-dismiss removed** (taxonomy: explicit action only) from
>   all five: `confirm-dialog`, `confirm-password-modal`, `downgrade-modal`,
>   `plan-comparison-modal`, `labels-manage-modal`.
> - **Already conforming, verified:** notification overlay (back-led, DB03
>   build) and search overlay (full-screen, trailing blue "Cancel" — the
>   documented variant).
> - **Reduced-motion:** covered by the existing P43 root gate
>   (`html[data-motion]` + `prefers-reduced-motion` rules zero all inline
>   transition/animation durations with `!important`, and honour the explicit
>   "on" override) — no per-component guards added; a per-component
>   `matchMedia` check was removed for defeating the "on" override.
>
> **Remainder (next session):**
> - `mobile-filter-sheet.tsx` (553 lines, own chrome incl. a full-screen label
>   editor) + `sort-menu` consolidation onto the shared sheet primitive /
>   contract.
> - `more-menu` / `user-menu` dropdown-contract audit.
> - Real-device touch pass (synthetic pointer events prove the handlers; the
>   standing workflow requires a phone for the actual gesture).
Phase: [Phase 46](phase-46-alphabet-scrubber.md)
Spec: [P46-DB06](p46-db06-design-brief-mobile-consistency-audit.md) A5 (+ the
handoff-#29 lead-affordance rule) · carry-notes in the brief's
"Carry into build" section

## Scope
Bring every transient surface onto the four-type contract:
1. **Full-screen overlays** — notification panel (`notification-bell.tsx`,
   chrome only; content/aging is P46-DB03's, already built) and **search**
   (`mobile-search-button` family): lead top-left with the **blue back
   chevron + title**; search is the documented variant (input fills the bar,
   trailing blue **"Cancel"**). **✕ never closes a full-screen overlay.**
   Cover the bottom nav; scroll-lock.
2. **Bottom sheets** — `mobile-filter-sheet`, `sort-menu`,
   `mobile-contact-sheet` on the shared `mobile-bottom-sheet` primitive:
   grabber + **real swipe-down-to-dismiss** (prototype was click-only) +
   backdrop tap; safe-area footer; active filter/sort reflected in the list
   header.
3. **Dropdowns** — `more-menu`, `user-menu`: anchored, backdrop-tap dismiss,
   no title bar.
4. **Modals** — `confirm-dialog`, `confirm-password-modal`, `downgrade-modal`,
   `plan-comparison-modal`, `labels-manage-modal` onto one primitive:
   **explicit dismiss only — never backdrop** (deliberate taxonomy split);
   `security-alert-drawer` keeps its distinct affordance on the shared
   layering contract.
5. **One layering contract:** all four types render above the fixed bottom nav,
   scroll-lock the body, respect safe-area insets.
6. **`prefers-reduced-motion`** guards every overlay transition (sheet slide,
   menu/modal scale, overlay slide) — consistent with the P43 motion pref.

## Acceptance
- Each type demonstrably follows its dismiss contract on device (sheet
  swipe-down is a real gesture — preview can't emulate touch; real-phone pass
  required per the standing workflow).
- Modal cannot be dismissed by backdrop tap; sheet/dropdown can.
- With reduce-motion on, overlays appear/disappear without animation.
- No surface renders under the bottom nav or under a banner.
