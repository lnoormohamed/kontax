# P22-DB05 — Design Brief: Notification Settings & Suspicious Activity UI

## Purpose

This brief specifies the visual design and interaction patterns for all Phase 22 notification surfaces: the in-app notification bell and dropdown feed, the notification preference settings panel, the persistent security alert banner, and the activity anomaly detail drawer. These surfaces collectively form Kontax's alert layer — they must be noticeable when something genuinely needs attention, and invisible when everything is fine.

## Background

Phase 22 introduces the first proactive communications from Kontax to the user. Unlike the activity log (reactive — the user pulls information), notifications push information to the user. The design must balance urgency (don't miss a security alert) against noise (don't interrupt normal usage with billing reminders). The locked design language applies throughout.

---

## Scope

### In scope

1. Notification bell icon + unread count badge (in the app header)
2. Notification dropdown feed
3. Notification preference settings page (`/settings/notifications`)
4. Security alert banner (on the contacts workspace)
5. Activity anomaly detail drawer

### Out of scope

- Email notification templates (Phase 20, P20-07/08)
- Digest email (Phase 22, P22-08)

---

## Design / Implementation Spec

### 1. Notification Bell (App Header)

The bell icon sits in the app header to the right of the search bar.

**Resting state (no unread):**
- `Bell` Lucide icon, 20px, `color: #5c655e`
- No badge

**Unread state:**
```
  🔔 ⬤3
```
- Same bell icon
- Badge: 18×18px circle, `background: #b5472f` (red), `color: #ffffff`, `font-size: 11px`, `font-weight: 700`
- Badge position: top-right of the icon, offset 6px up and 6px right
- Count display: `1`–`9` as a digit; `9+` for 10 or more
- Animate: badge fades in when count changes from 0 → N (opacity 0→1, 200ms)

**Hover:** bell icon `color: #1d2823`; cursor pointer.

**Active (dropdown open):** bell icon `color: #17352e` (brand green); a `2px solid #17352e` underline or selected state.

---

### 2. Notification Dropdown Feed

Opens below the bell on click. Width: 360px. Max-height: 480px (scrollable). `border-radius: 14px`, `border: 1px solid #d8ddd6`, `box-shadow: 0 8px 32px rgba(29,40,35,0.12)`, `background: #ffffff`.

```
┌───────────────────────────────────────────┐
│  Notifications        [Mark all as read]  │  ← header, 44px
├───────────────────────────────────────────┤
│  [🛡] Unusual activity detected    2m ago │  ← unread (tinted)
│       A new device signed into your…      │
├───────────────────────────────────────────┤
│  [↓] Jane Smith shared a contact  1h ago  │  ← unread
│      "Bob Jones" was shared with you.     │
├───────────────────────────────────────────┤
│  [💳] Payment failed              2d ago  │  ← read (no tint)
│       We couldn't process your payment…   │
├───────────────────────────────────────────┤
│  [🔁] Sync error — iCloud          3d ago │
│       Re-authentication required.         │
├───────────────────────────────────────────┤
│                                           │
│            No more notifications          │
│                                           │
├───────────────────────────────────────────┤
│  Notification settings →                 │  ← footer, 40px
└───────────────────────────────────────────┘
```

**Header row:** "Notifications" — `font-size: 14px`, `font-weight: 700`, `color: #1d2823`. "Mark all as read" — `font-size: 13px`, `color: #4158f4`, right-aligned. Hidden when no unread notifications.

**Notification row:**
- Height: 72px
- Left: category icon 32×32px tile, `border-radius: 8px`, icon 16px. Background tints per category (see below).
- Centre: title (`font-size: 13px`, `font-weight: 600`, `color: #1d2823`, one line) + body (`font-size: 12px`, `color: #5c655e`, two lines, truncated with ellipsis).
- Right: relative timestamp (`font-size: 11px`, `color: #8b938c`) + dismiss `×` button (appears on row hover, `color: #8b938c`, 20×20px tap target).
- **Unread row tint:** `background: #f9faf8` (barely perceptible — the emphasis is in the bold title, not a heavy background colour).
- **Read row:** white background.
- Row divider: `1px solid #f2f4f0`.
- On click: marks as read; if `actionUrl` is set, navigates there.

