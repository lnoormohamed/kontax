# Kontax — Mobile PWA Design Specification

**Status:** living spec · created 2026-06-12
**Companion docs:** [`mobile-design-brief.md`](./mobile-design-brief.md) tracks per-route *status &
priority*; this document is the *design language + per-page design* that all mobile work must follow.
**Design source of truth:** the `mob-*.jsx` / `cx-kit.jsx` modules from the Mobile-PWA prototype,
vendored at [`design-briefs/mobile-pwa-prototype/`](./design-briefs/mobile-pwa-prototype/) — open
`Mobile PWA.html` to interact with the live reference.

> Goal: one consistent visual language across **every** mobile page, with enough detail that any page
> can be built without guessing. If a value isn't here, derive it from Part A, don't invent a new one.

---

# Part A — Design language

## A1. Frame & safe areas
Phones are anything `< 768px` (`md` breakpoint). Use `100dvh` column layouts.

| Constant | Value | Use |
| --- | --- | --- |
| Header height | **52px** | All top headers. |
| Bottom nav height | **56px** + `env(safe-area-inset-bottom)` | Tab bar. |
| List row height | **60px** | Contact rows. |
| Group header height | **28px** | Alpha / Favourites dividers. |
| Top safe area | `env(safe-area-inset-top)` | Header sits below the notch. |
| Bottom safe area | `env(safe-area-inset-bottom)` | Pad nav, FAB, sheets, toasts. |

Fixed elements (header, bottom nav, FAB, toast, sheets) must respect safe-area insets. Scroll
regions use `-webkit-overflow-scrolling: touch` and hide scrollbars.

## A2. Color tokens
| Token | Hex | Role |
| --- | --- | --- |
| `ink` | `#1d2823` | Primary text, titles |
| `ink2` | `#5c655e` | Secondary text |
| `mute` | `#8b938c` | Labels, captions |
| `faint` | `#aeb4ac` | Disabled, placeholder icons |
| `line` | `#d8ddd6` | Borders, dividers |
| `line2` | `#e9ece7` | Inner dividers (rows in a card) |
| `wash` | `#f2f4f0` | Group headers, icon tiles, segmented track |
| `bg` | `#f6f7f4` | Screen background |
| `paper` | `#ffffff` | Cards, headers, nav |
| `green` | `#17352e` (tint `#e7efe9`) | Brand, FAB, primary actions, favourite swipe |
| `blue` | `#4158f4` (tint `#edf0fe`) | Links, secondary CTAs, "Add", form save |
| `red` | `#b5472f` (tint `#f3e1da`) | Destructive, archive swipe, errors |
| `amber` | `#bf8526` (tint `#f6edd9`) | Warnings, offline, favourite star |
| Status dots | green `#2f9e5e` · amber `#bf8526` · red `#b5472f` | Connection / health |

**Convention:** green = brand/identity actions, blue = navigation/links and form-commit, red =
destructive, amber = caution. Never introduce a new hue.

## A3. Typography
Font: **Geist** (`-apple-system` fallback). `-webkit-font-smoothing: antialiased`.

| Style | Size / weight | Use |
| --- | --- | --- |
| Screen title | 19 / 700 | Plain header titles ("Settings", "Sync") |
| Hero / detail name | 22 / 700 | Contact detail name |
| Section heading | 17 / 700 | Sheet header, card headings |
| Body | 14–15 / 400–500 | Field values, descriptions |
| List name | 15.5 / 600 | Contact row primary |
| Secondary | 12.5–13 / 400 | Row subtitle, status lines |
| Label (caps) | 11 / 700, `letter-spacing 0.05–0.1em`, uppercase, `mute` | Field labels, section labels |
| Nav label | 10 / 600 | Bottom-nav tab text |
| Badge | 10–11 / 700 | Counts |

## A4. Spacing, radius, elevation, motion
- **Spacing:** 16px screen gutter. Card-to-card gap 12–16. Inside-card row padding 11–14 vertical.
- **Radius:** rows/inputs 11 · cards 14 · sheets/large 20 (top corners) · chips/tiles 8–12 · pills/dots 999.
- **Elevation:** cards use a hairline border + `0 1px 2px rgba(20,30,25,0.03)`, *not* heavy shadows.
  FAB `0 6px 18px rgba(23,53,46,0.3)`. Sheets `0 -10px 40px rgba(0,0,0,0.25)`. Toast `0 8px 24px rgba(0,0,0,0.22)`.
