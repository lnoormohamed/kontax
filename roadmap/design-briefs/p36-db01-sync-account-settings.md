# P36-DB01 — Sync Account Settings (Edit Sync Options)

**Surface:** Settings panel within `/sync` account detail  
**Trigger:** "Settings" button in the account action row  
**Priority:** P1 — directional control, frequency, and safety rails are core to user trust.

> **Status — built (2026-06-19).** Implemented in
> [`connection-settings.tsx`](../../src/app/sync/_components/connection-settings.tsx)
> (extracted from `sync-page-client.tsx`) backed by the
> `updateSyncAccountSettings` server action. The `[Settings]` action-row button
> opens a dedicated panel that takes over the detail zone — mutually exclusive
> with the Edit-credentials form. Sections §1–§4 (direction, frequency, conflict
> policy, address books) originally shipped in **Phase 23** and are reused here;
> §5–§11 (the **Advanced** block) plus the new `SyncAccountSettings` columns are
> the net-new P36 work. **Runner enforcement** of the advanced fields (sync
> window, deletion threshold, field exclusions, export filter, etc.) is separate
> follow-up — see "Runner integration notes" at the end. **All P36 follow-ups
> (runner enforcement, dirty guard, mobile bottom sheet) are ticketed as
> [Phase 39](../build-phase/phase-39.md).**

---

## Context

Each `SyncAccount` has a companion `SyncAccountSettings` row (lazy-created on first save) with the following user-facing controls:

| Field | Type | Default |
|---|---|---|
| `syncDirection` | `TWO_WAY \| IMPORT_ONLY \| EXPORT_ONLY` | `TWO_WAY` |
| `syncFrequencyMinutes` | `Int?` | `null` = plan default; `0` = manual only |
| `conflictPolicy` | `SERVER_WINS \| DEVICE_WINS \| MANUAL` | `SERVER_WINS` |
| `bookAllowlist` | `String[]` | `[]` = all books |
| `importLabelId` | `String?` | `null` = none |
| `maxDeletionsThreshold` | `Int?` | `null` = disabled |
| `notifyOnFailure` | `Boolean` | `true` |
| `syncWindowStart` | `Int?` | `null` = no restriction |
| `syncWindowEnd` | `Int?` | `null` = no restriction |
| `excludedFields` | `String[]` | `[]` = sync all fields |
| `exportLabelFilter` | `String[]` | `[]` = push all contacts |
| `maxAttemptsBeforePause` | `Int?` | `null` = platform default (5) |

`requireReauthToEdit` is a security gate enforced by `SyncSettingsElevation` — it is not user-configurable in this panel.

---

## Placement in the detail panel

Action row after this feature:

```
[Sync now]  [Pause]  [Settings]  [Edit credentials]  [Disconnect]
```

**"Settings"** opens the settings panel, which **takes over the detail zone**
(replacing the account header / history / conflicts while open), mirroring how
the Edit-credentials form behaves. "Settings" and "Edit credentials" are
**mutually exclusive** — opening one closes the other. The same panel opens from
the gear icon on a list-rail row (selects that account first). Closing the panel
([×] or Cancel) returns to the normal detail view.

The panel header shows **"Sync settings"** with the account's email (OAuth) or
label (CardDAV) beneath it, so the user knows which connection they're editing,
and a **[×]** close on the right.

---

## Settings Panel Layout

