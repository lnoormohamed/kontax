# P49A-20 — Focus-visible sweep for borderless inline-edit inputs

**Phase:** 49A · **Priority:** P2 · **Effort:** M · **Depends on:** — · **Split from:** P49A-17
(reassessment 2026-09-27)

## Problem
Borderless inline-edit inputs remove the browser outline (`outline-none`) with no replacement, so
keyboard users can't see where they are while editing a contact or other inline values.

Found in (production 0886b69):
- `src/app/_components/contact-inline-editor.tsx:155, 164`
- `src/app/_components/contact-multi-value.tsx:261`
- `src/app/_components/manual-merge-entry.tsx:193`
- `src/app/_components/merge-picker-button.tsx:250`
- `src/app/_components/calendar-feed-section.tsx:82`
- `src/app/_components/phone-country-input.tsx:224`
- `src/app/settings/account/username-section.tsx:218` (or its current location)
- `src/app/welcome/_components/upgrade-onboarding.tsx:126`
- `src/app/_components/bulk-edit-toolbar.tsx:405`
- `src/app/_components/import-preview-form.tsx:700`

## Steps
1. Add one shared focus-visible style for inline inputs (a utility class or a Tailwind
   `focus-visible:` ring using the app's focus colour `#4158f4`) that doesn't change layout.
2. Replace the bare `outline-none` on each input above with it; grep for other `outline-none`
   inputs without a focus replacement and fix those too.
3. Add a lint rule or a simple grep check in CI that flags `outline-none` without a `focus:` or
   `focus-visible:` companion class.

## Acceptance
- Tabbing through the contact editor, merge picker, bulk edit, import preview and settings shows
  a visible focus ring on every inline input; axe reports no `focus-visible` issues there.