- **Motion:** sheet/slide-up `.3s cubic-bezier(.2,.8,.2,1)` · swipe snap `.26s cubic-bezier(.2,.8,.2,1)` ·
  toast in `.26s` · fade `.2–.25s` · tap feedback `opacity .55` on `:active` (no ripple).
  Keep animations ≤ 300ms. Haptic `navigator.vibrate(10)` on swipe-action commit.

## A5. Avatars
Deterministic by name. Circle, `fontSize = size × 0.36`, weight 600, initials = first letter of first
+ first letter of last word. 8-tint palette (hash the name → pick):
`#e0ebe2/#356048 · #e6e6f2/#4f4a9c · #f1e7dd/#8c5a36 · #dfeaf0/#356682 · #f0e3e8/#8e4259 ·
#e6eedd/#587336 · #efe8db/#7a6538 · #deedee/#377572` (bg/fg). Sizes: 42 (list), 48 (account/settings),
64 (detail).

## A6. Iconography
Lucide-style, **24 viewBox, 1.9 stroke**, round caps/joins. Default `ink2`; green/blue/red for accent
contexts. Star fills `amber` when on. Sizes: 17–18 (rows), 21–22 (actions/header), 24–26 (nav/FAB).

---

# Part B — Chrome & navigation

## B1. Header variants
All headers: 52px tall, `paper` bg, 1px `line` bottom border, sticky `top:0`, `z 40`.

1. **Home header** (Contacts list): wordmark left (28px green tile "K" + 19/600 "Kontax"); right cluster
   = bell (44×44, red count badge) + search (44×44). 
2. **Plain title header** (Activity / Sync / Settings roots): 19/700 title left; bell right.
   *(Build as one shared `MobilePlainHeader` — see brief §4.)*
3. **Secondary header** (pushed screens): back chevron (44×44) left · centered 16/700 title (may
   fade in on scroll) · optional right action (e.g. "Edit" / "Save", blue 15/600).
4. **Scroll-aware variant** (contact detail): full centered header scrolls away; the compact secondary
   header's title fades in once `scrollTop > 60`.

## B2. Bottom nav (the single tab bar)
`paper`, 1px `line` top, height 56 + bottom safe-area. Four tabs: **Contacts · Activity · Sync ·
Settings** (icons `layoutList · activity · refresh/sync · gear`). Per tab: 4px active **dot** above the
icon (green), icon 24 (stroke 2 active / 1.8 idle), label 10/600. Active = `green`, idle = `mute`.
Red count badge top-right of the icon (Activity = unread, Sync = errors). `md:hidden`. Never render a
second nav.

## B3. FAB
Circular, `green`, white icon, FAB shadow, `:active` scale .92. **56px** create FAB on the Contacts
list (bottom-right, above nav + safe area); **52px** edit FAB (pencil) on contact-detail Details tab.
FAB appears **only** on the Contacts list and contact detail — never on Activity/Sync/Settings or
secondary screens. Disabled/offline → `faint` bg, opens an explanatory toast.

---

# Part C — Building blocks