```
┌──────────────────────────────────────────────────────────┐
│  Sync settings                                      [×]  │
│  li@kontax.io                                            │  ← account email / label
├──────────────────────────────────────────────────────────┤
│                                                          │
│  DIRECTION                                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ● Two-way          Push and pull changes         │   │
│  │ ○ Import only      Pull from remote, read-only   │   │
│  │ ○ Export only      Push to remote only           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  SYNC FREQUENCY                                          │
│  [ Every 30 minutes                               ▾ ]   │
│                                                          │
│  CONFLICT POLICY                          (if two-way)   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ● Remote wins      Remote change always applies  │   │
│  │ ○ Kontax wins      Local change always applies   │   │
│  │ ○ Ask me           Queue for manual review       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ADDRESS BOOKS                            (CardDAV only) │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ☑ Personal (default)                             │   │
│  │ ☑ Work                                           │   │
│  │ ☐ Shared (read-only)                             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ─── Advanced ──────────────────────────────────────    │
│                                                          │
│  AUTO-LABEL ON IMPORT                                    │
│  [ No label                                       ▾ ]   │
│                                                          │
│  DELETION SAFETY                                         │
│  Pause if a sync would delete more than                  │
│  [ 10 ] contacts at once     ☐ Disabled                 │
│                                                          │
│  SYNC WINDOW                                             │
│  Only sync between [ 08:00 ] and [ 22:00 ]              │
│  ☐ No restriction                                        │
│                                                          │
│  FIELD EXCLUSIONS                                        │
│  ☐ Notes   ☐ Birthdays   ☐ Addresses   ☐ Custom fields  │
│                                                          │
│  EXPORT FILTER              (if two-way or export-only)  │
│  Only push contacts with label:                          │
│  [ All contacts                                   ▾ ]   │
│                                                          │
│  NOTIFICATIONS                                           │
│  ☑ Alert me when this account fails or needs re-auth    │
│                                                          │
│  RETRY SENSITIVITY                                       │
│  Auto-pause after [ 5 ] consecutive failures            │
│                                                          │
│  [Save]     [Cancel]                                     │
└──────────────────────────────────────────────────────────┘
```

---

## Section 1: Direction

**Control:** segmented radio group — three rows.

| Option | `syncDirection` | Description |
|---|---|---|
| Two-way | `TWO_WAY` | "Push and pull changes" |
| Import only | `IMPORT_ONLY` | "Pull from remote into Kontax — remote is read-only" |
| Export only | `EXPORT_ONLY` | "Push Kontax contacts to remote — Kontax is the source" |

**Visual:** Radio rows — `height: 52px`, `border: 1px solid #d8ddd6`, `border-radius: 10px`. Selected: `border-color: #4158f4`, `background: #edf0fe`. Label `font-size: 14px`, `font-weight: 600`, `color: #1d2823`. Description `font-size: 12px`, `color: #8b938c`.

**Provider constraints:**  
- Google and Microsoft: Export only shown disabled with tooltip "Not supported for this provider."  
- CardDAV: all three enabled.

**Cascade rules:**
- Switching away from `TWO_WAY` hides Conflict Policy (200ms fade).
- Switching to `IMPORT_ONLY` also hides Export Filter.
- Switching to `EXPORT_ONLY` hides Address Books (CardDAV) and Conflict Policy.

---

## Section 2: Sync Frequency

**Control:** `<select>` dropdown.

| Label | `syncFrequencyMinutes` |
|---|---|
| Plan default | `null` |
| Every 15 minutes | `15` |
| Every 30 minutes | `30` |
| Every hour | `60` |
| Every 6 hours | `360` |
| Every 24 hours | `1440` |
| Manual only | `0` |

Below the dropdown: `font-size: 12px`, `color: #8b938c` — "Your plan syncs every 30 minutes." (shows the resolved default when "Plan default" is selected).

**Entitlement gate:** options faster than the plan limit shown disabled with a "Pro" badge. Clicking a gated option opens the upgrade sheet.

---

## Section 3: Conflict Policy *(two-way only)*

**Visibility:** hidden when Direction ≠ `TWO_WAY`.

| Option | `conflictPolicy` | Description |
|---|---|---|
| Remote wins | `SERVER_WINS` | "Remote change always applies" |
| Kontax wins | `DEVICE_WINS` | "Local change always applies" |
| Ask me | `MANUAL` | "Queue conflicts for manual review — nothing overwritten" |

**"Kontax wins" amber callout:**
```
⚠  Remote edits made since the last sync will be overwritten by your local version.
```
`background: #f6edd9`, `border-radius: 8px`, `padding: 10px 12px`, `font-size: 12px`, `color: #7a5a1a`.

---

## Section 4: Address Books *(CardDAV only)*

**Visibility:** hidden for Google and Microsoft. Hidden when Direction = `EXPORT_ONLY`.

