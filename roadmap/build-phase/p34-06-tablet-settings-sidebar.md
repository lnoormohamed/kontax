# P34-06 — Tablet fix: settings sidebar collapse

## Purpose

Below 900px, hide the settings sidebar and replace it with a back-button and page
title in the content header, so every settings sub-page is usable at tablet
widths without the sidebar consuming a disproportionate share of the viewport.

## Background

The settings layout uses a fixed-width sidebar (~220px) plus a content area. At
tablet widths (768–900px) the sidebar is too narrow to show full nav labels and
the content area is left with <550px — cramped for forms with labels and inputs.
The existing mobile settings path (`mobile-settings-nav.tsx` and
`mobile-settings-header.tsx`) handles this below 640px, but the 641–899px range
falls into no-man's land: the mobile components are hidden, the desktop sidebar is
visible but dysfunctional.

The `AppShell` component already imports and uses `MobileSecondaryHeader` from
`~/app/_components/mobile-header` for secondary-level pages (contact detail, etc.).
The settings pages should follow the same pattern at tablet widths.

Relevant files:
- `src/app/settings/layout.tsx` — top-level settings layout (sidebar + content split)
- `src/app/_components/settings-sidebar.tsx` — the sidebar nav component
- `src/app/settings/_components/mobile-settings-nav.tsx` — mobile nav (≤640px)
- `src/app/settings/_components/mobile-settings-header.tsx` — mobile header
- `src/app/_components/app-shell.tsx` — imports `MobileSecondaryHeader`
- `src/app/_components/mobile-header.tsx` — `MobileSecondaryHeader` source

## Scope

**In scope**
- In `src/app/settings/layout.tsx`: hide the sidebar at `<900px` (add
  `hidden lg:block` or a custom breakpoint class to the sidebar container).
- At the same breakpoint, show a top-of-content back button + page title, using
  the `MobileSecondaryHeader` component or an equivalent pattern.
- Each settings sub-route must be navigable without the sidebar — direct URL entry
  must work (it already does; confirm the breadcrumb/back button points to
  `/settings` as the parent).
- The back button navigates to `/settings` (the settings index page which should
  render a nav list in place of the sidebar on smaller screens).
- Ensure `/settings` (the index page at `src/app/settings/page.tsx`) renders a
  list of settings sections when the sidebar is hidden (check if it already does
  this, or if it relies on the sidebar being visible).
- Update `p34-04-tablet-audit-findings.md` rows for settings pages.

**Out of scope**
- Redesigning the sidebar or adding new settings sections.
- Changes to the mobile settings experience (≤640px) which already works.
- Changes to the desktop settings experience (≥900px or ≥1024px).

## Design / Implementation Spec

### Settings layout breakpoint

In `src/app/settings/layout.tsx`, locate the outermost flex/grid container
that places the sidebar next to the content. Apply responsive classes:

```tsx
{/* Sidebar — hide at tablet */}
<div className="hidden lg:block w-56 shrink-0">
  <SettingsSidebar ... />
</div>

{/* Content area */}
<div className="flex-1 min-w-0">
  {children}
</div>
```

(Adjust `lg` vs a custom `tablet:` breakpoint consistently with P34-05.)

### Back button / page title in content area

Each settings sub-page needs a back affordance at tablet widths. Options:

**Option A** — In `settings/layout.tsx`, render `MobileSecondaryHeader` (with
`title` derived from the current route) above `{children}` when the sidebar is
hidden. Use `usePathname()` to derive a human-readable title from the URL segment.

**Option B** — Add a settings-specific header component
(`settings/_components/settings-page-header.tsx`) that each sub-page renders at
the top of its own layout. This is more explicit but requires changes to every
sub-page file.

**Recommended: Option A** — keeps changes in one file (the layout), is consistent
with how `AppShell` handles secondary-level headers, and doesn't require touching
every sub-page.

```tsx
// In settings/layout.tsx
"use client";
import { usePathname } from "next/navigation";
import { MobileSecondaryHeader } from "~/app/_components/mobile-header";

const SETTINGS_TITLES: Record<string, string> = {
  "/settings/account": "Account",
  "/settings/security": "Security",
  "/settings/notifications": "Notifications",
  "/settings/preferences": "Preferences",
  "/settings/devices": "Devices",
  "/settings/developer": "Developer",
  "/settings/teams": "Teams",
  "/settings/family": "Family",
  // add more as needed
};

// Inside the layout render:
const pathname = usePathname();
const pageTitle = SETTINGS_TITLES[pathname] ?? "Settings";

// Above {children}, inside the content div, at tablet breakpoint:
<div className="lg:hidden">
  <MobileSecondaryHeader title={pageTitle} backHref="/settings" />
</div>
```

### Settings index page at tablet widths

At `/settings` (index), the sidebar lists all sub-routes. When the sidebar is
hidden, the index page content must itself render a list of links to sub-pages.
Read `src/app/settings/page.tsx` to confirm whether it already does this. If the
page is currently empty / redirects, it needs a nav list for tablet users. The
existing `mobile-settings-nav.tsx` content is a good model to re-use or extract.

### Test widths
After change, test at 768px and 900px for each settings sub-page:
account, security, notifications, preferences, devices, developer, teams, family.

## Acceptance Criteria
- At 768px: settings sidebar is hidden. A back button and page title appear at
  the top of the content area. Content takes full available width.
- At 768px: `/settings` index page shows a list of all settings sections as
  tappable/clickable links.
- Each settings sub-route is directly accessible by URL without needing the
  sidebar (already true — confirm remains true post-change).
- The back button on each sub-page navigates to `/settings`.
- At ≥1024px (or ≥900px if using a custom breakpoint): existing sidebar layout
  is unchanged.
- No TypeScript or ESLint errors introduced.
- `p34-04-tablet-audit-findings.md` rows for settings pages updated to
  `Fixed by: P34-06`.

## Risks / Open Questions
- `settings/layout.tsx` is a server component; adding `usePathname()` requires
  converting the outer layout to a client component or extracting a small client
  child for the header. Prefer extracting the header into a
  `SettingsTabletHeader` client component to avoid making the whole layout
  a client component.
- The `SETTINGS_TITLES` map must be kept in sync with the actual routes. A
  missing entry will fall back to "Settings" — acceptable but not ideal.
- Align the breakpoint (`lg` / 1024px vs custom 900px) with P34-05 and P34-07
  before merging. If all three tickets use `lg`, no custom breakpoint is needed.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [ ] Internal · engineering — docs/: note the tablet header pattern for settings
      sub-pages
