# P34C-06 — Homepage Mobile Layout Polish

## Purpose

Verify and fix the homepage at 390px (iPhone 14 viewport) and 430px (iPhone 14
Plus / Pro Max). This is a QA and fix ticket: find every layout issue, fix it,
and confirm the homepage is production-ready on mobile before go-live.

## Background

P34C-03 and P34C-04 implement the hero and feature tiles targeting desktop
first. Mobile behaviour is specified in those tickets but not exhaustively
tested. Real mobile rendering often reveals issues that DevTools simulation
misses: font sizes that feel wrong on a real screen, CTA buttons that are too
narrow to tap comfortably, sections that overflow their container, and tap
targets that are too small.

This ticket runs the full homepage through a mobile audit and fixes every issue
found. It must run **after** P34C-03, P34C-04, and P34C-05 are merged.

## Scope

**In scope**
- The homepage (`/`) at 390px and 430px viewport widths.
- All sections: nav (hamburger), hero, feature tiles, social proof, footer.
- Fixes to any section that has overflow, truncation, spacing issues, or
  unusable tap targets.
- Verification on a real iOS device if possible (not just DevTools).

**Out of scope**
- Other marketing pages (they each have their own QA step).
- Dark mode (not supported).
- Landscape orientation (desktop-equivalent — not the primary mobile use case).

## Design / Implementation Spec

### Checklist — known risk areas

Work through each area methodically and fix anything that fails:

**Nav**
- [ ] Hamburger icon is visible and tappable (min 44×44px tap target).
- [ ] Logo does not overflow at 390px.
- [ ] Overlay opens full-screen and locks body scroll.
- [ ] All overlay links are tappable without horizontal scroll.
- [ ] Close button is in the top-right corner and 44×44px.

**Hero**
- [ ] Headline does not overflow container at 390px.
- [ ] Headline wraps gracefully — no orphaned single words on last line if
      possible (use `text-pretty` or manual line-break hint).
- [ ] Sub-copy readable at 390px (`text-[16px]` minimum on mobile).
- [ ] `Get started free` and `See how it works` buttons are full-width
      (`w-full`) at mobile breakpoint.
- [ ] Product screenshot: full-width, correct aspect ratio, no overflow.
- [ ] Hero section vertical padding is comfortable — not too tall (user should
      see the start of feature tiles without scrolling too far).

**Feature tiles**
- [ ] 1-column grid at 390px — no horizontal scroll.
- [ ] Each tile is at least 48px tall with comfortable padding.
- [ ] Icon tile renders correctly at full width.
- [ ] Tile text does not overflow or truncate.

**Social proof**
- [ ] Stat blocks stack vertically.
- [ ] Stat values (`10,000+`, `3`, `London`) are readable but not overwhelming.
- [ ] No horizontal overflow.

**Footer**
- [ ] Columns stack to a single column.
- [ ] All links are tappable (min 44px touch target height).
- [ ] Bottom bar copyright text wraps if needed; does not overflow.
- [ ] Social icons (X, GitHub) are at least 44×44px touch target.

### How to test

1. Chrome DevTools → Device toolbar → `iPhone 14 Pro` preset (393×852, DPR 3).
   Then also check `390×844` (iPhone 14) manually.
2. Run `npm run build && npm start` locally and open on a real iPhone if
   available (Tailwind sometimes has differences between DevTools and device).
3. Check for horizontal scroll at 390px: `document.documentElement.scrollWidth`
   in the console should equal `390`. Any value > 390 indicates an overflow.
4. Check touch targets: use Chrome's "Show tap targets" accessibility audit in
   Lighthouse or DevTools `Accessibility > Tap targets`.

### Common fixes

- **Overflow**: check for any element with `min-width` larger than the container,
  or `whitespace-nowrap` on text. Remove or add `overflow-x-hidden` on the
  section wrapper (not the body — body overflow-x-hidden hides scroll issues).
- **CTA buttons**: add `sm:flex-row` to `flex flex-col` wrapper; individual
  buttons get `w-full sm:w-auto`.
- **Hero screenshot overflow**: wrap in `relative overflow-hidden` with
  `w-full`.
- **Font size too small**: any text below `text-[14px]` on mobile should be
  reviewed for readability.

## Acceptance Criteria

- [ ] Homepage renders without horizontal scroll at 390px and 430px.
- [ ] Hero headline is fully visible without overflow.
- [ ] Both hero CTAs are full-width on mobile.
- [ ] Feature tiles are in a single column with no horizontal scroll.
- [ ] All tap targets pass the 44×44px minimum (Lighthouse tap target audit
      shows no failures on the homepage).
- [ ] Nav hamburger opens correctly; overlay closes on close button and on
      nav link tap.
- [ ] Footer stacks to a single column.
- [ ] Verified on a real iOS device (or noted in the PR if not possible).
- [ ] `tsc --noEmit` passes; no new ESLint errors.

## Risks / Open Questions

- **Turbopack HMR lag**: the preview environment may not accurately reflect
  production rendering at mobile viewports. Always test with `npm run build`.
- **Safe area insets**: if the site is ever added to home screen (PWA-style),
  safe area insets (`env(safe-area-inset-*)`) affect the bottom of the footer
  and the nav overlay. Add `padding-bottom: env(safe-area-inset-bottom)` to
  the footer bottom bar as a precaution.
- **Real device unavailability**: if no real iOS device is available, use
  BrowserStack or a Simulator on macOS.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: add a "Mobile QA checklist" to the
      engineering docs covering the overflow-detection technique and the
      44px tap-target standard
