# P24B-06 — PWA install prompt (iOS / Android)

## Purpose

Implement the "Add Kontax to your Home Screen" bottom sheet with platform-specific variants, matching
the prototype's install flow.

## Background

The prototype (`mob-extra.jsx` `InstallPrompt`, exercised via the Tweaks panel) defines both an
Android programmatic install and an iOS manual-steps variant. The PWA shell shipped in P24-08; this adds
the install nudge.

## Scope

**In scope:** `MobileInstallPrompt` component + the trigger heuristic + dismissal persistence.
**Out of scope:** manifest/service-worker (already shipped in P24-08).

## Design / Implementation Spec

Per spec §D5. Bottom sheet: drag handle, centered "Add Kontax to your Home Screen", 64px green app tile
+ "Kontax / kontax.app", one-line value prop.
- **iOS:** two numbered steps — (1) Tap the Share icon, (2) "Add to Home Screen" — + "Got it".
- **Android:** capture `beforeinstallprompt`; show "Install" (blue) + "Not now".
Trigger: not already installed (`display-mode: standalone` false), not previously dismissed (persist a
flag), after some engagement. Dismissable; don't nag.

## Acceptance Criteria

- Android: `beforeinstallprompt` is captured and "Install" triggers the native prompt.
- iOS Safari: the manual-steps variant shows (no `beforeinstallprompt` there).
- Dismissal persists (no re-show within a sensible window); hidden when running standalone.
- Matches the prototype's two install frames.

## Risks and Open Questions

- `beforeinstallprompt` timing/availability varies by Chrome version; guard and fall back to no prompt.
- Decide the engagement threshold + re-show window with the team.
