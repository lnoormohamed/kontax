# P34D-06 — Smoke Test: Mobile and PWA

## Purpose

Verify that Kontax is fully functional on real mobile devices (iOS Safari, Android
Chrome) and as an installed PWA — including offline mode, touch gestures, bottom
navigation, and all mobile-specific UI flows.

## Background

The mobile design brief (roadmap/mobile-design-brief.md) covers 40 routes. Phase 34
added tablet fixes (P34-05/06/07). The "Touch gestures: verify on device" memory
note explicitly states that Preview cannot emulate touch — swipe-to-archive and
swipe-to-favourite use `@use-gesture useDrag axis:"x"` and must be tested on a real
device.

PWA functionality (install, offline cache, background sync) cannot be meaningfully
tested in DevTools alone.

## Scope

**In scope**
- PWA install on Android Chrome and iOS Safari
- Offline mode: cached contact list visible, "Offline" banner
- Swipe-to-archive (swipe left on a contact row)
- Swipe-to-favourite (swipe right on a contact row)
- Bottom navigation (4 tabs)
- Mobile contact detail: readability, Edit FAB, action buttons
- Mobile create contact: full-screen form, keyboard handling
- Mobile settings: all sub-pages reachable, back navigation
- Mobile search overlay: open, type, grouped results, tap to open
- Tablet (768px) layout: verify P34 tablet fixes

**Out of scope**
- Mobile push notifications (if not yet implemented)
- Mobile billing flow (Stripe mobile Checkout is a hosted page — covered in P34D-05)
- App Store / Play Store submission (not in scope for this launch)

## Design / Implementation Spec

**Required devices:**
- Android Chrome (any Android 10+ phone with Chrome latest)
- iOS Safari (iPhone with iOS 15+)

**Tablet verification** can use DevTools device emulation at 768px width (tablet
layout is CSS-driven, not touch-dependent), but mobile tests must use real devices.

For the offline test (TC-03), use Android Chrome's DevTools remote debugging or
simply disable the device's WiFi and mobile data.

The "Offline" banner should be driven by `navigator.onLine` or a `window` `offline`
event — not by a failed API call alone — so that it appears immediately when
connectivity drops.

Record results in `roadmap/runbooks/smoke-test-results-v1.md` → Mobile & PWA
section. Note which device/OS/browser each test was run on.

## Test Cases