| Component | Spec |
| --- | --- |
| **GroupCard** | `margin 0 16 16`, 1px `line`, radius 14, `paper`, `overflow:hidden`. Wraps grouped rows. |
| **NavRow** | Tap row: `padding 13 16`, 30px icon tile (radius 8, `wash` bg, icon 18 `ink2`; danger → `red-t`/`red`), label 15/500, optional right detail 13 `mute`, chevron 17 `faint`. Divider `line2` except last. |
| **FieldCard** | `margin 0 16 12`, radius 14, optional 11/700 caps title (`mute`). |
| **FieldRow** | `padding 11 16`, 22px leading icon gutter, label 11/600 `mute`, value 15 `ink` (truncates), optional trailing action (e.g. 36px round call button, green-tint). Divider `line2` except last. |
| **ActionPill** | Column: 46px circle `green-tint` + icon 21 `green`, label 11.5/600 `ink2`. Used in the detail action row. |
| **List row** | 60px, `padding 0 8 0 16`, avatar 42, name 15.5/600 (search highlight `#fff0bf`), subtitle 13 `mute`, trailing 44px star tap target. Swipe-to-reveal underlay = 168px (two 84px actions: **Favourite** `green` / **Archive** `red`, icon 21 + 11/600 label). 40% snap, rubber-band, haptic. |
| **Group header** | 28px, `wash` bg, sticky `top:0`, optional leading star (Favourites), 11/700 `mute` label, `letter-spacing 0.04em`. |
| **Segmented control** | `wash` track, radius 10, 3px pad; segments 36px; active = `paper` + `0 1px 3px rgba(0,0,0,.08)`, idle `mute`. |
| **Source chip** (import) | 52px, radius 12, 1.5px border; active = `blue` border + `blue-t` bg + check; 2×2 grid. |
| **Radio card** (export/options) | `padding 14 16`, radius 12, 1.5px border (active `blue`+tint), 20px radio circle (10px blue dot when on), title 15/600 + desc 12.5 `mute`. |
| **Buttons** | Primary: full-width, 48–56px, radius 12, `green` (identity) or `blue` (form commit), 15–16/600–700 white. Secondary: 48px, `paper` + 1px `line`, `ink2`. Text button: `blue` 14/600. Dashed "add": 48px, 1.5px dashed `line`, `blue` text + plus. Disabled → `faint` bg / `#c7cdd6`. |
| **Input** (sheet field) | Min 46px (multiline 76), radius 11, 1.5px `line`; active = `blue` border + `blue-t` bg + `0 0 0 3px rgba(65,88,244,.12)` focus ring. Inputs must be ≥16px to avoid iOS zoom. Label 12/600 `mute` above. |
| **Status dot** | 9px circle: `#2f9e5e` ok · `amber` caution · `red` error. |
| **Badge** | `min-w 18 h 18`, radius 999, 11/700, count contexts; red on nav. |
| **Toast** | `ink` bg, white, radius 12, 48px, `left/right 16`, above nav + safe area, optional action chip (white-translucent), auto-dismiss ~3.2s, slide-up `.26s`. |
| **Offline banner** | `amber-t` bg, `#ecdcb6` border, wifi-off icon + 12.5/500 `#6f5417` text, under the header. |
| **Verify-email / locked banner** | Full-width info banner under header (amber for verify; `red-t` for read-only/locked) with inline action link. |
| **Empty state** | Centered: 56–64px `wash` rounded-square icon, 16–17/700 title, 13.5 `mute` description, optional CTA. |
| **Section label** | 11–12/700 caps `mute`, `letter-spacing 0.05–0.13em`, above a card/group. |

---

# Part D — Modals & sheets

## D1. Bottom sheet (create/edit, pickers, options)
Scrim `rgba(20,28,24,0.42)` (fade `.2s`). Sheet: `paper`/`bg`, top radius 20, slides up
`.3s cubic-bezier(.2,.8,.2,1)`, sheet shadow. Anatomy top→bottom:
1. **Drag handle** 40×4 `line`, centered.
2. **Header** 48px: left spacer · centered 17/700 title · close ✕ (44×44) — or Cancel/Save layout.
3. **Scroll body** (`flex:1, min-h:0`), 12–16px padding.
4. **Pinned footer** with the primary action button; padding-bottom respects safe area, collapses
   when the keyboard is up.

## D2. Keyboard-aware editing
Focusing a field raises the keyboard and: (a) pins the Save button directly above it, (b) shows an
**accessory bar** (44px, translucent, blur) with prev/next chevrons + "Done", (c) scrolls the focused
field 24px clear of the keyboard edge. Prev/next walk the visible field order across expanded sections.

## D3. Collapsible sections (in the edit sheet)
Each section = a card with a 48px header (14.5/700 title + chevron, rotates 180° when open). "Basic
Info" is **always-on** (shows "Always on", not a chevron). Optional sections (Phones, Emails,
Addresses, More) start collapsed; expanding reveals fields + a `blue` "+ Add …" text button.

