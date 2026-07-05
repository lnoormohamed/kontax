# P39-DB01 — Sync Enforcement States, Dirty Guard & Mobile Sheet

**Surface:** `/sync` account detail, settings panel, notifications, mobile sheet
**Trigger:** Phase 39 runner enforcement fires (deletion threshold, sync window, retry sensitivity) + the two P36-DB01 follow-ups
**Priority:** P1 — the moment a safety rail fires is exactly when the UI must be clearest.
**Parent:** [P36-DB01](./p36-db01-sync-account-settings.md) — its "Runner integration notes" and two "Not yet built" callouts are this brief's scope.

> **Companion visual:** `P39-DB01 Sync Enforcement States.html` (design canvas) renders every
> frame below pixel-accurate against the locked sync-page language. Frame ids (1a, 3c, 6b…)
> are cross-referenced here.

---

## Design language (reuse — do not invent)

All tokens come from `src/app/sync/_components/sync-shared.tsx` (`T`) and the P36-DB01 §3 amber callout.

| Token | Value | Use |
|---|---|---|
| `ink` | `#1d2823` | headings, primary text |
| `ink2` | `#5c655e` | body copy |
| `mute` | `#8b938c` | meta, timestamps |
| `line` / `line2` | `#d8ddd6` / `#e9ece7` | borders, hairlines |
| `wash` | `#f2f4f0` | neutral fills, muted pills |
| `blue` | `#4158f4` | primary actions, links |
| `sgreen` / `sgreenWash` / `sgreenText` | `#1f8a5b` / `#e3efe7` / `#1c6b48` | healthy, success |
| `red` / `redWash` | `#b5472f` / `#f3e1da` | broken, destructive |
| `amber` | `#bf8526` | protective-pause status dot/text |
| **amber callout** | bg `#f6edd9` · border `#e8d8b0` · ink `#7a5a1a` · ink2 `#8a6a2a` | **all protective pauses** |

**The tone contract**

- **Amber = a safety rail working.** Protective pause (deletion threshold, auto-pause). Icon: **shield-check**, never a warning triangle. Primary action **Resume**.
- **Red = broken.** `NEEDS_REAUTH` / permission-reduced. Icon: **key**. Primary action **Re-authorise**.
- **Neutral = configured behaviour.** Sync-window deferral. Icon: **clock**. No alarm color. `info` banner (`#f8faf8` / `line2`).

**Voice:** calm, factual, no exclamation marks. Same register as the P42 connection-loss brief.

---

## Surface 1 — Deletion-safety pause

`status = PAUSED`, `lastErrorCode = DELETION_THRESHOLD_EXCEEDED`, `health = paused_for_safety`.

### 1a — Default (`account detail takeover`)

Header health pill: `Paused for safety`, dot + text `#bf8526`. `HEALTH_DETAIL` copy: *"Auto-paused before committing deletions. Review what would have been removed, then resume."*

**Banner** (amber callout, shield icon):

```
◆  Sync paused: this sync would have deleted {N} contacts
   Your deletion-safety limit is {M}. Nothing was deleted. Review the
   changes below, then choose how to resume.
```

**Review affordance** — bordered card (`line2`, radius 12), header row `wash`:

```
WOULD HAVE BEEN DELETED                         {N} contacts   ← mono, amber
Personal  (iCloud default)                                −28  ← mono, red
Work      (Exchange)                                      −11
Family    (shared)                                         −3
```
Counts-by-book. Per-book `−n` in `mono`, color `red`.

**Actions** (in this order):

| Button | Style | Behaviour |
|---|---|---|
| Resume and allow deletions | solid `#b5472f` | opens confirm **1f** |
| Resume without deleting | `blue` (safe default) | resume; next run pushes edits, skips pending removals |
| Adjust threshold | ghost/outline | opens settings §6 |

**History row** for the halted run: amber `Paused for review` status pill · Changes cell *"Halted before commit · {N} pending removals"*.

### 1b — First occurrence
Rail row gets an amber wash + red count badge (`nbadge`, `#b5472f`); nav shows the unread count. In-app toast (green surface): **"1 sync paused for review"** (auto-dismiss 6s → opens account). Fires notification **4a** + email **4b** when `notifyOnFailure`.

