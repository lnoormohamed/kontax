# 07 — Sync Connections

**Route:** `/sync`
**Priority:** P1 — the core differentiator. Users who connect a CardDAV source get compound value from Kontax. The page must inspire confidence: green health dots, clear timestamps, no jargon beyond what is necessary.

> **Freshness (2026-06-10) — needs realignment.** This page is **built but on the original dark theme** (cyan / `#08101c`), inconsistent with the **locked light design system** now used by the core surfaces (01/02/03/09/10). The *structure and content* are still valid; the visual treatment is what's stale. Send as a **"bring into the locked light system"** task — keep the layout/IA, restyle to ink `#1d2823` / green `#17352e` / blue `#4158f4` / hairline `#d8ddd6` / white surfaces / Geist. Note: inbound device connections (Kontax's own CardDAV server + app passwords) shipped in Phase 9 — reconcile the "reserved at the bottom" section with what now exists.

---

## Purpose

The Sync Connections page lets a user manage their CardDAV client accounts — the external services that Kontax connects to in order to pull and push contacts. Examples: iCloud, Nextcloud, Fastmail, any CalDAV/CardDAV host. Each account has its own sync history, health status, and conflict queue.

This page is about **outbound connections from Kontax to other services**. It is distinct from Phase 9 (inbound connections: devices connecting to Kontax's own CardDAV server). The distinction must be visually clear — future sections for inbound device connections are reserved at the bottom of the page, separated by a divider and labelled differently.

The reference interaction model is a lightweight "source manager" — closer to how Reeder manages RSS feeds than a full iCloud settings panel. The left column is the source list; the right column is the detail and action panel. Focus and clarity over density.

---

## Layout

### Overall structure (desktop ≥ 1280px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER (sticky, shared global header)                               │
├──────────────────────────────────────────────────────────────────────┤
│  ← Back to contacts                                                  │
│                                                                      │
│  ┌────────────────────────┐  ┌───────────────────────────────────┐   │
│  │  ACCOUNT LIST          │  │  ACCOUNT DETAIL PANEL             │   │
│  │  (left column, fixed   │  │  (right column, scrollable)       │   │
│  │   or sticky scroll)    │  │                                   │   │
│  │                        │  │  ┌─────────────────────────────┐  │   │
│  │  ┌──────────────────┐  │  │  │ Account name + URL          │  │   │
│  │  │ iCloud    ● ──── │  │  │  │ Direction badge             │  │   │
│  │  └──────────────────┘  │  │  │ Health summary              │  │   │
│  │  ┌──────────────────┐  │  │  │ Last sync timestamp         │  │   │
│  │  │ Nextcloud ● ──── │  │  │  └─────────────────────────────┘  │   │
│  │  └──────────────────┘  │  │                                   │   │
│  │  ┌──────────────────┐  │  │  ┌─────────────────────────────┐  │   │
│  │  │ Fastmail  ● ──── │  │  │  │ SYNC JOB HISTORY table      │  │   │
│  │  └──────────────────┘  │  │  └─────────────────────────────┘  │   │
│  │                        │  │                                   │   │
│  │  [+ Add account]       │  │  ┌─────────────────────────────┐  │   │
│  │                        │  │  │ CONFLICTS (if any)          │  │   │
│  └────────────────────────┘  │  └─────────────────────────────┘  │   │
│                              │                                   │   │
│                              │  ACTION BUTTONS                   │   │
│                              └───────────────────────────────────┘   │
│                                                                      │
│  ────────────────────────────────────────────────────────────────    │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  CONNECT A DEVICE (Phase 9 placeholder)                       │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### Column proportions

Left (account list): 280px fixed width. Right (detail panel): fills remaining width, min 400px.

Gap between columns: 24px.

Page horizontal padding: 32px each side on desktop. Max-width: 1200px, centred.

### Tablet (768–1279px)

The left column narrows to 240px. The detail panel takes the rest. On screens below ~960px, switch to a stacked layout: account list on top (full width, horizontal scroll if many accounts, or compact list), detail panel below.

---

## Back link

Same style as `/settings`: `← Back to contacts`, 14px slate-500, top of content area, 20px margin below.

---

## Key Components

### 1. Account List (left column)

```
┌────────────────────────────┐
│  Sync accounts             │
│                            │
│  ┌──────────────────────┐  │
│  │ [☁] iCloud       ●  │  │
│  │     2 min ago        │  │
│  └──────────────────────┘  │
│  ┌──────────────────────┐  │
│  │ [N] Nextcloud     ●  │  │
│  │     1 hour ago       │  │
│  └──────────────────────┘  │
│  ┌──────────────────────┐  │
│  │ [✉] Fastmail      ●  │  │
│  │     Error            │  │
│  └──────────────────────┘  │
│                            │
│  + Add account             │
└────────────────────────────┘
```

**Section label:** "Sync accounts" — 11px uppercase tracking-widest slate-400, 12px padding-bottom.

**Account list item:**
- Height: 56px. Full width of the left column.
- Left: platform icon (24×24px). Icons:
  - iCloud: Apple iCloud icon (blue cloud) or a clean "☁" mark in #3b82f6
  - Nextcloud: Nextcloud logo mark (green) or generic "N"
  - Fastmail: Fastmail "FM" mark or envelope icon
  - Generic/manual: grey cloud icon
  - Use SVG icons. If a platform icon is unavailable, fall back to a grey cloud.
- Middle (text block):
  - Line 1: account label (14px semibold, slate-800). Truncated to one line with ellipsis.
  - Line 2: relative timestamp "2 min ago" or error string "Auth error" (12px regular, slate-400 normally, red-500 on error).
- Right: status dot (8px circle).
  - Green (#16a34a): healthy
  - Amber (#d97706): warning or needs attention
  - Red (#dc2626): error or auth failed
  - Grey (#94a3b8): paused
  - The dot has a subtle pulse animation when a sync is in progress (2s loop, opacity 0.5–1.0).
- Selected state: left border 3px brand green (#17352e), background: very light green tint (#f0fdf4).
- Hover (unselected): background slate-50.
- Click: loads account detail in the right panel. On mobile, navigates to a new view.

**"+ Add account" button:**
- Appears below the last account item, 8px gap.
- Style: text button, `+` icon left, "Add account" label, 14px, `#4158f4`, no background.
- Hover: underline.
- Clicking: loads the Add Account form in the right detail panel (replaces whatever was shown there).

---

### 2. Account Detail Panel (right column)

The detail panel has four zones stacked vertically:

```
┌──────────────────────────────────────────────────────────┐
│  ACCOUNT HEADER                                          │
│  Large label · URL · Direction badge · Health summary   │
│  Last sync: 2 minutes ago                               │
│                                                          │
│  ACTION BUTTONS                                          │
│  [Sync now]  [Pause]  [Edit credentials]  [Disconnect]  │
├──────────────────────────────────────────────────────────┤
│  SYNC JOB HISTORY                                        │
│  Compact table                                           │
├──────────────────────────────────────────────────────────┤
│  CONFLICTS (conditional)                                 │
│  Only shown if conflicts exist                           │
└──────────────────────────────────────────────────────────┘
```

**Account Header zone:**

- Account label: 22px semibold, slate-900.
- Below it: connection URL in 13px regular slate-400, truncated with a "copy" icon on hover.
- Direction badge: pill chip. Options:
  - "Two-way" — brand green bg (#dcfce7), green text (#166534)
  - "Import only" — blue bg (#dbeafe), blue text (#1e40af)
  - "Export only" — purple bg (#f3e8ff), purple text (#6b21a8)
- Health summary line:
  - Healthy: `● Connected` in green-600
  - Warning: `● 3 consecutive failures` in amber-600
  - Error: `● Authentication failed` in red-600
  - Paused: `● Paused` in slate-400
  - Needs re-auth: `● Re-authentication required` in amber-600
- Last sync: "Last synced 2 minutes ago" or "Never synced" — 13px slate-500.

**Action buttons zone:**

Four buttons in a row (horizontal on desktop, wrap on narrow):
- "Sync now" — primary, `#4158f4` bg, white text, 13px semibold, 36px height, rounded-lg. Disabled and shows spinner while sync is in progress.
- "Pause" (or "Resume" when paused) — ghost button, slate-700, border #d8ddd6.
- "Edit credentials" — ghost button, slate-700, border #d8ddd6. Opens a slide-in form or expands inline (see credential editing below).
- "Disconnect" — ghost button, red-600 text, border red-200. Opens a confirmation modal before disconnecting.

**Sync Job History zone:**

```
  Sync history
  ┌──────────────┬────────────┬──────────────────┬────────┐
  │ Date         │ Direction  │ Changes          │ Status │
  ├──────────────┼────────────┼──────────────────┼────────┤
  │ Today 14:32  │ ↕ Two-way  │ +3 ~1 −0         │ ✓      │
  │ Today 08:15  │ ↕ Two-way  │ +0 ~0 −0         │ ✓      │
  │ Yesterday    │ ↕ Two-way  │ +12 ~2 −1        │ ✓      │
  │ Jun 5        │ ↕ Two-way  │ —                │ ✗ Auth │
  └──────────────┴────────────┴──────────────────┴────────┘
  Show older →
```

- Section label: "Sync history" — 11px uppercase slate-400.
- Table: no outer border, rows separated by 1px slate-100 divider.
- Column widths: Date (auto), Direction (80px), Changes (120px), Status (60px).
- Date: 13px regular slate-600. Same-day entries show time only ("14:32"). Prior days show day name or date.
- Direction: small icon (↕ for two-way, ↓ for import, ↑ for export), 12px slate-500.
- Changes: format "+X ~Y −Z" where X=created, Y=updated, Z=deleted. 13px monospace or tabular numbers, slate-600. Show "—" if no changes.
- Status: ✓ in green-600, ✗ in red-600. On ✗, the cell is clickable and shows an error detail tooltip.
- Show 5 rows by default. "Show older →" text link below loads more (paginated, or infinite scroll within the panel).
- If no history: "No sync jobs yet. Click 'Sync now' to start." in slate-400, centered, 14px.

**Conflicts zone (conditional):**

Only appears if there are unresolved conflicts for this account.

```
  Open conflicts  (2)
  ┌────────────────────────────────────┬──────────────┐
  │ John Appleseed                     │ [Resolve →]  │
  │ Phone number conflict · Jun 5      │              │
  ├────────────────────────────────────┼──────────────┤
  │ Jane Doe                           │ [Resolve →]  │
  │ Email address conflict · Jun 3     │              │
  └────────────────────────────────────┴──────────────┘
```

- Section label: "Open conflicts" with a count badge (red circle, white number, 16px circle).
- Each row: contact name (14px semibold slate-800) + conflict description (13px slate-500) below it.
- "Resolve →" button on the right: 13px `#4158f4`, text link style with hover underline.
- Clicking "Resolve →" navigates to `/merge-suggestions/[id]` or a dedicated conflict resolution view.
- If zero conflicts: this section is hidden entirely (not shown as "0 conflicts").

---

### 3. Edit Credentials Flow

Triggered by "Edit credentials" button in the action bar.

The account header zone morphs into a form (inline expansion, not a modal):

```
┌──────────────────────────────────────────────────────────┐
│  Edit credentials                        [×]             │
│                                                          │
│  Label         [iCloud contacts          ]               │
│  Server URL    [https://contacts.icloud.com/…]          │
│  Username      [user@icloud.com           ]              │
│  Password      [••••••••••••••••          ] [show]       │
│                                                          │
│  [Test connection]                                       │
│                                                          │
│  [Save changes]     [Cancel]                             │
└──────────────────────────────────────────────────────────┘
```

- The form slides in from the right or fades in over the header zone (CSS transition, ~200ms).
- "Test connection" button: ghost style, tests the current form values against the server without saving. Returns a green "Connection successful" inline message or a red error.
- "Save changes": `#4158f4` bg, white, full-width or aligned to left. Disabled until test succeeds, OR allow save without test (the user can choose to proceed without testing).
- "Cancel": text link, closes the form and restores the account header view.

---

### 4. Add New Account Form

Appears in the right detail panel when "+ Add account" is clicked. The left column still shows the account list (with no item selected).

```
┌──────────────────────────────────────────────────────────┐
│  Add sync account                                        │
│                                                          │
│  Quick-connect                                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │  iCloud    │  │ Nextcloud  │  │  Fastmail  │         │
│  └────────────┘  └────────────┘  └────────────┘         │
│  ┌────────────┐                                          │
│  │  Manual    │                                          │
│  └────────────┘                                          │
│                                                          │
│  — or enter details manually —                           │
│                                                          │
│  Label         [                          ]              │
│  Server URL    [                          ]              │
│  Username      [                          ]              │
│  Password      [                          ] [show]       │
│                                                          │
│  [Test connection]                                       │
│                                                          │
│  [Connect]     [Cancel]                                  │
└──────────────────────────────────────────────────────────┘
```

**Quick-connect tiles:**
- 4 tiles in a 2×2 or horizontal row: iCloud, Nextcloud, Fastmail, Manual.
- Each tile: 80px wide, 64px tall, platform icon (32px) centered + label below (11px, slate-600).
- Clicking a tile pre-fills the Server URL with the canonical endpoint for that provider, and sets the Label. The user still fills in their credentials.
- "Manual" tile: no pre-fill. Label blank, URL blank.
- Selected tile gets a border: 2px `#4158f4`, background blue-50.

**Form fields:**
- Label, Server URL, Username, Password — standard input styling: border `#d8ddd6`, 12px radius, 44px height, 14px text.
- Password field has a show/hide toggle (eye icon, 16px, slate-400).
- All fields required. Inline validation on blur: red border + error text below field.

**Test connection button:**
- Ghost style, full-width or aligned left.
- States: idle ("Test connection"), loading (spinner + "Testing…"), success (green check + "Connection successful"), failure (red × + "Could not connect: [error message]").
- The test does a live round-trip from the server side.

**Connect button:**
- `#4158f4` bg, white, "Connect".
- Clicking saves the account and triggers a first sync. The right panel transitions to the account detail view for the new account. The left list adds the new account item.

---

## Health States (reference)

| State | Dot colour | Label text | Detail panel message |
|---|---|---|---|
| Healthy | Green #16a34a | Last synced N ago | "Connected — syncing normally" |
| Warning | Amber #d97706 | N ago | "3 consecutive sync failures — check credentials" |
| Error | Red #dc2626 | Error | "Last sync failed: [error type]" |
| Auth failed | Amber #d97706 | Auth error | "Re-authentication required. Update credentials." |
| Paused | Grey #94a3b8 | Paused | "Sync is paused. Click Resume to continue." |
| Never synced | Grey #94a3b8 | Never synced | "Click Sync now to start your first sync." |
| Syncing | Animated green | Syncing… | "Sync in progress…" — progress spinner in action bar |

---

## Empty State (no accounts)

When no accounts exist, the right panel is replaced by a full-width empty state centred in the page (or in the right column, which expands to fill the page on empty state).

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│              [cloud sync illustration]                   │
│                                                          │
│          Connect your first sync account                 │
│                                                          │
│  Kontax connects to your existing contacts services      │
│  via CardDAV, keeping everything in sync automatically.  │
│                                                          │
│  ┌────────┐  ┌───────────┐  ┌──────────┐                │
│  │ iCloud │  │ Nextcloud │  │ Fastmail │                │
│  └────────┘  └───────────┘  └──────────┘                │
│                                                          │
│            [+ Connect an account →]                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- Illustration: a minimal cloud with arrows (import/export direction) — a simple SVG, not a cartoon.
- Headline: 20px semibold, slate-800.
- Subtext: 14px regular, slate-500, max-width 380px centred.
- Provider tiles: same style as the add form quick-connect tiles.
- Primary CTA: "Connect an account →" — `#4158f4` bg, white text, rounded-xl, 44px height.
- Left column (account list) still renders but shows only the "+ Add account" row — it does not disappear.

---

## States

**Loading**
- Left column: 3 skeleton account items (icon circle + two bars).
- Right panel: skeleton header zone (two bars), skeleton table rows.

**Sync in progress**
- Account list item: the status dot pulses.
- Action bar: "Sync now" button is replaced by "Syncing…" with a spinner. It is disabled.
- History table: a new row appears at the top with status "In progress" and an animated spinner in the Status column.

**First-time flow (new account added, never synced)**
- After connecting, the detail panel shows: "Syncing for the first time…" with a progress bar if the count is known, or a spinner if not.
- On completion: transitions to the normal healthy state, history table shows one row.

**Re-auth required**
- The account item in the left list shows the amber dot and text "Re-auth required".
- The detail panel shows a prominent amber banner at the top: "Re-authentication required. Your credentials may have changed or expired." with an "Update credentials →" link that opens the edit credentials form.

**Disconnect confirmation modal**
- Title: "Disconnect [Account Name]?"
- Body: "Contacts synced from this account will remain in Kontax but will no longer sync. This cannot be undone without reconnecting."
- Two buttons: "Yes, disconnect" (red bg) and "Cancel" (ghost).

---

## Mobile Layout (< 768px)

The two-column layout collapses into a single-column flow:

**Screen 1: Account list view (default)**
- Full-width account list, same item design but full width.
- "+ Add account" at the bottom of the list.
- Tapping an account item navigates forward (push transition) to Screen 2.

**Screen 2: Account detail view**
- Full-width detail panel.
- A back button in the sub-header (or use the global header back affordance): "← Sync accounts".
- Action buttons wrap to a 2×2 grid if needed, or scroll horizontally.
- Sync history table: truncate columns. Show Date, Changes, Status. Direction is implied by the account's direction badge (shown in the header).
- Conflicts section: same, below history.

**Add account (mobile)**
- Triggered from the list view "+ Add account".
- Full-screen form. Quick-connect tiles are a 2×2 grid.
- Keyboard: Server URL input triggers URL keyboard. Username triggers email keyboard.

---

## Future Additions

### Phase 9 — Connect a Device (CardDAV Server)

This is the **inbound** counterpart: devices (iPhone, Android, macOS Contacts) connecting TO Kontax as a CardDAV server. It is completely separate from the client sync accounts above.

A section at the bottom of the page, below a horizontal divider:

```
────────────────────────────────────────────────────────

  Connect a device
  Add Kontax to your iPhone, Android, or macOS Contacts
  app. Your contacts stay in sync automatically.

  [iPhone]  [Android]  [macOS]

  App passwords                      [Generate password →]
  Device          Created    Last used
  iPhone 15       Jun 1      Today
  MacBook         May 28     Yesterday
                                     [Revoke]
```

- Design now: show this section as a placeholder card with the same lock / "Coming soon" treatment used in Settings.
- Label: "Connect a device"
- Description: "Use Kontax as your CardDAV contacts server for iPhone, Android, and macOS."
- State: lock icon + "Coming soon" badge. No interactive elements.
- When Phase 9 ships, this card expands in-place to show the full device connection UI, including platform setup guides and app password management.
