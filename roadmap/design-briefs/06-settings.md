# 06 — Settings

**Route:** `/settings`
**Priority:** P1 — reached from the sidebar avatar/name link and from the header. Not a daily-use screen but critical for trust: it is where users verify their plan, manage data, and control app behaviour.

> **Freshness (2026-06-10) — ready to send.** This brief reflects the built state of the Settings page as of P11-06. It has been reconciled against the live implementation — all layout, token, limit, and component details below match the code. Design language: the locked light system (ink `#1d2823`, green `#17352e`, blue `#4158f4`, hairline `#d8ddd6`, Geist). Pairs with **brief 11 — Pricing & Upgrade Flows**; send the two together.

---

## Purpose

The Settings page is a lightweight account management centre. It surfaces the information a user needs to understand what they are on (plan), who they are (profile), how the app behaves (preferences), and what risks exist (session). It deliberately avoids becoming a sprawling preferences panel — the current product has very few tuneable settings, and the layout should make that feel like calm simplicity rather than a half-finished page.

The page uses a two-column layout on large screens: a main content column on the left and a narrow (320px) sidebar on the right containing quick links, session controls, and contextual notes. On tablet and mobile the layout collapses to a single column.

Future phases (12–14) will add family group management, team management, and billing portal access. Group membership already has a scaffolded section inside the Plan card; it becomes a full card when those phases ship.

---

## Layout

### Overall structure

```
┌────────────────────────────────────────────────────────────────┐
│  HEADER (sticky, shared global header)                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  HERO CARD                                               │  │
│  │  ← Back to contacts                                      │  │
│  │  Avatar · "Account, preferences, and plan" heading       │  │
│  │  Section jump chips: Account · Preferences · Plan ·      │  │
│  │  Devices · Session                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────┐  ┌────────────────┐  │
│  │  ACCOUNT CARD            #account   │  │  QUICK LINKS   │  │
│  │  Display name · Email               │  │  sidebar card  │  │
│  ├─────────────────────────────────────┤  ├────────────────┤  │
│  │  PREFERENCES CARD     #preferences  │  │  SESSION CARD  │  │
│  │  Phonetic toggle + Save button      │  │  #session      │  │
│  ├─────────────────────────────────────┤  ├────────────────┤  │
│  │  PLAN CARD               #plan      │  │  SETTINGS      │  │
│  │  Plan name · Lifecycle badge        │  │  POSTURE card  │  │
│  │  Usage bars · Group membership      │  │  (static copy) │  │
│  ├─────────────────────────────────────┤  └────────────────┘  │
│  │  CONNECT A DEVICE CARD   #devices   │                       │
│  │  Server URL + Username copy fields  │                       │
│  │  App password manager               │                       │
│  │  Step-by-step setup guides          │                       │
│  └─────────────────────────────────────┘                       │
└────────────────────────────────────────────────────────────────┘
```

**Main column:** `minmax(0, 1fr)` — grows to fill available width up to the max-width constraint.
**Sidebar:** fixed 320px width, `self-start` (does not stretch to match main column height).
**Overall page max-width:** `max-w-5xl` (`1024px`), centred with `mx-auto`.
**Page background:** radial-gradient green wash fading to cream — `radial-gradient(circle at top, rgba(201,214,170,0.45), transparent 26%), linear-gradient(180deg, #eff3ea 0%, #f8fafc 38%, #f6f5f0 100%)`.
**Page padding:** `px-4 py-6` on mobile, `px-6 py-8` on large screens.

All cards use `rounded-[2rem] border border-[#d8ddd6] bg-white shadow-sm`. Card internal padding: `p-6` on main cards, `p-5` on sidebar cards. Vertical gap between cards in both columns: `gap-6` (24px).

---

## Back link

The back link lives inside the Hero card, at the very top before the avatar row:

```
← Back to contacts
```

- Text: "Back to contacts"
- Colour: `#4158f4`, 14px, semibold
- Hover: `#3248db`
- No underline at rest

---

## Key Components

### 1. Hero Card

This is the first card on the page. It contains:

**Back link** (see above).

