# P44-06 — End-to-end photo sync QA matrix

Status: Ready to run — matrix + runbook below; **live rows pending** (needs
`PHOTO_SYNC_ENABLED=1` + dedicated test accounts; the staging Google token was
dead at build time, see [p44-01 state](../../docs/photo-capability/README.md)) ·
Priority: P1 · Depends: [P44-03](p44-03-inbound-photo-sync.md), [P44-04](p44-04-outbound-photo-push-normalization.md)
Phase: [Phase 44](phase-44-photo-sync.md)

## Scope

Staging pass across Google + iCloud + Nextcloud with a seeded photo set:

- Add / change / delete on each side.
- **The no-op double-cycle echo test: two full sync cycles with no user
  change produce zero photo writes on either side** (the P44-02 guarantee —
  the single most important row in the matrix).
- Excluded-fields off-switch ("Photos" exclusion honoured both directions).
- A 5,000-contact account for storage/runtime cost.
- Real-device verification that iOS/Android contact apps display the synced
  photos.

## Acceptance

- Results recorded in this ticket file (P37-12 sign-off format).
- Echo test passes on every provider; any failure blocks phase exit.

---

## Offline pre-checks (done at build time — no accounts needed)

- [x] Decision-table + no-loop guarantee (docs/adr/0001 §4/§6) proven as a pure
      selftest: `npm run qa:phase44:photo-decision` (39 assertions, incl. the
      two-cycle no-loop for both signal kinds). Green as of 2026-07-04.
- [x] `npx tsc --noEmit` clean across the photo code + runner wiring.

## Runbook (live rows)

> ⚠️ Photo sync is behind `PHOTO_SYNC_ENABLED` (off). Every step writes to a
> **dedicated test account** only. Reuse the P44-01 accounts; keep all test
> contacts prefixed `P44QA ` so cleanup is unambiguous.

1. **Enable the flag** on the staging app env: `PHOTO_SYNC_ENABLED=1`, redeploy
   (or run the harness with it exported). Confirm off elsewhere.
2. **Seed** a reference photo set with the P44-01 harness
   (`npm run qa:phase44:photos -- --account=<id> --mode=push --confirm-test-account`)
   or set an avatar on a `P44QA ` contact in-app.
3. **Drive sync** through the product path — enqueue + `runQueuedSyncJobs`
   (same entrypoint as [P39-08](p39-08-enforcement-qa-matrix.md)); never
   simulate. Trigger Google via OAuth account, CardDAV via app-password account.
4. Record each row's observed result (job tallies from `SyncJob`, the activity
   feed `SYNC_PULLED/SYNC_PUSHED`, the `SyncContactLink.photoShadow`, and the
   rendered avatar/thumb) in the sign-off table.
5. **Cleanup**: remove `P44QA ` contacts on every provider + local; unset the
   flag.

## Matrix

Per provider (**Google**, **iCloud**, **Nextcloud** — Fastmail may stand in for
generic CardDAV per the P44-01 waiver):

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Add photo **remote** → pull | Normalized (EXIF-stripped) avatar appears; shadow seeded; `SYNC_PULLED` event; thumb renders |
| 2 | Add photo **local** → push | Reaches provider within its P44-01 cap; shadow holds provider-canonical signal immediately after push |
| 3 | Change photo **remote** → pull | New avatar replaces old; old MinIO object cleaned up |
| 4 | Change photo **local** → push | Provider updated; no re-pull churn next cycle |
| 5 | Delete photo **remote** → pull-delete | `avatarUrl` cleared; shadow cleared |
| 6 | Delete photo **local** → push-delete | Remote photo removed; contact kept |
| 7 | **Echo double-cycle** (no user change) | **Zero photo writes on both sides across two full cycles** — the P44-02 guarantee. *Blocks phase exit.* |
| 8 | Both sides changed → conflict | Side-by-side pick in conflict review ([P44-05](p44-05-photo-conflict-merge-surfaces.md)); choice applies + updates shadow |
| 9 | Both changed to **same** image | Auto-resolves silently (no conflict row) |
| 10 | "Photos" **excluded** (both directions) | Inbound ignored, existing `avatarUrl` untouched; outbound never pushes photo; remote photo preserved (not wiped) |
| 11 | iCloud **>1MB** local photo | Normalized <1MB before push (no 403); if still rejected, `lastPushRejected` latches — no retry loop |
| 12 | **5,000-contact** account | Full run completes; record photo-pass wall-clock + `getBatchGet` call count (Google) + MinIO storage delta |
| 13 | **Real device** (iOS + Android) | Synced photo displays in the native Contacts app |

## Sign-off (P37-12 format) — fill in on run

| # | Google | iCloud | Nextcloud | Notes |
| --- | --- | --- | --- | --- |
| 1 | ☐ | ☐ | ☐ | |
| 2 | ☐ | ☐ | ☐ | |
| 3 | ☐ | ☐ | ☐ | |
| 4 | ☐ | ☐ | ☐ | |
| 5 | ☐ | ☐ | ☐ | |
| 6 | ☐ | ☐ | ☐ | |
| 7 (echo) | ☐ | ☐ | ☐ | **must pass** |
| 8 | ☐ | ☐ | ☐ | |
| 9 | ☐ | ☐ | ☐ | |
| 10 | ☐ | ☐ | ☐ | |
| 11 | n/a | ☐ | ☐ | Google cap ≫1MB |
| 12 | ☐ | ☐ | ☐ | cost numbers |
| 13 | ☐ | ☐ | ☐ | device + OS versions |

Reviewer: ______  · Date: ______  · Build: `staging@<sha>`
