# P24-01 — Mobile Navigation Audit

## Purpose

Systematically identify every flow in the Kontax web app that is broken, degraded, or unusable on mobile screen widths — specifically on real iOS Safari and Android Chrome, not just browser DevTools. The output is a ranked bug list that drives the implementation order for P24-02 through P24-08.

## Background

Phase 16 (P16-07) shipped a basic mobile cozy fallback: compact row density, a bottom nav placeholder, and a tablet-level column drop. This was a minimum viable mobile experience, not a polished one. Before investing in specific improvements, a structured audit is necessary to ensure the right problems are fixed in the right order and that no critical path is missing from the implementation plan.

The audit must run on real devices — iOS Safari and Android Chrome have known divergences from DevTools simulations in input handling, viewport height calculation (the bottom URL bar affects `100vh`), rubber-band scrolling, and font rendering.

## Scope

**In scope:**
- All primary flows at 390px viewport width (iPhone 14 baseline) on iOS Safari 17+
- All primary flows at 360px viewport width (Android baseline) on Chrome 120+
- Secondary check at 768px (tablet threshold) and 1024px
- Documented findings: screenshot, affected route, severity (P0 blocks task / P1 degrades task / P2 cosmetic), and suggested fix
- Prioritised fix list ordered by user impact

**Out of scope:**
- Fixing any bugs (findings go to the bug list for subsequent tickets)
- Testing on devices below 320px (out of support scope)
- Native app or WebView-specific testing

---

## Design / Implementation Spec

### Flows to test

For each flow, verify: can the user complete the task without zooming, horizontal scrolling, or being blocked by an off-screen element?

| Flow | Key screens |
|---|---|
| Sign in / register | `/login`, `/register` |
| Contacts list | `/` — list, search, filter, bulk select |
| Contact detail | `/contacts/[id]` — all tabs, field visibility |
| Create contact | `/contacts/new` |
| Edit contact | `/contacts/[id]/edit` |
| Import | `/import-export` — Steps 1, 2, 3 |
| Export | `/import-export` — export card |
| Sync connections | `/sync` — list, detail, add |
| Activity log | `/activity` |
| Settings | `/settings/**` — all sections |
| Share invite | `/share/[token]` (public) |
| Merge suggestions | `/merge-suggestions` |

### Severity definitions

- **P0:** The user cannot complete the task. Action buttons off-screen, modal not dismissable, form not submittable.
- **P1:** The user can complete the task but it requires significant effort — zooming, imprecise tapping, horizontal scrolling.
- **P2:** Cosmetic or minor degradation — truncated text, slightly small tap targets, minor layout shift.

### Audit output format

Create `roadmap/build-phase/p24-01-audit-findings.md` with findings in this format:

```markdown
| # | Route | Flow | Device | Severity | Description | Screenshot |
|---|---|---|---|---|---|---|
| 1 | /contacts/[id] | Edit — keyboard covers Save button | iOS Safari | P0 | The Save button is hidden behind the iOS keyboard with no scroll accommodation | p24-01-finding-01.png |
| 2 | /sync | Account detail — action buttons wrap | Android Chrome | P1 | Action buttons (Sync now, Pause, Edit, Disconnect) overflow into two rows and partially clip | p24-01-finding-02.png |
```

### Test environment

- **Device 1 (iOS):** iPhone 14 or 15, Safari, iOS 17+. If no physical device available, Xcode Simulator with Safari on device skin.
- **Device 2 (Android):** Any Android 12+ device with Chrome 120+. If no physical device, Chrome DevTools device simulation with Android Pixel 7 preset (360px × 800px).
- **Browser DevTools baseline:** record the DevTools observations, then verify on real hardware. Note discrepancies.

### Expected findings based on known issues

Based on Phase 16's mobile fallback, the following are expected P0/P1 issues:
1. Keyboard does not push the page up on iOS — the Save/submit button is hidden when a text field is focused.
2. The contacts list sidebar is not hidden below 768px — it may stack but consume excessive vertical space.
3. The contact detail tab bar may not be horizontally scrollable on narrow viewports.
4. The import wizard Step 2 preview table has no horizontal scrolling constraint — overflows the viewport.
5. Settings nested pages may not have a back button on mobile.

---

## Acceptance Criteria

- All 12 flows listed above have been tested on iOS Safari and Android Chrome.
- Every P0 finding is documented with a screenshot and a specific suggested fix.
- The output is a ranked `p24-01-audit-findings.md` file agreed by engineering before P24-02 begins.
- P24-02 through P24-07 are sequenced based on the findings' severity counts.
- The audit is re-run (spot check for regressions) after each subsequent P24 ticket ships.

---

## Risks and Open Questions

- **iOS Safari 100vh bug:** `height: 100vh` on iOS Safari includes the browser chrome (address bar), causing elements to be positioned behind it. The fix uses `dvh` (dynamic viewport height) units or `window.innerHeight` in JavaScript. Confirm which approach is used in the current codebase and flag any inconsistencies for P24-02.
- **Physical device access:** if no physical devices are available, Xcode Simulator + Chrome DevTools are sufficient for the audit, but document which findings were device-verified vs simulation-only. Plan a device testing session before P24-08 (PWA) ships.
