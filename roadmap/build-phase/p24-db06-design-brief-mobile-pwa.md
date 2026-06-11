# P24-DB06 — Design Brief: Mobile-First Layout, Interaction Patterns & PWA

## Purpose

This brief specifies the mobile-first layout, interaction patterns, and PWA installation experience for Kontax. P16-07 shipped a basic mobile fallback; this brief defines the v2 mobile experience — genuinely touch-optimized, with native-feeling navigation, swipe gestures, keyboard-aware forms, and an installable PWA shell.

## Background

Kontax's primary delivery mechanism on mobile is the web app + CardDAV (native device sync). A high-quality mobile web experience is essential: users will open Kontax on their phone to look up a contact while on a call, add a contact after meeting someone, or check sync status. The mobile experience must feel fast, comfortable in one hand, and never require zooming or precise tapping.

The locked design language (ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, surface `#f2f4f0`, brand green `#17352e`, CTA blue `#4158f4`, Geist) applies to all mobile surfaces.

---

## Scope

### In scope

1. Bottom navigation bar (mobile primary nav)
2. Contact list — touch targets, swipe actions, group headers
3. Contact detail — single-column mobile layout, floating edit button
4. Create/edit form — full-screen modal, collapsible sections, keyboard-aware scroll
5. Import/export on mobile — file picker, progress, compact result
6. PWA install prompt and offline state

### Out of scope

- Native iOS/Android apps — PWA is the delivery mechanism
- Dark mode (explicitly deferred in roadmap)
- Tablet-specific designs beyond what Phase 16 provides

---

## Design / Implementation Spec

### 1. Bottom Navigation Bar (≤ 767px)

Replaces the sidebar navigation on mobile. Fixed at the bottom of the viewport, above the safe area.

```
┌──────────────────────────────────────────────┐
│                                              │
│   [Contacts]  [Activity]  [Sync]  [Settings] │
│      ●                                       │
└──────────────────────────────────────────────┘
```

- **Height:** 56px + safe area inset (`padding-bottom: env(safe-area-inset-bottom)`).
- **Background:** `#ffffff`, `border-top: 1px solid #d8ddd6`. No shadow — border is sufficient.
- **4 tabs:** Contacts, Activity, Sync, Settings. Each tab: icon (24px Lucide) above label (10px, `font-weight: 600`). Vertical layout.
  - Contacts: `LayoutList` icon
  - Activity: `Activity` icon
  - Sync: `RefreshCcw` icon
  - Settings: `Settings` icon
- **Active tab:** icon and label in `#17352e` (brand green). Dot indicator: 4px circle in `#17352e`, 4px above the icon.
- **Inactive:** icon and label in `#8b938c`.
- **Badge:** unread notification count on the Activity tab (same red badge as the bell). Sync error count on the Sync tab.
- **Tap target:** each tab is full height of the bar, 1/4 of the width. Minimum 44×44px.

**Top header on mobile (contact list screen):**
- Height: 52px. Kontax wordmark left. Notification bell right (links to P22-02 bell dropdown, shown as a full-screen overlay on mobile). Search icon right of bell.
- No back button on the home screen. Back buttons appear on secondary screens (detail, settings sections).

---

### 2. Contact List — Touch Targets & Swipe Actions

**Row height:** 60px (was 48px compact on desktop). One-hand reachable.

**Tap target:** full row width, full row height. The star/favourite icon tap area is the rightmost 44px of the row.

**Swipe actions (right-to-left):**

```
  ← swipe left ────────────────────────────────
  [  ⭐ Favourite  |  🗑 Archive  ]  Contact name  →
```

- Reveal threshold: 40% of row width exposed → snap open; less → snap closed.
- **Favourite:** `background: #17352e`, white star icon. Toggles favourite immediately.
- **Archive:** `background: #b5472f`, white archive icon. Confirmation toast: "Contact archived. [Undo]"
- Both actions fire haptic feedback (if supported: `navigator.vibrate(10)`).

**Group headers (alphabetical):** 28px height, `background: #f2f4f0`, letter label `font-size: 11px`, `font-weight: 700`, `color: #8b938c`, left-padded 16px.

---

### 3. Contact Detail — Mobile Layout

Single column. No sidebar. Sticky header (name + avatar) scrolls away after 60px, then a compact fixed header appears:

```
Compact fixed header (appears on scroll):
┌──────────────────────────────────────────────┐
│  ← Back     Jane Smith          [Edit]       │
└──────────────────────────────────────────────┘
```