### 1c — After resume
- **Resume without deleting** → toast **"Sync resumed"**; next history row *"+0 ~7 −0 · deletions skipped"*; halted row flips amber → muted `Resolved`.
- **Resume and allow deletions** (post-confirm) → toast **"Sync resumed — deletions applied"**; history shows the removal tally.

### 1d — Review states
- **Loading:** spinner + *"Loading what would have been removed…"* while the runner's pre-commit diff loads.
- **Empty (already reconciled):** green check, header count `0 remaining` (`sgreenText`), copy *"These deletions were already reconciled on a later sync. Nothing is pending — you can resume safely."* No destructive action.
- **>50 items:** collapse to counts-by-book; per-contact preview capped at 50 with footer *"Showing counts by book. Per-contact preview is capped at the first 50 — export the full list."* Never render N rows inline.

### 1e — Mobile
Actions stack full-width, safe default (**Resume without deleting**, blue) on top, destructive below. Banner keeps N and M; review collapses to counts-by-book.

### 1f — Confirm (destructive)
Reuses `ConfirmDialog` (`destructive`). Title **"Allow {N} deletions?"** · body *"Resuming will delete {N} contacts across {K} books to match the remote. This can't be undone from here."* Buttons: **Keep paused** (neutral, default/focused) · **Delete {N} & resume** (`#b5472f`).

---

## Surface 2 — Sync-window deferral

A scheduled run skipped because current time is outside `syncWindowStart`–`syncWindowEnd`. **Informational only** — status stays `ACTIVE`, health `healthy`. Not a failure; does **not** increment `consecutiveFailures`.

### 2a — Next-run line
Neutral `info` banner (clock icon):

```
🕑 Next sync at {HH:00}
   Outside your sync window ({start}–{end}). Scheduled runs are held
   until the window opens.
```

**History row:** muted `Skipped` pill · Changes cell *"Skipped — outside sync window"*.

**"Sync now" stays enabled.** Tooltip: **"Runs immediately — bypasses your sync window."**

### 2b — Mobile
Tooltip becomes an inline caption under the full-width Sync-now button (no hover on touch).

---

## Surface 3 — Auto-pause by retry sensitivity

`maxAttemptsBeforePause` tripped. `status = PAUSED`, `health = paused_for_safety` (same amber family as deletion). **Must read as recoverable, not broken.**

### 3a — Default
Amber callout, shield icon:

```
◆  Auto-paused after {n} consecutive failures
   Kontax stopped retrying to avoid hammering the server.
   Last error: {code} ({time}).
```

**Actions:** **Resume** (blue) · **Open settings** (→ §11 retry sensitivity) · **Sync now**.

**History:** the tripping run gets amber `Auto-paused`; prior attempts get red `Failed` pills with an *"{code} · attempt n of N"* counter.

### 3b — First occurrence / resumed
Badge + toast **"{account} auto-paused"** on first trip. Resume → toast **"Sync resumed"**, counter resets to 0.

### 3c — Distinct from `NEEDS_REAUTH`
The visual contract — never share tone:

| | Auto-pause | Needs re-auth |
|---|---|---|
| Banner | amber `#f6edd9` | red `#f7e9e4` |
| Icon | shield-check | key |
| Status pill | `Auto-paused` (amber) | `Needs re-auth` (red) |
| Primary action | **Resume** | **Re-authorise →** |
| Meaning | backed off; retry works | credentials broken; resuming won't help |

### 3d — Mobile
Amber banner + last error; **Resume** / **Open settings** stacked full-width.

---

## Surface 4 — Notification templates

### 4a — In-app
One-line title + one-line body carrying specifics; trailing action link matches the account CTA. Icon tile tone mirrors the surface (amber shield / red key).

| Event | Title | Body | Link |
|---|---|---|---|
| Deletion pause | Sync paused — review needed | {account} would have deleted {N} contacts (limit {M}). Nothing was deleted. | Review → |
| Auto-pause | Sync auto-paused | {account} was paused after {n} consecutive failures. Last error: {code}. | Open → |
| Needs re-auth | Reconnect needed | {account} needs re-authentication — {reason}. | Re-authorise → |

Gated by `notifyOnFailure` **except re-auth**, which always notifies.