**Category icon tiles:**

| Category | Background | Icon | Colour |
|---|---|---|---|
| SECURITY | `#fef2f2` (red-50) | `ShieldAlert` | `#dc2626` |
| SHARING | `#f0fdf4` (green-50) | `ArrowDownLeft` | `#16a34a` |
| SYNC_STATUS | `#faf5ff` (purple-50) | `RefreshCcw` | `#9333ea` |
| BILLING | `#fffbeb` (amber-50) | `CreditCard` | `#d97706` |
| REMINDERS | `#eff6ff` (blue-50) | `Cake` | `#2563eb` |
| PRODUCT_UPDATES | `#f0fdfa` (teal-50) | `Sparkles` | `#0d9488` |

**Empty state:**
```
  [Bell icon, 32px, #d8ddd6]
  No notifications
  (centred, 100px height, #8b938c 13px)
```

**Footer row:** "Notification settings →" — `font-size: 13px`, `color: #4158f4`. Full-width, `border-top: 1px solid #f2f4f0`, height 40px, centred.

---

### 3. Notification Preference Settings (`/settings/notifications`)

Single-column, max-width 600px, inside the standard settings shell.

```
Notifications
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Security alerts
Always sent — cannot be disabled.
  In-app  ☑ (grey, locked)    Email  ☑ (grey, locked)

────────────────────────────────────────────────

Contact sharing
  In-app  [toggle ✓]          Email  [toggle ✓]

────────────────────────────────────────────────

Sync status
  In-app  [toggle ✓]          Email  [toggle ✓]

────────────────────────────────────────────────

Billing
Always sent — cannot be disabled.
  In-app  ☑ (grey, locked)    Email  ☑ (grey, locked)

────────────────────────────────────────────────

Birthday & anniversary reminders
  In-app  [toggle ✓]          Email  [toggle off]

────────────────────────────────────────────────

Product updates
  In-app  [toggle ✓]          Email  [toggle off]

────────────────────────────────────────────────

Email digest
Instead of individual emails, receive a summary.
  ○ No digest
  ○ Daily digest   (sent at 8:00 AM UTC)
  ○ Weekly digest  (sent Monday at 8:00 AM UTC)
```

**Section layout:**
- Category name: `font-size: 14px`, `font-weight: 600`, `color: #1d2823`
- "Always sent" label: `font-size: 12px`, `color: #8b938c`, `margin-top: 2px`
- Toggle row: `height: 44px`. "In-app" and "Email" labels: `font-size: 13px`, `color: #5c655e`. Toggles: 36×20px, `border-radius: 10px`. On: `background: #17352e`. Off: `background: #d8ddd6`.
- Locked toggles: `opacity: 0.45`, `cursor: not-allowed`. Tooltip on hover: "Security and billing alerts cannot be disabled."
- Divider between sections: `1px solid #f2f4f0`.

---

### 4. Security Alert Banner

