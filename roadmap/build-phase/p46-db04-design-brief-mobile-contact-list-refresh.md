# P46-DB04 — Design brief: mobile contact-list row refresh (photo + name + scrubber)

Status: **Pre-plan** · Priority: P1 · Depends: —
Phase: [Phase 46](phase-46-alphabet-scrubber.md)
Feeds: [P46-07](p46-07-mobile-contact-list-row-polish.md) (contingent — only if this brief changes the as-built row)
Amends: [design-briefs/01-contacts-list.md](../design-briefs/01-contacts-list.md) (mobile section, written 2026-06-10, pre-scrubber/photo)

> User ask (2026-07-04): an updated **mobile** contact-list design brief —
> proposed row spine is **image + contact name + the alphabet scrubber**. This
> brief settles the canonical mobile row anatomy now that contact photos
> ([P46-02/03/04](p46-02-contact-photo-display-fix.md)) and the scrubber
> ([P46-01](p46-01-letter-index-data-scrubber-component.md)) exist, and becomes
> the source of truth for the mobile row — superseding the mobile portion of
> the original list brief, which predates both.

## Why (verified 2026-07-04)

The proposed spine is close to what already ships — the value of the brief is
deciding what stays, what goes, and how the scrubber is documented as
first-class:

- **The mobile row already renders photo + name + a meta line.** `mobileStacked`
  in `src/app/_components/contacts-workspace-table.tsx` (~654-708) renders:
  avatar (32 px compact / **40 px cozy**, `resolveAvatarSrc` thumb→canonical→
  tinted-initials fallback, ~182-227) · full name (semibold ~14.5 px,
  truncated, search-highlighted) · a secondary line of **company · email ·
  phone** (12.5 px, `#8b938c`) · optional context badges ("Emergency · Family ·
  Team · N labels") · optional match snippet when search hit a label/note. Rows
  live in a `@tanstack/react-virtual` windowed list (~1249-1266) with
  letter-bucket section headers + a pinned "Favorites" group, wrapped in
  `SwipeableRow` for star/archive gestures.
- **The scrubber is built but undocumented in any brief.**
  `src/app/_components/contact-list/alphabet-scrubber.tsx` exists (uncommitted,
  per [P46-01](p46-01-letter-index-data-scrubber-component.md)); it mounts on
  the right edge (28 px hit width, 2 px inset) and is **conditional** —
  `showScrubber = isMobile && groups && totalSize > 2×viewportH && !hasMore &&
  sections ≥ 4` (~1417-1467). It eagerly loads remaining windows when eligible.
  The original brief has no mention of it.
- **The original brief predates all of this.**
  [01-contacts-list.md](../design-briefs/01-contacts-list.md) (mobile row spec
  ~146-162 / 282-292, "BUILT 2026-06-10") describes avatar + name + company +
  email/phone but **no photo-upload reality and no scrubber**. Its mobile
  section is now stale.
- **Desktop/mobile split** is `matchMedia("(max-width: 1023px)")` (~944-955)
  plus `lg:` CSS; this brief governs the **< 1024 px** row only. Desktop's
  compact grid (~783-821) is out of scope here.

## The open question the user raised

> *"I suggest image, contact name and the alphabet scrubber — do you agree?"*

**Agree on the spine, with one caution to settle in this brief:** image + name
+ scrubber is the right backbone, but **dropping the secondary meta line
entirely** would hurt disambiguation (several "John"s with no company/number to
tell them apart). Recommend the row keep **one optional secondary line**, not
that it become photo-and-name-only. This brief decides that explicitly.

## Decisions to make

### 1. Canonical mobile row anatomy
- Lock the spine: **photo/avatar + name**, with **one** secondary line.
- Decide the secondary line's field priority (recommend company → primary
  email → primary phone, first non-empty) and whether it is
  always-on, user-toggleable, or density-dependent. Recommend keeping it on by
  default; consider a "name-only / minimal" density as an option, not the
  default.
- Decide the fate of the **context badges** and **match-snippet** lines: keep
  as conditional adornments (badges when relevant, snippet only under search)
  vs simplify. Recommend keep — they're conditional and earn their space.

### 2. Photo / avatar treatment
- Confirm size (40 px cozy as-built), shape (circle), and the
  thumb→canonical→tinted-initials fallback chain as the documented standard.
  Decide whether the photo gets any more prominence than today (it is already
  the row's leading element).

### 3. Scrubber as a first-class mobile affordance
- Document the scrubber in the row spec (it is currently code-only). Reconcile
  its eligibility thresholds (`≥ 4` letters, list `> 2×` viewport height, all
  windows loaded) with the row design and with the density above.
- Specify **clearance**: the rail (right edge, 28 px hit) must not collide with
  the row's right-aligned content or eat `SwipeableRow` horizontal gesture
  starts — this overlaps [P46-DB01](p46-db01-design-brief-alphabet-scrubber.md)'s
  gesture-coexistence rule; cross-reference rather than re-decide.

### 4. Density default
- Confirm **cozy** (60 px, two-line) as the mobile default vs compact (52 px).
  As-built defaults to cozy on the stacked mobile view; ratify or change.

### 5. Supersession & scope
- This brief becomes the **source of truth for the mobile row**. Add a pointer
  at the top of [01-contacts-list.md](../design-briefs/01-contacts-list.md)'s
  mobile section marking it superseded here, so the two don't drift.
- Call out whether any decision actually changes the as-built row. If it does,
  it flows into the contingent build ticket
  [P46-07](p46-07-mobile-contact-list-row-polish.md); if the brief just
  ratifies + documents what ships, **no build ticket is needed** and P46-07 is
  dropped.

## Deliverable
A short brief in `roadmap/design-briefs/` (e.g.
`p46-db04-mobile-contact-list-row.md`) recording decisions 1–5: the canonical
row anatomy (spine + secondary-line rule), avatar standard, scrubber
documentation + clearance cross-ref, density default, and the explicit
supersession pointer added to [01-contacts-list.md](../design-briefs/01-contacts-list.md).
State plainly whether a build follow-up ([P46-07](p46-07-mobile-contact-list-row-polish.md))
is required or the row ships as-is.
