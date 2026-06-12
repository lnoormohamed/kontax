# Kontax — Mobile (PWA) Design Brief

**Status:** living document · created 2026-06-12
**Source of truth for visual design:** `Mobile PWA.html` / `Mobile PWA Overview.html` and their
`mob-*.jsx` modules (in the design ZIP). Desktop surfaces have their own design HTML files; this
brief defines how **every** route behaves on a phone, including the ones the original mobile
prototype never covered.

> Purpose: stop playing whack-a-mole. Every route below has an explicit mobile treatment, a current
> status, and a priority, so nothing ships "desktop-only by accident."

---

## 1. Foundations

| Token group | Values |
| --- | --- |
| Breakpoint | `md` = **768px**. `md:hidden` = mobile-only, `hidden md:*` = desktop-only. Phones are < 768. |
| Viewport | `100dvh` columns; respect `env(safe-area-inset-*)` top and bottom. |
| Type | Geist. Screen titles 19/700. Body 14–15. Secondary 12.5–13. |
| Ink | `#1d2823` ink · `#5c655e` ink2 · `#8b938c` mute · `#aeb4ac` faint |
| Lines/surfaces | `#d8ddd6` line · `#e9ece7` line2 · `#f2f4f0` wash · `#f6f7f4` bg · `#fff` paper |
| Brand/accents | `#17352e` green (+`#e7efe9` tint) · `#4158f4` blue (+`#edf0fe` tint) · `#b5472f` red (+`#f3e1da` tint) · `#bf8526` amber (+`#f6edd9` tint) |
| Status dots | green `#2f9e5e` · amber `#bf8526` · red `#b5472f` |

### Chrome components (already built)
- **`MobileHomeHeader`** — 52px. Wordmark + bell + search on the Contacts list; renders a plain
  title (e.g. "Activity") on sibling tabs. (`_components/mobile-header.tsx`)
- **`MobileSecondaryHeader`** — 52px back · centered title · optional action. For pushed screens.
- **Plain title header** — 52px, left-aligned 19/700 title + bell. Used by Sync/Settings/Activity
  tab roots. (inline today; **should be extracted** — see §4.)
- **`BottomNav`** — the one canonical tab bar: **Contacts · Activity · Sync · Settings**, active dot
  above icon, red badges. `md:hidden`. (`_components/bottom-nav.tsx`)
- **`MobileBottomSheet`** — slide-up modal, keyboard-aware. Used by quick-create FAB.
- **`MobileCreateFab`** — 52px green FAB, People list only.

### Navigation model
1. **4 tab roots** (bottom nav): Contacts, Activity, Sync, Settings.
2. **Pushed secondary screens** (back button, no bottom nav OR with it per design): contact detail,
   import/export, shares, merge, settings sub-pages.
3. **Modals / bottom sheets**: create/edit contact, install prompt, confirm dialogs.

### Interaction patterns (from the prototype)
- Swipe-to-reveal on list rows (Favourite / Archive), 40% snap, haptic.
- Sticky group headers (`#f2f4f0`, 28px) — currently not sticky in the virtualized list (deferred).
- Collapsible sections inside the create/edit sheet (Basic Info always-on).
- Keyboard accessory bar (prev/next/Done) + Save pinned above keyboard in the sheet.

---

## 2. Status legend

✅ Done & matches design · 🟡 Renders but diverges/needs polish · 🟠 Functional but wrong pattern ·
🔴 Broken/unusable on mobile · ⚪ Not yet reviewed · ⛔ Out of mobile scope (desktop-primary)

---

## 3. Page inventory

### Core PWA tabs
| Route | Chrome | Status | Mobile spec / notes |
| --- | --- | --- | --- |
| `/contacts` (People) | HomeHeader + BottomNav + FAB | ✅ | Matches design after P24A fixes. Group headers not sticky (deferred). |
| `/contacts` (Favorites/Archived/Duplicates) | HomeHeader + BottomNav | 🟡 | Share the list; FAB correctly hidden. Duplicates uses desktop merge toolbar — verify it fits. |
| `/contacts?tab=activity` | Plain "Activity" + BottomNav | 🟡 | Locked card now fits (P24A). **Unlocked feed still uses desktop component** — design wants GroupCard event rows (32px circle icon · "Name · action" · time). FilterBar must not overflow. |
| `/contacts/[id]` (detail) | SecondaryHeader + BottomNav + edit FAB | 🟡 | Strong match. **Action row differs**: built = 5 outlined squares (Call/Email/Fav/Archive/Share); design = 4 round green-tint pills (Call/Message/Email/More). Confirm compact header fades in on scroll. |
| `/contacts/new` (create) | AppShell (Secondary + BottomNav) | 🟠 | **Wrong pattern.** Design = modal **bottom sheet** (drag handle, collapsible sections, keyboard bar, Save pinned). Built = full page with a **doubled header**. Quick-create FAB already uses the sheet — unify on it. |
| `/sync` | Plain "Sync" + BottomNav | ✅ | MobileSyncScreen cards + add deep-link (P24A). |
| `/settings` (root) | Plain "Settings" + BottomNav | ✅ | MobileSettingsNav matches design. Missing design's danger "Sign out" row (minor). |