**Avatar + heading row** (rendered as `flex-col` on mobile, `flex-row items-center` on `sm` and up):
- Avatar circle: 80×80px (`h-20 w-20`), `bg-[#e3e8ff]`, `text-[#4158f4]`, 24px semibold initials. Initials derived from display name (first letter of each word, max 2). If single name, use first two characters. Circle is not interactive.
- To the right of the avatar:
  - Eyebrow label: `"Settings"` — 12px uppercase, `tracking-[0.24em]`, slate-400.
  - Heading: `"Account, preferences, and plan"` — 36px semibold, tight tracking, slate-900.
  - Subtext: 14px, leading-6, slate-500. Current copy: *"This is the quieter side of Kontax: account details, phonetic behavior, plan visibility, and session controls, all kept out of the main contact workspace."*

**Section jump chips** — a horizontal row of pill links, `flex flex-wrap gap-2`, rendered below the avatar row:
- Each chip: `rounded-full border border-[#d8ddd6] bg-[#f8faf8] px-3 py-1.5 text-sm text-slate-600`, hover `bg-white`.
- Chips: Account (`#settings-account`), Preferences (`#settings-preferences`), Plan (`#settings-plan`), Devices (`#settings-devices`), Session (`#settings-session`).
- These are plain anchor links — smooth-scrolling to their respective cards.

---

### 2. Account Card

`id="settings-account"`