Shown at the top of the contacts workspace (below any grace-period billing banner) when there are unread `SECURITY` category notifications.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [🛡]  Security alert: A new device signed into your account.                │
│        [View details]   [That was me]   [Wasn't me — secure my account]      │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Banner styling:**
- `background: #fef2f2` (red-50)
- `border-bottom: 1px solid #fecaca` (red-200)
- `border-left: 4px solid #dc2626` (red-600)
- Padding: `12px 16px`
- `ShieldAlert` icon: 16px, `color: #dc2626`, left of the text, `flex-shrink: 0`
- Alert text: `font-size: 14px`, `font-weight: 600`, `color: #991b1b` (red-800)
- Alert body (summary): `font-size: 13px`, `color: #991b1b`

**Action buttons (inline, right side of banner):**
- "View details": `color: #4158f4`, `font-size: 13px`, `font-weight: 500`, text button with underline on hover
- "That was me": same style, `color: #5c655e`
- "Wasn't me — secure my account": same style, `color: #dc2626`
- Button dividers: `·` separator between buttons, `color: #fecaca`

**Multiple alerts (count > 1):**
```
│  [🛡]  Security alert (1 of 3): A new device signed into your account.      │
│        [View details]  [That was me]  [Wasn't me]  [◀ ▶]                    │
```
"◀ ▶" arrows: 20×20px, `color: #dc2626`. Navigate through alert stack. The current alert index is shown "(N of M)".

**Dismissed state:** banner slides up (translateY(-100%), 200ms ease-in) then is removed from DOM.

---

### 5. Activity Anomaly Detail Drawer

A slide-over panel from the right, 480px wide, full-height. Triggered by "View details" on the security alert banner.

```
┌────────────────────────────────────────────────────────────┐
│  [×]                                                        │
│                                                             │
│  [🛡 ShieldAlert, 24px, red]                               │
│  Security Alert — Bulk Contact Delete                       │  ← title
│  June 11, 2026 at 14:32 UTC                                │  ← timestamp
│                                                             │
│  ─────────────────────────────────────────────────────      │
│                                                             │
│  What happened                                              │  ← section label
│  13 contacts were deleted in the last 60 seconds.          │  ← body text
│                                                             │
│  Affected contacts                                          │  ← section label
│  [trash icon] "Jane Smith" deleted  ·  2:32 PM             │
│  [trash icon] "Bob Jones" deleted   ·  2:32 PM             │
│  [trash icon] "Alice Wu" deleted    ·  2:32 PM             │
│  … and 10 more                                              │
│                                                             │
│  ─────────────────────────────────────────────────────      │
│                                                             │
│  [That was me — dismiss]                                    │
│  [Wasn't me — secure my account]                           │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**Drawer styling:**
- `background: #ffffff`, `border-left: 1px solid #d8ddd6`
- Backdrop: `rgba(29,40,35,0.4)`, closes drawer on click
- `[×]` close button: top-left, 32×32px
- Title: `font-size: 20px`, `font-weight: 700`, `color: #1d2823`, `margin-top: 16px`
- Timestamp: `font-size: 13px`, `color: #8b938c`
- Section labels: `font-size: 11px`, `font-weight: 700`, uppercase, `color: #8b938c`, `letter-spacing: 0.06em`
- Event rows: `font-size: 13px`, `color: #5c655e`. Icon 14px `color: #8b938c`. Timestamp `color: #8b938c`.
- "…and N more": `font-size: 13px`, `color: #8b938c`, `font-style: italic`

**Action buttons (bottom, fixed):**
- "That was me — dismiss": `border: 1px solid #d8ddd6`, `color: #1d2823`, full-width, `height: 44px`, `border-radius: 10px`
- "Wasn't me — secure my account": `background: #dc2626`, `color: #ffffff`, full-width, `height: 44px`, `border-radius: 10px`, `margin-top: 8px`

**For new device login alerts, show device/IP block instead of event list:**
```
  Device info
  Device:      Chrome on macOS
  IP address:  91.108.4.5
  Time:        June 11, 2026 at 14:32 UTC
```
Same `background: #f4f6f2`, `border-radius: 8px`, `padding: 12px 16px` detail block pattern used elsewhere.

---

## Acceptance Criteria

- Designer can produce all 5 surfaces without a follow-up meeting.
- Bell badge colours, count formatting (1–9 / 9+), and animation are specified.
- All 6 category icon tile colour combinations are specified with exact hex values.
- The notification row unread vs read visual difference is specified.
- All preference settings states (active, disabled/locked, digest cadence) are specified.
- Security alert banner variants (single alert, multiple alerts with nav) are specified.
- Both drawer variants (bulk-delete with event list / new-device with IP block) are specified.
- All interactive states (hover, dismiss animation, loading) are documented.
- Mobile: dropdown becomes a full-screen bottom sheet; drawer becomes full-screen.
