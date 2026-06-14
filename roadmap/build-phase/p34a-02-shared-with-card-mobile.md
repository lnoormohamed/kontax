# P34A-02 — Shared With Card Rebuild (Mobile)

## Purpose

Apply the same Shared With card redesign from P34A-01 to the mobile contact
detail, with layout adjustments required for a narrow viewport: full-width
rows, 44px minimum touch targets, role badge that never wraps.

## Background

The mobile contact detail is rendered by
`src/app/_components/mobile-contact-detail.tsx`. It has its own Sharing tab
section separate from the desktop `contact-sharing.tsx` component. Both are
rendered conditionally in `src/app/contacts/[id]/page.tsx` — the desktop
variant around line 621, mobile around line 1043.

The mobile layout currently suffers from the same raw "Shared with the X
book" text issue as desktop. Because the mobile viewport is narrow (≤ 430px
on most phones), specific attention is needed to:
- Ensure the role badge (`Can edit`, `Can view`) never wraps to a second line.
- Maintain 44px minimum touch target height on all interactive-looking rows.
- Avoid horizontal padding that compresses the name + badge pair too tightly.

Depends on: P34A-01 (shares the `SharedBookMember` type and `SharedBook`
extended type, `<RoleBadge>` component, and avatar tint logic).

## Scope

**In scope**
- Mobile-specific rendering of `<SharedBookCard>` inside
  `mobile-contact-detail.tsx` (or import the same component from P34A-01 if
  it is layout-neutral, otherwise add a `mobile` prop or separate component).
- Full-width card with no horizontal compression; left and right padding
  `px-4` matching the rest of the mobile detail layout.
- Member rows: 44px min-height (touch target), avatar 36px, name truncates,
  badge right-aligned and always on one line.
- Explanatory callout 12px, full width, no truncation.

**Out of scope**
- Desktop layout (P34A-01).
- Empty state (P34A-03).
- Add/remove member actions.

## Design / Implementation Spec

### Determining mobile vs desktop

`src/app/contacts/[id]/page.tsx` already renders the sharing section twice —
once in the desktop column layout and once in the mobile layout. The simplest
approach is to make `<SharedBookCard>` work in both contexts and import it
from P34A-01's location. If the card has any desktop-specific horizontal
constraints (e.g., `max-w-sm`), remove them so it stretches to the parent
width.

Alternatively, if the mobile detail requires a custom card, extract a
`<MobileSharedBookCard>` that reuses `<RoleBadge>`, `<Avatar>`, and the same
data shape, but adjusts:
- `px-4` (not `px-5` as on desktop).
- Row padding `py-2.5` (gives 44px height with 2-line name).

### Badge overflow prevention

The role badge has a fixed max-width of ~70px for "Can edit". The name cell
uses `flex-1 truncate min-w-0`, so the badge always gets its natural width.
On a 390px viewport:
- Left padding: 16px
- Avatar: 36px + gap 12px = 48px
- Right padding: 16px
- Badge max: ~72px + gap 12px = 84px
- Available for name: 390 − 16 − 48 − 12 − 84 − 16 = 214px

This is comfortable; `truncate` on the name handles edge cases with very long
names (e.g. "Alexandra von Hohenstaufen").

### Touch target

Row `min-height: 44px` (using `style` or Tailwind `min-h-[44px]`). The
entire row is non-interactive in this iteration (add/remove is Phase 13), so
the 44px rule is about the visual affordance matching platform conventions,
not an actual tap target.

### Data fetching

The mobile page already receives `sharedBooks` from the same server
component. Extend the same `SharedBook` type (P34A-01) to include `members`,
and the mobile card receives the same prop shape.

### Skeleton state

The Sharing tab on mobile has a loading skeleton. Add two skeleton rows for
the member list (same height as member rows, `bg-[#edf0ea]` rounded pill).

## Acceptance Criteria

- [ ] On a 390px viewport, the mobile Sharing tab shows the SharedBookCard
      with book name row, callout caption, divider, and member rows.
- [ ] Role badges display on one line for all three roles (Owner, Can edit,
      Can view) at 390px and above.
- [ ] Each member row has a minimum visible height of 44px.
- [ ] The card stretches to full width of the mobile container with no
      horizontal clipping.
- [ ] Name cell truncates gracefully for names longer than ~20 characters.
- [ ] No regression in the mobile Sharing tab's other sections (vCard link,
      live share, static share).
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- If `mobile-contact-detail.tsx` renders sharing inline (not via the same
  `<ContactSharing>` component), confirm which rendering path the mobile tab
  uses to avoid double-rendering the book card.
- Pending invite state (dashed border, "Invited" badge) — if the GroupMember
  query returns pending members, render them with an "Invited" grey badge
  instead of a role badge, with dashed avatar border. This is low-risk to
  add now; defer only if invite model not yet in schema.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: note that SharedBookCard is used in
      both desktop ContactSharing and mobile-contact-detail