```
┌─────────────────────────────────────────────────────┐
│  Account                       [Consumer account]   │
│  Identity and sign-in basics now live in one place  │
│                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │  Display name        │  │  Account email       │ │
│  │  Liaqat Noormohamed  │  │  liaqat@example.com  │ │
│  └──────────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Card header row** — flex, space-between:
- Left: "Account" in 18px semibold slate-900. Below it: 14px slate-500 subtext.
- Right: "Consumer account" — pill badge, `rounded-full border border-[#d8ddd6] bg-[#f8faf8] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500`.

**Two-column info grid** (`md:grid-cols-2`, collapses to single column on mobile):
- **Display name tile:** `rounded-[1.4rem] border border-[#d8ddd6] bg-[#f8faf8] p-4`. Eyebrow: "Display name", 12px uppercase tracking-[0.2em] slate-400. Value: 18px semibold slate-900. Read-only display (no inline editing in current build).
- **Email tile:** same chrome, background `bg-[#f7f8ff]`. Eyebrow: "Account email". Value: 18px semibold slate-900, `break-all`. Read-only (email change is out of scope).

---

### 3. Preferences Card

`id="settings-preferences"`

```
┌──────────────────────────────────────────────────────┐
│  Preferences                                         │
│  Personal behavior settings…                         │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  Phonetic names                              │    │
│  │  Kontax can suggest phonetic readings…       │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ☐  Auto-fill phonetic first name, last name,        │
│     and company when those fields are empty.         │
│                                                      │
│  [Save preferences]                                  │
└──────────────────────────────────────────────────────┘
```

**Card header:** "Preferences" — 18px semibold slate-900. 14px slate-500 subtext below.

**Explainer tile:** `rounded-[1.4rem] border border-[#d8ddd6] bg-[#fbfcf8] p-4`. "Phonetic names" in 14px semibold, paragraph description below in 14px slate-500.

**Preference form (full-page POST, not live toggle):**
- A single checkbox row: `rounded-[1.4rem] border border-[#d8ddd6] bg-[#f8faf8] px-4 py-4`. Checkbox (`h-4 w-4 rounded border-slate-300 text-[#4158f4] focus:ring-[#4158f4]`) followed by label text at 14px slate-700.
- Helper paragraph: 14px slate-500, `leading-6`, below the checkbox row.
- **Save button:** `rounded-[1.2rem] bg-[#17352e] px-4 py-3 text-sm font-semibold text-white hover:bg-[#20443b]`. Saves via server action; page reloads with updated state.

**Note for designer:** preferences use a checkbox + explicit Save button, not a live toggle. There is only one preference currently. The card is intentionally minimal — do not pad with placeholder rows.

**Reserved future preferences:** dark mode override, notification preferences, default sort order.

---

### 4. Plan Card

`id="settings-plan"`

```
┌──────────────────────────────────────────────────────┐
│  Plan and limits                      ● Active        │
│  Billing visibility and usage gates…                  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Pro  [Current plan]          [View plans →]   │  │
│  │  Unlimited contacts · 5 sync accounts · …      │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Contacts                            840 / Unlimited  │
│  ████████████████████████████████████████████████    │
│                                                      │
│  Imports this month                        2 / Unlimited│
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│                                                      │
│  Sync accounts                             3 / 5     │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│                                                      │
│  Device passwords                          1 / 5     │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│                                                      │
│  Full read/write access with normal entitlement…     │
└──────────────────────────────────────────────────────┘
```

**Card header row** — flex, space-between:
- Left: "Plan and limits" in 18px semibold slate-900. 14px slate-500 subtext.
- Right: lifecycle badge (see Lifecycle State Badge below).

**Current plan tile** — `rounded-[1.4rem] border border-[#d8ddd6] bg-[#f6f7f4] p-4`, flex row space-between:
- Left: plan name in 20px semibold slate-900 + "Current plan" pill (`bg-[#e7efe9] text-[#17352e] text-[10px] uppercase tracking-[0.08em]`). One-line feature summary in 13px slate-500 below.
- Right: CTA button — `rounded-[1.1rem] bg-[#4158f4] px-4 py-2 text-sm font-semibold text-white`. Label: "Upgrade" on Free, "View plans" on all paid tiers. Links to `/pricing`.

**Plan feature summaries (one-line per tier):**
- Free: `"500 contacts · 1 sync account · 1 device · per-contact history (last 3) · no activity feed"`
- Pro: `"Unlimited contacts · 5 sync accounts · 5 devices · activity log (365 days) · live & static sharing"`
- Family: `"Everything in Pro for up to 6 members · 1 shared family book · 90-day history"`
- Teams: `"Everything in Pro for up to 25 members · multiple shared books · unlimited audit log"`

**Usage bars** — `grid gap-3.5`, one row per metric:
- Row label: 13px medium slate-700. Counts: 13px slate-500, right-aligned. Format: `"840 / Unlimited"` or `"3 / 5"`.
- Bar: `h-2 rounded-full bg-[#e9ece7]` track. Fill:
  - Normal (< 80%): `#17352e` (brand green)
  - Near limit (≥ 80%): `#bf8526` (amber)
  - At/over limit (= 100%): `#b5472f` (red)
  - Unlimited (null limit): full-width `#d8ddd6` grey bar (no percentage shown)
- Vertical gap between bar rows: 14px.

**Four usage rows (in order):**
1. Contacts — `used / entitlements.contactsLimit`
2. Imports this month — `importedThisMonth / entitlements.monthlyImportLimit`
3. Sync accounts — `syncAccountsUsed / entitlements.syncAccountsLimit`
4. Device passwords — `appPasswordAllowance.current / appPasswordAllowance.limit`

**Plan limits reference (for mockups):**

| Metric | Free | Pro | Family | Teams |
|---|---|---|---|---|
| Contacts | 500 | Unlimited | Unlimited | Unlimited |
| Imports / month | 3 | Unlimited | Unlimited | Unlimited |
| Sync accounts | 1 | 5 | 5 | 5 |
| Device passwords | 1 | 5 | 5 | 5 |

**Group membership block (Family / Teams plans only)**
Rendered below the usage bars when `plan === "FAMILY"` or `plan === "TEAMS"`:
- `rounded-[1.4rem] border border-[#d8ddd6] bg-white p-4`.
- Eyebrow: "Family group" or "Team" — 12px uppercase tracking-[0.2em] slate-400.
- If group exists: "Owner of [group name] · N/M members" in 14px slate-700.
- If no group yet: "[Your family / Your team] group isn't set up yet." in 14px slate-500.
- CTA: small blue pill button linking to `/settings/family` or `/settings/teams`. Label: "Manage family book" / "Set up family book" (or team equivalent).

**Lifecycle description** — 14px slate-500, below all the above, shows the current lifecycle policy description text.

#### Lifecycle State Badge

Displayed top-right of the Plan card header. Pill: 6px vertical, 10px horizontal padding, 12px semibold.

| State | Background | Text | Description shown |
|---|---|---|---|
| `Active` | emerald-50 / emerald-200 border | emerald-700 | "Full read/write access with normal entitlement checks." |
| `Trialing` | emerald-50 / emerald-200 border | emerald-700 | "Full product access during the active trial window." |
| `Grace` | amber-50 / amber-200 border | amber-700 | "Writes continue during recovery from billing issues…" |
| `Canceled` | rose-50 / rose-200 border | rose-700 | "Account becomes read-only, but owned contacts remain visible and basic export stays available for portability." |
| `Locked` | rose-50 / rose-200 border | rose-700 | "Account is restricted until billing recovery or administrative intervention clears the lock." |

Note: Active and Trialing share the same green tone. Grace uses amber. Canceled and Locked both use rose — the description text distinguishes them.

---

### 5. Connect a Device Card

`id="settings-devices"`

This is a **fully built section** (not a placeholder). It is the primary path for CardDAV device setup.

```
┌──────────────────────────────────────────────────────┐
│  Connect a device                                    │
│  Add Kontax to your iPhone, Mac, or Android phone    │
│  as a contacts account…                              │
│                                                      │
│  Server URL  [https://kontax.app]  [Copy]            │
│  Username    [liaqat@example.com]  [Copy]            │
│                                                      │
│  App passwords ─────────────────────────────────── │
│  ┌────────────────────────────────────────────────┐  │
│  │  Create a new app password                     │  │
│  │  Device name: [iPhone              ]           │  │
│  │  [Generate password]   Using 1 of 5 passwords  │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │  Your devices                                   │  │
│  │  📱 iPhone  Created 3 days ago  Last used today [Revoke] │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Step-by-step setup ────────────────────────────── │
│  [iPhone / iPad]  [Mac]  [Android (DAVx⁵)]          │
│  Step 1 … Step 2 … Step 3 …                         │
└──────────────────────────────────────────────────────┘
```

**Card header:** "Connect a device" in 18px semibold. 14px slate-500 description.

**Copy fields** — two stacked copy fields (Server URL, Username), each a `CopyField` component with label, value display, and a copy-to-clipboard button. Helper text below Server URL: *"Enter this as the server address during CardDAV setup on your device."*

**App passwords sub-section:**
- Sub-heading: "App passwords" in 14px semibold slate-900. Description in 14px slate-500: each device uses its own password; can revoke without affecting others.
- **Create form** — `rounded-[1.5rem] border border-[#d8ddd6] bg-[#f8faf8] p-4`:
  - "Device name" label + text input (`rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3`). Placeholder: "iPhone". Max 64 chars.
  - **Generate password** button — `rounded-[1.2rem] bg-[#17352e] px-4 py-3 text-sm font-semibold text-white`, disabled when at limit.
  - Usage indicator: `"Using N of M app passwords"` (or `"Unlimited app passwords on your plan"`) — 12px slate-500, right-aligned next to the button.
  - At limit: amber warning banner — `rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800`.
  - On success: one-time token reveal — amber banner showing the formatted token (`XXXX-XXXX-XXXX-XXXX`) in a monospace block, plus "Copy password" and "I've copied this password" buttons. After acknowledgement, banner becomes a green confirmation.
- **Your devices list** — `rounded-[1.5rem] border border-[#d8ddd6] bg-white`:
  - Header row: "Your devices" in 14px semibold slate-900, description in 14px slate-500: "Revoke anything you no longer trust."
  - Empty state: emoji row `📱 💻 🤖`, heading, description.
  - Each device row: platform glyph + device name (semibold) / Created date / Last used date / **Revoke** button (`rounded-[1.1rem] border border-rose-300 text-rose-700 hover:bg-rose-50`).
  - Revoke confirmation modal: centred dialog, `rounded-[1.6rem]`, "Revoke this password?" heading, description, Cancel + "Revoke password" (rose-600) buttons.

**Step-by-step setup sub-section:**
- `rounded-[1.5rem] border border-[#d8ddd6] bg-[#fbfcf8] p-5`.
- Sub-heading: "Step-by-step setup". Description: "Pick your device and follow the steps."
- Three platform tabs: **iPhone / iPad**, **Mac**, **Android (DAVx⁵)**. Active tab is visually selected.
- Each tab shows numbered steps with server URL and username pre-filled.

---

### 6. Quick Links Sidebar Card

Right sidebar, top position.

```
┌────────────────────────────────────────┐
│  Quick links                           │
│  Jump to the parts of Kontax that sit  │
│  next to settings most often…          │
│                                        │
│  Import and export center     →        │
│  Device and sync center       →        │
│  Manual merge review          →        │
└────────────────────────────────────────┘
```

- Eyebrow: "Quick links" — 12px uppercase tracking-[0.24em] slate-400.
- Description paragraph: 14px slate-500.
- Three link rows: each `rounded-[1.3rem] px-4 py-3 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50`. Full-width, no arrow icon (hover state is the affordance).
- Links: "Import and export center" → `/import-export`, "Device and sync center" → `/sync`, "Manual merge review" → `/merge/manual`.

---

### 7. Session Sidebar Card

`id="settings-session"` — right sidebar, second position.

```
┌────────────────────────────────────────┐
│  Session                               │
│  Use this for sign-out…               │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  liaqat@example.com              │  │
│  │  Signed in to Kontax on this     │  │
│  │  browser session.                │  │
│  │                                  │  │
│  │  [Sign out]                      │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

- Eyebrow: "Session" — 12px uppercase tracking-[0.24em] slate-400.
- Description: 14px slate-500.
- Inner tile: `rounded-[1.3rem] border border-[#d8ddd6] bg-[#f8faf8] p-4`.
  - Email in 14px semibold slate-900. "Signed in to Kontax on this browser session." in 14px slate-500.
  - **Sign out** — full-width `rounded-[1.2rem] border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50`. Signs out immediately (no confirmation needed — it is reversible).

**Note:** There is no "Delete account" action on this page in the current build. If/when added, it belongs in this card or below it as a separate danger row — do not design it as part of the current scope.

---

### 8. Settings Posture Sidebar Card

Right sidebar, third position. Static copy card — no interactive elements.

- Eyebrow: "Settings posture" — 12px uppercase tracking-[0.24em] slate-400.
- Three short paragraphs in 14px slate-600, `space-y-3 leading-6`:
  1. "Account and plan controls now stay off the main contacts page."
  2. "Preferences are separated from billing so they are easier to understand at a glance."
  3. "This gives us a calmer shell for later settings growth without cluttering the workspace."

---

## States

**Loading state**
- Each card renders a skeleton version while user data fetches.
- Avatar circle: grey `bg-slate-100 animate-pulse` circle.
- Name/email tiles: two skeleton bars at 60% and 40% width.
- Usage bars: full-width `bg-slate-100 animate-pulse` placeholders.
- Checkbox row: grey pill placeholder.

**Error state**
- If profile data fails to load: inline error banner below the back link. "Couldn't load your settings. Try refreshing." with a Retry link.
- Individual card errors: show card chrome with inline slate-500 message centred vertically.

**Plan at limit (contacts)**
- Usage bar fill: `#b5472f` (red). Count label: red bold.
- Below the bar: 13px amber-700 text: "You've reached your contact limit. Upgrade to add more contacts."
- Free plan CTA changes to "Upgrade now to continue adding contacts".

**App password at limit**
- Amber banner inside the Create form (see §5 above).
- Generate button is disabled.

---

## Mobile Layout (< 768px)

- Two-column layout collapses to single column. Sidebar cards stack below the main cards.
- Hero card: avatar and heading go `flex-col`. Chips wrap naturally.
- Cards go full width with 16px side safe area.
- Card internal padding: `px-5` (reduced from `px-6`).
- Usage bars: full width, no change.
- Device list rows: stack to single column (name + dates stack vertically, Revoke button full-width).
- Token reveal: full width.
- Sign out button: full width.
- Revoke confirmation modal: bottom sheet (slides up from bottom, full width).

---

## Future Additions

The following are planned and must not require structural redesign when they ship:

1. **Phase 11 — Billing portal:** A "Manage billing →" quiet text link will appear in the Plan card (below the current plan tile or lifecycle description). It becomes functional when Stripe billing portal is wired up. Reserve a line for it now.

2. **Phase 12–13 — Family Group management:** The group membership block in the Plan card grows into a full standalone card between the Plan card and the Connect a Device card. It will need: group name, member count, member avatar stack (up to 5), "Manage group" link, and "Leave group" danger action.

3. **Phase 14 — Team management:** Same pattern as Family Group. Becomes a standalone card with: team name, member count, role badge (Owner / Member / Admin), "Manage team" link.

4. **Future — Profile photo:** The avatar circle in the Hero card can accept a photo upload. A subtle camera icon overlay (`opacity-0` at rest, `opacity-60` on hover) is the planned affordance. No file picker in current scope — do not add the overlay yet.

5. **Future — Email change:** A "Change email →" text link below the email tile in the Account card. Leads to a separate re-verification flow. Reserve horizontal space for it now.

6. **Future — Delete account:** A destructive "Delete account" row in or below the Session card, with a two-step confirmation modal (button → "Type DELETE to confirm"). Not in current scope — do not design it now.

7. **Future — Activity log retention footnote:** A 12px slate-400 line inside the Plan card, below usage bars: `"Activity log retained for 30 days on Free · 1 year on Pro · 90 days on Family · unlimited on Teams"`. Rendered when Phase 10 ships; reserve the vertical space.
