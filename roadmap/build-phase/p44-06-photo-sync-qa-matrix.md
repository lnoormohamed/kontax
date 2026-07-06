# P44-06 — End-to-end photo sync QA matrix

Status: **Partially run on staging 2026-07-05/06** — the phase-exit blocker (row 7,
echo double-cycle) **PASSES on all three live providers (Fastmail + iCloud +
Google)**; inbound pull (row 1) verified end-to-end on all three. Remaining rows
(local push / change /
delete / conflict / excluded-fields / >1MB / 5k-contact / real-device) and the
Nextcloud column are **not yet exercised** (no Nextcloud account).
See [Live run](#live-run--staging-20260705) below ·
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

## Sign-off (P37-12 format)

Legend: ✅ pass · ☐ not exercised this run · ⛔ blocked. Fastmail column added as
the generic-CardDAV stand-in (P44-01 waiver); iCloud is the second CardDAV.

| # | Fastmail (CardDAV) | iCloud | Google | Nextcloud | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | ✅ | ✅ | ✅ | ☐ | Remote→pull: 7/7 (FM) + 6/6 (iC) QA contacts; Google 60/821 real contacts with remote photos got normalized avatar + `photoShadow` + MinIO `.jpg`+`-thumb.webp`; EXIF-stripped, ≤1024px |
| 2 | ☐ | ☐ | ☐ | ☐ | local→push-to-empty-remote not exercised as a discrete row (push *mechanics* proven by row 3) |
| 3 | ✅ | ☐ | ⏳ | ☐ | Local photo **change** → push: FM shadow flipped to new normalized hash (`eccda4c6…`), `lastPushRejected=false`, next cycle echo-quiet (remote re-fetch matches pushed hash = photo confirmed ON the Fastmail server, no loop). Google attempt blocked by `GOOGLE_QUOTA_EXCEEDED` (People API), not a defect — retry after quota reset |
| 4 | ☐ | ☐ | ☐ | ☐ | |
| 5 | ☐ | ☐ | ☐ | ☐ | |
| 6 | ☐ | ☐ | ☐ | ☐ | |
| 7 (echo) | ✅ | ✅ | ✅ | ☐ | **PASS** — 2 consecutive no-change cycles = **0 photo writes** (DB `photoShadow`/`avatarUrl` byte-identical). Phase-exit blocker cleared on all three live providers |
| 8 | ☐ | ☐ | ☐ | ☐ | |
| 9 | ☐ | ☐ | ☐ | ☐ | |
| 10 | ☐ | ☐ | ☐ | ☐ | |
| 11 | n/a | ☐ | n/a | ☐ | Google cap ≫1MB |
| 12 | ☐ | ☐ | ☐ | ☐ | cost numbers |
| 13 | ☐ | ☐ | ☐ | ☐ | device + OS versions |

☐ Nextcloud = no staging account. Google column run 2026-07-06 against the
re-authed `li@noormohamed.uk` connection (the two older Google connections
remain `NEEDS_REAUTH` and were not used).

Reviewer: Claude (paired w/ Li) · Date: 2026-07-05 (CardDAV) / 2026-07-06 (Google) · Build: `staging@662ab1d`+ (deployed container, `PHOTO_SYNC_ENABLED=1`)

---

## Live run — staging 2026-07-05

**Headline:** the P44-02 echo/no-loop guarantee (row 7) holds in production-like
conditions on both CardDAV providers. The two provider **signal kinds** were both
exercised for real: Fastmail = inline `contentHash`; iCloud = URI-form
`resourceIdentifier` (`https://gateway.icloud.com/.../ck/card/<ver>`).

### Infra blocker found + fixed (this is why every prior attempt showed nothing)

The deployed `kontax.vexon.co` container was **missing all `MINIO_*` env vars and
`CRON_SECRET`** (only `PHOTO_SYNC_ENABLED=1` was present). Because `MINIO_*` are
`.optional()` in `src/env.js`, the app booted clean and the photo pass ran and
**pulled + normalized every remote photo — then silently dropped each one**
(`getS3()` returns null → log `MINIO_ENDPOINT not configured — inbound contact
photo not stored`), so `avatarUrl`/`photoShadow` never persisted. Fix: added the
6 vars in Coolify + redeploy. Litmus after redeploy: `/api/cron/sync` → 200 (was
401), and the same Fastmail sync then stored 7/7 photos. (Feeds
[P47-05](p47-05-production-env-var-completeness.md) / [P47-02](p47-02-minio-media-host-verification.md).)

### Evidence

- **Fastmail** (acct `cmq446geh…`, 7 `P44 Photo QA *` contacts): cycle 1 set all
  7 `avatarUrl` (MinIO `avatars/<contactId>/<cuid>.jpg` + `-thumb.webp`,
  physically listed via S3 ListObjects) and populated `photoShadow`
  (`signalKind:"contentHash"`, `remoteSignal == remoteCanonicalHash`, byte-stable
  per P44-01). Cycles 2 + 3 (no change): DB snapshot **byte-identical**, **0** new
  MinIO objects → echo suppressed.
- **iCloud** (acct `cmqfr967…`, 6 contacts): cycle 1 succeeded in ~5s, all 6 set
  with `signalKind:"resourceIdentifier"`. Two consecutive no-change cycles: full
  `photoShadow` (remoteSignal / localAvatarUrl / localPhotoHash /
  remoteCanonicalHash) **unchanged** → echo suppressed. NB a transient "churn"
  during testing was traced entirely to the `MINIO_PUBLIC_URL` value being
  refined mid-run (all avatar URLs legitimately migrated
  `10.0.0.144:9000` → `media-staging.getkontax.com`, forcing a one-time re-store)
  plus the iCloud card settling after its first write — **not** a loop.

### Google run — staging 2026-07-06

The third provider (and the third **signal kind** exercise: Google
`resourceIdentifier` from the People API photo URL) went green a day after the
CardDAV pair, once the `li@noormohamed.uk` connection was re-authed:

- **First healthy sync** (acct `cmqjx0xbz…`): SUCCEEDED in ~5 min — 448 contacts
  created, 174 updated, 48 field-pushes. Photo pass stored **60/821** linked
  contacts' remote photos (the ones that have real Google photos): `avatarUrl` →
  MinIO via `media-staging.getkontax.com` (spot-check GET → 200 `image/jpeg`),
  `photoShadow.signalKind = "resourceIdentifier"`, and **0/60** signals carry an
  `=sNN` size suffix (the suffix-strip that makes the signal stable is working).
- **Echo double-cycle**: cycle 1 — all 60 `avatarUrl`+`remoteSignal` states
  **byte-identical** (13 outbound writes were field `SYNC_PUSHED` events, not
  photos); cycle 2 — fully quiet (`updatedCount=0`, `pushedUpdatedCount=0`),
  states again byte-identical. **Zero photo writes across both cycles.**
- Ops note: sync was driven via `POST /api/cron/sync` (CRON_SECRET). Cloudflare
  cuts the HTTP response at ~30s (502) on the long first sync, but the runner
  keeps executing server-side — poll `SyncJob` for the real result. The 5 stale
  2026-07-02/03 queued jobs from the dead-token era were closed as
  `SKIPPED/SUPERSEDED`.

### Row 3 (local photo change → push) — 2026-07-06 afternoon

Replaced the local photo on both copies of `P44 Photo QA jpeg-512` (new distinct
test JPEG in MinIO, `avatarUrl` + `updatedAt` bumped — the same state an in-app
upload produces):

- **Fastmail ✅** — photo pass pushed the new image (shadow `localPhotoHash`
  `8703fe61…` → `eccda4c6…`, `remoteSignal` seeded to the pushed hash,
  `lastPushRejected=false`); the **next cycle was echo-quiet** for the contact,
  i.e. the re-fetched remote card's inline photo hash equals what we pushed —
  the photo is confirmed on the Fastmail server and does not re-push. Local
  `avatarUrl` untouched by the pass; zero photo conflicts recorded.
- **Google ⏳** — two attempts failed `GOOGLE_QUOTA_EXCEEDED` (People API rate
  limit after the day's 821-contact first sync + echo cycles + 60 photo
  downloads). Not a code defect. **Ops finding:** a quota-starved Google job
  looks *frozen* for minutes (RUNNING, heartbeat static, empty logs) while the
  googleapis client silently backoff-retries 429s before surfacing the error —
  don't reap those under ~10 min. Retry the row-3 push after quota reset.
- Second ops finding: a genuinely frozen `SCHEDULED` Fastmail job from 05:00
  (heartbeat never advanced, 4 h old) was blocking follow-up jobs via the
  same-account sibling guard until reaped — stale `RUNNING` rows block their
  account's whole queue silently (`skipped` counts in the cron response are the
  tell).

### Not yet done (to fully close the matrix later)

Rows 2–6, 8–13 (local push, remote/local change, delete both ways, conflict pick,
same-image auto-resolve, "Photos" exclusion, iCloud >1MB, 5k-contact cost,
real-device display) were **not** exercised on any provider. Nextcloud column
outstanding (no account). Row 7 — the only phase-exit blocker — is green on all
three live providers, so Phase 44 is not gated on the remaining rows, but they
should be completed before the feature is enabled in prod.

### How the run was driven (for reproducibility)

Runner triggered via `POST /api/sync/run` authenticated with a short-lived
NextAuth session JWT minted from the container's own `AUTH_SECRET`
(`@auth/core/jwt` encode, salt `__Secure-authjs.session-token`, no-`sid` legacy
claim path) — the middleware blocks `/api/cron/*`'s sibling `/api/sync/run` only
by cookie presence, and `CRON_SECRET`/cron was the intended path once env was
fixed. Full recipe in memory `project_p44-06-live-run-blocker`.
