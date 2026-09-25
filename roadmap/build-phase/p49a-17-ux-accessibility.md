# P49A-17 — UX & accessibility: confirmations, labels, 2FA inputs, focus, loading states

**Phase:** 49A · **Priority:** P1 · **Depends on:** — · **Effort:** M
**Audit IDs:** A-43, A-44, A-45, A-46, A-47 (UX-12…UX-18)

## Objective
No accidental irreversible actions, and the core forms work with screen readers, keyboards and
iPhones.

## Production verification (2026-09-25)
Code-verified against origin/main (identical to audited code). The signed-in app can't be
exercised on prod without a real account; verify each on staging with a test account.
- A-43: live-share revoke (`contact-sharing.tsx:454-460`) and single-device sign-out
  (`sessions-section.tsx:40-49`) act on click; `ConfirmDialog` exists but isn't used there.
- A-44: `create-contact-form.tsx` has 0 `<label>` elements (placeholder-only) and 14 px inputs.
- A-45: 2FA code boxes (`login/verify-2fa/page.tsx:30-52`, `two-factor-modal.tsx:24-47`) have no
  per-digit labels and no `autocomplete="one-time-code"`; the 2FA modal lacks
  `aria-modal`/`aria-labelledby`/Escape/initial focus.
- A-46: `mobile-bottom-sheet.tsx:131-139` claims a focus trap but only handles Escape.
- A-47: no `loading.tsx` or `not-found.tsx` anywhere under `src/app`.

## Steps
1. Route live-share revoke and device sign-out through `ConfirmDialog`.
2. Visible compact labels for every create-contact field; inputs ≥ 16 px on mobile.
3. One shared `OtpInput` with per-digit `aria-label`, `inputMode="numeric"`,
   `autocomplete="one-time-code"` on the first box, paste support; 2FA modal adopts the
   `ConfirmDialog` dialog conventions.
4. Real focus trap + initial focus + focus restore in the bottom sheet.
5. `loading.tsx` skeletons for contacts, sync, settings, merge review; branded `not-found.tsx`.
6. Smaller: onboarding completion card waits for user action; delete-account modal follows the
   explicit-dismiss policy and announces errors via `aria-live`.

## Acceptance
- axe/Playwright a11y check on create-contact, 2FA verify, 2FA setup and the bottom sheet: no
  critical issues; keyboard-only walkthrough possible.
- iPhone (375 px) focusing any create-contact field does not zoom.
