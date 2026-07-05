# Phase 39 — Sync Settings Enforcement & P36 Carry-Over

> Closes the gap between what the P36 sync-settings UI *promises* and what the
> platform *does*. The settings panel
> ([P36-DB01](../design-briefs/p36-db01-sync-account-settings.md)) shipped in
> June 2026 with all eleven sections, but the advanced fields are stored, not
> enforced — the runner ignores them. This phase makes every control real, and
> picks up the two UI follow-ups the brief explicitly flagged as not built
> (dirty guard, mobile bottom sheet).

## Phase status
Pre-plan

## Phase objective
Every field in `SyncAccountSettings` that the P36 panel lets a user set must be
honoured by the sync runner, and the panel itself must reach the design brief's
intended interaction quality on desktop and mobile. Until then the advanced
block is a trust liability: a user who sets "pause if a sync would delete more
than 10 contacts" believes they are protected, and they are not.

Source material: the "Runner integration notes" and the two "Not yet built"
callouts in [P36-DB01](../design-briefs/p36-db01-sync-account-settings.md).

## Success criteria
- Each advanced setting observably changes runner behaviour (verified per
  ticket with a staging sync account).
- Deletion safety actually halts a destructive sync before commit.
- The settings panel warns before discarding a dirty draft.
- On < 768px the panel renders as the bottom sheet specified in the brief.

## Exit criteria
- P39-01 … P39-08 verified.
- The "Runner integration notes" section of P36-DB01 updated from "read by the
  runner, not enforced" to shipped, with a pointer to this phase.

## Tickets

| Ticket | Title | Priority | Depends on |
| --- | --- | --- | --- |
| [P39-DB01](p39-db01-design-brief-sync-enforcement-states.md) | Design brief: enforcement states, dirty guard & mobile sheet | P0 | — |
| [P39-01](p39-01-runner-sync-window-enforcement.md) | Runner: sync-window enforcement | P1 | — |
| [P39-02](p39-02-runner-deletion-safety-threshold.md) | Runner: deletion-safety threshold (pause before commit) | P0 | P39-DB01 |
| [P39-03](p39-03-runner-field-exclusions.md) | Runner: field exclusions on read and write | P1 | — |
| [P39-04](p39-04-runner-export-label-filter.md) | Runner: export label filter | P1 | — |
| [P39-05](p39-05-runner-retry-sensitivity-notifications.md) | Runner: retry sensitivity + failure notifications | P1 | P39-DB01 |
| [P39-06](p39-06-settings-panel-dirty-guard.md) | Settings panel dirty guard | P2 | P39-DB01 |
| [P39-07](p39-07-mobile-bottom-sheet-sync-settings.md) | Mobile bottom-sheet treatment for sync settings | P2 | P39-DB01 |
| [P39-08](p39-08-enforcement-qa-matrix.md) | Enforcement QA matrix & smoke test | P1 | P39-01…05 |

> Tickets are split into standalone files (linked above); the sections
> below remain the phase-level overview.

### P39-01 — Runner: sync-window enforcement
`syncWindowStart` / `syncWindowEnd` (hour-of-day). **Known flaw in the P36
brief to resolve here, not inherit:** the brief says "resolved client-side …
stored and evaluated as UTC offsets", which silently shifts the window by an
hour across DST changes. Store the user's local hours plus an IANA timezone
(additive column or encode alongside), and have the runner evaluate in that
zone; migrate any already-saved UTC values. The scheduler skips a due job
when the current time (user zone) falls outside the window; the account's
next-run display reflects the deferral rather than showing a silent miss.
Manual "Sync now" bypasses the window (explicit user intent).

Acceptance: a staging account with a window excluding the current hour does not
auto-sync; the history/status copy says why; "Sync now" still works.

### P39-02 — Runner: deletion-safety threshold
`maxDeletionsThreshold`. Before committing a sync batch, count pending contact
deletions (both directions, counted per direction); if the count exceeds the
threshold, abort **before any deletion commits**, set the account to `PAUSED`,
record a distinct error/activity code (e.g. `DELETION_THRESHOLD_EXCEEDED`), and
fire the in-app notification + email path when `notifyOnFailure` is on. Resume
is manual, and resuming re-evaluates rather than blindly replaying the
deletions.

Acceptance: seeded staging scenario where a remote wipe would delete N > threshold
contacts leaves local data untouched, account paused, notification delivered.

### P39-03 — Runner: field exclusions
`excludedFields` (`NOTE`, `BDAY`, `ADR`, `X-CUSTOM`). The runner strips excluded
vCard properties from outbound writes and ignores them on inbound reads, in both
OAuth and CardDAV paths. Existing remote data is left unchanged (no active
scrubbing), matching the brief's info note.

Acceptance: with `NOTE` excluded, local note edits never reach the remote and
remote note changes never overwrite local notes; other fields sync normally.

### P39-04 — Runner: export label filter
`exportLabelFilter`. During outbound push, contacts not carrying a matching
label are skipped for *new* pushes; contacts already on the remote are not
deleted for failing the filter (filter affects new outbound changes only, per
the brief). Interacts with `syncDirection`: applies for `TWO_WAY` and
`EXPORT_ONLY`.

Acceptance: only labelled contacts appear on a freshly connected remote;
removing the label from a contact does not delete it remotely.

### P39-05 — Runner: retry sensitivity + failure notifications
`maxAttemptsBeforePause` replaces the hardcoded 5-consecutive-failure auto-pause
when set (`0` = never auto-pause). `notifyOnFailure` gates the notification on
error-state change / `NEEDS_REAUTH`, including the pause events from P39-02 and
this ticket. Notification fires on state *change*, not on every failed retry.

Acceptance: an account set to "1 failure" pauses after a single induced failure;
an account set to "Never auto-pause" keeps retrying; unchecking the notification
box silences both paths.

### P39-06 — Settings panel dirty guard
The brief's "Discard unsaved settings?" prompt: navigating away from a dirty
settings draft (selecting another account, opening Edit credentials, closing the
panel) asks before discarding. Reuse `ConfirmDialog`. Today the draft is
silently dropped.

### P39-07 — Mobile bottom-sheet treatment
Implement the brief's mobile layout: full-screen bottom sheet with drag handle,
"Sync settings" header + close ×, sections stacked at 24px spacing, full-width
Save pinned above the safe area. Currently the desktop panel renders inline
full-width. Follow the bottom-sheet patterns already used by mobile contact
create (see roadmap/mobile-design-brief.md). Verify on a real device — preview
cannot emulate touch.

### P39-08 — Enforcement QA matrix & smoke test
A staging pass exercising every advanced field against a real Google + CardDAV
account pair, captured as a checklist (follow the p34h-07 smoke-test format).
Includes the entitlement gate on frequency and the elevation (re-auth) path.

## Documentation (per roadmap/documentation-policy.md)
- [ ] External · users — in-app Help: what each advanced sync setting does
- [ ] Internal · engineering — docs/sync-carddav-model.md: enforcement points in the runner
- [ ] Internal · admins/ops — runbook note: diagnosing `DELETION_THRESHOLD_EXCEEDED` pauses