### Settings sub-pages — **cross-cutting gap: no back-to-Settings on mobile**
The settings layout shows a static "Settings" title with **no back button**, and the sidebar is
hidden on mobile. Once you tap into a sub-page you can only leave via the bottom nav. **Fix:** when a
sub-page is active, the layout header should become a `MobileSecondaryHeader` (‹ back to Settings +
sub-page title). Then audit each sub-page's content for mobile fit.

| Route | Status | Mobile spec / notes |
| --- | --- | --- |
| `/settings/profile` | 🟡 | Form; needs single-column + back header. Has 1 `md:` util already. |
| `/settings/account` | ⚪ | Email/account; single-column, back header. |
| `/settings/notifications` | ⚪ | Toggle list → GroupCard rows. |
| `/settings/preferences` | ⚪ | Toggle/select list → GroupCard rows. |
| `/settings/devices` | 🟡 | Device/app-password **table** → stack into cards on mobile. |
| `/settings/security` | 🟡 | 2FA + sessions + app passwords; dense. Stack sections; sessions as cards. |
| `/settings/family` | 🟡 | Member management; roster + invites as cards, not table. |
| `/settings/teams` | 🟡 | 3 wide-content markers — **likely overflows**. Roster/permission matrix needs a mobile layout. |
| `/settings/teams/audit` | ⚪ | Audit log table → stacked rows w/ horizontal scroll if needed. |

### Collaboration / data
| Route | Chrome | Status | Mobile spec / notes |
| --- | --- | --- | --- |
| `/import-export` | AppShell | 🟠 | **Decision: adapt the existing wizard responsively** (keep the 4-step Upload→Map→Preview→Done incl. field-mapping). Make steps single-column, the source picker a 2×2 chip grid, the preview table h-scroll with sticky Name/Email columns. Do **not** drop to the prototype's simpler screen. |
| `/shares` | AppShell | ⚪ | Incoming/outgoing shares — render as cards; verify fit. |
| `/merge-suggestions/[id]` | AppShell | 🟡 | Side-by-side merge compare is desktop-shaped; needs stacked A/B mobile compare. |
| `/merge/manual` | ⚪ | Manual merge picker; same stacking concern. |

### Auth & public (no app chrome — centered card / marketing)
| Route | Status | Mobile spec / notes |
| --- | --- | --- |
| `/login`, `/login/verify-2fa` | ⚪ | Centered card; ensure full-width with padding < 768, inputs 16px (no iOS zoom). |
| `/register` | ⚪ | As above. |
| `/forgot-password`, `/reset-password`, `/verify-email` | ⚪ | Already `max-w-[400–420px]`; confirm padding + tap targets. |
| `/account-deleted`, `/account-pending-deletion` | ⚪ | Simple status pages; should be fine, verify. |
| `/` (landing) | ⚪ | Marketing — responsive hero/sections. |
| `/pricing` | ⚪ | Plan cards must stack 1-col; CTA full-width. |
| `/privacy`, `/terms` | ⚪ | Long-form legal; readable measure + padding. |
| `/family/join/[token]`, `/teams/join/[token]` | ⚪ | Invite acceptance; centered card, clear single CTA. |

### Admin
| Route | Status | Mobile spec / notes |
| --- | --- | --- |
| `/admin` + `audit`, `broadcast`, `feature-flags`, `metrics`, `users`, `users/[id]` | ⛔ | **Decision: desktop-primary.** No mobile redesign. Minimum-viable hardening only — don't break the layout below 768px: allow horizontal scroll on tables, keep headers/controls readable and tappable. |

### Excluded
| Route | Note |
| --- | --- |
| `/wireframes/*` (7) | Internal design scaffolding — not production, no mobile work. |

---

## 4. Cross-cutting work (do these once, benefits many pages)

1. **Extract a `MobilePlainHeader` component** (title + bell) — Sync/Settings/Activity duplicate it
   inline. One component, consistent 52px chrome.
2. **Settings sub-page back navigation** — layout swaps the static "Settings" title for a
   `MobileSecondaryHeader` (‹ Settings · <subpage>) when not at the root. **Highest-value nav fix.**
3. **Table→cards helper** — devices, security sessions, family/team rosters, audit logs all need the
   same "stack a table into cards under `md`" treatment.
4. **Create/Edit as a sheet** *(confirmed)* — unify `/contacts/new` and edit onto `MobileBottomSheet`
   with the design's collapsible sections + keyboard bar; keep the full page as a `?full=1` fallback.
5. **Activity feed mobile rows** — GroupCard event-row variant of `ActivityFeed` for < 768.
6. **Detail action pills** — 4 round green-tint pills to match the design.

---

## 5. Decisions (resolved 2026-06-12)
- **Admin on mobile:** ✅ Desktop-primary. Minimum-viable hardening only (no layout breakage).
- **Import on mobile:** ✅ Adapt the existing 4-step wizard responsively (keep field-mapping).
- **Create/Edit:** ✅ Bottom-sheet pattern, full page kept as fallback.

---

## 6. Priority order (proposed)
1. Settings sub-page back nav + single-column content (P1 — navigation is broken today).
2. Create/Edit bottom sheet (P1 — most-used write flow, wrong pattern).
3. Activity feed mobile rows; detail action pills (P2 — polish on shipped tabs).
4. Import mobile screen/decision; merge & shares stacking (P2).
5. Settings tables→cards (devices/security/family/teams) (P2).
6. Auth/marketing/legal verification pass (P3 — likely small fixes).
7. Admin decision + minimal hardening (P3).
