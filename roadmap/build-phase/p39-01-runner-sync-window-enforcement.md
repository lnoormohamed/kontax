# P39-01 — Runner: sync-window enforcement

Status: Done — built against P39-DB01 (2026-07-03) · Priority: P1 · Depends: —
Phase: [Phase 39](phase-39.md)

## Problem

`syncWindowStart` / `syncWindowEnd` (hour-of-day) are stored by the P36
settings panel but ignored by the runner — a user who restricts syncing to
08:00–22:00 gets synced at 03:00 anyway.

**Known flaw in the P36 brief to resolve here, not inherit:** the brief says
hours are "resolved client-side … stored and evaluated as UTC offsets", which
silently shifts the window by an hour across DST changes.

## Change

- Store the user's local hours plus an IANA timezone (additive column or
  encode alongside), and have the runner evaluate in that zone; migrate any
  already-saved UTC values.
- The scheduler skips a due job when the current time (user zone) falls
  outside the window; the account's next-run display reflects the deferral
  rather than showing a silent miss.
- Manual "Sync now" bypasses the window (explicit user intent) — its tooltip
  says so (copy via [P39-DB01](p39-db01-design-brief-sync-enforcement-states.md)).

## Acceptance

- A staging account with a window excluding the current hour does not
  auto-sync; the history/status copy says why; "Sync now" still works.
- A window spanning a DST transition keeps firing at the user's wall-clock
  hours on both sides of the change.
