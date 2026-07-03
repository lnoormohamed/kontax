# P39-08 — Enforcement QA matrix & smoke test

Status: Not started · Priority: P1 · Depends: P39-01…05
Phase: [Phase 39](phase-39.md)

## Scope

A staging pass exercising every advanced field against a real Google +
CardDAV account pair, captured as a checklist (follow the
[p34h-07](p34h-07-reconnect-replace-qa-and-smoke-test.md) smoke-test format):

- Sync window (including the DST case from
  [P39-01](p39-01-runner-sync-window-enforcement.md)).
- Deletion threshold: trigger, review, both resume paths
  ([P39-02](p39-02-runner-deletion-safety-threshold.md)).
- Field exclusions per field family
  ([P39-03](p39-03-runner-field-exclusions.md)).
- Export label filter on both providers
  ([P39-04](p39-04-runner-export-label-filter.md)).
- Retry sensitivity values 1 / default / never, and notification gating
  ([P39-05](p39-05-runner-retry-sensitivity-notifications.md)).
- The entitlement gate on frequency and the elevation (re-auth) path
  (`SYNC_SETTINGS_ELEVATION_REQUIRED`).

## Acceptance

- Checklist recorded in this ticket file with results per row, sign-off
  format per p34h-07.
- Any failure files a fix ticket before the phase exits.
