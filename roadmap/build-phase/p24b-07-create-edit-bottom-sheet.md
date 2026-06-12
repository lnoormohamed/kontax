# P24B-07 — Create / edit contact as a bottom sheet

## Purpose

Replace the full-page mobile create/edit form with the design's keyboard-aware **bottom sheet** —
collapsible sections, accessory bar, pinned Save — so the most-used write flow matches the prototype.

## Background

`/contacts/new` currently renders a full page on mobile with a **doubled header** (the AppShell
secondary header *and* the form's own Cancel/Save bar) and the bottom nav showing through. The design
(`mob-sheet.jsx` `EditSheet`) is a modal sheet over the current screen. The quick-create FAB already
uses `MobileBottomSheet`; this unifies full create/edit onto that pattern. Decision locked
(2026-06-12): bottom sheet, full page kept as a `?full=1` fallback. Supersedes the desktop-era P24-05
approach where it diverges from the current spec.

## Scope

**In scope:** mobile create + edit as a `MobileBottomSheet` with collapsible sections and keyboard
handling; full-page form retained behind `?full=1` and used on desktop. **Out of scope:** field schema
/ server action changes (reuse existing `createContact` / update actions).

## Design / Implementation Spec

Per spec §E3 and §D1–D3.
- **Sheet:** top radius 20, slides up `.3s cubic-bezier(.2,.8,.2,1)`, scrim `rgba(20,28,24,0.42)`.
  Header = drag handle (40×4) + centered "New contact" / "Edit contact" (17/700) + ✕ (44×44).
- **Sections (cards):** **Basic Info** always-on (first, last, company) shows "Always on"; **Phone
  numbers**, **Email addresses**, **Addresses**, **More — dates, notes, custom fields** start collapsed,
  48px header + chevron (rotates 180° open), reveal fields + a `blue` "+ Add …" button.
- **Fields:** label 12/600 `mute` + input (min 46px / 76 multiline, radius 11, 1.5px `line`; active
  `blue` border + `blue-t` + focus ring). Inputs ≥16px.
- **Keyboard accessory bar (44px):** prev/next chevrons + "Done"; Save pins directly above the keyboard;
  focused field scrolls 24px clear of the keyboard edge (`visualViewport`).
- **Save-to target** (Private / Family / Team) when applicable, near the top (segmented/inline).
- **Footer:** pinned primary "Save contact" / "Save changes" (`green`).
- **Routing:** opening updates the URL (intercepting route or shallow push) so back closes the sheet;
  `?full=1` renders the legacy full page; desktop renders the existing route form unchanged.

## Acceptance Criteria

- Mobile "New contact"/FAB and "Edit" open the sheet (not the full page); back / ✕ / swipe-down closes it.
- Basic Info expanded by default; other sections collapse/expand on header tap.
- Keyboard up: focused field clears the keyboard by 24px and Save stays visible; Next advances fields.
- Inline validation under the field (no alert).
- `?full=1` still renders the full-page form; desktop unchanged.
- Person/Organisation toggle and Save-to target work; save persists via the existing action.
- Variance: read-only (GRACE/LOCKED) hides the create entry points entirely.

## Decision (2026-06-13)

Create uses the new `MobileContactSheet` (collapsible sections, pinned Save). **Edit keeps the
existing in-place `ContactInlineEditor`** — it covers the full field set (middle name, phonetic,
websites, related people, significant dates, custom fields) which the focused sheet intentionally does
not. The sheet remains edit-capable for future use; the comprehensive editor is the better edit UX, so
the detail "Edit" button is unchanged. The full create form stays the `?full=1` fallback. Done.

## Risks and Open Questions

- `visualViewport` is iOS 13+; fall back to a fixed bottom padding on older iOS.
- Intercepting routes give URL-deep-linkable sheets but add routing complexity vs a state overlay —
  confirm approach (same open question as P24-05).
