# P39-02 — Runner: deletion-safety threshold (pause before commit)

Status: Done — built against P39-DB01 (2026-07-03) · Priority: P0 · Depends: [P39-DB01](p39-db01-design-brief-sync-enforcement-states.md)
Phase: [Phase 39](phase-39.md)

## Problem

`maxDeletionsThreshold` is the highest-trust setting in the P36 panel — "pause
if a sync would delete more than N contacts at once" — and it is stored but
**not enforced**. A user who believes they are protected against a remote
wipe is not.

## Change

Before committing a sync batch, count pending contact deletions (both
directions, counted per direction); if the count exceeds the threshold:

- Abort **before any deletion commits**.
- Set the account to `PAUSED` with a distinct error/activity code
  (e.g. `DELETION_THRESHOLD_EXCEEDED`).
- Fire the in-app notification + email path when `notifyOnFailure` is on.
- Resume is manual, via the review surface specified in P39-DB01 (explicit
  "resume and allow deletions" vs "resume without deleting"); resuming
  re-evaluates rather than blindly replaying the deletions.

## Acceptance

- Seeded staging scenario where a remote wipe would delete N > threshold
  contacts: local data untouched, account paused with the distinct code,
  notification delivered.
- Resume-without-deleting completes the sync minus the deletions;
  resume-and-allow applies them once, with an activity event.
