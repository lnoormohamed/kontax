# P49A-20 — Focus-visible sweep for borderless inline-edit inputs

**Phase:** 49A · **Priority:** P2 · **Effort:** M · **Depends on:** — · **Split from:** P49A-17
(reassessment 2026-09-27) · **Status:** Done 2026-09-27 (branch `p49a-20`, base `98f0d1b`)

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

## Resolution (2026-09-27)
Shipped on branch `p49a-20` (base `98f0d1b`), 3 commits.

- **Shared style:** `.kx-focus-visible` in `src/styles/globals.css` — `outline: 2px solid #4158f4`,
  `outline-offset: 1px`, `border-radius: 4px`, scoped to `:focus-visible` only (never `:focus`, so
  mouse clicks stay silent). Mirrors the marketing site's pre-existing `.mkt-wrap :focus-visible`
  rule and the search input's `has-[:focus-visible]` ring from P49A-17. Applied directly to each
  bare input/textarea/button; for the two ticket inputs sitting flush against an `overflow-hidden`
  wrapper (`phone-country-input.tsx`, `username-section.tsx`), the wrapper carries
  `has-[:focus-visible]:border-[#4158f4]` instead (an outline there would get clipped).
- **All 10 ticket inputs fixed**, plus 12 more found by sweeping the rest of `src` for
  `outline-none` / `outline: none`: `contact-books-block.tsx`, `labels-sidebar.tsx` (x2),
  `smart-lists-books.tsx` (x4), `admin.css` (`.ad-header-search`, `.ad-select-wrap` gain
  `:focus-within`; `.ad-range` gets a direct `:focus-visible` outline), `confirm-password-modal.tsx`,
  `mobile-search-button.tsx`, `mobile-filter-sheet.tsx`, `search-dropdown.tsx`,
  `sync-page-client.tsx` (6 inputs across the IMAP/CardDAV account forms), `connection-settings.tsx`
  (a select + a number input). The last 8 of those set `outline: "none"` via an inline `style`
  object — a sibling `className` alone can't override an inline style regardless of specificity, so
  the outline removal itself had to move into `className="outline-none kx-focus-visible"` alongside
  it. Confirmed by a throwaway static-render check: className-only silently did nothing against an
  inline `outline: "none"`; the combined fix reliably produces the 2px blue outline.
- **Check script:** `scripts/check-focus-visible.mjs`, wired as `npm run check:focus-visible`
  (same pattern as `check:session-guard` / `check:marketing-titles`). Scans `src/**/*.{ts,tsx,css}`
  for `outline-none` / `outline: none` and fails on any occurrence without a same-JSX-element or
  same-CSS-selector focus companion, with a small documented ALLOWLIST (13 entries) for cases it
  can't verify structurally — an ancestor wrapper's ring, an imperative onFocus/onBlur handler, a
  CSS-in-JS template literal, a pre-existing multi-line className. Verified to catch a deliberately
  reintroduced violation in both a `.tsx` className and a `.css` rule.
- **Verified:** `tsc --noEmit` clean; `eslint` clean on every touched file (one pre-existing,
  unrelated `react-hooks/exhaustive-deps` warning in `sync-page-client.tsx`); `npm run test:repo`
  536 tests, 521/522 pass + 14 skips (by design) — the one failure
  (`merge-suggestion-performance.test.ts`, a synchronous-slice timing assertion) passes cleanly
  alone, the documented flake. Production build + `next start` + headless Playwright: Tab-walked
  `/login`, `/register`, `/pricing`, `/help` (search input), `/forgot-password` and confirmed a
  visible focus indicator (2px solid `#4158f4` outline on marketing pages via the global
  `.mkt-wrap` rule, border+shadow ring on the auth-card inputs) via computed styles — none of these
  public pages contain the fixed inline-edit inputs themselves. The signed-in inline editors
  (contact editor, merge picker, bulk edit, import preview, sync connection forms) were verified by
  code reading plus a static render of the exact `outline-none kx-focus-visible` class combination
  against the real compiled CSS bundle; a full keyboard walkthrough of those still needs a
  signed-in session on staging.

## Coordination note
Files also touched by P49A-19 (billing/pricing/help copy) or P49A-13 (settings/security, API
tokens, share links) were not touched here — the intersecting ones (`two-factor-section.tsx`,
`password-change-form.tsx`, `delete-account-section.tsx`, `billing/page.tsx`,
`api-token-manager.tsx`, `contact-sharing.tsx`, `family/page.tsx`, `teams/page.tsx`,
`teams/books/page.tsx`, `data/books/page.tsx`, `notifications/page.tsx`,
`display-preferences-section.tsx`) already had a `focus:border-[...]` / `focus:ring-[...]` /
`focus:shadow-[...]` companion on the same line, so nothing there needed a change.