## D4. Confirm dialog
Centered or bottom-sheet card: 17/700 title, 14 `ink2` body, action row — destructive primary in
`red`, secondary outline. Use for archive-all, leave family, revoke device, delete, sign out.

## D5. PWA install prompt
Bottom sheet: drag handle, centered "Add Kontax to your Home Screen", 64px green app tile + "Kontax /
kontax.app", one-line value prop. **iOS:** two numbered steps (Share → "Add to Home Screen") + "Got
it". **Android:** "Install" (blue) + "Not now". Triggered by the install heuristic; dismissable.

---

# Part E0 — Plan, lifecycle & role variance (read before Part E)

The same route renders differently along **four independent axes**. Every page in Part E must define
its variants on whichever of these apply. Don't hard-code one happy path.

## E0.1 The four axes
1. **Plan** — `FREE · PRO · FAMILY · TEAMS` (from `planSummary.plan`). Gates features (table below).
2. **Billing lifecycle** — `ACTIVE · TRIALING · GRACE · CANCELED · LOCKED` (`planSummary.lifecycleState`).
   `GRACE`/`LOCKED` set `canWrite=false` → **read-only mode** (owned contacts visible, basic export
   stays for portability; all create/edit/delete affordances disabled).
3. **Group role** — for Family/Team members: `OWNER · ADMIN · MEMBER` (`GroupMember.role`). Determines
   who manages members, invites, books, and billing.
4. **Per-resource permission** — `canEdit` (can the member edit the shared book), `addressBookPermissions`
   (per-book read/write, Teams), `inviteStatus` (`PENDING/ACCEPTED/DECLINED/REVOKED`).

## E0.2 Plan entitlement matrix (what each plan unlocks)
| Capability | FREE | PRO | FAMILY | TEAMS |
| --- | --- | --- | --- | --- |
| Contacts | 500 (limit banner near/at cap) | ∞ | ∞ | ∞ |
| Imports / month | 3 (quota meter) | ∞ | ∞ | ∞ |
| Sync accounts | **1** | 5 | 5 | 5 |
| CardDAV sync + device setup | **✗ (upsell)** | ✓ | ✓ | ✓ |
| App passwords | 1 | 5 | 5 | 5 |
| Activity log | **✗ locked card** | 365 days | 90 days | unlimited |
| Per-contact history shown | last **3** | full | full | full |
| Live + static sharing | **✗** | ✓ | ✓ | ✓ |
| Premium export · advanced merge | ✗ | ✓ | ✓ | ✓ |
| Family group | ✗ | ✗ | ✓ (1 book · 6 seats) | ✗ |
| Teams | ✗ | ✗ | ✗ | ✓ (multi-book · 25 seats) |

## E0.3 Role capability matrix (Family / Team)
| Action | OWNER | ADMIN (Teams) | MEMBER |
| --- | --- | --- | --- |
| View shared book | ✓ | ✓ | ✓ |
| Edit shared contacts | ✓ | ✓ | per `canEdit` / book perms |
| Invite / remove members | ✓ | ✓ | ✗ |
| Manage roles & per-book permissions | ✓ | ✓ (not owner) | ✗ |
| Create / delete address books (Teams) | ✓ | ✓ | ✗ |
| Billing & plan | ✓ | ✗ | ✗ |
| Leave group | disband/transfer | ✓ | ✓ |

## E0.4 Reusable variance treatments (design once, apply everywhere)
- **Upsell card** — plan-gated feature: centered `wash` icon, "<Feature> is a <Plan> feature",
  one-line value prop, `blue` "Upgrade to <Plan>", "You're on the <Plan> plan." (Activity-locked is the
  reference; reuse for Sharing tab on Free, Sync/CardDAV on Free, Family/Team setup, etc.)
- **Near/at-limit banner** — amber under the header: "{used} of {limit} … remaining" + Upgrade link
  (contacts 500, imports 3/mo). At-limit disables the create affordance.
- **Read-only banner** — `red-t`, "Your account is read-only. {lifecycle reason}" + "Manage plan".
  Hides/disables FAB, swipe-edit, edit/save buttons, add-connection, invite buttons.
