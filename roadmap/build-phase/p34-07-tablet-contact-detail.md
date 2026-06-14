# P34-07 — Tablet fix: contact detail two-panel split

## Purpose

Below 900px, collapse the side-by-side two-panel contact detail layout into a
single column — avatar and action buttons at top, followed by the tabs and field
sections — so the contact detail page is usable at tablet widths.

## Background

The contact detail page (`src/app/contacts/[id]/page.tsx`) renders a two-panel
layout: a left panel containing the avatar, name, source badges, and action
buttons; a right panel containing the Details / Sharing / History tabs and their
field content. At 768–900px both panels are too narrow: the left panel truncates
action icon labels and the right panel cannot display multi-column field groups
without overflow. No Tailwind responsive override currently exists for this split.

The page is a large client component (~1000+ lines). The two-panel split is
likely a top-level `flex` container inside the page's returned JSX. The
`AppShell` wrapper handles the outer chrome (top bar, mobile nav). The two panels
are the inner content responsibility of the page itself.

## Scope

**In scope**
- In `src/app/contacts/[id]/page.tsx`: identify the `div` that creates the
  two-column split between left panel (avatar/meta/actions) and right panel
  (tabs/fields). Add responsive Tailwind classes so the split becomes a single
  column at `<lg` (or `<900px` using a custom breakpoint, consistent with
  P34-05 and P34-06).
- In single-column mode: left panel content flows naturally at top; right panel
  content (tabs + fields) follows immediately below.
- The left panel in single-column mode should not be full-screen-height — let
  content height drive it. Remove any fixed-height or `h-full` constraint from
  the left panel at this breakpoint.
- Confirm the action buttons (Edit, Share, Merge, Delete, etc.) remain accessible
  and not clipped at tablet widths in single-column mode.
- Update `p34-04-tablet-audit-findings.md` rows for `/contacts/[id]`.

**Out of scope**
- Redesigning the contact detail UI beyond layout stacking.
- Changes to the mobile contact detail experience (≤640px), which may already use
  a different component path or route.
- Tab and field-section redesign within the right panel.
- History list, sharing section, or activity feed content changes.

## Design / Implementation Spec

### Locate the two-panel container

Read `src/app/contacts/[id]/page.tsx` around line 540–580 (where the hero avatar
and the tabs appear). Look for a pattern like:

```tsx
<div className="flex h-full overflow-hidden">
  {/* Left panel */}
  <div className="w-80 shrink-0 border-r ...">
    {/* avatar, name, actions */}
  </div>
  {/* Right panel */}
  <div className="flex-1 overflow-y-auto ...">
    {/* tabs + fields */}
  </div>
</div>
```

### Apply responsive stacking

```tsx
<div className="flex flex-col lg:flex-row h-full overflow-hidden">
  {/* Left panel */}
  <div className="w-full lg:w-80 lg:shrink-0 lg:border-r ...">
    {/* avatar, name, actions */}
  </div>
  {/* Right panel */}
  <div className="flex-1 overflow-y-auto ...">
    {/* tabs + fields */}
  </div>
</div>
```

Key changes:
- `flex-col` default (mobile/tablet), `lg:flex-row` (desktop).
- Left panel: `w-full` default, `lg:w-80` at desktop. Remove `h-full` from left
  panel at tablet (it would make the panel full-viewport-height even when stacked).
- Right panel: ensure `overflow-y-auto` so tabs + fields scroll independently
  on desktop; in stacked mode, the outer page scroll handles this.

### History inline avatar (line ~743)

The history list renders its own avatar elements inside the right panel. These
are already self-contained and should not be affected by the layout change.
Confirm visually after the change.

### Action buttons at tablet width

In single-column mode at 768px the action button row (Edit, Share, etc.) has full
width. Confirm button labels and icons don't clip. If the buttons currently use
`flex-col` on mobile and `flex-row` on desktop, the existing responsive classes
should be correct — verify during review.

### Breakpoint alignment

Use `lg` (1024px) or custom `tablet:` (900px) consistently with P34-05 and
P34-06. All three tablet fix tickets should ideally use the same breakpoint. If
P34-05 and P34-06 settled on `lg`, use `lg` here too.

### Test widths
After change: 768px, 900px, 1024px (confirm two-column restored if using
`lg`=1024), 1280px (desktop unchanged).

### Mobile (≤640px) path

Check whether mobile contact detail uses a completely different component tree
(e.g., a `MobileContactDetail` component) or shares the same page component with
CSS hiding. If it shares the same component, ensure `flex-col` at ≤640px doesn't
conflict with the existing mobile layout. If it's a separate component, no
changes needed there.

## Acceptance Criteria
- At 768px: left panel (avatar, name, actions) appears at the top, full width.
  Right panel (tabs, fields) appears immediately below, full width. No horizontal
  overflow. No content clipped or inaccessible.
- At 900px: same single-column layout (or two-column if breakpoint is set at
  `lg`=1024). Consistent with P34-05 and P34-06 breakpoint.
- At 1024px (if `lg` is used): two-column layout restored.
- At 1280px: existing two-column layout unchanged.
- Action buttons remain accessible and not clipped at all tested widths.
- Contact name, source badges, and tab labels are fully readable at 768px.
- No TypeScript or ESLint errors introduced.
- `p34-04-tablet-audit-findings.md` rows for `/contacts/[id]` updated to
  `Fixed by: P34-07`.

## Risks / Open Questions
- `contacts/[id]/page.tsx` is a large file (~1000+ lines). The layout change is
  localised to a handful of className strings, but reading it carefully first is
  important — the two-panel structure may be nested inside multiple wrapper divs
  before the actual split.
- The left panel may rely on `h-full` or `sticky` positioning for desktop scroll
  behaviour. In single-column mode, `sticky` on the left panel would be wrong —
  add `lg:sticky` to preserve it only at desktop.
- If the page uses explicit pixel widths via `style` props rather than Tailwind,
  a `useWindowWidth` hook or CSS media query in a `<style>` tag will be needed
  instead of Tailwind classes.
- Coordinate breakpoint (`lg` vs custom `tablet:`) with P34-05 and P34-06 before
  any of the three tickets merge, to avoid conflicting tailwind.config.ts changes.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [ ] Internal · engineering — docs/: note tablet layout strategy for two-panel
      pages (sync, contact detail)
