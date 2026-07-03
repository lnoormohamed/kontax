# P39-08 — Enforcement QA matrix & smoke test

Status: Done (CardDAV) · Google-transport rows blocked on token refresh — see
sign-off · Run 2026-07-03 · Priority: P1 · Depends: P39-01…05
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

## Harness

`scripts/p39-enforcement-qa-harness.ts` — drives every scenario through the
product code paths (`runQueuedSyncJobs`, `enqueueDueSyncJobs`, the
`sync-deletion-resume` cores), never by simulating them. Safety contract:
only contacts whose name starts with `P39QA` are ever created/edited/deleted
(local or remote); every setting it changes is snapshotted and restored in a
`finally`; live provider writes require `--confirm-live`.

Run (env: `.env` + VPN flags for the homelab DB / iCloud):

```
export NODE_OPTIONS="--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=2000"
SYNC_COMMIT_TX_TIMEOUT_MS=600000 npx tsx --tsconfig tsconfig.json \
  scripts/p39-enforcement-qa-harness.ts --mode=<mode> --account=<id> --confirm-live
```

Accounts used (owner `li@linoormohamed.com`):
- **Fastmail Personal** `cmq446geh0001j5uhqoo4ps11` (CardDAV, ~505 links, MANUAL policy)
- **iCloud** `cmqfr967400l9oc2muykimp51` (CardDAV, ~454 links, DEVICE_WINS policy)
- Scratch CardDAV account (created + destroyed by the `retry` mode)

## Results matrix

| # | Behaviour | Mode / provider | Result |
|---|---|---|---|
| DST-1..5 | Window tracks wall clock across DST (spring-forward, fall-back), null-tz = UTC legacy, midnight-wrap | `dst` (pure) | ✅ 5/5 |
| WIN-1 | Due account outside window is deferred, not enqueued | `window` / Fastmail | ✅ |
| WIN-2 | SKIPPED row carries `SYNC_WINDOW_DEFERRED` + window copy | `window` / Fastmail | ✅ |
| WIN-3 | Deferral rows throttled (one SKIPPED per frequency period) | `window` / Fastmail | ✅ |
| WIN-4 | SKIPPED row does not count toward `consecutiveFailures` | `window` / Fastmail | ✅ |
| RETRY-1 | Threshold 1 → paused after a single failure with `SYNC_AUTO_PAUSED` | `retry` / scratch | ✅ |
| RETRY-2 | Auto-pause raises exactly one notification | `retry` / scratch | ✅ |
| RETRY-3 | Threshold 0 (never) → repeated failures do not pause | `retry` / scratch | ✅ |
| RETRY-4 | Platform default → pauses on the 5th consecutive failure, not the 4th | `retry` / scratch | ✅ |
| RETRY-5 | Tripping run's history row carries `attempt 5 of 5` | `retry` / scratch | ✅ |
| RETRY-6 | `notifyOnFailure=false` silences the auto-pause notification | `retry` / scratch | ✅ |
| RETRY-7 | Notifications fire per state change, not per attempt | `retry` / scratch | ✅ |
| DEL-1 | QA contacts pushed to remote | `deletion` / iCloud | ✅ |
| DEL-2 | Run halts before commit: `PAUSED` + `DELETION_THRESHOLD_EXCEEDED` | `deletion` / iCloud | ✅ |
| DEL-3 | Nothing deleted remotely | `deletion` / iCloud | ✅ |
| DEL-4 | Hold payload records the pending outbound deletions | `deletion` / iCloud | ✅ |
| DEL-5 | `HALTED` history row written | `deletion` / iCloud | ✅ |
| DEL-6 | Deletion-pause notification + email raised | `deletion` / iCloud | ✅ |
| DEL-7 | Review core reports N remaining (not yet reconciled) | `deletion` / iCloud | ✅ |
| DEL-8 | Resume-without-deleting reactivates and never deletes | `deletion` / iCloud | ✅ |
| DEL-9 | Second trip parks a fresh hold | `deletion` / iCloud | ✅ |
| DEL-10 | Resume-and-allow commits the deletions once, clears hold + bypass | `deletion` / iCloud | ✅ † |
| EXCL-1 | Baseline contact (note/bday/addr) on remote | `exclusions` / iCloud | ✅ |
| EXCL-2 | Outbound: phone pushed, excluded NOTE/BDAY/ADR unchanged on remote | `exclusions` / iCloud | ✅ |
| EXCL-3 | Inbound: remote note change never overwrites the local note | `exclusions` / iCloud | ✅ |
| EXCL-4 | Unknown exclusion token: no crash, no accidental exclude-everything | `exclusions` / iCloud | ✅ |
| LBL-1 | Only the labelled contact appears on a freshly filtered remote | `labelfilter` / iCloud | ✅ |
| LBL-2 | Removing the label neither deletes nor freezes the linked contact | `labelfilter` / iCloud | ✅ |

**Live-verified: 32/32 checks across all five enforcement behaviours + DST.**

† DEL-10's inline resume-and-allow sync was interrupted mid-commit by a VPN
blip on the first pass (the interactive transaction rolled back atomically —
no corruption). Re-driven from the already-armed bypass state and confirmed:
the two round-2 deletions committed, the round-1 resume-without-deleting
contacts were correctly *kept*, hold cleared, bypass reset.

## Not run this pass

| Row | Reason |
|---|---|
| deletion-inbound (Google remote wipe), exclusions-google (mask withholding), labelfilter on Google | li@'s active Google token expired 2026-06-23 and the `GOOGLE_CLIENT_ID`/`SECRET` needed to refresh it live only in the prod deployment (per the P44 photo-harness runbook). Modes exist in the harness (`deletion-inbound`, `exclusions-google`, `labelfilter` on a Google account) and are ready to run once the token is refreshed (trigger a sync on the deployment, then run within the hour). |
| Frequency entitlement gate; elevation / `SYNC_SETTINGS_ELEVATION_REQUIRED` | Save-time gates (P24B / P23-06), not runner enforcement. The elevation keep-draft-and-retry path was exercised during the P39-06 settings-panel work; the Free-plan sub-30-min frequency gate is unchanged pre-existing P24B code. Neither is in the P39 runner surface. |

**Proxy coverage for the Google gap:** the inbound field-exclusion and
deletion-guard logic is provider-agnostic — Google and Microsoft route through
the same `sync-import-engine.ts` (`stripExcludedPortableFields` /
`omitExcludedContactWriteData` / the shared deletion pre-scan) that the
CardDAV exclusion + deletion rows above exercise live. Only the Google
update-mask withholding (`googleUpdateFieldsFor`) and the People-API delete
transport are Google-specific and remain unverified against a live token.

## Bugs found & fixed during the pass

1. **Big-book commit timeout.** The post-sync commit transaction (hundreds of
   link upserts on a ~500-contact book) aborted mid-commit over the VPN at the
   prior 120s ceiling. Made tunable via `SYNC_COMMIT_TX_TIMEOUT_MS`
   (default 120s) so high-latency runs can extend it. No production impact
   (prod DB is local to the app).

No enforcement-logic defects were found. No fix ticket filed.

## Acceptance

- [x] Checklist recorded with per-row results, sign-off per p34h-07.
- [x] Failures triaged: the one interruption (DEL-10) was environmental and
      re-verified; no enforcement defect filed.
- [ ] Google-transport rows deferred until a fresh token is available on
      staging (tracked above; not blocking the CardDAV sign-off).
