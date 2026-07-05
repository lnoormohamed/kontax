# P39-05 — Runner: retry sensitivity + failure notifications

Status: Done — built against P39-DB01 (2026-07-03) · Priority: P1 · Depends: [P39-DB01](p39-db01-design-brief-sync-enforcement-states.md)
Phase: [Phase 39](phase-39.md)

## Problem

`maxAttemptsBeforePause` and `notifyOnFailure` are stored by the P36 panel but
the runner uses a hardcoded 5-consecutive-failure auto-pause and its own
notification behaviour.

## Change

- `maxAttemptsBeforePause` replaces the hardcoded 5 when set; `0` = never
  auto-pause (keep retrying on schedule).
- `notifyOnFailure` gates the notification on error-state change /
  `NEEDS_REAUTH`, including the pause events from
  [P39-02](p39-02-runner-deletion-safety-threshold.md) and this ticket.
- Notification fires on state **change**, not on every failed retry.
- Auto-pause banner/copy and notification templates per P39-DB01
  (visually distinct from `NEEDS_REAUTH`).

## Acceptance

- An account set to "1 failure" pauses after a single induced failure.
- An account set to "Never auto-pause" keeps retrying.
- Unchecking the notification box silences both the failure and pause paths.
- A flapping account (fail, recover, fail) produces one notification per
  state change, not per attempt.