- **Permission-hidden** — never show a control the role can't use (no "Invite", "Manage", per-book
  edit) for `MEMBER`; show a read affordance instead. Prefer hiding over disabling for role gates;
  use disabled+explanation for *temporary* gates (offline, read-only).
- **Pending state** — `inviteStatus = PENDING` members render with a muted "Pending" chip and a
  resend/revoke affordance (owner/admin only).
- **Empty-because-plan vs empty-because-new** — distinguish "Activity is a Pro feature" (upsell) from
  "No activity yet" (genuine empty). Never show an upsell as if it were empty data.

## E0.5 Who-sees-what (most-affected pages)
| Page | FREE | PRO | FAMILY member | FAMILY/TEAM owner/admin | Read-only (GRACE/LOCKED) |
| --- | --- | --- | --- | --- | --- |
| Contacts | limit banner; FAB on | full | + "Save to family" target | + manage entry points | FAB/swipe-edit off, locked banner |
| Contact detail | history capped to 3; no Sharing | full | shared badge; edit per `canEdit` | edit | view-only, no edit |
| Activity | locked upsell | feed (365d) | feed (90d) | feed | feed (read) |
| Sync | upsell (CardDAV off) or 1-acct cap | up to 5 | personal | personal | add disabled |
| Settings root | no Family/Team rows; "Upgrade" | personal rows | "Family management" | "Family/Team management" | billing emphasised |
| Family/Teams | upsell card | upsell card | roster + "Leave" (no manage) | roster + invite/role/book mgmt | read |
| Import/export | 3/mo quota; basic export only | unlimited; premium export | same as Pro | same | export-only (portability) |
| Shares | sharing locked (upsell) | full | full | full | incoming view only |

---

# Part E — Per-page design

> Format: **Chrome** · **Layout** · **States** · **Variance** (plan/role, per Part E0) · **Interactions**.
> Tokens/components reference Parts A–D. ✅ = built to spec · 🟡 = exists, restyle · 🟠 = wrong pattern ·
> 🔴 = broken/off-brand · ☐ = to design.

## E1. Contacts tab
**`/contacts` — People list** · ✅
- *Chrome:* Home header + bottom nav + 56px create FAB.
- *Layout:* optional offline/verify banner; sticky Favourites group (star header) then A–Z groups of
  60px swipe rows; trailing 12px spacer.
- *States:* empty = centered empty state ("No contacts yet" + import hint); offline = banner + FAB
  disabled (`faint`, toast on tap); read-only = locked banner.
- *Variance:* **Free** near/at 500 → limit banner, FAB disabled at cap. **Read-only** (GRACE/LOCKED) →
  locked banner, FAB + swipe-edit off. **Family/Team** member → contacts show a shared badge and a
  "Save to {Private/Family/Team}" target in create; book scope chips when in a shared book.
- *Interactions:* tap → detail; swipe → Favourite/Archive (40% snap, haptic); archive → undo toast;
  star tap target on the right. Group headers should be sticky (currently deferred in the virtualizer).

**`/contacts` — Favorites / Archived / Duplicates filters** · 🟡
- Same chrome/list; FAB hidden on non-People. Duplicates shows merge-suggestion cards (stacked, never
  the desktop toolbar) with a "Review" CTA per pair.

## E2. Contact detail
**`/contacts/[id]`** · 🟡 (action row restyle)
- *Chrome:* scroll-aware secondary header (back · name fades in · "Edit" blue) + bottom nav + 52px edit FAB (Details tab only).
- *Layout:* full centered header (64px avatar, 22/700 name, 14 `ink2` subtitle) that scrolls away;
  **action row = 4 round ActionPills: Call · Message · Email · More** (green-tint). Sticky segmented
  tabs **Details / Sharing / History** (active = 700 + 2.5px green underline). Then FieldCards:
  phones (trailing green call button), emails, a combined company/address/birthday card, optional Note card.
- *Sharing tab:* FieldCard "Shared with" rows (Family · permission, Public link · state).
- *History tab:* FieldCard recent-activity rows (icon · when · what).
- *States:* not-found → friendly empty + back; shared/read-only contact → hide edit affordances.
- *Variance:* **Free** History tab capped to last 3 entries (+ "Upgrade for full history"); **Sharing tab
  hidden/locked** on Free (no live/static sharing). Member viewing a shared contact without `canEdit` →
  read-only (no Edit/FAB). Read-only lifecycle → view-only.