**Full header (initial):**
- Avatar: 64px circle, centred.
- Name: `font-size: 22px`, `font-weight: 700`, centred.
- Job/company: `font-size: 14px`, `color: #5c655e`, centred.
- Action row: Call, Message, Email, More — 4 icon buttons in a row.

**Fields sections:** full-width cards, `border-radius: 14px`, `border: 1px solid #d8ddd6`, `margin: 0 16px 12px`.

**Floating edit button (FAB):**
- Position: `fixed`, bottom 80px (above bottom nav), right 16px.
- 52px circle, `background: #17352e`, white `Pencil` icon.
- Shows only when not in a tab that has its own primary action.

**Tabs (Details / Sharing / History):** horizontal tab bar below the header, full-width. Tab labels in 14px. Active underline `#17352e`.

---

### 4. Create/Edit Form — Mobile

**Container:** full-screen bottom sheet that slides up from the bottom. Not a route change on mobile — an overlay over the current screen.

- Handle bar: 4px × 40px, `background: #d8ddd6`, centred at top, `margin: 8px auto 16px`.
- Close: × icon top-right, 44×44px tap target.
- Title: "New contact" or "Edit contact" — `font-size: 17px`, `font-weight: 700`, centred.

**Field sections:** collapsible (disclosure chevron on section header). Collapsed by default except Basic Info. Tap section header to expand.

```
▸ Basic Info   (expanded — always open)
  First name  [           ]
  Last name   [           ]
  Company     [           ]

▸ Phone numbers  (collapsed)
▸ Email addresses
▸ Addresses
▸ More (dates, notes, custom fields)
```

**Keyboard behaviour:**
- The sheet rises above the keyboard (`resize: none` on body; use `visualViewport` to track keyboard height and apply `padding-bottom` accordingly).
- The focused field is always scrolled into view — 24px above the keyboard edge.
- "Next" button on keyboard (iOS `returnKeyType="next"`) advances to the next field.

**Save button:** fixed at the bottom of the sheet, above the keyboard when open. Full width, `background: #4158f4`, `color: #fff`, "Save contact", `height: 48px`.

---

### 5. Import/Export on Mobile

**Import:**
- Drop zone replaced by a large "Choose file" button on mobile — `height: 56px`, `background: #4158f4`, `color: #fff`, folder icon + "Choose CSV file". Opens native file picker.
- Source profile chips: 2×2 grid (same as desktop).
- Step 2 preview table: horizontally scrollable; first 2 columns sticky (Name, Email); remaining columns scroll.

**Export:**
- Format selector unchanged (CSV / vCard radio).
- Export button triggers a browser download. On iOS Safari, the download appears in the Files app. Show a toast: "Your file has been saved to Downloads."

---

### 6. PWA Install Prompt & Offline State

**Install prompt:**
- Trigger: shown after the user's third session if they have not dismissed or installed before. Not shown on the first visit (avoids interrupting onboarding).
- Design: bottom sheet (same container as the edit form), not a browser native prompt.

```
┌──────────────────────────────────────────────┐
│        Add Kontax to your home screen        │
│                                              │
│  [App icon 64px]                             │
│  Kontax                                      │
│  kontax.app                                  │
│                                              │
│  Access your contacts instantly, even        │
│  without an internet connection.             │
│                                              │
│  [Install]          [Not now]               │
└──────────────────────────────────────────────┘
```

On iOS: "Install" triggers the standard iOS "Add to Home Screen" guidance (a bottom sheet explaining the Share → Add to Home Screen steps, since iOS cannot trigger installation programmatically).
On Android/Chrome: "Install" calls `deferredPrompt.prompt()` from the `beforeinstallprompt` event.

**Offline state:**
- Service worker caches the last contact list response.
- When offline, a banner appears at the top of the contact list: `background: #f6edd9`, "⚠ You're offline. Showing your last synced contacts."
- Search works against the cached list. Creating/editing contacts is disabled with a grey button and tooltip: "Changes require a connection."
- On reconnect: banner disappears, list refreshes automatically.

---

## Acceptance Criteria

- Designer can produce all mobile screen mockups without a follow-up meeting.
- All bottom navigation states (active, inactive, badge) are specified with exact token values.
- Swipe action thresholds and visual states (reveal, snap, confirmation) are specified.
- The contact detail compact header (on scroll), full header (initial), and FAB are all specified.
- The create/edit bottom sheet keyboard-avoidance behaviour is described.
- The PWA install prompt variants (iOS guidance vs Android programmatic) are specified.
- The offline state banner and disabled-edit states are specified.
- All tap target sizes meet the 44×44px minimum.
