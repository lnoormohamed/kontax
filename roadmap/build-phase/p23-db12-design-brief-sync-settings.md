# P23-DB12 — Design Brief: Sync Connection Advanced Settings

## Purpose

This brief specifies the visual design and interaction patterns for Phase 23's sync settings surfaces: the gear icon trigger on connection cards, the settings drawer within the connection detail panel, the book allowlist selector, the manual conflict resolution queue, and the re-authentication confirmation modal. It extends the existing sync connections design (`07-sync-connections.md`) and must integrate seamlessly into the existing detail panel layout.

## Background

The `07-sync-connections.md` brief locked the connection list, detail panel, sync history table, and the edit credentials form. Phase 23 adds a second configurable zone to the detail panel: **Connection settings** — below the action buttons and above the sync history. The existing panel zones are not redesigned; settings are additive.

The locked design language applies: ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, surface `#f2f4f0`, brand green `#17352e`, CTA blue `#4158f4`, Geist.

---

## Scope

### In scope

1. Gear icon placement and trigger state on connection list cards
2. Connection settings zone within the detail panel
3. Sync direction radio group
4. Conflict policy radio group
5. Sync frequency dropdown
6. Book allowlist sub-section (collapsed/expanded)
7. Manual conflict queue rows with field comparison resolver
8. Re-authentication modal (password confirmation)

### Out of scope

- The existing credential edit form (unchanged from `07-sync-connections.md`)
- The Add account form (unchanged)
- OAuth-specific UI (Phase 27, P27-DB08)

---

## Design / Implementation Spec

### 1. Gear Icon on Connection Cards

The gear icon appears on the right side of each account list item on hover (desktop) or always visible on mobile.

```
┌──────────────────────────────────────────────────────┐
│  [☁]  iCloud                   ●         [⚙]        │
│       2 minutes ago                                   │
└──────────────────────────────────────────────────────┘
```

- Icon: `Settings` Lucide, 14px, `color: #8b938c`
- Hover state: `color: #1d2823`, `background: #f2f4f0`, `border-radius: 6px`, `padding: 4px`
- Tap/click: selects the account AND scrolls the right panel to the settings zone, expanding it if collapsed
- Position: rightmost element in the row, 36×36px tap target

### 2. Connection Settings Zone

Inserted between the action buttons and the sync history table in the detail panel. Collapsed by default; expanded by the gear icon click.

```
┌─────────────────────────────────────────────────────────────────┐
│  CONNECTION SETTINGS                                 [▾]  [▴]  │  ← toggle
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Sync direction                                                  │
│  ● Two-way        Contacts sync in both directions               │
│  ○ Import only    Kontax pulls from remote, never pushes        │
│  ○ Export only    Kontax pushes to remote, ignores changes       │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Conflict resolution                                             │
│  ● Server wins    Remote changes take precedence (recommended)   │
│  ○ Kontax wins    Local changes take precedence                  │
│  ○ Review manually   Create a review queue for each conflict     │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Sync frequency                                                  │
│  [Every 60 minutes ▾]                                           │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Address books                                                   │
│  All books synced ›                          [▾ Change]         │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  [Save settings]                              [Cancel]          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Section label:** "CONNECTION SETTINGS" — `font-size: 11px`, `font-weight: 700`, uppercase, `#8b938c`, `letter-spacing: 0.08em`. Right-aligned chevron toggles collapsed/expanded state.

**Collapsed state:** the zone shows only the label row and a summary of current settings (e.g., "Two-way · Server wins · 60 min"). Expanding reveals the full controls.

**Radio group styling:**
- Label: `font-size: 14px`, `font-weight: 600`, `color: #1d2823`, `margin-bottom: 10px`
- Option row: `height: 44px`. Radio: 18px, active fill `#4158f4`. Option name: `font-size: 14px`, `color: #1d2823`. Description: `font-size: 12px`, `color: #8b938c`, on the same line after a `·` separator.