- *Note:* current build uses 5 outlined square buttons — **replace with the 4 green-tint pills**.

## E3. Create / Edit contact
**`/contacts/new` + edit** · 🟠 → **bottom sheet** (decision locked)
- *Pattern:* `MobileBottomSheet` over the current screen (not a full page; keep full page as `?full=1`
  fallback). Header = drag handle + centered "New contact" / "Edit contact" + ✕.
- *Layout:* collapsible section cards — **Basic Info** (always-on: first, last, company), **Phone
  numbers**, **Email addresses**, **Addresses**, **More — dates, notes, custom fields**. Each field =
  label 12/600 + tappable input; multi-value sections show a "+ Add …" button. "Save to" target
  selector (Private / Family / Team) when applicable, as a segmented/inline control near the top.
- *Footer:* pinned primary "Save contact" / "Save changes" (`green`).
- *Interactions:* keyboard accessory bar (prev/next/Done); Save pins above keyboard; person/org toggle.

## E4. Activity tab
**`/contacts?tab=activity`** · 🟡 (feed rows)
- *Chrome:* Plain "Activity" header + bottom nav (no FAB).
- *Layout (unlocked):* GroupCard feed of event rows — 32px circle `wash` icon · "**Name** · action" (14.5
  `ink`) · timestamp (12 `mute`). Optional lightweight filter (category/actor) that must not overflow.
- *States:* loading skeleton rows; empty = "No activity yet"; load-more on scroll.
- *Variance:* **Free** → upsell card (clock icon, "Activity log is a Pro feature", blue "Upgrade to Pro",
  plan note; must fit `w-full max-w-[460px]`) — never the empty state. **Pro** 365-day / **Family** 90-day
  / **Teams** unlimited retention; show the retention window as a caption ("Showing the last N days").

## E5. Sync tab
**`/sync`** · ✅
- *Chrome:* Plain "Sync" header + bottom nav.
- *Layout:* GroupCard of connection rows — 38px `green-tint` tile (refresh icon) · name 15/600 ·
  status line 12.5 ("Synced 2m ago", "Paused", "Reconnect needed", error in tone color) · status dot.
  Below: dashed "+ Add connection" button.
- *States:* empty = centered empty state + Add; offline = banner + disabled add.
- *Variance:* **Free** has no CardDAV sync → the screen is an **upsell** ("Sync is a Pro feature") OR a
  single-account cap with Add disabled past 1 (match the entitlement: `cardDavSyncEnabled=false`,
  `syncAccountsLimit=1`). **Pro+** up to 5 accounts. Read-only → Add disabled.
- *Interactions:* tap a row → full-screen connection detail (deep-link `?account=`); Add → full-screen
  add form (`?add=1`); detail/add back button returns to the summary. Conflict/settings/job-history
  live inside the detail (power-user, desktop-derived but usable full-screen).

## E6. Settings tab + sub-pages
**`/settings` (root)** · ✅
- *Chrome:* Plain "Settings" header + bottom nav.
- *Layout:* account GroupCard (48px avatar, name 16/700, "email · plan"); grouped NavRows —
  [Sync connections · Family/Team management · Import & export], [Profile · Notifications · Devices ·
  Security · Plan & billing]; danger group ([Sign out], red) to match the design; "Kontax · kontax.app" footer.
- *Variance:* the **Family/Team management** row shows only when the user is in a group or on the matching
  plan (Free/Pro without a group → no row, or an "Upgrade" upsell row). Account card shows the live plan
  label. Read-only → surface the billing/"Manage plan" entry prominently.

**Settings sub-pages** (`profile · account · notifications · preferences · devices · security · family ·
teams · teams/audit`) · ✅ content / **back-nav gap (P1)**
- *Chrome fix:* when not at the settings root, the layout header becomes a **secondary header**
  (‹ Settings · <sub-page title>) so users can get back without leaving Settings.
- *Layout:* keep the established card pattern — section-labelled FieldCards / GroupCards, toggle rows,
  roster rows (avatar · name/email · role badge), danger cards. Single column.
