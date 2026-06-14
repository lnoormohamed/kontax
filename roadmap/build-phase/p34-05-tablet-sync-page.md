# P34-05 — Tablet fix: /sync page

## Purpose

Make the `/sync` page usable at tablet widths (768px–900px) by stacking the
account-list and detail panels vertically below 900px, and switching to a
navigate-into-detail pattern on mobile (≤640px).

## Background

The `/sync` page uses a two-column split: account list on the left (~280px),
detail panel on the right (remainder). This is fine at ≥1280px. Below 900px both
columns become too narrow to use — the account list truncates account names and
the detail panel cannot display the sync form fields without horizontal overflow.
At ≤640px the page uses `mobile-sync-screen.tsx` but the breakpoint transitions
between the mobile and desktop components may need tuning.

The sync page components are:
- `src/app/sync/page.tsx` — server component, renders client
- `src/app/sync/_components/sync-page-client.tsx` — main layout split
- `src/app/sync/_components/mobile-sync-screen.tsx` — mobile-specific component

## Scope

**In scope**
- In `sync-page-client.tsx`: add a Tailwind responsive breakpoint so that at
  `max-width: 899px` the two columns stack vertically (account list above, detail
  panel below). Use `flex-col` at tablet, `flex-row` (or the existing layout) at
  `md:` (≥900px). Tailwind's `md` breakpoint is 768px by default — a custom
  breakpoint or inline style override may be needed for 900px. Use `max-md:flex-col`
  if `md` maps to 768px; otherwise use a custom `tablet:` breakpoint or inline.
- Stacked mode: account list takes full width; detail panel takes full width below
  it. No minimum height constraint on the account list — let content drive height.
- On mobile (≤640px): confirm `mobile-sync-screen.tsx` handles the "list of
  accounts → tap → detail view" navigation pattern. If it already does, document
  this. If it shows a split, fix it to use a replace/slide-in navigation (see
  existing `AppShell` `MobileSecondaryHeader` pattern).
- Update `p34-04-tablet-audit-findings.md` to mark the `/sync` row(s) as fixed.

**Out of scope**
- Redesigning the sync UI beyond layout stacking.
- Adding new sync providers or changing sync logic.
- Changes to the desktop layout (≥900px).

## Design / Implementation Spec

### Confirm component structure

Before editing, read `sync-page-client.tsx` to identify the exact className on the
container div that creates the two-column split. It will be something like:
```tsx
<div className="flex h-full">
  <div className="w-72 ..."> {/* account list */} </div>
  <div className="flex-1 ..."> {/* detail */} </div>
</div>
```

### Tailwind stacking

Tailwind's default breakpoints: `sm`=640, `md`=768, `lg`=1024, `xl`=1280.
The 900px target falls between `md` and `lg`. Options:

**Option A — use `lg:flex-row`** (simplest, makes column layout default up to 1023px):
```tsx
<div className="flex flex-col lg:flex-row h-full">
```
This stacks at <1024px (wider than requested but conservative and safe).

**Option B — add a custom `tablet` breakpoint** in `tailwind.config.ts`:
```ts
screens: { tablet: "900px" }
```
Then use `tablet:flex-row`. Only do this if the 900px boundary is required
precisely (e.g., contact detail at 900–1023px must stay two-column but sync must
stack). Check P34-07 for whether 900px is needed there too before adding the
breakpoint.

**Recommended**: Use Option A (lg:flex-row) for this ticket unless the P34-04
audit reveals a specific reason the 900–1023px range must be two-column on sync.

### Account list width in stacked mode

When stacked, the account-list `w-72` (288px fixed) becomes full-width. Ensure
the class is overridden: `w-full lg:w-72`.

### Mobile (≤640px) — check mobile-sync-screen.tsx

Read `mobile-sync-screen.tsx`. If it already implements a list → detail navigation
flow (push route or conditional render), document it and confirm the transition
animation works. If it renders both panels simultaneously, fix to conditional:
```tsx
{selectedAccount ? <SyncDetail account={selectedAccount} onBack={clearSelection} />
                 : <SyncAccountList onSelect={setSelectedAccount} />}
```

### Test widths
After change, test at: 768px, 900px, 1024px, 1280px (desktop should be unchanged).

## Acceptance Criteria
- At 768px: account list and detail panel are stacked vertically with no
  horizontal overflow. All account names are fully visible in the list.
- At 900px: same stacked layout (or transition to side-by-side if using
  Option A at lg=1024). No overlap or overflow.
- At 1280px: existing two-column layout is unchanged.
- On mobile (≤640px): tapping an account shows only the detail panel; a back
  affordance returns to the account list.
- No TypeScript or ESLint errors introduced.
- `p34-04-tablet-audit-findings.md` rows for `/sync` updated to `Fixed by: P34-05`.

## Risks / Open Questions
- The 900px breakpoint may need to be consistent with P34-06 (settings) and
  P34-07 (contact detail). Align breakpoint choice across all three tablets
  tickets before merging to avoid conflicting Tailwind config changes.
- If `sync-page-client.tsx` uses pixel-based `style` props instead of Tailwind
  classes for the column widths, the Tailwind approach above won't work —
  inline CSS media queries or a `useMediaQuery` hook will be needed instead.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [ ] Internal · engineering — docs/: note tablet breakpoint strategy if a custom
      `tablet:` breakpoint is added to tailwind.config.ts