**"Export only" direction warning:**
When "Export only" is selected, show an inline amber warning below the option:
```
  ⚠ Remote changes will be ignored. Make sure Kontax is your authoritative source.
```
`background: #fffbeb`, `border-left: 3px solid #d97706`, `padding: 8px 12px`, `font-size: 12px`, `color: #92400e`.

**Sync frequency dropdown:**
`height: 36px`, `border-radius: 8px`, `border: 1px solid #d8ddd6`, `font-size: 14px`. Options: Every 15 min / 30 min / 60 min / 6 hours / Manual only.

**Save / Cancel buttons:**
- "Save settings": `background: #4158f4`, `color: #fff`, `height: 36px`, `border-radius: 8px`, `font-size: 13px`, `font-weight: 600`
- "Cancel": `color: #5c655e`, text button
- These appear at the bottom of the zone only when changes have been made (dirty state). When clean: buttons hidden, zone shows "Settings saved" confirmation for 2 seconds on save.

---

### 3. Book Allowlist Sub-Section

Triggered by clicking "Address books" row's "Change" button. The sub-section expands inline within the settings zone.

```
  Address books
  ─────────────────────────────────────────────────────
  Sync all address books     [toggle — off]

  Custom selection
  ☑  Personal              (default)
  ☑  Work contacts
  ☐  Subscriptions (read-only on remote)     [lock icon]
  ☐  Shared family

  [Refresh list]

  Note: unchecked books will have their contacts archived in Kontax.
```

**Toggle styling:** same as the preference settings toggles (P22-DB05). When "Sync all" is ON (green toggle), checkboxes are `opacity: 0.45`, non-interactive.

**Book rows:**
- `height: 40px`. Checkbox left, book name centre, optional `(read-only)` note in `#8b938c` 12px, optional lock icon 12px right.
- Read-only books: shown with a `Lock` icon 12px `#8b938c` and `(read-only on remote)` note. Cannot be unchecked for export — export direction is automatically `IMPORT_ONLY` for these.

**"Refresh list" link:** `color: #4158f4`, `font-size: 13px`. Spinner replaces text while refreshing.

**Archive warning note:** `font-size: 12px`, `color: #8b938c`, `font-style: italic`. Only shown when at least one currently-synced book is being unchecked.

---

### 4. Manual Conflict Queue

Shown as a section in the detail panel (between Connection Settings and Sync History) **only when there are OPEN conflict rows**. Matches the conflicts specification in `07-sync-connections.md`.

```
OPEN CONFLICTS  (3)  ●  3
─────────────────────────────────────────────────────────────────

  John Appleseed · phone number · Jun 5                 [▾ Review]
  ── (expanded) ──────────────────────────────────────────────────
    Field          Kontax (local)         Remote (iCloud)
    ──────────────────────────────────────────────────────
    Phone          +1 415 555 0100       +1 415 555 0199
                   (last edited Jun 1)   (last edited Jun 5)

    [ Keep local ]   [ Keep remote ]   [ Manual merge → ]
  ── ────────────────────────────────────────────────────────────

  Jane Doe · email address · Jun 3                       [▾ Review]
```

**Conflict count badge:** `background: #b5472f`, `color: #fff`, 18px circle — same pattern as the notification bell badge.

**Row (collapsed):** contact name `font-size: 14px`, `font-weight: 600`; conflict summary ("phone number · Jun 5") `font-size: 12px`, `color: #8b938c`; "Review" link `color: #4158f4`, `font-size: 13px`.

**Resolver (expanded):**
- Comparison table: `font-size: 13px`. Column headers: `font-size: 11px`, uppercase, `color: #8b938c`. Differing values: subtle `background: #fffbeb` tint on cells with differences.
- "Last edited" metadata: `font-size: 11px`, `color: #8b938c`, below each value cell.
- Outcome buttons: `height: 34px`, `border-radius: 8px`, `font-size: 13px`, `font-weight: 600`. Keep local / Keep remote: `border: 1px solid #d8ddd6`, `color: #1d2823`. Manual merge →: `background: #4158f4`, `color: #fff`.

