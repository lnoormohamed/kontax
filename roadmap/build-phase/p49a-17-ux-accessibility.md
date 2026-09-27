# P49A-17 — UX & accessibility: confirmations, labels, 2FA inputs, dialogs, loading states

**Phase:** 49A · **Priority:** P1 · **Status:** Ready — reassessed 2026-09-27 after Phase 50 shipped
(production 0886b69) · **Effort:** M overall (mostly S items) · **Depends on:** —
**Audit IDs:** A-43…A-47 (UX-12…UX-18) + follow-ups · Split out: [P49A-20](p49a-20-focus-visible-sweep.md)

## Objective
No accidental irreversible actions, and the core signed-in forms and dialogs work with screen
readers, keyboards and iPhones.

## Reassessment (2026-09-27)
Phase 50 restyled the marketing site and auth screens, and a separate fix reworked the 2FA
recovery-codes flow, but **none of the original items were fixed**; one is partly improved.
Auth screens themselves (`auth-card.tsx`) are fine: 16 px inputs, real labels, focus ring on
`:focus`. No colour-only states found.

| Item | Status | Evidence (production code) |
|---|---|---|
| A-43 live-share revoke / unlink | open | `src/app/_components/contact-sharing.tsx:454-461, 513-521, 660-667` — bare form actions, no confirm |
| A-43 single-device sign-out | open | `src/app/settings/security/sessions-section.tsx:40-51, 74` |
| A-43 "sign out all other devices" | partly | `sessions-section.tsx:96, 140-160` — bespoke inline two-step confirm, not `ConfirmDialog` |
| A-44 create-contact form | open | `src/app/_components/create-contact-form.tsx` — 0 `<label>`s; `FIELD` (l.29-30) is 14 px |
| A-45 2FA code inputs | open | `src/app/login/verify-2fa/page.tsx:14-49`, `two-factor-modal.tsx:9-46` — two copies of `OtpInput`, no per-digit labels, no `autocomplete="one-time-code"` |
| A-45 2FA modal semantics | open | `two-factor-modal.tsx:107-108` — `role="dialog"` only; closes on backdrop; no Escape, no initial focus |
| A-46 mobile bottom sheet | open | `src/app/_components/mobile-bottom-sheet.tsx:131-139` — only Escape; no Tab trap, initial focus or restore |
| A-47 loading / not-found | open | no `loading.tsx` / `not-found.tsx` anywhere under `src/app` |
| Recovery-codes dialog focus (Fable, P49A-19) | open | `src/app/settings/security/recovery-codes.tsx:86-103` — no focus in on open, no restore, no `inert` background |
| Onboarding "all done" auto-dismiss (5 s) | open | `src/app/_components/onboarding-checklist.tsx:151-193` |
| Delete-account modal | open | `src/app/settings/security/delete-account-section.tsx:96` closes on backdrop; error at l.124 has no `aria-live` |
| **New:** global search box | high | `src/app/_components/search-input.tsx:79-90` — no accessible name; focus style keyed to `value`, so an empty focused box shows nothing |
| **New:** icon-only buttons without names | high | `src/app/import-export/_components/presets-panel.tsx:70-83` (✓/✕), `src/app/sync/_components/sync-page-client.tsx:2765-2782` (close ✕) |

## Steps (in order)
1. **Confirmations (S):** route live-share revoke, live-share unlink, single-device sign-out and
   "sign out all other devices" through `ConfirmDialog` — one pattern, four call sites.
2. **Search + icon buttons (S):** `aria-label="Search contacts"` and a `:focus-visible` ring
   independent of the value on `search-input.tsx`; `aria-label`s on the preset ✓/✕ and the sync
   credentials close button.
3. **Create-contact form (M):** visible compact labels for every field; inputs 16 px on mobile.
4. **2FA (S–M):** one shared `OtpInput` (per-digit `aria-label` "Digit n of 6",
   `inputMode="numeric"`, `autoComplete="one-time-code"` on the first box, paste support) used by
   both 2FA screens. Give `two-factor-modal.tsx` and `RecoveryCodesDialog` real dialog behaviour:
   `aria-modal`, `aria-labelledby`, focus moved in on open and restored on close, `inert` on the
   background, Escape where dismissal is allowed (the recovery-codes dialog stays
   confirm-to-close, but must still be keyboard-reachable).
5. **Bottom sheet (M):** real focus trap, initial focus and focus restore in
   `mobile-bottom-sheet.tsx`.
6. **Loading and 404 (M):** `loading.tsx` skeletons for contacts, sync, settings and merge review;
   a branded `not-found.tsx`.
7. **Small fixes (S):** onboarding completion waits for the user (no 5 s auto-dismiss);
   delete-account modal no longer closes on backdrop and announces errors with `aria-live`.

## Acceptance
- axe (Playwright) on create-contact, 2FA verify, 2FA setup, recovery codes, sessions, sharing and
  the bottom sheet: no critical or serious violations; keyboard-only walkthrough possible.
- Revoking a share or signing out a device asks for confirmation first.
- Focusing any create-contact field on a 375 px iPhone viewport does not zoom.

## Out of scope
The invisible focus on borderless inline-edit inputs (10 files) is a design-system sweep: see
[P49A-20](p49a-20-focus-visible-sweep.md).