| ID | Test Case | Device | Steps | Expected Result | Pass/Fail |
|----|-----------|--------|-------|-----------------|-----------|
| TC-01 | Install PWA — Android Chrome | Android Chrome | Open https://kontax.vexon.co in Chrome. Tap the "Add to Home Screen" banner or use the Chrome menu. Install. | App appears on the home screen. Opening it launches without browser chrome (no address bar). Splash screen shows app name/icon. | |
| TC-02 | Install PWA — iOS Safari | iOS Safari | Open https://kontax.vexon.co in Safari. Tap the Share icon → "Add to Home Screen". Add. | App appears on home screen. Opening it launches in standalone mode (no Safari chrome). | |
| TC-03 | PWA offline mode | Android Chrome (installed PWA) | Log in, load the contact list. Disable WiFi and mobile data. Open the app. | Cached contact list is visible. An "Offline" or "No internet connection" banner is shown. The app does not crash or show a blank screen. | |
| TC-04 | Background sync on reconnect | Android Chrome | While offline (from TC-03), if any pending change exists (edge case — note it). Re-enable WiFi. | App detects reconnection. If there were pending changes, they sync. No data loss. | |
| TC-05 | Swipe-to-archive | Real device (either) | In the contact list, swipe left on a contact row. | An "Archive" action appears (red background or action label). Tapping it archives the contact. Contact removed from People tab. | |
| TC-06 | Swipe-to-favourite | Real device (either) | In the contact list, swipe right on a contact row. | A "Favourite" action appears. Tapping it toggles the favourite state. Star appears on the contact row. | |
| TC-07 | Bottom navigation | Real device (either) | Tap each of the 4 bottom nav tabs: Contacts, Activity, Sync, Settings. | Each tab navigates to the correct page. Active tab is visually indicated. Back swipe (iOS) returns to previous tab correctly. | |
| TC-08 | Mobile contact detail — readability | Real device (either) | Open any contact with multiple phones, emails, notes, and labels. | All sections readable on a 375px-wide screen. No horizontal overflow. Labels wrap correctly. | |
| TC-09 | Mobile contact detail — Edit FAB | Real device (either) | Scroll down on the contact detail page. | The floating Edit action button remains visible (sticky) as the page scrolls. Tapping it opens edit mode. | |
| TC-10 | Mobile contact detail — action buttons | Real device (either) | On a contact with a phone number, tap the "Call" action button. On a contact with an email, tap "Email". | Call action triggers the native phone dialler with the number pre-filled. Email action opens the native mail client with the address pre-filled. | |
| TC-11 | Mobile create contact | Real device (either) | Tap the "+" or FAB to create a new contact. | A full-screen form opens (bottom sheet or full page). All fields are reachable by scrolling. When a text field is focused, the keyboard does not obscure the active input — the form scrolls up. | |
| TC-12 | Mobile settings — all sub-pages | Real device (either) | Open Settings. Tap into each sub-page: Account, Security, Billing, Sync, Notifications, etc. | Each sub-page opens. A back button (or OS back gesture) returns to the settings list. The "settings subpages lack mobile back button" issue (per memory note) should now be fixed — verify. | |
| TC-13 | Mobile search overlay | Real device (either) | Tap the search icon in the top bar. Type a contact name. | Full-screen search overlay opens. Results grouped (People, Email, etc.) appear. Tapping a result opens the contact detail page. Overlay closes. | |
| TC-14 | Tablet layout — sync page | DevTools 768px | Open /sync at 768px width. | Two-column or properly adapted layout. No content cut off or overflowing. Verify this matches the P34-05 tablet fix. | |
| TC-15 | Tablet layout — settings | DevTools 768px | Open /settings at 768px width. | Settings sidebar + content panel layout (if applicable) or single-column adapted layout. No overflow. | |
| TC-16 | Tablet layout — contact detail | DevTools 768px | Open a contact detail at 768px. | Two-column layout (if implemented) or clean single-column. All fields readable. No horizontal overflow. | |

## Acceptance Criteria

- TC-05 (swipe-to-archive) and TC-06 (swipe-to-favourite) pass on at least one real
  device. DevTools emulation does not count for these two cases.
- TC-01 (Android PWA install) passes.
- TC-03 (offline mode) passes — cached list visible and "Offline" banner shown.
- TC-12 (mobile settings back navigation) passes — the known gap from the memory note
  must be resolved before go-live.
- All other test cases pass.
- Results recorded with device/OS/browser noted per row.

## Risks / Open Questions

- PWA manifest and service worker caching strategy must be verified. If the service
  worker is not registered or the cache is too narrow, TC-03 will fail. Check
  `public/manifest.json` and the service worker registration in `_app` or layout.
- iOS Safari standalone mode has restrictions: no push notifications, limited
  service worker support. TC-04 may not be fully testable on iOS — note this.
- Back button on iOS (swipe-from-left-edge) may conflict with swipe-to-archive in
  TC-05 if the gesture detection isn't scoped to the row element. Test carefully.
- TC-12 references the "settings subpages lack mobile back button" memory note. If
  this is still not fixed, it is P1 (not P0, since Settings works on desktop).

## Documentation

- [ ] External · users — in-app Help: no changes needed
- [ ] External · developers — /developers: no changes needed
- [x] Internal · ops — `roadmap/runbooks/smoke-test-results-v1.md`: record results here
  with device details per test case
- [ ] Internal · engineering — docs/: note any PWA service worker caching strategy