**Auto-pause banner** (when queue reaches 50):
```
┌──────────────────────────────────────────────────────────────────┐
│  ⚠  Sync paused — conflict queue is full (50 conflicts)         │
│  Review and resolve conflicts to resume automatic sync.          │
└──────────────────────────────────────────────────────────────────┘
```
`background: #f6edd9`, `border: 1px solid #fcd34d`, `border-radius: 10px`.

---

### 5. Re-Authentication Modal

Triggered when "Save settings" is clicked without a valid elevation token.

```
┌──────────────────────────────────────────────────────┐
│  Confirm your password                               │
│                                                      │
│  Sync connection settings are sensitive. Enter        │
│  your Kontax password to continue.                    │
│                                                      │
│  Password  [•••••••••••••••            ]             │
│                                                      │
│  ⚠ Incorrect password          (error state only)   │
│                                                      │
│  [Cancel]      [Confirm]                             │
└──────────────────────────────────────────────────────┘
```

- Modal: `max-width: 400px`, `border-radius: 16px`, `padding: 28px 32px`
- Body copy: `font-size: 14px`, `color: #5c655e`
- Input: same field spec as P26-02 (login page). `height: 44px`, `border-radius: 12px`.
- Error state: `border-color: #b5472f` on input; error text `font-size: 12px`, `color: #8f3320` below input.
- Confirm button: `background: #4158f4`, `color: #fff`. Loading spinner while verifying.
- Success: modal closes, settings save proceeds — no success message needed.
- Elevation is good for 15 minutes; modal does not reappear for subsequent saves within the window.

---

## Acceptance Criteria

- Designer can produce all 5 surfaces without a follow-up meeting.
- The gear icon placement, hover state, and tap target size are specified.
- The settings zone's collapsed summary and expanded state are both specified.
- The "Export only" amber warning block is specified.
- Both book allowlist states (Sync all / Custom selection) are fully specified.
- Read-only remote book treatment is specified.
- Conflict resolver row anatomy (collapsed, expanded, all 3 outcome buttons) is specified.
- Auto-pause banner is specified.
- Re-auth modal error state is specified.
- Mobile: settings zone is full-width; conflict resolver rows stack field/local/remote vertically.

---

## As-Built Notes (Phase 23 implementation)

Cross-checked against the shipped UI (`src/app/sync/_components/sync-page-client.tsx`) at the end of Phase 23. All 5 surfaces were built to spec; the items below are the only points where the implementation departs from this brief. Recorded here so the brief reflects what actually ships.

### Deliberate deviations
- **Book allowlist archive note** — brief copy "unchecked books will have their contacts archived in Kontax" was changed to "unchecked books will no longer sync into Kontax." The live CardDAV slice syncs one address book per account and contacts carry no per-book source, so nothing is actually archived (see P23-03). Copy follows the real behaviour.
- **Allowlist has its own "Save books" button** — the brief mock implies the single "Save settings" commits book changes too. Implementation follows the P23-03 ticket, which defines a separate `updateBookAllowlist` server action, so the allowlist sub-section saves independently of direction/policy/frequency.
- **Read-only remote books** — the lock + "(read-only on remote)" treatment and the auto-`IMPORT_ONLY` rule are wired, but remote read-only detection is stubbed `false` (needs a `current-user-privilege-set` PROPFIND not yet in the discovery body, per P23-03), so no discovered book currently reports as read-only.

### Minor cosmetic trims (intentional, low-impact)
- **"Settings saved" inline confirmation** is not held for the spec'd 2 seconds — saving triggers `router.refresh()`, which re-seeds the zone and clears the pill almost immediately. The bottom toast "Settings saved" (≈3.2s) already provides the feedback, so the inline pill is redundant rather than missing.
- **Auto-pause banner headline** omits the literal "(50 conflicts)" count; the count surfaces in the account's health-detail line instead. Banner colours/shape match the brief exactly.

### Conformance fix applied during review
- **Gear tap target** was initially 28×28; corrected to the spec'd **36×36** (hover `#f2f4f0`, 14px `Settings` icon, `#8b938c`). Row right-padding bumped to 48px to clear it.