Checkbox list of `discoveredBooks` on the account. Checked = included in `bookAllowlist`. All checked saves `[]` (include all). Read-only remote books show a lock icon and a disabled checkbox.

**Empty state:** "Address books will appear here after the first successful sync." — `color: #8b938c`.

---

## Advanced Settings

Separated by a labelled divider: `─── Advanced ───` — `font-size: 11px`, `font-weight: 700`, `letter-spacing: 0.08em`, `color: #8b938c`.

---

## Section 5: Auto-label on Import

**Field:** `importLabelId`  
**Visibility:** shown for all providers when Direction ≠ `EXPORT_ONLY`.

**Control:** `<select>` dropdown populated with the user's labels (name + colour swatch). First option: "No label" (`null`). If the user has no labels yet, show a hint: "Create a label in Contacts first."

**Purpose:** every contact created or updated by an inbound sync from this account gets this label applied automatically. Useful for tagging contacts by source (e.g. "iCloud", "Work Exchange").

---

## Section 6: Deletion Safety

**Fields:** `maxDeletionsThreshold`  
**Visibility:** always shown.

**Control:** a number input (`min: 1`, `max: 9999`, `width: 72px`) inline with the label "Pause if a sync would delete more than ___ contacts at once", plus a "Disabled" checkbox that clears the field to `null`.

Default value when first enabled: `10`.

**Behaviour when triggered:** the sync job is halted before committing deletions, status set to `PAUSED`, and an in-app notification + email (if `notifyOnFailure` is on) fires. The user must review and manually resume.

---

## Section 7: Sync Window

**Fields:** `syncWindowStart`, `syncWindowEnd`  
**Visibility:** only shown when `syncFrequencyMinutes` is not `0` (manual) and not `null` with plan default of manual.

**Control:** two time selectors (hour only, 00–23) — "Only sync between ___ and ___" — plus a "No restriction" checkbox that clears both to `null`.

Hours are in the user's local timezone (resolved client-side). The runner stores and evaluates them as UTC offsets.

**Validation:** start must be before end. If equal: show error "Start and end must be different."

---

## Section 8: Field Exclusions

**Field:** `excludedFields`  
**Visibility:** always shown.

**Control:** checkbox grid of vCard field categories:

| Checkbox label | `excludedFields` value stored |
|---|---|
| Notes | `NOTE` |
| Birthdays | `BDAY` |
| Addresses | `ADR` |
| Custom fields | `X-CUSTOM` |

Unchecked = sync that field type. Checked = skip on both read and write.

**Info note below:** `font-size: 12px`, `color: #8b938c` — "Excluded fields are not read from or written to the remote. Existing remote data is left unchanged."

---

## Section 9: Export Filter

**Field:** `exportLabelFilter`  
**Visibility:** only when Direction = `TWO_WAY` or `EXPORT_ONLY`.

**Control:** `<select>` (multi-select or single for now). Options:
- "All contacts" → `[]` (push everything)
- Then one option per label the user has created.

When a label is selected, only contacts tagged with that label are pushed to the remote during outbound sync. Contacts without the label are not deleted from the remote — only new pushes are filtered.

**Info note:** "Contacts already on the remote won't be deleted if they don't match the filter — only new outbound changes are affected."

---

## Section 10: Notifications

**Field:** `notifyOnFailure`  
**Visibility:** always shown.

**Control:** single checkbox — "Alert me when this account fails or needs re-authentication."

Checked = the existing `Notification` system sends an in-app notification (and email if the user has email notifications on) when `lastErrorCode` is set or status becomes `NEEDS_REAUTH`.

---

## Section 11: Retry Sensitivity

**Field:** `maxAttemptsBeforePause`  
**Visibility:** always shown.

**Control:** `<select>` dropdown.

| Label | Value |
|---|---|
| Platform default (5 failures) | `null` |
| 1 failure | `1` |
| 3 failures | `3` |
| 5 failures | `5` |
| 10 failures | `10` |
| Never auto-pause | `0` |

Below: `font-size: 12px`, `color: #8b938c` — "After this many consecutive failures, the account is auto-paused. You'll need to resume it manually."

---

## Save / Cancel

