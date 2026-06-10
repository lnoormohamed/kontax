# 07 — Sync Connections

**Route:** `/sync`
**Priority:** P1 — the core differentiator. Users who connect a CardDAV source get compound value from Kontax. The page must inspire confidence: green health dots, clear timestamps, no jargon beyond what is necessary.

> **Design decision locked (2026-06-10): light system.** This page uses the locked design language — ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, surface `#f2f4f0`, brand green `#17352e`, CTA blue `#4158f4`, Geist. The current build is on the old dark theme and needs replacing. **Phase 9 note:** inbound device connections (Kontax as CardDAV server + app passwords) shipped and live in **Settings** — not on this page. The "Connect a device" placeholder at the bottom of this brief is retired; the sync page covers outbound connections only.

---

## Purpose

The Sync Connections page lets a user manage their CardDAV client accounts — the external services that Kontax connects to in order to pull and push contacts. Examples: iCloud, Nextcloud, Fastmail, any CardDAV host. Each account has its own sync history, health status, and conflict queue.

This page covers **outbound connections from Kontax to other services**. Inbound device connections (devices connecting to Kontax's CardDAV server) are managed in **Settings → Device connections**.

The interaction model is a lightweight source manager: left column is the account list, right column is detail and actions.

---

## Layout (Desktop ≥ 1280px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER (sticky, shared global header)                               │
├──────────────────────────────────────────────────────────────────────┤
│  ← Back to contacts                                                  │
│                                                                      │
│  ┌────────────────────────┐  ┌───────────────────────────────────┐   │
│  │  ACCOUNT LIST          │  │  ACCOUNT DETAIL PANEL             │   │
│  │  (left column, sticky) │  │  (right column, scrollable)       │   │
│  │                        │  │                                   │   │
│  │  ┌──────────────────┐  │  │  Account name · URL               │   │
│  │  │ iCloud     ●     │  │  │  Direction badge · Health         │   │
│  │  └──────────────────┘  │  │  Last sync timestamp              │   │
│  │  ┌──────────────────┐  │  │  [Sync now] [Pause] [Edit] [Disc] │   │
│  │  │ Nextcloud  ●     │  │  │                                   │   │
│  │  └──────────────────┘  │  │  SYNC JOB HISTORY table          │   │
│  │  ┌──────────────────┐  │  │                                   │   │
│  │  │ Fastmail   ● err │  │  │  CONFLICTS (if any)               │   │
│  │  └──────────────────┘  │  │                                   │   │
│  │                        │  └───────────────────────────────────┘   │
│  │  + Add account         │                                          │
│  └────────────────────────┘                                          │
└──────────────────────────────────────────────────────────────────────┘
```

**Column proportions:** Left: 280px fixed. Right: fills remaining width, min 400px. Gap: 24px. Page padding: 32px each side. Max-width: 1200px centred.

**Tablet (768–1279px):** Left narrows to 240px. Below ~960px, stack vertically: account list full-width on top, detail below.

---

## Back link

`← Back to contacts` — `font-size: 14px`, `color: #5c655e`, `margin-bottom: 20px`.

---

## Key Components

### 1. Account List (left column)

```
┌────────────────────────────┐
│  SYNC ACCOUNTS             │  ← section label
│                            │
│  ┌──────────────────────┐  │
│  │ [☁] iCloud       ●  │  │  ← selected
│  │     2 min ago        │  │
│  └──────────────────────┘  │
│  ┌──────────────────────┐  │
│  │ [N] Nextcloud     ●  │  │
│  │     1 hour ago       │  │
│  └──────────────────────┘  │
│  ┌──────────────────────┐  │
│  │ [✉] Fastmail      ●  │  │  ← error state
│  │     Auth error       │  │
│  └──────────────────────┘  │
│                            │
│  + Add account             │
└────────────────────────────┘
```

**Section label:** "Sync accounts" — `font-size: 11px`, `font-weight: 700`, `letter-spacing: 0.1em`, `text-transform: uppercase`, `color: #8b938c`, `padding-bottom: 12px`.

**Account list item:** height 56px, full column width.
- **Left:** platform icon, 24×24px. iCloud: blue cloud. Nextcloud: green N. Fastmail: envelope. Generic: cloud in `#8b938c`. SVG only — no raster.
- **Centre:** name in `font-size: 14px`, `font-weight: 600`, `color: #1d2823` (truncated); timestamp / status string in `font-size: 12px`, `color: #8b938c` normally, `color: #b5472f` on error.
- **Right:** status dot, 8px circle.
  - Healthy: `#1f8a5b` (statusGreen)
  - Warning / needs attention: `#bf8526` (amber)
  - Error / auth failed: `#b5472f` (red)
  - Paused / grey: `#8b938c` (muted)
  - Syncing in progress: dot pulses (opacity 0.5–1, 2s loop)
- **Selected state:** `border-left: 3px solid #17352e`, `background: #e3efe7` (statusGreenWash).
- **Hover (unselected):** `background: #f2f4f0` (surface).

**"+ Add account":** below the list, 8px gap. `color: #4158f4`, `font-size: 14px`, `font-weight: 500`, `+` icon left. Hover: underline. Opens the Add Account form in the right panel.

---

### 2. Account Detail Panel (right column)

Four zones stacked vertically:

```
┌──────────────────────────────────────────────────────────┐
│  ACCOUNT HEADER                                          │
│  Name · URL · Direction badge · Health summary           │
│  Last synced: 2 minutes ago                              │
│                                                          │
│  [Sync now]  [Pause]  [Edit credentials]  [Disconnect]  │
├──────────────────────────────────────────────────────────┤
│  SYNC JOB HISTORY                                        │
├──────────────────────────────────────────────────────────┤
│  CONFLICTS (if any)                                      │
└──────────────────────────────────────────────────────────┘
```

**Account Header:**
- Account name: `font-size: 22px`, `font-weight: 600`, `color: #1d2823`.
- URL: `font-size: 13px`, `color: #8b938c`, truncated, copy icon on hover.
- **Direction badge:** pill, `font-size: 11px`, `font-weight: 600`, `border-radius: 999px`, `padding: 2px 10px`.
  - Two-way: `background: #e3efe7`, `color: #1c6b48` (statusGreenWash / statusGreenText)
  - Import only: `background: #f2f4f0`, `color: #5c655e`
  - Export only: `background: #f2f4f0`, `color: #5c655e`
- **Health summary:** `font-size: 13px`.
  - Healthy: `● Connected` — `color: #1f8a5b`
  - Warning: `● 3 consecutive failures` — `color: #bf8526`
  - Error: `● Authentication failed` — `color: #b5472f`
  - Paused: `● Paused` — `color: #8b938c`
  - Re-auth needed: `● Re-authentication required` — `color: #bf8526`
- Last sync: `font-size: 13px`, `color: #5c655e`.

**Action buttons:** horizontal row, `height: 34px`, `border-radius: 8px`, `font-size: 13px`, `font-weight: 600`.
- **Sync now:** `background: #4158f4`, `color: #fff`. Hover: `#3347d8`. Disabled + spinner while syncing.
- **Pause / Resume:** `border: 1px solid #d8ddd6`, `color: #1d2823`. Hover: `background: #f2f4f0`.
- **Edit credentials:** `border: 1px solid #d8ddd6`, `color: #1d2823`. Hover: `background: #f2f4f0`.
- **Disconnect:** `border: 1px solid #d8ddd6`, `color: #b5472f`. Hover: `background: #f3e1da`. Opens confirmation before disconnecting.

**Sync Job History:**

```
  SYNC HISTORY
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

- Section label: `font-size: 11px`, `font-weight: 700`, `letter-spacing: 0.1em`, `text-transform: uppercase`, `color: #8b938c`.
- No outer border. Rows divided by `1px solid #e9ece7`.
- Date: `font-size: 13px`, `color: #5c655e`.
- Direction: small icon (↕/↓/↑), `color: #8b938c`.
- Changes: "+X ~Y −Z" format, `font-size: 13px`, monospace (Geist Mono), `color: #5c655e`. "—" if none.
- Status: ✓ in `#1f8a5b`, ✗ in `#b5472f`. Clicking ✗ shows error tooltip.
- 5 rows default. "Show older →" text link, `color: #4158f4`.
- Empty: "No sync jobs yet. Click 'Sync now' to start." — `color: #8b938c`, centred.

**Conflicts (conditional — only if unresolved conflicts exist):**

```
  OPEN CONFLICTS  (2)
  ┌────────────────────────────────────┬──────────────┐
  │ John Appleseed                     │ [Resolve →]  │
  │ Phone number conflict · Jun 5      │              │
  ├────────────────────────────────────┼──────────────┤
  │ Jane Doe                           │ [Resolve →]  │
  │ Email address conflict · Jun 3     │              │
  └────────────────────────────────────┴──────────────┘
```

- Section label + count badge: `background: #b5472f`, `color: #fff`, 16px circle.
- Contact name: `font-size: 14px`, `font-weight: 600`, `color: #1d2823`. Conflict description: `font-size: 13px`, `color: #5c655e`.
- "Resolve →": `color: #4158f4`, text link, hover underline. Links to `/merge-suggestions/[id]`.
- Zero conflicts → section hidden entirely.

---

### 3. Edit Credentials (inline expansion)

Triggered by "Edit credentials". Morphs the account header zone into a form:

```
┌──────────────────────────────────────────────────────────┐
│  Edit credentials                           [×]           │
│  Label         [iCloud contacts            ]              │
│  Server URL    [https://contacts.icloud.com/…]           │
│  Username      [user@icloud.com            ]              │
│  Password      [••••••••••••••••           ] [show]       │
│                                                           │
│  [Test connection]                                        │
│  [Save changes]     [Cancel]                              │
└──────────────────────────────────────────────────────────┘
```

- Slide-in / fade-in over the header zone, ~200ms.
- Fields: `height: 44px`, `border-radius: 12px`, `border: 1px solid #d8ddd6`. Focus: `border-color: #4158f4`, `box-shadow: 0 0 0 3px rgba(65,88,244,0.18)`.
- **Test connection:** `border: 1px solid #d8ddd6`, full-width or left-aligned. States: idle → spinner "Testing…" → green "Connection successful" (`color: #1f8a5b`) / red error (`color: #b5472f`).
- **Save changes:** `background: #4158f4`, `color: #fff`.
- **Cancel:** `color: #5c655e`, text button.

---

### 4. Add New Account Form

Appears in the right detail panel when "+ Add account" is clicked:

```
┌──────────────────────────────────────────────────────────┐
│  Add sync account                                         │
│                                                           │
│  Quick-connect                                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│  │   iCloud   │  │ Nextcloud  │  │  Fastmail  │          │
│  └────────────┘  └────────────┘  └────────────┘          │
│  ┌────────────┐                                           │
│  │   Manual   │                                           │
│  └────────────┘                                           │
│                                                           │
│  Label         [                           ]              │
│  Server URL    [                           ]              │
│  Username      [                           ]              │
│  Password      [                           ] [show]       │
│                                                           │
│  [Test connection]                                        │
│  [Connect]     [Cancel]                                   │
└──────────────────────────────────────────────────────────┘
```

**Quick-connect tiles:** 80×64px each. Platform icon (32px) + label (11px, `color: #5c655e`). `border: 1px solid #d8ddd6`, `border-radius: 10px`, `background: #fff`. Hover: `background: #f2f4f0`. Selected: `border: 2px solid #4158f4`, `background: #edf0fe`.

**Form fields:** same as edit credentials above.

**Connect:** `background: #4158f4`, `color: #fff`, "Connect". Triggers first sync and transitions to the new account's detail view.

---

## Health States (reference)

| State | Dot | Label text | Detail message |
|---|---|---|---|
| Healthy | `#1f8a5b` | Last synced N ago | "Connected — syncing normally" |
| Warning | `#bf8526` | N ago | "3 consecutive sync failures" |
| Error | `#b5472f` | Error | "Last sync failed: [error]" |
| Auth failed | `#bf8526` | Auth error | "Re-authentication required" |
| Paused | `#8b938c` | Paused | "Sync is paused. Click Resume." |
| Never synced | `#8b938c` | Never synced | "Click Sync now to start." |
| Syncing | `#1f8a5b` pulsing | Syncing… | "Sync in progress…" |

---

## Empty State (no accounts)

Full-width centred (replaces detail panel):

- Icon: minimal cloud-sync SVG, 48px, `color: #d8ddd6`.
- Headline: "Connect your first sync account" — `font-size: 20px`, `font-weight: 600`, `color: #1d2823`.
- Subtext: "Kontax connects to your existing contacts services via CardDAV, keeping everything in sync automatically." — `font-size: 14px`, `color: #5c655e`, max-width 380px centred.
- Quick-connect tiles (iCloud, Nextcloud, Fastmail) — same style as Add form.
- CTA: `background: #4158f4`, `color: #fff`, "Connect an account →", `height: 44px`, `border-radius: 10px`.
- Left column still renders (shows only "+ Add account").

---

## States

**Loading:** Skeleton account items (circle + two bars). Skeleton header zone + table rows. Skeleton `background: #f2f4f0`, animated shimmer.

**Sync in progress:** Dot pulses. "Sync now" → "Syncing…" + spinner (disabled). New history row at top: "In progress" + spinner in Status column.

**First-time sync:** "Syncing for the first time…" with progress bar if count known, spinner if not. Completes → healthy state.

**Re-auth required:** Amber dot in list. Amber banner at top of detail panel: `background: #f6edd9`, `border: 1px solid #e9ece7`, `color: #7a5a1a`. "Re-authentication required." + "Update credentials →" link.

**Disconnect confirmation:**
- Title: "Disconnect [Account Name]?" — `font-size: 17px`, `font-weight: 700`, `color: #1d2823`.
- Body: "Contacts synced from this account will remain in Kontax but will no longer sync." — `color: #5c655e`.
- "Yes, disconnect": `background: #b5472f`, `color: #fff`. "Cancel": `color: #5c655e`, text.

---

## Mobile Layout (< 768px)

**Screen 1 — Account list (default):** Full-width items. "+ Add account" at bottom. Tap → navigate to Screen 2.

**Screen 2 — Account detail:** Full-width panel. Back button "← Sync accounts" in sub-header. Action buttons wrap 2×2.

**Add account (mobile):** Full-screen form. Quick-connect tiles in 2×2 grid.

---

## Future Additions

### Sync frequency controls
A "Sync every N hours" or "Manual only" selector per account. Inserts in the account header zone below the action buttons.

### Conflict queue page
When conflicts are numerous, a dedicated `/sync/conflicts` page lists all conflicts across all accounts. The conflicts section in the detail panel links to it.
