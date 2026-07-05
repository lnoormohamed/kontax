# P43-DB01 — Design Brief: Interface Preferences & Device Scoping

## Purpose

Specify the "Interface" preferences group: which richness/effects knobs exist,
how they are scoped per device class (desktop vs mobile/touch), how they are
presented in Settings → Preferences, and what each one visibly changes.
Motivating example: desktop rows revealing label chips and quick actions on
hover — a user on a slower machine turns this off for a leaner list.

## Background

- P34B-01 shipped the foundation: `User.preferences` Json on the user row, the
  `UserPreferences` type (`src/lib/preferences-shared.ts`), server helpers
  (`src/server/preferences.ts`), and the Display section at
  `/settings/preferences` (`display-preferences-section.tsx`). This brief
  extends that page — same section styling, same save semantics.
- Current row behaviour the knobs act on: the contacts table
  (`contacts-workspace-table.tsx`) reveals the row action trigger on
  `group-hover` (desktop) and always shows it below `lg`; label chips render
  per P31B-05. Phase 38 is putting rows on a strict cost budget — this brief's
  toggles are also levers for that budget.
- Existing density preference (`defaultViewMode`: compact/cozy) is adjacent
  but separate — do not fold it into the new group; cross-link it.

## Scope

### In scope

1. **The preference set (v1 — deliberately two knobs)**, per the P43-00
   framing decision (display/taste preference, not a performance remedy):
   | Preference | Device class | Options (default first) |
   |---|---|---|
   | Labels on rows | desktop | on hover · always · off |
   | Animations & transitions | both | system (`prefers-reduced-motion`) · on · off |
   Each option gets one plain sentence on what it changes. Copy is framed as
   visual quiet ("show less on each row"), **not** speed — no performance
   claims unless P43-00 measured one. Deferred until users ask: quick-actions
   reveal mode, hover previews/tooltips toggle, avatars vs initials.
2. **Device-class scoping model** — the brief lands the storage shape with
   engineering. Proposal: flat keys with a device-class applicability map
   resolved at read time (`hover: none` media query decides "desktop"), i.e.
   one saved value per preference, *applied* only where it makes sense — not
   two parallel desktop/mobile buckets, unless the brief finds a real case
   where one user wants different values per device for the same knob.
   Preferences sync across devices either way (they live on the user row).
3. **Settings presentation** — a new "Interface" card on
   `/settings/preferences` below Display: grouped rows, radio/segmented
   controls matching the existing section, a device badge on desktop-only
   rows ("Desktop"), and on a touch device those rows either hide or render
   disabled with "Applies on desktop" (brief decides; recommendation: show
   disabled — discoverability beats minimalism in settings).
4. **Live preview** — changes apply immediately (optimistic, matching the
   existing section's save pattern) so the user sees the effect without
   leaving settings; include a small inline "example row" preview if feasible.
### Out of scope
- Theme / dark mode.
- Per-list or per-book display overrides.
- The deferred v1 cuts above (quick actions, hover previews, avatars) —
  revisit only on user demand.
- Performance positioning of any kind — Phase 38 owns speed; this brief owns
  taste. (P43-00 records the measurement backing this.)
- An offline mutation queue for preference saves (existing save semantics
  apply).
- Density (`defaultViewMode`) redesign — cross-link only.

## States to specify

The Interface card on: desktop, touch device (disabled desktop-only rows),
save-in-flight, save-error revert. The contacts table under labels on-hover /
always / off, at compact and cozy density, desktop and mobile widths.
Reduced-motion default state.

## Deliverables

A `p43-db01` brief in `roadmap/design-briefs/` following the section format of
the existing preferences page (extend, don't restyle): final preference list
with defaults, storage-shape decision recorded, control layouts, copy for
every option and description line, and the states above — ready for P43-01 to
build without further design decisions.

## P43-00 gate result (recorded 2026-07-02)

The measurement gate ran and **confirmed the display/taste framing** this brief
was drafted against. At 500 / 2,000 / 10,000 contacts, label chips on rows cost
a fixed +5 DOM nodes per chip-row and add ≤1.2% (≈0.8 ms, below noise) to a
deliberately harsh forced-reflow scroll — scale-invariant, because the
virtualized table mounts only ~23–35 rows regardless of total. Row hover is
pure CSS `group-hover` with no JS re-render. **No performance benefit exists to
claim; the toggle is taste, and the default (chips shown) is fast for everyone.**
Design proceeds unblocked. (Full numbers: [P43-00](p43-00-post-p38-measurement-gate.md).)

## Dependencies
Depends on [P43-00](p43-00-post-p38-measurement-gate.md) — measurement gate
**done**; its framing decision is recorded above. Blocks P43-01. Label-chip
rendering conventions come from P31B-DB12; "always show chips" must fit the
P38-01 lean row shape.