Pinned at the foot of the panel, always visible (a panel, not a collapsing
disclosure).

**Save settings:** `background: #4158f4`, `color: #fff`, `height: 36px`,
`border-radius: 8px`. **Disabled (0.55 opacity) until the form is dirty.** Sends
**only the changed fields** to `updateSyncAccountSettings` (keeps the audit diff
meaningful). On success: toast "Settings saved", `router.refresh()`, panel
closes. On `SYNC_SETTINGS_ELEVATION_REQUIRED`: keeps the draft, opens re-auth,
retries once elevated. On other errors: reverts the draft to baseline and toasts
the message.

**Cancel:** text button, `color: #5c655e`. Reverts the draft and closes the
panel (same as [×]).

> **Not yet built — dirty guard.** The brief's intended "Discard unsaved
> settings?" prompt when navigating away mid-edit is **not** implemented; today
> selecting another account simply discards the draft. Track as a follow-up.

---

## Post-save header updates

After a successful save the panel closes and the detail view re-renders via
`router.refresh()`, so the Direction badge in the account header reflects the new
value:
- `↕ Two-way` — `background: #e3efe7`, `color: #1c6b48`
- `↓ Import only` — `background: #f2f4f0`, `color: #5c655e`
- `↑ Export only` — `background: #f2f4f0`, `color: #5c655e`

---

## Mobile Layout (< 768px)

**Intended:** full-screen bottom sheet — handle at top, "Sync settings" + close ×,
sections stacked with 24px spacing, full-width Save pinned above the safe area.

> **As-built:** on mobile the panel renders inline within the `SyncPageClient`
> detail takeover (the same panel as desktop, full-width), **not** the dedicated
> bottom-sheet treatment above. The sheet styling is a follow-up.

---

## States

**Initial values:** seeded from the account's current settings (server-rendered
via `page.tsx`); no client fetch / skeleton needed.  
**No settings row yet:** show all defaults — no error.  
**Clean (not dirty):** Save is disabled (greyed); Cancel/[×] still close.  
**Save in progress:** Save → "Saving…" + spinner, button disabled.  
**Save success:** toast "Settings saved", `router.refresh()`, panel closes back to
the detail view.  
**Re-auth required:** if the save returns `SYNC_SETTINGS_ELEVATION_REQUIRED`, the
dirty draft is kept and the password re-auth modal opens; the save retries once
elevated (P23-06).  
**Save error (other):** the draft reverts to baseline and the message is toasted.

---

## Server Action

`updateSyncAccountSettings({ syncAccountId, ...patch })` — all fields optional;
the client sends only what changed.

- Requires a valid `SyncSettingsElevation` (P23-06); returns
  `SYNC_SETTINGS_ELEVATION_REQUIRED` otherwise so the client can prompt re-auth.
- Validates `syncAccountId` belongs to `session.user.id`.
- Validates `importLabelId` (if non-null) belongs to the same user.
- Validates the sync window: both bounds or neither, and start ≠ end.
- Upserts `SyncAccountSettings` (a shared patch object seeds create + update).
- Mirrors `syncDirection` onto `SyncAccount` (P23-01: the field lives in two
  places — keep them in sync on write) and queues a catch-up re-sync on a
  direction change to a pulling mode (P23-04).
- Auto-resolves the open conflict queue when leaving the `MANUAL` policy (P23-05).
- Emits a `SYNC_SETTINGS_CHANGED` activity event with a per-field before/after
  diff (P23-06), covering the new advanced fields.
- Returns `{ ok: true }` or `{ ok: false, error }`.

---

## Runner integration notes

These fields are read by the sync runner, not enforced in the UI:
- `syncWindowStart` / `syncWindowEnd` — runner skips the job if current UTC time is outside window.
- `maxDeletionsThreshold` — runner aborts and pauses before committing if deletion count exceeds threshold.
- `excludedFields` — runner strips excluded vCard properties before write in both directions.
- `exportLabelFilter` — runner skips outbound push for contacts that don't carry a matching label.
- `maxAttemptsBeforePause` — runner uses this instead of the hardcoded `5` when set.
- `notifyOnFailure` — runner triggers notification on error state change when `true`.
