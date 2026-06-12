# P24B-02 — Settings sub-page back navigation (mobile)

## Purpose

Give settings sub-pages a way back to the settings list on mobile. Today the settings layout shows a
static "Settings" title with no back affordance, so tapping into Profile/Security/etc. traps the user
— the only escape is the bottom nav, which exits Settings entirely.

## Background

`settings/layout.tsx` renders a fixed mobile header (`<span>Settings</span>` + bell) and hides the
sidebar `< md`. The settings **root** (`/settings`) shows `MobileSettingsNav` (the nav list); sub-pages
have their own `SettingsPageHead` ("SETTINGS / <Title>") but no chrome-level back. Confirmed during the
2026-06-12 verification sweep as the highest-value navigation gap (P0).

## Scope

**In scope:** the settings layout's mobile header becomes route-aware — a plain "Settings" title at the
root, a Secondary (back) header on every sub-page. **Out of scope:** sub-page *content* layout
(P24B-12) and family/teams management (P24B-13).

## Design / Implementation Spec

Per spec §B1 (variant 3) and §E6. The settings layout reads the current pathname:

- At `/settings` (root): render `MobilePlainHeader title="Settings"` (P24B-01).
- At any `/settings/*` sub-page: render `MobileSecondaryHeader` — back chevron (44×44) → `/settings`,
  centered 16/700 title (the sub-page name), optional right slot. `paper`, 52px, sticky, 1px `line`.

Implementation: the layout is a server component, so derive the title from the segment, or expose a
small client wrapper that reads `usePathname()` and maps segment → label
(`profile→Profile, account→Account, notifications→Notifications, preferences→Preferences,
devices→Devices & app passwords, security→Security, family→Family, teams→Team management`). Back target
is always `/settings` (the list), not browser-back, so it's deterministic from a deep link.

Keep the desktop header + sidebar exactly as-is (`hidden md:*`).

## Acceptance Criteria

- `/settings` on mobile shows the plain "Settings" header (unchanged).
- Every `/settings/*` sub-page on mobile shows a back header whose chevron returns to `/settings`.
- The sub-page title appears in the header; no duplicate title chrome.
- Desktop (≥768px) header + sidebar unchanged.
- Reaching a sub-page via a deep link still shows a working back button.

## Risks and Open Questions

- The layout is server-rendered; the pathname→title map needs a tiny client component (or pass the
  segment down). Keep it to one small client island, not a full client layout.
- Some sub-pages render their own `SettingsPageHead` breadcrumb ("SETTINGS / Profile") — decide whether
  to keep it under the new back header or drop the breadcrumb on mobile to avoid double titling.