- *Variance (Family/Teams):* **member** sees roster (read) + "Leave"; **owner/admin** additionally see
  invite, role-change, remove, and (Teams) per-book permission controls — *hidden* for members, not just
  disabled. `PENDING` invitees show a muted chip + resend/revoke (owner/admin). Free/Pro without a group
  → upsell card. Billing/seat management = owner only.
- *To design properly:* **team-owner view** (roster + per-book permission **matrix**) and
  **teams/audit** log — stack the matrix into per-member cards or an h-scroll table under `md`;
  audit as stacked rows. **Family-owner** invite management as cards. **2FA setup** as a sheet
  (QR + code entry). Verify notifications/preferences toggle rows.

## E7. Import & export
**`/import-export`** · 🟠 → adapt the wizard responsively (decision locked)
- *Chrome:* secondary header ("Import & Export") + bottom nav.
- *Layout:* top segmented **Import / Export**. **Import** keeps the 4-step flow
  (Upload → Map fields → Preview → Done) but single-column: a 2×2 source-chip grid, a full-width
  "Choose CSV file" (`blue`, 56px), the mapping step as stacked field→column rows, and the preview as a
  bordered table that **h-scrolls with sticky Name/Email columns**; commit button full-width `green`.
  **Export:** format radio cards (CSV / vCard) + summary + full-width "Export" (`blue`, download icon).
- *States:* quota near/over-limit banner; empty/locked per plan; success toast with "View".
- *Variance:* **Free** import quota 3/mo (meter + at-limit block + Upgrade), **export = basic CSV/vCard
  only** (premium/filtered export gated → upsell). **Pro+** unlimited imports + premium export. Read-only
  → export still allowed (portability), import disabled.

## E8. Collaboration
**`/shares`** · ✅
- Secondary header + bottom nav. Pending shares = dashed empty card when none; "Earlier" = accepted/
  declined rows (avatar · "Name · shared by X" · status · "View contact →"). Pending rows get
  Accept/Decline actions.
- *Variance:* **Free** can't create outbound shares (sharing gated → "Sharing is a Pro feature" on the
  share affordance), but **can still receive/accept** incoming shares. Pro+ → full. Read-only → view
  incoming only.

**`/merge-suggestions/[id]` · `/merge/manual`** · 🔴 **restyle to the design system first**
- *Current:* off-brand dark-navy/cyan dev-scaffold theme — does not follow this spec on any viewport.
- *Target chrome:* secondary header ("Review merge" / "Manual merge") + bottom nav.
- *Target layout:* contact pickers as the standard segmented/select pattern (manual); the A/B compare
  **stacked vertically** on mobile (Record A card, then Record B card, field-by-field) with a per-field
  "keep" choice and a clear "Survivor" selector; primary `green` "Merge" + outline cancel; deterministic
  preview card. Use FieldCard/FieldRow, light tokens — no dark theme.

## E9. Auth & account status (centered-card pattern) · ✅ by pattern
`/login · /login/verify-2fa · /register · /forgot-password · /reset-password · /verify-email`
- *Layout:* `bg` screen, centered wordmark, white card (radius ~16, max-w ~400–420 but full-width with
  16px gutter < 768), title 22–24/700, helper text, labelled inputs (≥16px), full-width primary, a
  secondary link ("Back to login"), legal footer. 2FA = 6-box / single code input + resend.
- `/account-deleted · /account-pending-deletion`: same centered-card with a status message + single CTA.

## E10. Public / marketing / legal
**`/` landing** · ✅ — responsive hero, full-width CTA, product mockup; stacked sections.
**`/pricing`** · 🟡 — hero + Monthly/Annual segmented fit, but **plan cards must stack 1-column** and the
feature-comparison table must stack into per-plan cards (or h-scroll) under `md`; CTAs full-width.
**`/privacy · /terms`** · ☐ verify — long-form: comfortable measure, 16px gutter, readable line-height,
sticky-free.
**`/family/join/[token]` · `/teams/join/[token]`** · ☐ verify — centered-card invite acceptance: who
invited you, what you get, single clear Accept CTA + decline link.