### 4b / 4c — Email (P20 layout, variable body)
Reuse `EmailLayout` + `EmailSectionLabel / EmailHeading / EmailDetailBlock / EmailButton / EmailFootnote`. Only the section-label color, heading, body, detail rows and CTA vary. Section-label colors from `src/emails/_tokens.ts`: `amber #d97706` (pauses), `red #dc2626` (re-auth).

| Event | Label | Heading | CTA (tone) | Notes |
|---|---|---|---|---|
| Deletion pause | Sync paused (amber) | A sync was paused to protect your contacts | Review the paused sync → (blue) | DetailBlock: connection / would-have-deleted / limit / when |
| Auto-pause | Sync auto-paused (amber) | We paused a sync after repeated failures | Open the connection → (blue) | body names count + last error |
| Needs re-auth | Action required (red) | Reconnect {account} to keep syncing | Reconnect → (red) | reassures contacts are safe; **no-unsubscribe footnote** (matches `suspicious-activity.tsx`) |

---

## Surface 5 — Dirty guard

Reuses `ConfirmDialog`. Fires **only when the settings panel is `dirty`** and the user tries to leave.

**Triggers:** selecting a different account in the rail · opening **Edit credentials** (mutually-exclusive panel) · closing the panel ([×] / Cancel / back gesture / nav away).

Title **"Discard unsaved settings?"** · body *"You've changed sync settings for this connection. If you leave now, your changes won't be saved."*

Buttons: **Keep editing** (neutral, **default / focused**) · **Discard changes** (`#b5472f`). Mobile: buttons stack, **Keep editing** on top. Clean panels close silently (today's behaviour).

---

## Surface 6 — Mobile bottom sheet (< 768px)

The P36-DB01 sheet, finally. Follows the create-contact sheet pattern (`roadmap/mobile-design-brief.md`).

**Structure:**
- Drag handle (grabber: 38×5, `line`, radius 999) centered at top.
- Header: **"Sync settings"** (17/700) + close × (`wash` tile); account label beneath (`mute`).
- Body: full-screen sheet (`radius 22px 22px 0 0`, `sheetShadow`), sections stacked at **24px** (`marginBottom`). Same controls as desktop, full-width.
- **Save** pinned full-width (height 48, radius 12, `blue`) in a sticky footer above the safe area: `padding-bottom: calc(14px + env(safe-area-inset-bottom))`, top hairline `line2`.

**States (6a–6c):**
- **Dirty:** Save enabled; tapping outside / drag-to-dismiss fires the dirty guard (Surface 5).
- **Clean:** Save `opacity .55`, disabled; dismiss needs no guard. Sends only changed fields.
- **Saving:** spinner + **"Saving…"**, disabled. Success → toast **"Settings saved"** + dismiss. `SYNC_SETTINGS_ELEVATION_REQUIRED` → keep draft, open re-auth, retry once elevated.

---

## Runner / server contract (consumed by build tickets)

- **P39-02** deletion pause: runner aborts before commit when the pending deletion count > `maxDeletionsThreshold`; sets `PAUSED` + `DELETION_THRESHOLD_EXCEEDED`; persists the pre-commit deletion diff (counts-by-book + first 50 contacts) for the review card; fires notif/email when `notifyOnFailure`.
- **P39-05** sync window: runner skips the job when current UTC ∉ [`syncWindowStart`,`syncWindowEnd`); writes a `Skipped` job row (no failure increment); status stays `ACTIVE`.
- **P39-06** auto-pause: runner uses `maxAttemptsBeforePause` instead of the hardcoded 5; on trip sets `PAUSED` + `paused_for_safety`, records last error + attempt counter.
- **P39-07** notifications: three templates above ride the existing `Notification` system + P20 email layout.
- Resume actions reuse `activateSyncAccount`; "allow deletions" resume must clear the deletion-guard hold so the next run commits.

---

## States matrix (coverage checklist)

For surfaces 1–3: default · first-occurrence (badge) · after-resume toast · mobile. Deletion review adds: loading · empty (reconciled) · >50 truncation. All rendered in the companion canvas.

## Dependencies
Blocks **P39-02, P39-05, P39-06, P39-07**. Informed by, does not block, P39-01/03/04 (copy-only). Locked design language + existing sync-page status conventions apply throughout.