## E11. Admin (desktop-primary — decision locked) · ⛔
`/admin · /admin/audit · /admin/broadcast · /admin/feature-flags · /admin/metrics · /admin/users ·
/admin/users/[id]` — **no mobile redesign.** Minimum hardening only: don't break below 768px — wrap
dense tables in horizontal scroll, keep headers/controls readable and tap targets ≥44px. No bottom nav.

## E12. Excluded
`/wireframes/*` — internal design scaffolding, not production.

---

# Part F — Global states & edge cases
Every data screen must define: **loading** (skeletons matching row/card shape — never a bare spinner
where content will land), **empty** (Part C empty state), **error** (inline card + retry), **offline**
(banner; writes disabled with explanatory toast), and the **plan/lifecycle/role variants from Part E0**
— upsell (plan-gated), near/at-limit, read-only (lifecycle), and permission-hidden (role). Two rules:
distinguish *empty-because-plan* (upsell) from *empty-because-new* (genuine empty); and **hide** controls
a role can't use rather than disabling them (reserve disabled+explanation for temporary gates: offline,
read-only). Respect `prefers-reduced-motion` (disable slide/scale, keep opacity). Tap targets ≥ 44×44.

---

# Part G — Component build checklist
Shared pieces to implement once and reuse:
- [ ] `MobilePlainHeader` (title + bell) — Activity/Sync/Settings roots.
- [ ] Settings layout: secondary-header swap on sub-pages (back to Settings).
- [ ] `MobileBottomSheet` collapsible-section form + keyboard accessory (create/edit).
- [ ] Activity feed mobile event-row variant.
- [ ] Detail action row → 4 green-tint ActionPills.
- [ ] Stacked A/B merge compare + **merge pages restyle to light system**.
- [ ] Import wizard responsive (single-column steps, sticky-column preview).
- [ ] Pricing: 1-col plan cards + stacked comparison.
- [ ] Generic "stack table → cards / h-scroll" helper (teams matrix, audit, pricing).
- [ ] `MobileInstallPrompt` (iOS/Android variants).
- [ ] Confirm dialog / action sheet primitive.

---

# Part H — Page coverage index (every route, one line)
| Route | Spec § | Status |
| --- | --- | --- |
| `/contacts` (People) | E1 | ✅ |
| `/contacts` (Fav/Archived/Duplicates) | E1 | 🟡 |
| `/contacts/[id]` | E2 | 🟡 |
| `/contacts/new` (+edit) | E3 | 🟠→sheet |
| `/contacts?tab=activity` | E4 | 🟡 |
| `/sync` (+`?account`/`?add`) | E5 | ✅ |
| `/settings` | E6 | ✅ |
| `/settings/profile` | E6 | ✅ /back-nav |
| `/settings/account` | E6 | ☐ verify |
| `/settings/notifications` | E6 | ☐ verify |
| `/settings/preferences` | E6 | ☐ verify |
| `/settings/devices` | E6 | ✅ /back-nav |
| `/settings/security` | E6 | ✅ /back-nav |
| `/settings/family` (member/owner) | E6 | ✅ member · ☐ owner |
| `/settings/teams` (upsell/active) | E6 | ✅ upsell · 🟡 active |
| `/settings/teams/audit` | E6 | ☐ |
| `/import-export` | E7 | 🟠→adapt |
| `/shares` | E8 | ✅ |
| `/merge-suggestions/[id]` | E8 | 🔴 |
| `/merge/manual` | E8 | 🔴 |
| `/login` · `/login/verify-2fa` | E9 | ✅ pattern |
| `/register` | E9 | ✅ pattern |
| `/forgot-password` | E9 | ✅ |
| `/reset-password` · `/verify-email` | E9 | ✅ pattern |
| `/account-deleted` · `/account-pending-deletion` | E9 | ☐ verify |
| `/` (landing) | E10 | ✅ |
| `/pricing` | E10 | 🟡 |
| `/privacy` · `/terms` | E10 | ☐ verify |
| `/family/join/[token]` · `/teams/join/[token]` | E10 | ☐ verify |
| `/admin/*` (7) | E11 | ⛔ desktop-primary |
| `/wireframes/*` | E12 | excluded |
